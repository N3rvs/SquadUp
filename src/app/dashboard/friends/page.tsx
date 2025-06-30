
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthRole } from '@/hooks/useAuthRole';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  searchUsers,
  sendFriendRequest,
  getFriends,
  getFriendRequests,
  handleFriendRequest,
  type Friend,
  type FriendRequest
} from './actions';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Search, UserPlus, Users, MessageSquare, Check, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatModal } from '@/components/chat-modal';
import { Badge } from '@/components/ui/badge';

function FriendList({ friends, onChat }: { friends: Friend[]; onChat: (friend: Friend) => void; }) {
    if (friends.length === 0) {
        return (
            <div className="text-center py-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">No tienes amigos</h3>
                <p className="text-muted-foreground">Usa la pestaña "Añadir Amigo" para buscar a otros jugadores.</p>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {friends.map(friend => (
                <Card key={friend.uid}>
                    <CardContent className="pt-6 flex flex-col items-center text-center">
                        <Avatar className="h-20 w-20 mb-4">
                            <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />
                            <AvatarFallback>{friend.displayName.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <h4 className="font-semibold">{friend.displayName}</h4>
                        <p className="text-sm text-muted-foreground capitalize">{friend.primaryRole}</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => onChat(friend)}>
                            <MessageSquare className="mr-2 h-4 w-4" /> Chat
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function AddFriend() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Friend[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        onAuthStateChanged(auth, setUser);
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim() || !user) return;
        setIsLoading(true);
        const result = await searchUsers(searchQuery, user.uid);
        if (result.success && result.users) {
            setSearchResults(result.users);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };

    const handleSendRequest = async (receiverId: string) => {
        if (!user) return;
        setIsSending(receiverId);
        const result = await sendFriendRequest(receiverId, user.uid);
        if (result.success) {
            toast({ title: 'Éxito', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSending(null);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <Input
                    placeholder="Buscar por nombre de usuario..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button type="submit" disabled={isLoading || !searchQuery.trim()}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
            </form>

            <div className="space-y-4">
                {searchResults.map(foundUser => (
                    <Card key={foundUser.uid}>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar>
                                    <AvatarImage src={foundUser.avatarUrl} alt={foundUser.displayName} />
                                    <AvatarFallback>{foundUser.displayName.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h4 className="font-semibold">{foundUser.displayName}</h4>
                                    <p className="text-sm text-muted-foreground capitalize">{foundUser.primaryRole}</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => handleSendRequest(foundUser.uid)}
                                disabled={isSending === foundUser.uid}
                            >
                                {isSending === foundUser.uid
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <UserPlus className="mr-2 h-4 w-4" />
                                }
                                Añadir
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function PendingRequests({ requests, onUpdateRequest }: { requests: FriendRequest[]; onUpdateRequest: () => void; }) {
    const { toast } = useToast();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleRequest = async (requestId: string, accept: boolean) => {
        setProcessingId(requestId);
        const result = await handleFriendRequest(requestId, accept);
        if (result.success) {
            toast({ title: 'Éxito', description: `Solicitud ${accept ? 'aceptada' : 'rechazada'}.` });
            onUpdateRequest();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setProcessingId(null);
    };

    if (requests.length === 0) {
        return (
            <div className="text-center py-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">No tienes solicitudes pendientes</h3>
            </div>
        );
    }
    
    return (
        <div className="space-y-3 max-w-2xl mx-auto">
            {requests.map(req => (
                 <Card key={req.id}>
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src={req.from_avatarUrl} />
                                <AvatarFallback>{req.from_displayName.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <p><span className="font-semibold">{req.from_displayName}</span> te ha enviado una solicitud.</p>
                        </div>
                        <div className="flex gap-2">
                             <Button size="icon" variant="outline" onClick={() => handleRequest(req.id, true)} disabled={!!processingId}>
                                {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-500" />}
                            </Button>
                             <Button size="icon" variant="destructive" onClick={() => handleRequest(req.id, false)} disabled={!!processingId}>
                                {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default function FriendsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [chatFriend, setChatFriend] = useState<Friend | null>(null);
    const { toast } = useToast();

    const fetchData = useCallback(async (uid: string) => {
        setIsLoading(true);
        const [friendsResult, requestsResult] = await Promise.all([
            getFriends(uid),
            getFriendRequests(uid)
        ]);

        if (friendsResult.success) {
            setFriends(friendsResult.friends || []);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: friendsResult.error });
        }

        if (requestsResult.success) {
            setRequests(requestsResult.requests || []);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: requestsResult.error });
        }
        setIsLoading(false);
    }, [toast]);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                fetchData(currentUser.uid);
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchData]);

    const handleOpenChat = (friend: Friend) => {
        setChatFriend(friend);
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }
    
    if (!user) {
        return <div>Debes iniciar sesión para ver a tus amigos.</div>
    }

    return (
        <div className="grid gap-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Amigos</h1>
                <p className="text-muted-foreground">Conecta y chatea con otros jugadores.</p>
            </div>
            <Tabs defaultValue="friends" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="friends">Mis Amigos</TabsTrigger>
                    <TabsTrigger value="requests">Solicitudes Pendientes <Badge className="ml-2">{requests.length}</Badge></TabsTrigger>
                    <TabsTrigger value="add">Añadir Amigo</TabsTrigger>
                </TabsList>
                <TabsContent value="friends" className="pt-4">
                    <FriendList friends={friends} onChat={handleOpenChat} />
                </TabsContent>
                <TabsContent value="requests" className="pt-4">
                    <PendingRequests requests={requests} onUpdateRequest={() => fetchData(user.uid)} />
                </TabsContent>
                <TabsContent value="add" className="pt-4">
                    <AddFriend />
                </TabsContent>
            </Tabs>
            {chatFriend && (
                <ChatModal
                    friend={chatFriend}
                    currentUser={user}
                    open={!!chatFriend}
                    onOpenChange={(open) => !open && setChatFriend(null)}
                />
            )}
        </div>
    );
}
