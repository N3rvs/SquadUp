
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Users, Loader2 } from 'lucide-react';
import { ChatWindow } from '@/components/chat-window';
import { getOrCreateChat } from './actions';
import type { Friend } from './../friends/actions';

interface ChatPreview extends Friend {
    lastMessage?: {
        text: string;
        timestamp: any;
        senderId: string;
    };
}

export default function ChatPage() {
    const [user, setUser] = useState<User | null>(null);
    const [chats, setChats] = useState<ChatPreview[]>([]);
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [selectedChat, setSelectedChat] = useState<{ friend: Friend, chatId: string } | null>(null);
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        if (!user) return;

        setIsLoadingChats(true);
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('participants', 'array-contains', user.uid), orderBy('lastMessage.timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedChats = snapshot.docs.map(doc => {
                const data = doc.data();
                const otherParticipantId = data.participants.find((p: string) => p !== user.uid);
                const participantDetails = data.participantDetails?.[otherParticipantId] || {};
                
                return {
                    uid: otherParticipantId,
                    displayName: participantDetails.displayName || 'Unknown User',
                    avatarUrl: participantDetails.avatarUrl,
                    lastMessage: data.lastMessage,
                };
            });
            setChats(fetchedChats);
            setIsLoadingChats(false);
        }, (error) => {
            console.error("Error fetching chats:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load your chats.' });
            setIsLoadingChats(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setIsLoadingChats(false);
                setChats([]);
                setSelectedChat(null);
            }
        });
        return () => unsubscribeAuth();
    }, []);
    
    useEffect(() => {
        const friendIdToChat = searchParams.get('u');
        
        const openChatWithFriend = async (friendId: string) => {
            if (!user) return;
            if (selectedChat?.friend.uid === friendId) return;

            setIsCreatingChat(true);
            try {
                const friendDocRef = doc(db, 'users', friendId);
                const friendDoc = await getDoc(friendDocRef);
                if (!friendDoc.exists()) {
                    toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
                    return;
                }
                const friendData = { ...friendDoc.data(), uid: friendId } as Friend;
                const chatId = await getOrCreateChat(user.uid, friendId);
                setSelectedChat({ friend: friendData, chatId });
            } catch(e) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not open chat.' });
            } finally {
                setIsCreatingChat(false);
                router.replace('/dashboard/chat', { scroll: false });
            }
        };

        if (friendIdToChat && user) {
            openChatWithFriend(friendIdToChat);
        }

    }, [searchParams, user, selectedChat?.friend.uid, toast, router]);

    const handleSelectChat = async (friend: Friend) => {
        if (!user) return;
        setIsCreatingChat(true);
        try {
            const chatId = await getOrCreateChat(user.uid, friend.uid);
            setSelectedChat({ friend, chatId });
        } catch(error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not open chat.'});
        } finally {
            setIsCreatingChat(false);
        }
    };
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[calc(100vh-10rem)]">
            <Card className="md:col-span-1 flex flex-col">
                <CardHeader>
                    <CardTitle>Conversaciones</CardTitle>
                    <CardDescription>Selecciona una conversación para chatear.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                    {isLoadingChats ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : chats.length > 0 ? (
                        <div className="space-y-1">
                             {chats.map(chat => (
                                <Button
                                    key={chat.uid}
                                    variant={selectedChat?.friend.uid === chat.uid ? 'secondary' : 'ghost'}
                                    className="w-full justify-start h-auto py-2 px-3 gap-3"
                                    onClick={() => handleSelectChat(chat)}
                                    disabled={isCreatingChat}
                                >
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={chat.avatarUrl} />
                                        <AvatarFallback>{chat.displayName.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 text-left overflow-hidden">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold truncate">{chat.displayName}</span>
                                            {chat.lastMessage?.timestamp && (
                                                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                                    {formatDistanceToNow(chat.lastMessage.timestamp.toDate(), { locale: es, addSuffix: true })}
                                                </span>
                                            )}
                                        </div>
                                        {chat.lastMessage ? (
                                            <p className="text-sm text-muted-foreground truncate">
                                                {chat.lastMessage.senderId === user?.uid && 'Tú: '}{chat.lastMessage.text}
                                            </p>
                                        ) : (
                                             <p className="text-sm text-muted-foreground italic">No hay mensajes aún.</p>
                                        )}
                                    </div>
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-sm text-muted-foreground pt-10">
                            <Users className="mx-auto h-10 w-10" />
                            <p className="mt-4">No tienes conversaciones.</p>
                             <Button asChild variant="link" className="mt-2"><Link href="/dashboard/friends">Encuentra a tus amigos para empezar.</Link></Button>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card className="md:col-span-2 flex flex-col">
                 {selectedChat && user ? (
                    <ChatWindow chatId={selectedChat.chatId} currentUserId={user.uid} />
                 ) : isCreatingChat ? (
                    <div className="flex flex-col items-center justify-center text-center h-full">
                        <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                        <h2 className="mt-6 text-2xl font-semibold">Abriendo Chat...</h2>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center text-center h-full p-4">
                        <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground" />
                        <h2 className="mt-6 text-2xl font-semibold">Selecciona una Conversación</h2>
                        <p className="mt-2 text-muted-foreground">Elige un amigo de la lista para empezar a chatear.</p>
                    </div>
                 )}
            </Card>
        </div>
    );
}
