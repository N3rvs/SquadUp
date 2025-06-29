
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, writeBatch, Timestamp, getDoc, arrayUnion } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

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
        
        const appQuery = query(applicationsRef, 
            where("teamOwnerId", "==", userId), 
            where("status", "==", "pending"),
            where("type", "==", "application")
        );

        const inviteQuery = query(applicationsRef,
            where("userId", "==", userId),
            where("status", "==", "pending"),
            where("type", "==", "invite")
        );

        const [appSnapshot, inviteSnapshot] = await Promise.all([
            getDocs(appQuery),
            getDocs(inviteQuery)
        ]);
        
        const applications: Notification[] = appSnapshot.docs.map(doc => {
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
                createdAt: (appData.createdAt as Timestamp).toDate().toISOString(),
            };
        });

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
                createdAt: (inviteData.createdAt as Timestamp).toDate().toISOString(),
            };
        });

        const allNotifications = [...applications, ...invites];
        
        allNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return { success: true, notifications: allNotifications };

    } catch (error) {
        console.error("Error fetching notifications:", error);
        if (error instanceof Error && error.message.includes('composite index')) {
             return { success: false, error: 'Database requires a new index. Please check the browser console for a link to create it.' };
        }
        return { success: false, error: 'Failed to fetch notifications.' };
    }
}


export async function handleNotification(
  notificationId: string,
  userId: string, 
  teamId: string,
  decision: 'accept' | 'reject'
): Promise<{ success: boolean; error?: string; }> {
    try {
        const batch = writeBatch(db);
        const notificationRef = doc(db, "teamApplications", notificationId);

        if (decision === 'accept') {
            const teamRef = doc(db, "teams", teamId);
            const teamDoc = await getDoc(teamRef);
            if (!teamDoc.exists()) {
                return { success: false, error: "Team not found." };
            }
            const teamData = teamDoc.data();
            if (teamData.memberIds && teamData.memberIds.length >= 5) {
                batch.update(notificationRef, { status: "rejected", reason: "Team is full" });
                await batch.commit();
                return { success: false, error: "Team is already full. The notification has been rejected." };
            }

            batch.update(teamRef, {
                memberIds: arrayUnion(userId)
            });

            batch.update(notificationRef, { status: "accepted" });

        } else {
            batch.update(notificationRef, { status: "rejected" });
        }

        await batch.commit();
        
        revalidatePath('/dashboard', 'layout'); 
        return { success: true };

    } catch (error) {
        console.error(`Error handling notification ${decision}:`, error);
        return { success: false, error: `Failed to ${decision} notification.` };
    }
}
