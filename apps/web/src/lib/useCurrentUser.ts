'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, errorMessage } from './api-client';
import { authApi, type PublicUser } from './auth-api';

/**
 * Loads the logged-in user for a protected page and sends everyone else to
 * the right place:
 *   - not logged in                      -> /login
 *   - 'profile-complete' page, no type   -> /complete-profile
 *   - 'profile-incomplete' page, has type -> /dashboard
 *
 * This only decides what to SHOW. The real protection is the API, which checks
 * the login on every request.
 */
export function useCurrentUser(requirement: 'profile-complete' | 'profile-incomplete') {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        if (requirement === 'profile-complete' && !me.profileCompleted) return router.replace('/complete-profile');
        if (requirement === 'profile-incomplete' && me.profileCompleted) return router.replace('/dashboard');
        setUser(me);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        } else {
          setError(errorMessage(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requirement, router, pathname]);

  return { user, setUser, error };
}
