
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
  documentId,
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
    const allNotifications: Notification[] = [];

    // 1. Fetch Friend Requests
    try {
        const friendRequestQuery = query(
            collection(db, 'friendRequests'),
            where('to', '==', uid),
            where('status', '==', 'pending')
        );
        const friendRequestSnapshot = await getDocs(friendRequestQuery);
        const friendRequests = friendRequestSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                type: 'friendRequest',
                from_displayName: data.from_displayName,
                from_avatarUrl: data.from_avatarUrl,
                createdAt: data.createdAt,
            } as Notification;
        });
        allNotifications.push(...friendRequests);
    } catch (error) {
        console.warn("Could not fetch friend requests:", error);
    }

    // 2. Fetch Team Invites (user is invited to a team)
    try {
        const teamInviteQuery = query(
            collection(db, 'teamApplications'),
            where('userId', '==', uid),
            where('status', '==', 'pending'),
            where('type', '==', 'invite')
        );
        const teamInviteSnapshot = await getDocs(teamInviteQuery);
        const teamInvites = teamInviteSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                type: 'teamInvite',
                from_displayName: data.teamName,
                from_avatarUrl: data.teamLogoUrl,
                teamName: data.teamName,
                teamId: data.teamId,
                createdAt: data.createdAt,
            } as Notification;
        });
        allNotifications.push(...teamInvites);
    } catch (error) {
        console.warn("Could not fetch team invites:", error);
    }

    // 3. Fetch Team Applications (user is team owner)
    try {
        const teamApplicationQuery = query(
            collection(db, 'teamApplications'),
            where('teamOwnerId', '==', uid),
            where('status', '==', 'pending'),
            where('type', '==', 'application')
        );
        const teamApplicationSnapshot = await getDocs(teamApplicationQuery);

        if (!teamApplicationSnapshot.empty) {
            const userIdsToFetch = teamApplicationSnapshot.docs.map(doc => doc.data().userId).filter(Boolean);
            const userProfiles: { [key: string]: { displayName: string, avatarUrl?: string } } = {};
            
            if (userIdsToFetch.length > 0) {
                const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', userIdsToFetch.slice(0, 30)));
                const usersSnapshot = await getDocs(usersQuery);
                usersSnapshot.forEach(doc => {
                    userProfiles[doc.id] = {
                        displayName: doc.data().displayName,
                        avatarUrl: doc.data().avatarUrl
                    };
                });
            }

            const teamApplications: Notification[] = [];
            for (const appDoc of teamApplicationSnapshot.docs) {
                const data = appDoc.data();
                const userProfile = userProfiles[data.userId];
                if (userProfile) {
                    teamApplications.push({
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
            allNotifications.push(...teamApplications);
        }
    } catch (error) {
        console.warn("Could not fetch team applications (this is expected for non-team-owners).", error);
    }

    allNotifications.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    return { success: true, notifications: allNotifications };
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
