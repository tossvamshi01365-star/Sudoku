'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { errorMessage } from '../../../lib/api-client';
import { authApi, takeTokenFromUrlHash } from '../../../lib/auth-api';

export default function ResetPasswordPage() {
  // undefined = still reading the link, null = no token in the link.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // The token arrives in the link as #token=... (never sent to any server in the URL).
  useEffect(() => {
    setToken(takeTokenFromUrlHash());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!token) return;
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Set New Password</h1>
          <p className="text-sm text-slate-600 mt-1">Please enter your new strong password below</p>
        </div>

        {success ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <h2 className="font-semibold text-emerald-900">Password Updated!</h2>
            <p className="text-sm">
              Your password has been changed and you have been logged out on every device. Please log in with your new password.
            </p>
            <div className="pt-2">
              <Link href="/login" className="inline-block btn-success px-5 py-2.5 font-medium text-sm rounded-lg transition">
                Go to Login
              </Link>
            </div>
          </div>
        ) : token === null ? (
          <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-center space-y-4">
            <p className="text-sm leading-relaxed">This reset link is incomplete or invalid. Please request a new one.</p>
            <Link href="/forgot-password" className="inline-block btn-accent px-5 py-2.5 font-medium text-sm rounded-lg transition">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg p-3.5 leading-snug">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                New Password (min. 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="btn-accent w-full py-3 font-semibold text-sm rounded-lg shadow-sm transition"
            >
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>

            <div className="text-center text-xs text-slate-600 pt-2">
              <Link href="/login" className="link hover:underline">
                Cancel and return to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

