'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export function ForceLogoutFix() {
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult(true);
          if (tokenResult.claims.aud !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
            console.warn(
              `Stale token detected for project ${tokenResult.claims.aud}. Expected ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}. Forcing logout.`
            );
            toast({
              title: 'Actualización de sesión requerida',
              description: 'Se ha cerrado tu sesión para actualizarla. Por favor, inicia sesión de nuevo.',
            });
            await auth.signOut();
            router.push('/login');
          }
        } catch (error) {
            console.error("Error verifying token, forcing logout.", error);
            await auth.signOut();
            router.push('/login');
        }
      }
    });

    return () => unsubscribe();
  }, [router, toast]);

  return null;
}
