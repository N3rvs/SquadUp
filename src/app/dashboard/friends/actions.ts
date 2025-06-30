import { db, functions, auth } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, query, where, getDocs, Timestamp, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

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

function getErrorMessage(error: any): string {
    if (error.code && error.message) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "La operación o el usuario no fue encontrado en el servidor.";
            default:
                return `Ocurrió un error con la función: ${error.message}`;
        }
    }
    return error.message || "An unknown error occurred.";
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

export async function getOutgoingFriendRequests(userId: string): Promise<{ success: boolean; requests?: { to: string }[]; error?: string }> {
    if (!userId) {
        return { success: false, error: 'User not authenticated.' };
    }
    try {
        const friendRequestsRef = collection(db, "friendRequests");
        const q = query(friendRequestsRef, where("from", "==", userId), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { success: true, requests: [] };
        }
        
        const requests = querySnapshot.docs.map(doc => ({ to: doc.data().to }));

        return { success: true, requests };
    } catch (error) {
         console.error("Error fetching outgoing friend requests:", error);
         if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "An unknown error occurred." };
    }
}

export async function respondToFriendRequest(
    requestId: string,
    decision: 'accept' | 'reject'
): Promise<{ success: boolean; error?: string; }> {
    if (!auth.currentUser) {
        return { success: false, error: "User not authenticated." };
    }
    
    try {
        await auth.currentUser.getIdToken(true);
        const respondToRequestFunc = httpsCallable(functions, 'respondToFriendRequest');
        await respondToRequestFunc({ requestId, decision });
        return { success: true };
    } catch (error: any) {
        console.error(`Error handling friend request decision ${decision}:`, error);
        return { success: false, error: getErrorMessage(error) };
    }
}


export async function removeFriend(
    friendId: string
): Promise<{ success: boolean; error?: string; }> {
     if (!auth.currentUser) {
        return { success: false, error: "User not authenticated." };
    }
    if (!friendId) {
        return { success: false, error: "Friend ID is required." };
    }
    try {
        await auth.currentUser.getIdToken(true);
        const unfriendUserFunc = httpsCallable(functions, 'unfriendUser');
        await unfriendUserFunc({ friendId });
        return { success: true };
    } catch (error: any) {
        console.error("Error removing friend:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}
