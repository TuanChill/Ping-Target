'use client';

import { hasFirebaseWebConfig } from '@/config/env';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { getFirebaseClient } from '@/lib/firebase/client';

type FirebaseAuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue>({
  user: null,
  loading: true,
  configured: false,
  error: null
});

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasFirebaseWebConfig);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const firebase = getFirebaseClient();
    if (!firebase) {
      setLoading(false);

      return;
    }

    return onAuthStateChanged(
      firebase.auth,
      async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          setLoading(false);

          return;
        }

        try {
          await signInAnonymously(firebase.auth);
        } catch {
          setError('Không thể kết nối Firebase. Vui lòng thử tải lại trang.');
          setLoading(false);
        }
      },
      () => {
        setError('Không thể kiểm tra phiên làm việc. Vui lòng tải lại trang.');
        setLoading(false);
      }
    );
  }, []);

  return (
    <FirebaseAuthContext.Provider
      value={{ user, loading, configured: hasFirebaseWebConfig, error }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth(): FirebaseAuthContextValue {
  return useContext(FirebaseAuthContext);
}
