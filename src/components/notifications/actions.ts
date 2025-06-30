
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

export interface Notification {
  id: string;
  type: 'application' | 'invite';
  team: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  applicant?: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export async function getPendingNotifications(userId: string): Promise<{ success: boolean; notifications?: Notification[]; error?: string; }> {
    if (!userId) {
        return { success: false, error: 'User not authenticated.' };
    }

    try {
        const applicationsRef = collection(db, "teamApplications");
        
        // Find teams where the current user is the owner
        const teamsRef = collection(db, "teams");
        const userOwnedTeamsQuery = query(teamsRef, where("ownerId", "==", userId));
        const userOwnedTeamsSnapshot = await getDocs(userOwnedTeamsQuery);
        const ownedTeamIds = userOwnedTeamsSnapshot.docs.map(doc => doc.id);

        let applications: Notification[] = [];
        if (ownedTeamIds.length > 0) {
            const appQuery = query(applicationsRef, 
                where("teamId", "in", ownedTeamIds), 
                where("status", "==", "pending"),
                where("type", "==", "application")
            );
            const appSnapshot = await getDocs(appQuery);
            applications = appSnapshot.docs.map(doc => {
                const appData = doc.data();
                return {
                    id: doc.id,
                    type: 'application',
                    team: {
                        id: appData.teamId,
                        name: appData.teamName,
                    },
                    applicant: {
                        uid: appData.userId,
                        displayName: appData.userDisplayName || 'Unknown User',
                        avatarUrl: appData.userAvatarUrl || '',
                    },
                    createdAt: appData.createdAt instanceof Timestamp ? appData.createdAt.toDate().toISOString() : new Date(0).toISOString(),
                };
            });
        }


        const inviteQuery = query(applicationsRef,
            where("userId", "==", userId),
            where("status", "==", "pending"),
            where("type", "==", "invite")
        );

        const inviteSnapshot = await getDocs(inviteQuery);
        
        const invites: Notification[] = inviteSnapshot.docs.map(doc => {
            const inviteData = doc.data();
            return {
                id: doc.id,
                type: 'invite',
                team: {
                    id: inviteData.teamId,
                    name: inviteData.teamName,
                    logoUrl: inviteData.teamLogoUrl || '',
                },
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


export async function handleApplicationDecision(
  applicationId: string,
  decision: 'accept' | 'reject'
): Promise<{ success: boolean; error?: string; }> {
    try {
        const processAppFunc = httpsCallable(functions, 'processTeamApplication');
        await processAppFunc({ applicationId, approved: decision === 'accept' });
        
        return { success: true };

    } catch (error: any) {
        console.error(`Error handling application decision ${decision}:`, error);
        return { success: false, error: error.message || `An unknown error occurred while handling the application.` };
    }
}
