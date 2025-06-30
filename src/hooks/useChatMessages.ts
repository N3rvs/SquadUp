'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
}

export function useChatMessages(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!chatId) {
        setMessages([]);
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMessages = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          senderId: data.senderId,
          timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
        };
      });
      setMessages(fetchedMessages);
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching messages:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  return { messages, isLoading };
}
