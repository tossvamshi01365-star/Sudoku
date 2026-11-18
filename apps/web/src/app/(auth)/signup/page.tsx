import { isAgeCheckRequired } from '../../../lib/settings';
import { SignUpForm } from './SignUpForm';

export default async function SignUpPage() {
  const ageRequired = await isAgeCheckRequired();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <SignUpForm ageRequired={ageRequired} />
    </main>
  );
}
