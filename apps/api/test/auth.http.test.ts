import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { ACCESS_TTL_MS, buildTestSystem, FRONTEND } from './harness';

/**
 * A tiny "browser": keeps cookies between requests and sends the CSRF header,
 * the way the Next.js website will.
 */
class Browser {
  readonly cookies = new Map<string, string>();
  csrf?: string;

  constructor(private readonly base: string) {}

  async send(
    path: string,
    init: { method?: string; body?: unknown; origin?: string | null; withCsrf?: boolean; csrfOverride?: string } = {},
  ) {
    const method = init.method ?? 'POST';
    const csrf = init.csrfOverride ?? (init.withCsrf === false ? undefined : this.csrf);
    const res = await fetch(`${this.base}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        ...(init.origin === null ? {} : { origin: init.origin ?? FRONTEND }),
        ...(this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...(csrf && method !== 'GET' ? { 'x-csrf-token': csrf } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(header)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async fetchCsrf() {
    const res = await this.send('/api/auth/csrf', { method: 'GET' });
    this.csrf = ((await res.json()) as { csrfToken: string }).csrfToken;
  }

  async loginVerifiedUser(sys: ReturnType<typeof buildTestSystem>, email = 'reader@example.com') {
    await this.fetchCsrf();
    await this.send('/api/auth/register', { body: { ...signup, email } });
    await this.send('/api/auth/verify-email', { body: { token: sys.mailer.lastToken() } });
    const res = await this.send('/api/auth/login', { body: { email, password: 'correct-horse' } });
    this.csrf = ((await res.json()) as { csrfToken: string }).csrfToken;
    return res;
  }
}

let server: Server | undefined;

async function start() {
  const sys = buildTestSystem();
  server = sys.app.listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { sys, browser: new Browser(base), newBrowser: () => new Browser(base) };
}

afterEach(() => {
  server?.close();
  server = undefined;
});

const signup = { email: 'Reader@Example.com ', password: 'correct-horse', displayName: 'Reader', userType: 'free_player' };
const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe('email + password over HTTP', () => {
  it('register -> verify -> login sets httpOnly JWT + refresh cookies -> me -> logout', async () => {
    const { sys, browser } = await start();
    await browser.fetchCsrf();

    expect((await browser.send('/api/auth/register', { body: signup })).status).toBe(202);
    expect((await browser.send('/api/auth/verify-email', { body: { token: sys.mailer.lastToken() } })).status).toBe(200);

    const login = await browser.send('/api/auth/login', { body: { email: 'reader@example.com', password: 'correct-horse' } });
    expect(login.status).toBe(200);
    const body = (await login.json()) as { user: object; next: string; csrfToken: string };
    expect(body).toMatchObject({ user: { email: 'reader@example.com', profileCompleted: true }, next: '/dashboard' });
    expect(body.csrfToken).not.toBe(browser.csrf); // a fresh CSRF token after login
    browser.csrf = body.csrfToken;

    const setCookies = login.headers.getSetCookie();
    const access = setCookies.find((c) => c.startsWith('access_token='))!;
    const refresh = setCookies.find((c) => c.startsWith('refresh_token='))!;
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/Path=\//);
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/Path=\/api\/auth/);
    // The access token cookie lives 12 minutes.
    const expires = new Date(/Expires=([^;]+)/i.exec(access)![1]).getTime();
    expect(expires - sys.clock.ms).toBe(ACCESS_TTL_MS);

    const me = await browser.send('/api/auth/me', { method: 'GET' });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: object }).user).not.toHaveProperty('passwordHash');

    expect((await browser.send('/api/auth/logout')).status).toBe(200);
    expect(browser.cookies.has('access_token')).toBe(false);
    expect((await browser.send('/api/auth/me', { method: 'GET' })).status).toBe(401);
    expect(sys.refreshRepo.active()).toHaveLength(0);
  });

  it('rejects unexpected fields (only the needed data is accepted)', async () => {
    const { browser } = await start();
    await browser.fetchCsrf();
    const res = await browser.send('/api/auth/register', { body: { ...signup, proofStatus: 'verified' } });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('rejects a weak password with a clear message', async () => {
    const { browser } = await start();
    await browser.fetchCsrf();
    const res = await browser.send('/api/auth/register', { body: { ...signup, password: 'short' } });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toBe('Password must be at least 8 characters long.');
  });

  it('rate-limits repeated login attempts for the same email', async () => {
    const { browser } = await start();
    await browser.fetchCsrf();
    const attempt = () => browser.send('/api/auth/login', { body: { email: 'reader@example.com', password: 'wrong-password' } });
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });
});

describe('CSRF protection', () => {
  it('blocks a POST without the CSRF token, or with a wrong one', async () => {
    const { browser } = await start();
    await browser.fetchCsrf();

    const missing = await browser.send('/api/auth/login', { body: { email: 'a@b.co', password: 'x' }, withCsrf: false });
    expect(missing.status).toBe(403);
    expect(await errorCode(missing)).toBe('CSRF_TOKEN_INVALID');

    const wrong = await browser.send('/api/auth/login', { body: { email: 'a@b.co', password: 'x' }, csrfOverride: 'forged-token-value' });
    expect(wrong.status).toBe(403);
  });

  it('blocks a POST with a valid-looking header but no CSRF cookie (cross-site request)', async () => {
    const { browser, newBrowser } = await start();
    await browser.fetchCsrf();
    const attacker = newBrowser(); // no cookies from our site
    const res = await attacker.send('/api/auth/login', { body: { email: 'a@b.co', password: 'x' }, csrfOverride: browser.csrf });
    expect(res.status).toBe(403);
  });

  it('still blocks requests from other websites by Origin', async () => {
    const { browser } = await start();
    await browser.fetchCsrf();
    expect((await browser.send('/api/auth/login', { body: {}, origin: 'https://evil.example' })).status).toBe(403);
    expect((await browser.send('/api/auth/login', { body: {}, origin: null })).status).toBe(403);
  });

  it('returns the same CSRF token while the cookie is valid', async () => {
    const { browser } = await start();
    await browser.fetchCsrf();
    const first = browser.csrf;
    await browser.fetchCsrf();
    expect(browser.csrf).toBe(first);
  });
});

describe('access + refresh tokens', () => {
  it('the access token expires after 12 minutes and /refresh issues a new pair', async () => {
    const { sys, browser } = await start();
    await browser.loginVerifiedUser(sys);
    const firstRefresh = browser.cookies.get('refresh_token');

    sys.clock.advance(ACCESS_TTL_MS - 1000);
    expect((await browser.send('/api/auth/me', { method: 'GET' })).status).toBe(200);

    sys.clock.advance(2000);
    const expired = await browser.send('/api/auth/me', { method: 'GET' });
    expect(expired.status).toBe(401);
    expect(await errorCode(expired)).toBe('ACCESS_TOKEN_EXPIRED');

    const refreshed = await browser.send('/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(browser.cookies.get('refresh_token')).not.toBe(firstRefresh); // rotated
    expect((await browser.send('/api/auth/me', { method: 'GET' })).status).toBe(200);
  });

  it('detects a stolen refresh token: reusing an old one ends the whole login', async () => {
    const { sys, browser } = await start();
    await browser.loginVerifiedUser(sys);
    const stolen = browser.cookies.get('refresh_token')!;

    expect((await browser.send('/api/auth/refresh')).status).toBe(200); // the real user refreshes
    const current = browser.cookies.get('refresh_token')!;

    sys.clock.advance(60_000);
    browser.cookies.set('refresh_token', stolen); // the thief replays the old token
    const replay = await browser.send('/api/auth/refresh');
    expect(replay.status).toBe(401);
    expect(await errorCode(replay)).toBe('REFRESH_TOKEN_REUSED');

    browser.cookies.set('refresh_token', current); // even the newest token is now dead
    const after = await browser.send('/api/auth/refresh');
    expect(after.status).toBe(401);
    expect(await errorCode(after)).toBe('INVALID_REFRESH_TOKEN');
  });

  it('two tabs refreshing at the same moment do not log the user out', async () => {
    const { sys, browser } = await start();
    await browser.loginVerifiedUser(sys);
    const shared = browser.cookies.get('refresh_token')!;

    expect((await browser.send('/api/auth/refresh')).status).toBe(200); // tab 1
    const tab1Token = browser.cookies.get('refresh_token')!;

    browser.cookies.set('refresh_token', shared); // tab 2, a moment later, with the old cookie
    const tab2 = await browser.send('/api/auth/refresh');
    expect(tab2.status).toBe(401);
    expect(await errorCode(tab2)).toBe('REFRESH_IN_PROGRESS');

    browser.cookies.set('refresh_token', tab1Token);
    expect((await browser.send('/api/auth/refresh')).status).toBe(200); // still logged in
  });

  it('a password reset invalidates access tokens that were already issued', async () => {
    const { sys, browser } = await start();
    await browser.loginVerifiedUser(sys);
    const oldAccess = browser.cookies.get('access_token')!;

    await browser.send('/api/auth/forgot-password', { body: { email: 'reader@example.com' } });
    const reset = await browser.send('/api/auth/reset-password', { body: { token: sys.mailer.lastToken(), password: 'brand-new-password' } });
    expect(reset.status).toBe(200);

    browser.cookies.set('access_token', oldAccess);
    const me = await browser.send('/api/auth/me', { method: 'GET' });
    expect(me.status).toBe(401);
    expect(await errorCode(me)).toBe('NOT_AUTHENTICATED');
    expect(sys.refreshRepo.active()).toHaveLength(0);
  });

  it('refuses a tampered access token', async () => {
    const { sys, browser } = await start();
    await browser.loginVerifiedUser(sys);
    const [header, payload, signature] = browser.cookies.get('access_token')!.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...claims, sub: '00000000-0000-0000-0000-000000000000' })).toString('base64url');
    browser.cookies.set('access_token', `${header}.${forged}.${signature}`);
    expect((await browser.send('/api/auth/me', { method: 'GET' })).status).toBe(401);
  });
});

describe('public settings', () => {
  it('returns only whitelisted settings', async () => {
    const { browser } = await start();
    const res = await browser.send('/api/settings/public', { method: 'GET' });
    expect(res.status).toBe(200);
    const { settings } = (await res.json()) as { settings: Record<string, unknown> };
    expect(settings).toEqual({ brand_name: 'Vamshi Finance', per_puzzle_prize_usd: 1000 });
    expect(settings).not.toHaveProperty('admin_only_secret_setting');
  });
});

describe('Google sign-in over HTTP', () => {
  it('signs in with Google, then requires the profile choice', async () => {
    const { sys, browser } = await start();

    const startRes = await browser.send('/api/auth/google', { method: 'GET' });
    expect(startRes.status).toBe(302);
    expect(startRes.headers.get('location')).toContain('accounts.google.com');

    const callback = await browser.send('/api/auth/google/callback?code=good-code&state=fake-state-value', { method: 'GET' });
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe(`${FRONTEND}/complete-profile`);
    expect(sys.googleClient.lastCodeVerifier).toBe('fake-verifier');
    expect(browser.cookies.has('access_token')).toBe(true);

    await browser.fetchCsrf(); // the website does this after the redirect
    const done = await browser.send('/api/auth/complete-profile', { body: { displayName: 'Gamer', userType: 'book_buyer' } });
    expect(done.status).toBe(200);
    expect(((await done.json()) as { user: object }).user).toMatchObject({ userType: 'book_buyer', profileCompleted: true });

    const again = await browser.send('/api/auth/complete-profile', { body: { displayName: 'Gamer', userType: 'free_player' } });
    expect(again.status).toBe(409);
  });

  it('refuses a Google callback whose state does not match (login CSRF)', async () => {
    const { browser, newBrowser } = await start();
    await browser.send('/api/auth/google', { method: 'GET' });

    const forged = await browser.send('/api/auth/google/callback?code=good-code&state=attacker-state', { method: 'GET' });
    expect(forged.headers.get('location')).toBe(`${FRONTEND}/login?error=google_failed`);

    const noCookie = await newBrowser().send('/api/auth/google/callback?code=good-code&state=fake-state-value', { method: 'GET' });
    expect(noCookie.headers.get('location')).toBe(`${FRONTEND}/login?error=google_failed`);
  });
});
