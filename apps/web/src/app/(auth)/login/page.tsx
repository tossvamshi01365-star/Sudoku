'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleSignInButton } from '../../../components/GoogleSignInButton';
import { ApiError, errorMessage } from '../../../lib/api-client';
import { authApi, safeNextPath } from '../../../lib/auth-api';

/** Fixed messages for error codes in the URL. Text from the URL itself is never displayed. */
const URL_ERRORS: Record<string, string> = {
  google_failed: 'Google sign-in did not complete. Please try again.',
  google_mismatch: 'This email is already linked to a different Google account.',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('error');
    if (code && URL_ERRORS[code]) setFormError(URL_ERRORS[code]);
  }, [searchParams]);

  // Already logged in? Skip the login form.
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((user) => {
        if (!cancelled) router.replace(user.profileCompleted ? '/dashboard' : '/complete-profile');
      })
      .catch(() => {
        // Not logged in: stay on this page.
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);
    setNeedsVerification(false);

    if (!email.trim() || !password) {
      setFormError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), password);
      const next = res.user.profileCompleted ? safeNextPath(searchParams.get('next')) ?? res.next : '/complete-profile';
      router.push(next);
    } catch (err) {
      setFormError(errorMessage(err));
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') setNeedsVerification(true);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const res = await authApi.resendVerification(email.trim());
      setNeedsVerification(false);
      setFormError(null);
      setInfoMessage(res.message);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h1>
        <p className="text-sm text-slate-600 mt-1">Log in to continue your Sudoku challenge</p>
      </div>

      {formError && (
        <div role="alert" className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg p-3.5 leading-snug">
          {formError}
          {needsVerification && (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="link mt-2 block font-semibold hover:underline disabled:opacity-50"
            >
              Send me a new confirmation email
            </button>
          )}
        </div>
      )}

      {infoMessage && (
        <div role="status" className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg p-3.5 leading-snug">
          {infoMessage}
        </div>
      )}

      {/* Primary Action: Continue with Google */}
      <div className="mb-5">
        <GoogleSignInButton text="Continue with Google" />
      </div>

      {/* Divider */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <span className="relative bg-white px-3 text-xs uppercase tracking-wider text-slate-400">
          or continue with email
        </span>
      </div>

      {/* Secondary Action: Email & Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="link text-xs font-medium hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 font-semibold text-sm rounded-lg shadow-sm transition"
        >
          {loading ? 'Logging in...' : 'Log in with Email'}
        </button>

        <div className="text-center text-xs text-slate-600 pt-2">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="link font-semibold hover:underline">
            Create an account
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-500 text-sm">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
