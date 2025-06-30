
'use client';

import { db, auth, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { getFirebaseErrorMessage } from '@/lib/firebase-errors';

export interface Notification {
  id: string;
  type: 'friendRequest' | 'teamApplication' | 'teamInvite';
  from_displayName: string;
  from_avatarUrl?: string;
  teamName?: string;
  teamId?: string;
  createdAt: Timestamp;
}


export async function getPendingNotifications(): Promise<{ success: boolean; notifications?: Notification[]; error?: string; }> {
  if (!auth.currentUser) {
    return { success: false, error: "Not authenticated" };
  }
  const uid = auth.currentUser.uid;

  const fetchFriendRequests = async (): Promise<Notification[]> => {
    const q = query(
      collection(db, 'friendRequests'),
      where('to', '==', uid),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'friendRequest',
        from_displayName: data.from_displayName,
        from_avatarUrl: data.from_avatarUrl,
        createdAt: data.createdAt,
      };
    });
  };

  const fetchTeamInvites = async (): Promise<Notification[]> => {
    const q = query(
      collection(db, 'teamApplications'),
      where('userId', '==', uid),
      where('status', '==', 'pending'),
      where('type', '==', 'invite')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'teamInvite',
        from_displayName: data.teamName,
        from_avatarUrl: data.teamLogoUrl,
        teamName: data.teamName,
        teamId: data.teamId,
        createdAt: data.createdAt,
      };
    });
  };

  const fetchTeamApplications = async (): Promise<Notification[]> => {
    const q = query(
      collection(db, 'teamApplications'),
      where('teamOwnerId', '==', uid),
      where('status', '==', 'pending'),
      where('type', '==', 'application')
    );
    const snapshot = await getDocs(q);
    const applications: Notification[] = [];
    for (const appDoc of snapshot.docs) {
      const data = appDoc.data();
      const userProfileDoc = await getDoc(doc(db, 'users', data.userId));
      if (userProfileDoc.exists()) {
        const userProfile = userProfileDoc.data();
        applications.push({
          id: appDoc.id,
          type: 'teamApplication',
          from_displayName: userProfile.displayName,
          from_avatarUrl: userProfile.avatarUrl,
          teamName: data.teamName,
          teamId: data.teamId,
          createdAt: data.createdAt,
        });
      }
    }
    return applications;
  };
  
  try {
    const results = await Promise.allSettled([
      fetchFriendRequests(),
      fetchTeamInvites(),
      fetchTeamApplications(),
    ]);

    const allNotifications: Notification[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allNotifications.push(...result.value);
      } else {
        // This will log the permission error in the console for debugging,
        // but it won't crash the function for the user.
        const queryNames = ['friend requests', 'team invites', 'team applications'];
        console.warn(`Could not fetch ${queryNames[index]}:`, result.reason);
      }
    });
    
    allNotifications.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    
    return { success: true, notifications: allNotifications };
  } catch (error) {
    console.error("An unexpected error occurred while processing notifications:", error);
    return { success: false, error: getFirebaseErrorMessage(error) };
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
