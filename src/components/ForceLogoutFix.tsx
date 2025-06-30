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
          // Hardcode the project ID check for robustness against stale tokens.
          if (tokenResult.claims.aud !== 'valorant-squadfinder') {
            console.warn(
              `Stale token detected for project ${tokenResult.claims.aud}. Expected 'valorant-squadfinder'. Forcing logout.`
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
            toast({
              title: 'Error de sesión',
              description: 'Hubo un problema al verificar tu sesión. Por favor, inicia sesión de nuevo.',
            });
            await auth.signOut();
            router.push('/login');
        }
      }
    });

    return () => unsubscribe();
  }, [router, toast]);

  return null;
}
