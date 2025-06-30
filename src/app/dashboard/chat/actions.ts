'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDoc,
  getDocs,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  documentId,
  updateDoc
} from 'firebase/firestore';

export interface ChatParticipant {
    displayName: string;
    avatarUrl?: string;
}

export interface Chat {
    id: string;
    participants: string[];
    lastMessage?: {
        text: string;
        timestamp: any; // Firestore Timestamp
        senderId: string;
    }
    participantDetails: Record<string, ChatParticipant>;
    createdAt: any; // Firestore Timestamp
}


export async function getOrCreateChat(currentUserId: string, friendId: string): Promise<string> {
  if (!currentUserId || !friendId) {
    throw new Error("User IDs cannot be empty.");
  }

  const ids = [currentUserId, friendId].sort();
  const chatId = ids.join('_');

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where(documentId(), 'in', ids));
    const usersSnap = await getDocs(q);
    const participantDetails: Record<string, ChatParticipant> = {};
    
    if (usersSnap.size !== 2) {
        console.error("Could not find both users for chat.", { ids });
        throw new Error("One or more chat participants could not be found.");
    }

    usersSnap.forEach(doc => {
        const data = doc.data();
        participantDetails[doc.id] = {
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
        }
    });

    await setDoc(chatRef, {
      participants: ids,
      participantDetails,
      createdAt: serverTimestamp(),
    });
  }

  return chatId;
}

export async function sendMessage(chatId: string, text: string, senderId: string) {
  if (!chatId || !text.trim() || !senderId) {
    return { success: false, error: 'Invalid data for sending message.' };
  }

  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatRef = doc(db, 'chats', chatId);

    const messageData = {
      text,
      senderId,
      timestamp: serverTimestamp(),
    };
    
    await addDoc(messagesRef, messageData);
    
    await updateDoc(chatRef, {
        lastMessage: messageData
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: 'Failed to send message.' };
  }
}
