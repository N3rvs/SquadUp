'use server';

import { db, auth, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseErrorMessage } from '@/lib/firebase-errors';

export interface Notification {
  id: string;
  type: 'friendRequest' | 'teamApplication';
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

  try {
    const friendRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('to', '==', uid),
      where('status', '==', 'pending')
    );
    
    // To get team applications, we first need to find which teams the user owns.
    const userOwnedTeamsQuery = query(
        collection(db, 'teams'),
        where('ownerId', '==', uid)
    );
    const ownedTeamsSnapshot = await getDocs(userOwnedTeamsQuery);
    const ownedTeamIds = ownedTeamsSnapshot.docs.map(doc => doc.id);

    const friendRequestsPromise = getDocs(friendRequestsQuery);
    let teamApplicationsPromise = Promise.resolve({ docs: [] as any[] });
    
    if (ownedTeamIds.length > 0) {
        const teamApplicationsQuery = query(
            collection(db, 'teamApplications'),
            where('teamId', 'in', ownedTeamIds),
            where('status', '==', 'pending')
        );
        teamApplicationsPromise = getDocs(teamApplicationsQuery);
    }
    
    const [friendRequestsSnapshot, teamApplicationsSnapshot] = await Promise.all([
      friendRequestsPromise,
      teamApplicationsPromise,
    ]);

    const friendNotifications: Notification[] = friendRequestsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'friendRequest',
        from_displayName: data.from_displayName,
        from_avatarUrl: data.from_avatarUrl,
        createdAt: data.createdAt,
      };
    });

    const teamNotifications: Notification[] = teamApplicationsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'teamApplication',
        from_displayName: data.userName,
        from_avatarUrl: data.userAvatarUrl,
        teamName: data.teamName,
        teamId: data.teamId,
        createdAt: data.createdAt,
      };
    });

    const allNotifications = [...friendNotifications, ...teamNotifications]
        .sort((a, b) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis());
    
    return { success: true, notifications: allNotifications };

  } catch (error) {
    console.error("Error fetching notifications:", error);
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
