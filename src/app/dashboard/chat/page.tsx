"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Search, MessageSquare, Loader2, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Friend } from '../friends/actions'; // Reuse type from friends
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, documentId, getDocs } from 'firebase/firestore';


type Message = {
  id: number;
  text: string;
  sender: 'me' | 'other';
};

type Contact = Friend & {
  lastMessage: string;
  messages: Message[];
};

function ChatSkeleton() {
    return (
        <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function ChatPage() {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedChat, setSelectedChat] = useState<Contact | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
             if (!currentUser) {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Real-time listener for friends list
    useEffect(() => {
        if (!user) {
            setContacts([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const userDocRef = doc(db, "users", user.uid);
        const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const friendIds = docSnap.data().friends || [];
                if (friendIds.length > 0) {
                     const friendsData: Friend[] = [];
                    for (let i = 0; i < friendIds.length; i += 10) {
                        const chunk = friendIds.slice(i, i + 10);
                        const friendsQuery = query(collection(db, "users"), where(documentId(), "in", chunk));
                        const friendsSnapshot = await getDocs(friendsQuery);
                        friendsSnapshot.forEach(doc => {
                            const data = doc.data();
                            friendsData.push({
                                uid: doc.id,
                                displayName: data.displayName,
                                avatarUrl: data.avatarUrl || '',
                            });
                        });
                    }

                    // Mocking chat history for now
                    const contactsWithMessages = friendsData.map(friend => ({
                        ...friend,
                        lastMessage: 'Click to start chatting...',
                        messages: [
                            { id: 1, text: `This is the beginning of your conversation with ${friend.displayName}.`, sender: 'other' }
                        ],
                    }));
                    setContacts(contactsWithMessages);

                } else {
                    setContacts([]);
                }
            } else {
                setContacts([]);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error listening to friend updates for chat:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not sync your contacts." });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        // When chat is selected, if its data in the main contacts list has changed, update it.
        if (selectedChat) {
            const updatedContactData = contacts.find(c => c.uid === selectedChat.uid);
            if(updatedContactData) {
                setSelectedChat(currentSelected => ({...updatedContactData, messages: currentSelected?.messages || updatedContactData.messages }));
            } else {
                // The friend was removed, so close the chat.
                setSelectedChat(null);
            }
        }
    }, [contacts, selectedChat]);

    useEffect(() => {
        scrollToBottom();
    }, [selectedChat?.messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !selectedChat) return;

        const message: Message = {
            id: Date.now(),
            text: newMessage,
            sender: 'me',
        };

        const updatedMessages = [...selectedChat.messages, message];
        const updatedChat = { ...selectedChat, messages: updatedMessages, lastMessage: newMessage };
        
        setSelectedChat(updatedChat);

        const updatedContacts = contacts.map(c => 
            c.uid === updatedChat.uid ? updatedChat : c
        );
        // Move updated chat to the top
        const finalContacts = [updatedChat, ...updatedContacts.filter(c => c.uid !== updatedChat.uid)];

        setContacts(finalContacts);
        setNewMessage('');
    };

    const me = {
        displayName: user?.displayName || 'Me',
        avatarUrl: user?.photoURL || ''
    }

  return (
    <div className="grid h-[calc(100vh-theme(spacing.24))] grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <Card className="md:col-span-1 lg:col-span-1 h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6"/> Chats
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search friends..." className="pl-8" />
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <CardContent className="p-2">
            {isLoading ? <ChatSkeleton /> : contacts.length > 0 ? (
                <div className="space-y-1">
                    {contacts.map((contact) => (
                    <button
                        key={contact.uid} 
                        className={cn(
                            "flex items-center gap-3 p-2 rounded-lg cursor-pointer text-left w-full", 
                            selectedChat?.uid === contact.uid ? 'bg-secondary' : 'hover:bg-secondary/50'
                        )}
                        onClick={() => setSelectedChat(contact)}
                    >
                        <Avatar>
                        <AvatarImage src={contact.avatarUrl} alt={contact.displayName} />
                        <AvatarFallback>{contact.displayName.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 truncate">
                        <p className="font-semibold">{contact.displayName}</p>
                        <p className="text-sm text-muted-foreground truncate">{contact.lastMessage}</p>
                        </div>
                    </button>
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground p-8">
                    <User className="h-10 w-10 mx-auto mb-2" />
                    <p className="font-semibold">No friends yet</p>
                    <p className="text-sm">Find players in the marketplace to start chatting.</p>
                     <Button asChild variant="link" className="mt-2">
                        <Link href="/dashboard/marketplace">Go to Marketplace</Link>
                    </Button>
                </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3 h-full flex flex-col">
        {selectedChat ? (
            <>
                <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                         <Avatar>
                            <AvatarImage src={selectedChat.avatarUrl} alt={selectedChat.displayName} />
                            <AvatarFallback>{selectedChat.displayName.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold">{selectedChat.displayName}</p>
                    </div>
                </CardHeader>
                <ScrollArea className="flex-1 p-4 space-y-4 bg-muted/20">
                {selectedChat.messages.map((message) => (
                    <div key={message.id} className={cn("flex items-end gap-2 w-full", message.sender === 'me' && "justify-end")}>
                        {message.sender === 'other' && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={selectedChat.avatarUrl} />
                                <AvatarFallback>{selectedChat.displayName.substring(0,2)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn("p-3 rounded-xl max-w-[70%]", message.sender === 'me' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-secondary rounded-bl-none' )}>
                            <p className="text-sm">{message.text}</p>
                        </div>
                         {message.sender === 'me' && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={me.avatarUrl} />
                                <AvatarFallback>{me.displayName.substring(0,2)}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
                </ScrollArea>
                <div className="p-4 border-t bg-background">
                <form onSubmit={handleSendMessage} className="relative">
                    <Input 
                        placeholder="Type a message..." 
                        className="pr-12" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                    <Send className="h-4 w-4" />
                    </Button>
                </form>
                </div>
            </>
        ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-4">
                <MessageSquare className="h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">Select a chat</h3>
                <p className="text-muted-foreground">Choose one of your friends to start a conversation.</p>
            </div>
        )}
      </Card>
    </div>
  );
}
