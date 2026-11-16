'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../lib/auth-api';
import { useCurrentUser } from '../../lib/useCurrentUser';

/**
 * The player's dashboard. The user is loaded from the API (which re-checks the
 * login on every request); visitors who are not logged in are sent to /login.
 */
export function DashboardView({ brandName }: { brandName: string }) {
  const router = useRouter();
  const { user, error } = useCurrentUser('profile-complete');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      // Even if the request failed, leave the private page.
      router.replace('/login');
    }
  };

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div role="alert" className="max-w-md bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg p-4">
          {error}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-slate-500">Loading your dashboard…</p>
      </main>
    );
  }

  const userTypeLabel =
    user.userType === 'book_buyer' ? 'Book Buyer (Per-puzzle + Grand Prize)' : 'Free Player (Grand Prize Only)';

  const proofStatusColor =
    user.proofStatus === 'verified'
      ? 'bg-emerald-100 text-emerald-800'
      : user.proofStatus === 'rejected'
      ? 'bg-rose-100 text-rose-800'
      : user.proofStatus === 'pending'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-100 text-slate-700';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="font-bold text-lg text-slate-900 tracking-tight">{brandName}</div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="btn-muted px-4 py-2 text-xs font-semibold rounded-lg transition disabled:opacity-50"
          >
            {loggingOut ? 'Logging out…' : 'Log Out'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Logged in as {user.email}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Welcome to your contest dashboard. Puzzle submission and proof upload features will be unlocked here in the next steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Display Name</div>
              <div className="text-base font-bold text-slate-900 mt-1">{user.displayName || user.email}</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Player Type</div>
              <div className="text-sm font-semibold text-slate-900 mt-1">{userTypeLabel}</div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Proof of Purchase Status</div>
              <div className="mt-1">
                <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wider ${proofStatusColor}`}>
                  {user.proofStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
