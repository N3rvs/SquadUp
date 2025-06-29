
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, writeBatch, Timestamp, getDoc, arrayUnion } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

// Interface for the data returned
export interface ApplicationWithUser {
  appId: string;
  teamId: string;
  teamName: string;
  applicant: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

// Fetches pending applications for teams owned by the user
export async function getPendingApplications(userId: string): Promise<{ success: boolean; applications?: ApplicationWithUser[]; error?: string; }> {
    if (!userId) {
        return { success: false, error: 'User not authenticated.' };
    }

    try {
        const applicationsRef = collection(db, "teamApplications");
        const q = query(applicationsRef, where("teamOwnerId", "==", userId), where("status", "==", "pending"));
        
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return { success: true, applications: [] };
        }

        const applicantIds = [...new Set(querySnapshot.docs.map(doc => doc.data().userId))];
        
        if (applicantIds.length === 0) {
            return { success: true, applications: [] };
        }

        // Fetch user data directly using getDoc for better performance and to avoid potential security rule issues on list operations.
        const userPromises = applicantIds.map(id => getDoc(doc(db, "users", id)));
        const userDocSnapshots = await Promise.all(userPromises);
        
        const usersData = new Map();
        userDocSnapshots.forEach(docSnap => {
            if (docSnap.exists()) {
                usersData.set(docSnap.id, docSnap.data());
            }
        });


        const applications: ApplicationWithUser[] = querySnapshot.docs.map(doc => {
            const appData = doc.data();
            const applicantData = usersData.get(appData.userId);
            const createdAt = appData.createdAt instanceof Timestamp ? appData.createdAt.toDate() : new Date();

            return {
                appId: doc.id,
                teamId: appData.teamId,
                teamName: appData.teamName,
                applicant: {
                    uid: appData.userId,
                    displayName: applicantData?.displayName || 'Unknown User',
                    avatarUrl: applicantData?.avatarUrl || '',
                },
                createdAt: createdAt.toISOString(),
            };
        });
        
        // Sort by most recent
        applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return { success: true, applications };

    } catch (error) {
        console.error("Error fetching pending applications:", error);
        return { success: false, error: 'Failed to fetch applications.' };
    }
}


// Handles accepting or rejecting an application
export async function handleApplication(
  applicationId: string,
  applicantId: string,
  teamId: string,
  decision: 'accept' | 'reject'
): Promise<{ success: boolean; error?: string; }> {
    try {
        const batch = writeBatch(db);
        const applicationRef = doc(db, "teamApplications", applicationId);

        if (decision === 'accept') {
            const teamRef = doc(db, "teams", teamId);
            const teamDoc = await getDoc(teamRef);
            if (!teamDoc.exists()) {
                return { success: false, error: "Team not found." };
            }
            const teamData = teamDoc.data();
            if (teamData.memberIds && teamData.memberIds.length >= 5) {
                batch.update(applicationRef, { status: "rejected", reason: "Team is full" });
                await batch.commit();
                return { success: false, error: "Team is already full. The application has been rejected." };
            }

            // Add user to team members
            batch.update(teamRef, {
                memberIds: arrayUnion(applicantId)
            });

            // Update application status to 'accepted'
            batch.update(applicationRef, { status: "accepted" });

        } else { // 'reject'
            // Update application status to 'rejected'
            batch.update(applicationRef, { status: "rejected" });
        }

        await batch.commit();
        
        revalidatePath('/dashboard', 'layout'); 
        return { success: true };

    } catch (error) {
        console.error(`Error handling application ${decision}:`, error);
        return { success: false, error: `Failed to ${decision} application.` };
    }
}
