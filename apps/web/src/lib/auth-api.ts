import { api } from './api-client';
import { API_URL } from './config';

export type UserType = 'book_buyer' | 'free_player';
export type ProofStatus = 'none' | 'pending' | 'verified' | 'rejected';

/** The logged-in user, as returned by the API. Never contains passwords or tokens. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  userType: UserType | null;
  proofStatus: ProofStatus;
  isAgeConfirmed: boolean;
  profileCompleted: boolean;
}

type Message = { message: string };

/** One function per auth endpoint. Pages call these; they never call fetch directly. */
export const authApi = {
  /** Full-page navigation target that starts Google sign-in on the API. */
  googleSignInUrl: `${API_URL}/api/auth/google`,

  me: async () => (await api<{ user: PublicUser }>('/api/auth/me')).user,

  login: (email: string, password: string) =>
    api<{ user: PublicUser; next: string; csrfToken: string }>('/api/auth/login', { method: 'POST', body: { email, password } }),

  register: (input: { email: string; password: string; displayName: string; userType: UserType; isAgeConfirmed: boolean }) =>
    api<Message>('/api/auth/register', { method: 'POST', body: input }),

  logout: () => api<{ csrfToken: string }>('/api/auth/logout', { method: 'POST' }),

  verifyEmail: (token: string) => api<Message>('/api/auth/verify-email', { method: 'POST', body: { token } }),

  resendVerification: (email: string) => api<Message>('/api/auth/resend-verification', { method: 'POST', body: { email } }),

  forgotPassword: (email: string) => api<Message>('/api/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (token: string, password: string) =>
    api<Message>('/api/auth/reset-password', { method: 'POST', body: { token, password } }),

  completeProfile: async (input: { displayName: string; userType: UserType; isAgeConfirmed: boolean }) =>
    (await api<{ user: PublicUser }>('/api/auth/complete-profile', { method: 'POST', body: input })).user,
};

/**
 * Only allow redirects to our own pages after login (never to another site,
 * e.g. ?next=//evil.example).
 */
export function safeNextPath(next: string | null): string | null {
  const allowed = ['/dashboard', '/complete-profile'];
  return next && allowed.includes(next) ? next : null;
}

/** Reads `#token=...` from the URL, then removes it so it doesn't stay in the address bar or history. */
export function takeTokenFromUrlHash(): string | null {
  if (typeof window === 'undefined') return null;
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}
