
import { db, auth as clientAuth, functions } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  serverTimestamp,
  addDoc,
  documentId,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseErrorMessage } from '@/lib/firebase-errors';

export interface Friend {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    primaryRole?: string;
}

export interface FriendRequest {
    id: string;
    from: string;
    from_displayName: string;
    from_avatarUrl?: string;
    status: 'pending';
    createdAt: any;
}

export async function searchUsers(displayName: string, currentUserId: string) {
    if (!displayName) return { success: false, error: 'Search query is empty.' };
    try {
        const usersRef = collection(db, "users");
        const q = query(
            usersRef, 
            where("displayName", ">=", displayName), 
            where("displayName", "<=", displayName + '\uf8ff'),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs
            .map(doc => ({ uid: doc.id, ...doc.data() } as Friend))
            .filter(user => user.uid !== currentUserId); // Filter out the current user

        return { success: true, users };
    } catch (error) {
        console.error("Error searching users:", error);
        return { success: false, error: "Failed to search for users." };
    }
}

export async function sendFriendRequest(receiverId: string, senderId: string) {
    try {
        const senderDoc = await getDoc(doc(db, "users", senderId));
        if (!senderDoc.exists()) {
            return { success: false, error: "Sender profile not found." };
        }
        const senderData = senderDoc.data();

        // Check if a request already exists
        const q1 = query(collection(db, "friendRequests"), where("from", "==", senderId), where("to", "==", receiverId));
        const q2 = query(collection(db, "friendRequests"), where("from", "==", receiverId), where("to", "==", senderId));
        
        const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        if (!snapshot1.empty || !snapshot2.empty) {
            return { success: false, error: "A friend request already exists between you and this user." };
        }
        
        const requestData = {
            from: senderId,
            to: receiverId,
            from_displayName: senderData.displayName || 'Unknown User',
            from_avatarUrl: senderData.avatarUrl || '',
            status: 'pending',
            createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, "friendRequests"), requestData);

        return { success: true, message: "Friend request sent!" };
    } catch (error) {
        console.error("Error sending friend request:", error);
        return { success: false, error: getFirebaseErrorMessage(error) };
    }
}

export async function getFriends(uid: string): Promise<{ success: boolean; friends?: Friend[]; error?: string }> {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (!userDoc.exists() || !userDoc.data()?.friends || userDoc.data().friends.length === 0) {
            return { success: true, friends: [] };
        }
        
        const friendIds = userDoc.data().friends;
        const friendsRef = collection(db, "users");
        const q = query(friendsRef, where(documentId(), "in", friendIds));
        const querySnapshot = await getDocs(q);

        const friends = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            displayName: doc.data().displayName,
            avatarUrl: doc.data().avatarUrl,
            primaryRole: doc.data().primaryRole,
        } as Friend));

        return { success: true, friends };
    } catch (error) {
        console.error("Error getting friends:", error);
        return { success: false, error: "Failed to fetch friends." };
    }
}

export async function getFriendRequests(uid: string): Promise<{ success: boolean; requests?: FriendRequest[]; error?: string }> {
    try {
        const q = query(collection(db, "friendRequests"), where("to", "==", uid), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);

        const requests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
        return { success: true, requests };
    } catch (error) {
        console.error("Error getting friend requests:", error);
        return { success: false, error: "Failed to fetch friend requests." };
    }
}

export async function handleFriendRequest(requestId: string, accept: boolean) {
     if (!clientAuth.currentUser) {
        return { success: false, error: 'You must be logged in.' };
    }
    try {
        await clientAuth.currentUser.getIdToken(true);
        const processRequest = httpsCallable(functions, 'processFriendRequest');
        const result = await processRequest({ requestId, accept });
        return { success: true, data: result.data };
    } catch (error) {
        console.error("Error handling friend request:", error);
        return { success: false, error: getFirebaseErrorMessage(error) };
    }
}
