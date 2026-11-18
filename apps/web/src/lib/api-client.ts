import { API_URL } from './config';

/**
 * Browser-side client for our API. It handles the security plumbing so pages
 * don't have to:
 *
 *  - Sends cookies (credentials: 'include'). The login tokens live in httpOnly
 *    cookies set by the API; this code never sees or stores them.
 *  - Adds the CSRF token (X-CSRF-Token header) to every POST, fetching it first
 *    if needed, and fetching a fresh one once if the API says it expired.
 *  - When the 12-minute access token has expired, calls /refresh ONCE (shared
 *    by all requests running at that moment) and retries the request.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The CSRF token is not a login secret, but it is kept only in memory (never in localStorage). */
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let refreshRequest: Promise<boolean> | null = null;

function rememberCsrfToken(token: unknown) {
  if (typeof token === 'string' && token.length > 0) csrfToken = token;
}

async function send(path: string, method: string, body?: unknown, csrf?: string): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'We could not reach the server. Please check your connection and try again.');
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = 'UNKNOWN_ERROR';
  let message = 'Something went wrong. Please try again.';
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    if (body.error?.code) code = body.error.code;
    if (body.error?.message) message = body.error.message;
  } catch {
    // Not JSON: keep the generic message.
  }
  return new ApiError(res.status, code, message);
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfRequest ??= (async () => {
    const res = await send('/api/auth/csrf', 'GET');
    if (!res.ok) throw await toApiError(res);
    rememberCsrfToken(((await res.json()) as { csrfToken?: string }).csrfToken);
    if (!csrfToken) throw new ApiError(500, 'CSRF_UNAVAILABLE', 'Could not start a secure session. Please reload the page.');
    return csrfToken;
  })().finally(() => {
    csrfRequest = null;
  });
  return csrfRequest;
}

/** @returns true if the browser now has fresh login cookies. */
function refreshSession(): Promise<boolean> {
  refreshRequest ??= (async () => {
    const res = await send('/api/auth/refresh', 'POST', undefined, await getCsrfToken());
    if (res.ok) return true;
    // Another tab refreshed a moment earlier; the shared cookies are already new.
    return (await toApiError(res)).code === 'REFRESH_IN_PROGRESS';
  })()
    .catch(() => false)
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

/**
 * When the access cookie expires (after 12 minutes) the browser deletes it, so
 * the API answers NOT_AUTHENTICATED instead of ACCESS_TOKEN_EXPIRED. Both mean
 * "try the refresh token".
 */
const REFRESHABLE = new Set(['ACCESS_TOKEN_EXPIRED', 'NOT_AUTHENTICATED']);

export async function api<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const attempt = async () => send(path, method, options.body, method === 'GET' ? undefined : await getCsrfToken());

  let res = await attempt();

  if (res.status === 401 || res.status === 403) {
    const error = await toApiError(res.clone());
    if (error.code === 'CSRF_TOKEN_INVALID') {
      csrfToken = null;
      res = await attempt();
    } else if (REFRESHABLE.has(error.code) && (await refreshSession())) {
      res = await attempt();
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;

  const data = (await res.json()) as T;
  // login and logout hand out a new CSRF token.
  if (data && typeof data === 'object' && 'csrfToken' in data) rememberCsrfToken((data as { csrfToken: unknown }).csrfToken);
  return data;
}

/** Friendly text for any error thrown by `api()`. */
export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}
