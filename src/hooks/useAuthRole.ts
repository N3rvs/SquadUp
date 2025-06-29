"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function useAuthRole() {
  const [role, setRole] = useState<'player' | 'moderator' | 'admin' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult(true);
          const userRole = (idTokenResult.claims.role as 'player' | 'moderator' | 'admin') || 'player';
          setRole(userRole);
        } catch (error) {
          console.error("Failed to get user role:", error);
          setRole('player');
        }
      } else {
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { role, isLoading };
}
