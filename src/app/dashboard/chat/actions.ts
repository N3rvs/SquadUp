
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
    participants: string[];
    lastMessage?: {
        text: string;
        timestamp: any; // Firestore Timestamp
        senderId: string;
    }
    participantDetails: Record<string, ChatParticipant>;
    createdAt: any; // Firestore Timestamp
}

export interface ChatParticipantInfo {
    uid: string;
    displayName: string | null;
    avatarUrl?: string | null;
}


export async function getOrCreateChat(currentUserInfo: ChatParticipantInfo, friendInfo: ChatParticipantInfo): Promise<string> {
  if (!currentUserInfo.uid || !friendInfo.uid) {
    throw new Error("User IDs cannot be empty.");
  }

  const ids = [currentUserInfo.uid, friendInfo.uid].sort();
  const chatId = ids.join('_');

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    const participantDetails: Record<string, ChatParticipant> = {
      [currentUserInfo.uid]: {
        displayName: currentUserInfo.displayName || 'Usuario',
        avatarUrl: currentUserInfo.avatarUrl || '',
      },
      [friendInfo.uid]: {
        displayName: friendInfo.displayName || 'Usuario',
        avatarUrl: friendInfo.avatarUrl || '',
      },
    };

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
