
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

  try {
    const allNotifications: Notification[] = [];

    // --- Friend Requests ---
    try {
      const friendRequestsQuery = query(
        collection(db, 'friendRequests'),
        where('to', '==', uid),
        where('status', '==', 'pending')
      );
      const friendRequestsSnapshot = await getDocs(friendRequestsQuery);
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
      allNotifications.push(...friendNotifications);
    } catch (error) {
      console.warn("Could not fetch friend requests:", error); // Log and continue
    }
    
    // --- Team Invites (for user) ---
    try {
      const teamInvitesQuery = query(
          collection(db, 'teamApplications'),
          where('userId', '==', uid),
          where('status', '==', 'pending'),
          where('type', '==', 'invite')
      );
      const teamInvitesSnapshot = await getDocs(teamInvitesQuery);
      const inviteNotifications: Notification[] = teamInvitesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'teamInvite',
          from_displayName: data.teamName, // For invites, sender is the team
          from_avatarUrl: data.teamLogoUrl,
          teamName: data.teamName,
          teamId: data.teamId,
          createdAt: data.createdAt,
        };
      });
      allNotifications.push(...inviteNotifications);
    } catch (error) {
      console.warn("Could not fetch team invites:", error);
    }

    // --- Team Applications (for owner) ---
    // This query is expected to fail for non-owners due to security rules.
    // By catching the error, we prevent it from crashing the entire function.
    try {
      const teamApplicationsQuery = query(
          collection(db, 'teamApplications'),
          where('teamOwnerId', '==', uid),
          where('status', '==', 'pending'),
          where('type', '==', 'application')
      );
      const teamApplicationsSnapshot = await getDocs(teamApplicationsQuery);
      const applicationNotifications: Notification[] = [];
      for (const appDoc of teamApplicationsSnapshot.docs) {
        const data = appDoc.data();
        const userProfileDoc = await getDoc(doc(db, 'users', data.userId));
        if (userProfileDoc.exists()) {
          const userProfile = userProfileDoc.data();
          applicationNotifications.push({
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
      allNotifications.push(...applicationNotifications);
    } catch (error) {
       // This is expected to fail for users who don't own teams, so we suppress the error in production.
       if (process.env.NODE_ENV === 'development') {
        console.log("Info: Could not fetch team applications for owner (this is expected for non-owners).", error);
       }
    }

    allNotifications.sort((a, b) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis());
    
    return { success: true, notifications: allNotifications };

  } catch (error) {
    // This outer catch is a fallback for other unexpected errors
    console.error("An unexpected error occurred while fetching notifications:", error);
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
