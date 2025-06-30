
'use server';

import { db, functions, auth } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, Timestamp, doc, getDoc, documentId, type DocumentData } from 'firebase/firestore';

export interface Notification {
  id: string;
  type: 'application' | 'invite' | 'friend_request';
  team?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  applicant?: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  };
  sender?: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

async function getTeamApplicationsForOwner(userId: string): Promise<Notification[]> {
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        console.warn("No user document found for owner, cannot fetch team applications.");
        return [];
    }

    const userData = userDocSnap.data();
    const ownedTeamIds = userData.ownedTeams || [];

    if (ownedTeamIds.length === 0) {
        return [];
    }
    
    try {
        const getAppsFunc = httpsCallable(functions, 'getTeamApplicationsInbox');
        const appPromises = ownedTeamIds.map(async (teamId: string) => {
            try {
                const result = await getAppsFunc({ teamId });
                return (result.data as any).applications as any[];
            } catch (error) {
                console.error(`Error fetching applications for team ${teamId}:`, error);
                return [];
            }
        });

        const allAppsNested = await Promise.all(appPromises);
        const allAppsFlat = allAppsNested.flat();
        
        const pendingApplications = allAppsFlat.filter(app => app && app.type === 'application' && app.status === 'pending');
        const applicantIds = pendingApplications.map(app => app.userId).filter(Boolean);

        if (applicantIds.length > 0) {
            const usersRef = collection(db, "users");
            const usersQuery = query(usersRef, where(documentId(), "in", applicantIds));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data()]));
            
            return pendingApplications.map(app => {
                const createdAt = app.createdAt?.seconds ? new Timestamp(app.createdAt.seconds, app.createdAt.nanoseconds).toDate() : new Date();
                const applicantData = usersData.get(app.userId) as DocumentData | undefined;

                return {
                    id: app.id,
                    type: 'application',
                    team: { id: app.teamId, name: app.teamName, logoUrl: app.teamLogoUrl || '' },
                    applicant: { 
                        uid: app.userId, 
                        displayName: applicantData?.displayName || 'Usuario Desconocido', 
                        avatarUrl: applicantData?.avatarUrl || '' 
                    },
                    createdAt: createdAt.toISOString(),
                };
            });
        }
        
        return [];
    } catch (error) {
        console.error("Error fetching team applications via callable function:", error);
        return [];
    }
}

async function getFriendRequestsForUser(userId: string): Promise<Notification[]> {
    const requestsRef = collection(db, "friendRequests");
    const q = query(requestsRef, where("to", "==", userId), where("status", "==", "pending"));
    const querySnapshot = await getDocs(q);

    const baseNotifications = querySnapshot.docs.map(requestDoc => ({
        doc: requestDoc,
        data: requestDoc.data()
    }));

    const fromUserIds = baseNotifications.map(n => n.data.from).filter(Boolean);
    
    if (fromUserIds.length === 0) {
        return [];
    }

    const usersRef = collection(db, "users");
    const usersQuery = query(usersRef, where(documentId(), "in", fromUserIds));
    const usersSnapshot = await getDocs(usersQuery);
    const usersData = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data()]));

    return baseNotifications.map(n => {
        const requestData = n.data;
        const createdAt = requestData.createdAt instanceof Timestamp ? requestData.createdAt.toDate() : new Date();
        const senderData = usersData.get(requestData.from) as DocumentData | undefined;

        return {
            id: n.doc.id,
            type: 'friend_request',
            sender: {
                uid: requestData.from,
                displayName: senderData?.displayName || 'Usuario Desconocido',
                avatarUrl: senderData?.avatarUrl || '',
            },
            createdAt: createdAt.toISOString(),
        };
    });
}


export async function getPendingNotifications(userId: string): Promise<{ success: boolean; notifications?: Notification[]; error?: string; }> {
    if (!userId) {
        return { success: false, error: 'User not authenticated.' };
    }

    try {
        const applicationsPromise = getTeamApplicationsForOwner(userId);
        const friendRequestsPromise = getFriendRequestsForUser(userId);

        const applicationsRef = collection(db, "teamApplications");
        const inviteQuery = query(applicationsRef, where("userId", "==", userId), where("status", "==", "pending"), where("type", "==", "invite"));
        const invitesPromise = getDocs(inviteQuery);
        
        const [applications, friendRequests, inviteSnapshot] = await Promise.all([
            applicationsPromise,
            friendRequestsPromise,
            invitesPromise
        ]);

        const invites: Notification[] = inviteSnapshot.docs.map(doc => {
            const inviteData = doc.data();
            const createdAt = inviteData.createdAt instanceof Timestamp ? inviteData.createdAt.toDate() : new Date();
            return {
                id: doc.id,
                type: 'invite',
                team: { id: inviteData.teamId, name: inviteData.teamName, logoUrl: inviteData.teamLogoUrl || '' },
                createdAt: createdAt.toISOString(),
            };
        });
        
        const allNotifications = [...applications, ...invites, ...friendRequests];
        allNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return { success: true, notifications: allNotifications };

    } catch (error) {
        console.error("Error fetching notifications:", error);
        if (error instanceof Error) {
            if (error.message.includes('composite index') || error.message.includes('requires an index')) {
                return { success: false, error: 'Database requires a new index. Please check the browser console for a link to create it.' };
            }
            return { success: false, error: `Failed to fetch notifications: ${error.message}` };
        }
        return { success: false, error: 'An unknown error occurred while fetching notifications.' };
    }
}

export async function handleApplicationDecision(applicationId: string, decision: 'accept' | 'reject'): Promise<{ success: boolean; error?: string; }> {
    try {
        const processAppFunc = httpsCallable(functions, 'processTeamApplication');
        await processAppFunc({ applicationId, approved: decision === 'accept' });
        return { success: true };
    } catch (error: any) {
        console.error(`Error handling application decision ${decision}:`, error);
        return { success: false, error: error.message || `An unknown error occurred while handling the application.` };
    }
}

export async function handleFriendRequestDecision(requestId: string, accept: boolean) {
    if (!auth.currentUser) {
        return { success: false, error: 'You must be logged in.' };
    }
    try {
        await auth.currentUser.getIdToken(true);
        const respond = httpsCallable(functions, 'respondToFriendRequest');
        await respond({ requestId, accept });
        return { success: true };
    } catch (error: any) {
        console.error('Error responding to friend request:', error);
        return { success: false, error: error.message || 'Ocurrió un error desconocido.' };
    }
}
