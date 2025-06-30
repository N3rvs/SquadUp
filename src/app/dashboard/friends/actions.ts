'use server';

import { db } from "@/lib/firebase";
import { collection, doc, getDoc, query, where, getDocs, Timestamp } from "firebase/firestore";

export interface Friend {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    primaryRole?: string;
}

export interface FriendRequest {
    id: string;
    from: string;
    sender?: {
        displayName: string;
        avatarUrl?: string;
    }
    createdAt: string;
}

export async function getFriendsList(userId: string): Promise<{ success: boolean; friends?: Friend[]; error?: string }> {
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

        const friendsData: Friend[] = [];
        // Fetch friends in chunks to avoid firestore limitations if the list grows
        for (let i = 0; i < friendIds.length; i += 10) {
            const chunk = friendIds.slice(i, i + 10);
            if (chunk.length > 0) {
                const friendsQuery = query(collection(db, "users"), where("uid", "in", chunk));
                const friendsSnapshot = await getDocs(friendsQuery);
                friendsSnapshot.forEach(doc => {
                    const data = doc.data();
                    friendsData.push({
                        uid: data.uid,
                        displayName: data.displayName,
                        avatarUrl: data.avatarUrl || '',
                        primaryRole: data.primaryRole || 'Player',
                    });
                });
            }
        }
        
        return { success: true, friends: friendsData };
    } catch (error) {
        console.error("Error fetching friends list:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "An unknown error occurred." };
    }
}


export async function getPendingFriendRequests(userId: string): Promise<{ success: boolean; requests?: FriendRequest[]; error?: string }> {
     if (!userId) {
        return { success: false, error: 'User not authenticated.' };
    }

    try {
        const friendRequestsRef = collection(db, "friendRequests");
        const friendRequestQuery = query(friendRequestsRef, where("to", "==", userId), where("status", "==", "pending"));
        const friendRequestSnapshot = await getDocs(friendRequestQuery);

        if (friendRequestSnapshot.empty) {
            return { success: true, requests: [] };
        }
        
        const senderIds = [...new Set(friendRequestSnapshot.docs.map(doc => doc.data().from))].filter(id => id);
        
        if (senderIds.length === 0) {
            return { success: true, requests: [] };
        }

        const usersRef = collection(db, "users");
        const sendersQuery = query(usersRef, where("uid", "in", senderIds));
        const sendersSnapshot = await getDocs(sendersQuery);
        const sendersData = new Map(sendersSnapshot.docs.map(doc => [doc.id, doc.data()]));

        const requests: FriendRequest[] = friendRequestSnapshot.docs.map(doc => {
            const requestData = doc.data();
            const senderInfo = sendersData.get(requestData.from);
            return {
                id: doc.id,
                from: requestData.from,
                sender: {
                    displayName: senderInfo?.displayName || 'Unknown User',
                    avatarUrl: senderInfo?.avatarUrl || '',
                },
                createdAt: requestData.createdAt instanceof Timestamp ? requestData.createdAt.toDate().toISOString() : new Date(0).toISOString(),
            };
        });

        return { success: true, requests };

    } catch (error) {
         console.error("Error fetching friend requests:", error);
         if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "An unknown error occurred." };
    }
}