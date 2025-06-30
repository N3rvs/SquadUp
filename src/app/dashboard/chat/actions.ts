'use server';

import { db } from "@/lib/firebase";
import { collection, doc, getDoc, query, where, getDocs, limit } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";

export interface Friend {
    uid: string;
    displayName: string;
    avatarUrl?: string;
}

export async function getFriends(userId: string): Promise<{ success: boolean; friends?: Friend[]; error?: string }> {
    if (!userId) {
        return { success: false, error: "User not authenticated." };
    }

    try {
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            return { success: false, error: "User profile not found." };
        }

        const userData = userDoc.data();
        const friendIds = userData.friends || [];

        if (friendIds.length === 0) {
            return { success: true, friends: [] };
        }

        const friendsQuery = query(collection(db, "users"), where("uid", "in", friendIds), limit(30));
        const friendsSnapshot = await getDocs(friendsQuery);

        const friends = friendsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                uid: data.uid,
                displayName: data.displayName,
                avatarUrl: data.avatarUrl || '',
            };
        });

        return { success: true, friends };
    } catch (error) {
        console.error("Error fetching friends:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "An unknown error occurred." };
    }
}
