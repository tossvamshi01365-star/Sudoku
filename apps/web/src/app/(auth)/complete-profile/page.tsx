import { isAgeCheckRequired } from '../../../lib/settings';
import { CompleteProfileForm } from './CompleteProfileForm';

/** Shown once after the first Google sign-in, to choose book buyer or free player. */
export default async function CompleteProfilePage() {
  const ageRequired = await isAgeCheckRequired();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full mb-3 text-xl font-bold">
            👤
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Complete Your Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Just a couple of details before you begin the Sudoku challenge
          </p>
        </div>

        <CompleteProfileForm ageRequired={ageRequired} />
      </div>
    </main>
  );
}

