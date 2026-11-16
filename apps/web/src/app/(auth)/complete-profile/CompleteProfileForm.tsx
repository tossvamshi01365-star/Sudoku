'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorMessage as describeError } from '../../../lib/api-client';
import { authApi } from '../../../lib/auth-api';
import { useCurrentUser } from '../../../lib/useCurrentUser';

interface CompleteProfileFormProps {
  ageRequired: boolean;
}

export function CompleteProfileForm({ ageRequired }: CompleteProfileFormProps) {
  const router = useRouter();
  // Sends visitors who are not logged in to /login, and finished profiles to /dashboard.
  const { user, error: loadError } = useCurrentUser('profile-incomplete');
  const [displayName, setDisplayName] = useState('');
  const [userType, setUserType] = useState<'book_buyer' | 'free_player'>('book_buyer');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Suggest the Google name (or the start of the email) as the display name.
  useEffect(() => {
    if (user) setDisplayName((current) => current || user.displayName || user.email.split('@')[0] || '');
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!displayName.trim() || displayName.trim().length < 2) {
      setErrorMessage('Please enter a display name (at least 2 characters).');
      return;
    }

    if (ageRequired && !isAgeConfirmed) {
      setErrorMessage('Please confirm that you are 18 years or older to participate.');
      return;
    }

    setLoading(true);
    try {
      await authApi.completeProfile({ displayName: displayName.trim(), userType, isAgeConfirmed });
      router.push('/dashboard');
    } catch (err) {
      setErrorMessage(describeError(err));
      setLoading(false);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg p-3.5 leading-snug">
        {loadError}
      </div>
    );
  }
  if (!user) {
    return <p className="text-center text-sm text-slate-500">Loading your account…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg p-3.5 leading-snug">
          {errorMessage}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
          Display Name
        </label>
        <input
          type="text"
          required
          minLength={2}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. SudokuPlayer"
          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
          Participation Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setUserType('book_buyer')}
            className={`p-3.5 rounded-xl border text-left transition ${
              userType === 'book_buyer'
                ? 'choice-card choice-card-selected ring-2'
                : 'choice-card'
            }`}
          >
            <div className="font-semibold text-sm text-slate-900">I bought the book</div>
            <div className="text-xs text-slate-500 mt-1 leading-snug">
              Eligible for $1,000 per-puzzle prizes & $1 billion grand prize
            </div>
          </button>

          <button
            type="button"
            onClick={() => setUserType('free_player')}
            className={`p-3.5 rounded-xl border text-left transition ${
              userType === 'free_player'
                ? 'choice-card choice-card-selected ring-2'
                : 'choice-card'
            }`}
          >
            <div className="font-semibold text-sm text-slate-900">Play free</div>
            <div className="text-xs text-slate-500 mt-1 leading-snug">
              Eligible for grand prize only (free puzzles)
            </div>
          </button>
        </div>
      </div>

      {/* Conditionally rendered age check based on settings */}
      {ageRequired && (
        <div className="flex items-start gap-2.5 pt-1">
          <input
            type="checkbox"
            id="completeAgeCheck"
            checked={isAgeConfirmed}
            onChange={(e) => setIsAgeConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label
            htmlFor="completeAgeCheck"
            className="text-xs text-slate-700 leading-snug cursor-pointer select-none"
          >
            I confirm that I am <strong>18 years of age or older</strong>.
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-accent w-full py-3 font-semibold text-sm rounded-lg shadow-sm transition"
      >
        {loading ? 'Saving Profile...' : 'Save & Continue to Dashboard'}
      </button>
    </form>
  );
}

