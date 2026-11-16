import { describe, expect, it } from 'vitest';
import { AppError } from '../src/common/errors/AppError';
import { buildTestSystem } from './harness';

const signup = { email: 'reader@example.com', password: 'correct-horse', displayName: 'Reader', userType: 'book_buyer' as const, isAgeConfirmed: false };

const errorCode = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppError) return err.code;
    throw err;
  }
  return 'NO_ERROR';
};

describe('email + password', () => {
  it('registers an unverified account, blocks login until the email is confirmed, then allows it', async () => {
    const sys = buildTestSystem();
    await sys.emailPassword.register(signup);

    const stored = await sys.users.findByEmail(signup.email);
    expect(stored?.passwordHash).toBe('hashed:correct-horse');
    expect(stored?.emailVerifiedAt).toBeNull();
    expect(await errorCode(sys.emailPassword.login(signup.email, signup.password))).toBe('EMAIL_NOT_VERIFIED');

    await sys.verification.verify(sys.mailer.lastToken());
    const user = await sys.emailPassword.login(signup.email, signup.password);
    expect(user.userType).toBe('book_buyer');
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    const sys = buildTestSystem();
    await sys.emailPassword.register(signup);
    await sys.verification.verify(sys.mailer.lastToken());

    expect(await errorCode(sys.emailPassword.login(signup.email, 'wrong-password'))).toBe('INVALID_CREDENTIALS');
    expect(await errorCode(sys.emailPassword.login('nobody@example.com', 'whatever'))).toBe('INVALID_CREDENTIALS');
  });

  it('does not create a second account for a registered email, and emails the owner instead', async () => {
    const sys = buildTestSystem();
    await sys.emailPassword.register(signup);
    await sys.verification.verify(sys.mailer.lastToken());

    await sys.emailPassword.register({ ...signup, password: 'attacker-password' });
    expect(sys.users.rows.size).toBe(1);
    expect(sys.mailer.last().subject).toContain('already have');
    expect((await sys.users.findByEmail(signup.email))?.passwordHash).toBe('hashed:correct-horse');
  });

  it('requires the 18+ confirmation only when the setting is on', async () => {
    const sys = buildTestSystem();
    sys.settings.ageCheckRequired = true;
    expect(await errorCode(sys.emailPassword.register(signup))).toBe('AGE_CONFIRMATION_REQUIRED');
    await sys.emailPassword.register({ ...signup, isAgeConfirmed: true });
    expect(sys.users.rows.size).toBe(1);
  });

  it('uses a verification link only once', async () => {
    const sys = buildTestSystem();
    await sys.emailPassword.register(signup);
    const token = sys.mailer.lastToken();
    await sys.verification.verify(token);
    expect(await errorCode(sys.verification.verify(token))).toBe('INVALID_OR_EXPIRED_TOKEN');
  });
});

describe('password reset', () => {
  it('sets a new password, logs out every session, and the link cannot be reused', async () => {
    const sys = buildTestSystem();
    await sys.emailPassword.register(signup);
    await sys.verification.verify(sys.mailer.lastToken());
    const user = await sys.emailPassword.login(signup.email, signup.password);
    await sys.sessions.start(user.id);
    await sys.sessions.start(user.id); // logged in on a second device
    expect(sys.refreshRepo.active()).toHaveLength(2);

    await sys.passwordReset.requestReset(signup.email);
    const token = sys.mailer.lastToken();
    await sys.passwordReset.resetPassword(token, 'brand-new-password');

    expect(sys.refreshRepo.active()).toHaveLength(0);
    expect((await sys.users.findById(user.id))?.tokensValidAfter).not.toBeNull();
    expect(await errorCode(sys.emailPassword.login(signup.email, signup.password))).toBe('INVALID_CREDENTIALS');
    await sys.emailPassword.login(signup.email, 'brand-new-password');
    expect(await errorCode(sys.passwordReset.resetPassword(token, 'another-password'))).toBe('INVALID_OR_EXPIRED_TOKEN');
  });

  it('sends nothing for an unknown email (and does not reveal it)', async () => {
    const sys = buildTestSystem();
    await sys.passwordReset.requestReset('nobody@example.com');
    expect(sys.mailer.sent).toHaveLength(0);
  });
});

describe('Google sign-in', () => {
  it('creates a verified account with no player type yet', async () => {
    const sys = buildTestSystem();
    const user = await sys.google.signIn(sys.googleClient.profile);
    expect(user.googleId).toBe('google-sub-1');
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.userType).toBeNull();
    expect(user.passwordHash).toBeNull();
  });

  it('returns the same account on the next sign-in', async () => {
    const sys = buildTestSystem();
    const first = await sys.google.signIn(sys.googleClient.profile);
    const second = await sys.google.signIn(sys.googleClient.profile);
    expect(second.id).toBe(first.id);
    expect(sys.users.rows.size).toBe(1);
  });

  it('links to an existing verified password account and keeps its password', async () => {
    const sys = buildTestSystem();
    await sys.emailPassword.register({ ...signup, email: 'gamer@example.com' });
    await sys.verification.verify(sys.mailer.lastToken());

    const user = await sys.google.signIn(sys.googleClient.profile);
    expect(user.googleId).toBe('google-sub-1');
    expect(user.passwordHash).toBe('hashed:correct-horse');
    expect(user.userType).toBe('book_buyer');
  });

  it('removes the password of an UNVERIFIED account with the same email (someone else may have set it)', async () => {
    const sys = buildTestSystem();
    await sys.emailPassword.register({ ...signup, email: 'gamer@example.com', password: 'squatter-password' });

    const user = await sys.google.signIn(sys.googleClient.profile);
    expect(user.passwordHash).toBeNull();
    expect(await errorCode(sys.emailPassword.login('gamer@example.com', 'squatter-password'))).toBe('INVALID_CREDENTIALS');
  });

  it('refuses a Google account whose email Google has not verified', async () => {
    const sys = buildTestSystem();
    expect(await errorCode(sys.google.signIn({ ...sys.googleClient.profile, emailVerified: false }))).toBe('GOOGLE_EMAIL_NOT_VERIFIED');
  });
});

describe('complete profile', () => {
  it('lets a Google user choose a player type exactly once', async () => {
    const sys = buildTestSystem();
    const user = await sys.google.signIn(sys.googleClient.profile);

    const updated = await sys.profiles.completeProfile(user.id, { displayName: 'Gamer', userType: 'free_player', isAgeConfirmed: false });
    expect(updated.userType).toBe('free_player');

    const again = sys.profiles.completeProfile(user.id, { displayName: 'Gamer', userType: 'book_buyer', isAgeConfirmed: false });
    expect(await errorCode(again)).toBe('PROFILE_ALREADY_COMPLETED');
    expect((await sys.users.findById(user.id))?.userType).toBe('free_player');
  });
});
