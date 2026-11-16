'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { errorMessage } from '../../../lib/api-client';
import { authApi, takeTokenFromUrlHash } from '../../../lib/auth-api';

type Status = 'checking' | 'confirmed' | 'failed';

/**
 * Opened from the "Confirm your email" link (/verify-email#token=...).
 * Confirms the email with the API, or lets the user request a new link.
 */
export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // React may run effects twice in development; the token can be used only once.
    if (started.current) return;
    started.current = true;

    const token = takeTokenFromUrlHash();
    if (!token) {
      setStatus('failed');
      setMessage('This confirmation link is incomplete or invalid.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus('confirmed');
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus('failed');
        setMessage(errorMessage(err));
      });
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      setResendMessage((await authApi.resendVerification(email.trim())).message);
    } catch (err) {
      setResendMessage(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Confirm Your Email</h1>
        </div>

        {status === 'checking' && <p className="text-center text-sm text-slate-500">Confirming your email…</p>}

        {status === 'confirmed' && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <p className="text-sm leading-relaxed">{message}</p>
            <Link href="/login" className="inline-block btn-success px-5 py-2.5 font-medium text-sm rounded-lg transition">
              Go to Login
            </Link>
          </div>
        )}

        {status === 'failed' && (
          <div className="space-y-5">
            <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg p-3.5 leading-snug">
              {message}
            </div>

            {resendMessage ? (
              <p role="status" className="text-sm text-slate-700">{resendMessage}</p>
            ) : (
              <form onSubmit={handleResend} className="space-y-4">
                <div>
                  <label htmlFor="resendEmail" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Send a new link to
                  </label>
                  <input
                    id="resendEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-accent w-full py-3 font-semibold text-sm rounded-lg shadow-sm transition"
                >
                  {loading ? 'Sending…' : 'Send a new confirmation link'}
                </button>
              </form>
            )}

            <div className="text-center text-xs text-slate-600">
              <Link href="/login" className="link font-semibold hover:underline">
                Back to login
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
