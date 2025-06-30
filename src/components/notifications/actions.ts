import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, Timestamp, doc, updateDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export interface Notification {
  id: string;
  type: 'application' | 'invite';
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
                return []; // Return empty array for a specific team if it fails
            }
        });

        const allAppsNested = await Promise.all(appPromises);
        const allAppsFlat = allAppsNested.flat();

        return allAppsFlat
            .filter(app => app && app.type === 'application' && app.status === 'pending')
            .map(app => {
                const createdAt = app.createdAt?.seconds ? new Timestamp(app.createdAt.seconds, app.createdAt.nanoseconds).toDate() : new Date();
                return {
                    id: app.id,
                    type: 'application',
                    team: { id: app.teamId, name: app.teamName, logoUrl: app.teamLogoUrl || '' },
                    applicant: { 
                        uid: app.userId, 
                        displayName: app.userDisplayName || 'Unknown User', 
                        avatarUrl: app.userAvatarUrl || '' 
                    },
                    createdAt: createdAt.toISOString(),
                };
            });
    } catch (error) {
        console.error("Error fetching team applications via callable function:", error);
        return [];
    }
}


export async function getPendingNotifications(userId: string): Promise<{ success: boolean; notifications?: Notification[]; error?: string; }> {
    if (!userId) {
        return { success: false, error: 'User not authenticated.' };
    }

    try {
        const applicationsRef = collection(db, "teamApplications");
        
        // 1. Get team applications for teams the user owns (SECURELY)
        const applications = await getTeamApplicationsForOwner(userId);

        // 2. Get team invites for the user
        const inviteQuery = query(applicationsRef, where("userId", "==", userId), where("status", "==", "pending"), where("type", "==", "invite"));
        const inviteSnapshot = await getDocs(inviteQuery);
        const invites: Notification[] = inviteSnapshot.docs.map(doc => {
            const inviteData = doc.data();
            return {
                id: doc.id,
                type: 'invite',
                team: { id: inviteData.teamId, name: inviteData.teamName, logoUrl: inviteData.teamLogoUrl || '' },
                createdAt: inviteData.createdAt instanceof Timestamp ? inviteData.createdAt.toDate().toISOString() : new Date(0).toISOString(),
            };
        });
        
        const allNotifications = [...applications, ...invites];
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
