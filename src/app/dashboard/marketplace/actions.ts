
'use server';

import { auth, db, functions } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { revalidatePath } from "next/cache";

// --- Friend Request Logic ---

export async function sendFriendRequest(senderId: string, receiverId: string) {
    if (!senderId) {
        return { success: false, error: "User not authenticated." };
    }

    if (senderId === receiverId) {
        return { success: false, error: "You cannot send a friend request to yourself." };
    }

    try {
        const sendFriendRequestFunc = httpsCallable(functions, 'sendFriendRequest');
        await sendFriendRequestFunc({ to: receiverId });
        return { success: true };
    } catch (error: any) {
        console.error("Error sending friend request:", error);
        if (error.code === 'already-exists') {
            return { success: false, error: "A friend request has already been sent." };
        }
        return { success: false, error: error.message || "An unknown error occurred while sending the friend request." };
    }
}


// --- Team Invite Logic ---

export async function getManagedTeams(managerId: string) {
    if (!managerId) {
        return { success: false, error: "Manager not authenticated." };
    }
    try {
        // A manager is a team owner for now. This can be expanded with roles.
        const teamsRef = collection(db, "teams");
        const q = query(teamsRef, where("ownerId", "==", managerId));
        const querySnapshot = await getDocs(q);
        
        const teams = querySnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
        }));
        
        return { success: true, teams };
    } catch (error) {
        console.error("Error fetching managed teams:", error);
        return { success: false, error: "Failed to fetch managed teams." };
    }
}


export async function sendTeamInvite(senderId: string, teamId: string, receiverId: string) {
    if (!senderId) {
        return { success: false, error: "User not authenticated." };
    }

    try {
        const teamDocRef = doc(db, "teams", teamId);
        const teamDoc = await getDoc(teamDocRef);

        if (!teamDoc.exists()) {
            return { success: false, error: "Team not found." };
        }
        
        const teamData = teamDoc.data();

        // Check permissions (must be owner, admin or mod)
        const userDoc = await getDoc(doc(db, "users", senderId));
        const userRole = userDoc.data()?.primaryRole;
        if (teamData.ownerId !== senderId && userRole !== 'admin' && userRole !== 'moderator') {
            return { success: false, error: "You don't have permission to invite players to this team." };
        }

        // Check if player is already in team
        if (teamData.memberIds?.includes(receiverId)) {
            return { success: false, error: "This player is already a member of the team." };
        }
        
        // Check for existing pending invite
        const invitesRef = collection(db, "teamApplications");
        const q = query(invitesRef, where("teamId", "==", teamId), where("receiverId", "==", receiverId), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return { success: false, error: "An invitation for this player to this team is already pending." };
        }

        // Create the invite
        await addDoc(collection(db, "teamApplications"), {
            teamId,
            userId: receiverId,
            teamName: teamData.name,
            teamLogoUrl: teamData.logoUrl || '',
            teamOwnerId: teamData.ownerId,
            type: 'invite', // To distinguish from an application
            status: "pending",
            createdAt: serverTimestamp(),
        });
        
        revalidatePath('/dashboard/marketplace');
        return { success: true };
    } catch (error) {
        console.error("Error sending team invite:", error);
        return { success: false, error: "An unknown error occurred while sending the invite." };
    }
}
