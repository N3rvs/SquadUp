
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, query, serverTimestamp, where, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import { revalidatePath } from "next/cache";

export async function applyToTeam(teamId: string, userId: string) {
    if (!userId) {
        return { success: false, error: "User not authenticated." };
    }

    try {
        const teamDocRef = doc(db, "teams", teamId);
        const userDocRef = doc(db, "users", userId);

        const [teamDoc, userDoc] = await Promise.all([
            getDoc(teamDocRef),
            getDoc(userDocRef)
        ]);

        if (!teamDoc.exists()) {
            return { success: false, error: "Team not found." };
        }
        if (!userDoc.exists()) {
            return { success: false, error: "Applicant profile not found." };
        }

        const teamData = teamDoc.data();
        const userData = userDoc.data();

        // Check if user is already a member
        if (teamData.memberIds?.includes(userId)) {
            return { success: false, error: "You are already a member of this team." };
        }

        // Check if user has already applied and it's pending
        const applicationsRef = collection(db, "teamApplications");
        const q = query(applicationsRef, where("teamId", "==", teamId), where("userId", "==", userId), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return { success: false, error: "You have already sent a pending application to this team." };
        }

        // Create application with denormalized user data
        await addDoc(collection(db, "teamApplications"), {
            teamId: teamId,
            teamName: teamData.name,
            teamOwnerId: teamData.ownerId,
            userId: userId,
            userDisplayName: userData.displayName,
            userAvatarUrl: userData.avatarUrl || '',
            status: "pending",
            createdAt: serverTimestamp(),
            type: 'application',
        });

        revalidatePath(`/dashboard/teams/${teamId}`);
        return { success: true };
    } catch (error) {
        console.error("Error applying to team:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "An unknown error occurred while applying." };
    }
}
