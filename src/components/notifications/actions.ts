
'use client';

import { db, auth, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseErrorMessage } from '@/lib/firebase-errors';

export interface Notification {
  id: string;
  type: 'friendRequest' | 'teamApplication' | 'teamInvite';
  from_displayName: string;
  from_avatarUrl?: string;
  teamName?: string;
  teamId?: string;
  createdAt: Date;
}


export async function getPendingNotifications(): Promise<{ success: boolean; notifications?: Notification[]; error?: string; }> {
    if (!auth.currentUser) {
        return { success: false, error: "Not authenticated" };
    }
    
    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/notifications', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch notifications');
        }

        const data = await response.json();
        const notifications = data.notifications.map((n: any) => ({
            ...n,
            createdAt: new Date(n.createdAt) // Convert timestamp from millis
        }));

        return { success: true, notifications };

    } catch (error: any) {
        console.error("Error fetching notifications via API:", error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}


export async function handleFriendRequestDecision(requestId: string, accept: boolean) {
    if (!auth.currentUser) {
        return { success: false, error: 'You must be logged in.' };
    }
    try {
        await auth.currentUser.getIdToken(true);
        const processRequest = httpsCallable(functions, 'processFriendRequest');
        const result = await processRequest({ requestId, accept });
        return { success: true, data: result.data };
    } catch (error) {
        return { success: false, error: getFirebaseErrorMessage(error) };
    }
}

export async function handleTeamApplicationDecision(applicationId: string, accept: boolean) {
     if (!auth.currentUser) {
        return { success: false, error: 'You must be logged in.' };
    }
    try {
        await auth.currentUser.getIdToken(true);
        const processApplication = httpsCallable(functions, 'processTeamApplication');
        const result = await processApplication({ applicationId, accept });
        return { success: true, data: result.data };
    } catch (error) {
        return { success: false, error: getFirebaseErrorMessage(error) };
    }
}
