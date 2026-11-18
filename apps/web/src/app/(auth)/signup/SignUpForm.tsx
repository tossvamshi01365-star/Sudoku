'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GoogleSignInButton } from '../../../components/GoogleSignInButton';
import { errorMessage as describeError } from '../../../lib/api-client';
import { authApi } from '../../../lib/auth-api';

export function SignUpForm({ ageRequired }: { ageRequired: boolean }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'book_buyer' | 'free_player'>('book_buyer');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Browser-side validation
    if (!displayName.trim()) {
      setErrorMessage('Please enter your display name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (ageRequired && !isAgeConfirmed) {
      setErrorMessage('Please confirm that you are 18 years or older to participate.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        userType,
        isAgeConfirmed,
      });
      setSuccessMessage(res.message);
    } catch (err) {
      setErrorMessage(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Your Account</h1>
        <p className="text-sm text-slate-600 mt-1">Join the official Sudoku Challenge</p>
      </div>

      {successMessage ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ✓
          </div>
          <h2 className="font-semibold text-lg text-emerald-900">Check Your Email</h2>
          <p className="text-sm leading-relaxed">{successMessage}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block btn-success px-5 py-2.5 font-medium text-sm rounded-lg transition"
            >
              Go to Login
            </Link>
          </div>
        </div>
      ) : (
        <>
          {errorMessage && (
            <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg p-3.5 leading-snug">
              {errorMessage}
            </div>
          )}

          {/* Primary Action: Continue with Google */}
          <div className="mb-5">
            <GoogleSignInButton text="Sign up with Google" />
          </div>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <span className="relative bg-white px-3 text-xs uppercase tracking-wider text-slate-400">
              or register with email
            </span>
          </div>

          {/* Secondary Action: Email & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. SudokuMaster"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Password (min. 8 characters)
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

            {/* Participation Type */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Participation Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType('book_buyer')}
                  className={`p-3 rounded-xl border text-left transition ${
                    userType === 'book_buyer'
                      ? 'choice-card choice-card-selected ring-2'
                      : 'choice-card'
                  }`}
                >
                  <div className="font-semibold text-xs text-slate-900">I bought the book</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Per-puzzle prizes & grand prize
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUserType('free_player')}
                  className={`p-3 rounded-xl border text-left transition ${
                    userType === 'free_player'
                      ? 'choice-card choice-card-selected ring-2'
                      : 'choice-card'
                  }`}
                >
                  <div className="font-semibold text-xs text-slate-900">Play free</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Grand prize only
                  </div>
                </button>
              </div>
            </div>

            {/* Conditionally rendered Age Confirmation */}
            {ageRequired && (
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="signupAgeCheck"
                  checked={isAgeConfirmed}
                  onChange={(e) => setIsAgeConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="signupAgeCheck"
                  className="text-xs text-slate-700 leading-snug cursor-pointer select-none"
                >
                  I confirm that I am <strong>18 years of age or older</strong>.
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 font-semibold text-sm rounded-lg shadow-sm transition"
            >
              {loading ? 'Creating Account...' : 'Create Account with Email'}
            </button>

            <div className="text-center text-xs text-slate-600 pt-2">
              Already have an account?{' '}
              <Link href="/login" className="link font-semibold hover:underline">
                Log in
              </Link>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

