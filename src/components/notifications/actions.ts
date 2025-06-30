
import { db, auth, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
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
    const friendRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('to', '==', uid),
      where('status', '==', 'pending')
    );
    
    const teamInvitesQuery = query(
        collection(db, 'teamApplications'),
        where('userId', '==', uid),
        where('status', '==', 'pending'),
        where('type', '==', 'invite')
    );

    // This query now directly checks for applications to teams owned by the current user.
    // This is more efficient and aligns with Firestore security rules, preventing permission errors.
    const teamApplicationsQuery = query(
        collection(db, 'teamApplications'),
        where('teamOwnerId', '==', uid),
        where('status', '==', 'pending'),
        where('type', '==', 'application')
    );
    
    const [
      friendRequestsSnapshot,
      teamInvitesSnapshot,
      teamApplicationsSnapshot
    ] = await Promise.all([
      getDocs(friendRequestsQuery),
      getDocs(teamInvitesQuery),
      getDocs(teamApplicationsQuery),
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

    const inviteNotifications: Notification[] = teamInvitesSnapshot.docs.map(doc => {
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

    const allNotifications = [...friendNotifications, ...inviteNotifications, ...applicationNotifications]
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
