'use server';

import { auth, db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore';

// Types
export interface FriendRequest {
    id: string;
    from: string;
    fromDisplayName: string;
    fromAvatarUrl?: string;
    to: string;
    status: 'pending' | 'accepted' | 'rejected';
}

export interface Friend {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    primaryRole?: string;
}

// Action wrappers for Cloud Functions
export async function sendFriendRequestAction(toId: string) {
    if (!auth.currentUser || auth.currentUser.uid === toId) {
        return { success: false, error: 'Acción no válida.' };
    }
    try {
        const sendRequest = httpsCallable(functions, 'sendFriendRequest');
        await sendRequest({ to: toId });
        return { success: true };
    } catch (error: any) {
        console.error('Error sending friend request:', error);
        return { success: false, error: error.message || 'Ocurrió un error desconocido.' };
    }
}

export async function respondToFriendRequestAction(requestId: string, accept: boolean) {
    try {
        const respond = httpsCallable(functions, 'respondToFriendRequest');
        await respond({ requestId, accept });
        return { success: true };
    } catch (error: any) {
        console.error('Error responding to friend request:', error);
        return { success: false, error: error.message || 'Ocurrió un error desconocido.' };
    }
}

export async function removeFriendAction(friendId: string) {
    try {
        const removeFriend = httpsCallable(functions, 'removeFriend');
        await removeFriend({ friendId });
        return { success: true };
    } catch (error: any) {
        console.error('Error removing friend:', error);
        return { success: false, error: error.message || 'Ocurrió un error desconocido.' };
    }
}

// Data fetching function for the friends page
export async function getFriendsPageData(userId: string): Promise<{
    friends: Friend[];
    incomingRequests: FriendRequest[];
    outgoingRequests: FriendRequest[];
    error?: string;
}> {
    try {
        // 1. Get user's friend list
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            throw new Error('User not found');
        }
        const friendIds = userDocSnap.data().friends || [];

        // 2. Fetch friend profiles
        let friends: Friend[] = [];
        if (friendIds.length > 0) {
            // Firestore 'in' queries are limited to 30 elements in latest versions. We will chunk in 10s to be safe.
            const friendPromises = [];
            for (let i = 0; i < friendIds.length; i += 10) {
                const batch = friendIds.slice(i, i + 10);
                const q = query(collection(db, 'users'), where(documentId(), 'in', batch));
                friendPromises.push(getDocs(q));
            }
            const friendSnapshots = await Promise.all(friendPromises);
            friends = friendSnapshots.flatMap(snap => snap.docs.map(d => ({ uid: d.id, ...d.data() } as Friend)));
        }

        // 3. Fetch incoming friend requests
        const incomingQuery = query(collection(db, 'friendRequests'), where('to', '==', userId), where('status', '==', 'pending'));
        const incomingSnapshot = await getDocs(incomingQuery);
        const incomingRequestsData = incomingSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const fromIds = [...new Set(incomingRequestsData.map(req => req.from))];
        let fromUsers: Friend[] = [];
        if (fromIds.length > 0) {
            // Use documentId() for querying by UID, as UID is the document ID in 'users' collection
             const fromUsersQuery = query(collection(db, 'users'), where(documentId(), 'in', fromIds));
             const fromUsersSnapshot = await getDocs(fromUsersQuery);
             fromUsers = fromUsersSnapshot.docs.map(d => ({ uid: d.id, ...d.data() } as Friend));
        }

        const incomingRequests = incomingRequestsData.map(req => {
            const sender = fromUsers.find(u => u.uid === req.from);
            return {
                id: req.id,
                from: req.from,
                to: req.to,
                status: req.status,
                fromDisplayName: sender?.displayName || 'Usuario Desconocido',
                fromAvatarUrl: sender?.avatarUrl,
            };
        }) as FriendRequest[];


        // 4. Fetch outgoing friend requests
        const outgoingQuery = query(collection(db, 'friendRequests'), where('from', '==', userId), where('status', '==', 'pending'));
        const outgoingSnapshot = await getDocs(outgoingQuery);
        const outgoingRequests = outgoingSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FriendRequest[];

        return { friends, incomingRequests, outgoingRequests };
    } catch (error: any) {
        console.error("Error fetching friends data:", error);
        return { friends: [], incomingRequests: [], outgoingRequests: [], error: error.message };
    }
}