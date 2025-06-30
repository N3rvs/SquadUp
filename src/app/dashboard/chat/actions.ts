
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDoc,
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
    members: string[]; // Changed from participants
    lastMessage?: {
        text: string;
        timestamp: any; // Firestore Timestamp
        senderId: string;
    }
    // No longer storing participantDetails directly in chat doc for this model
    createdAt: any; // Firestore Timestamp
}

export interface ChatParticipantInfo {
    uid: string;
    displayName: string | null;
    avatarUrl?: string | null;
}


export async function getOrCreateChat(currentUserUid: string, friendUid: string): Promise<string> {
  if (!currentUserUid || !friendUid) {
    throw new Error("User IDs cannot be empty.");
  }

  const ids = [currentUserUid, friendUid].sort();
  const chatId = ids.join('_');

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    // Create a chat with just the members array
    await setDoc(chatRef, {
      members: ids,
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
    
    // Update the lastMessage field for chat list previews
    await updateDoc(chatRef, {
        lastMessage: messageData
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: 'Failed to send message.' };
  }
}
