"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { respondToFriendRequest, removeFriend } from './actions';
import type { Friend, FriendRequest } from './actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, UserMinus, MessageSquare } from 'lucide-react';
import { ChatModal } from '@/components/chat-modal';
import { doc, getDocs, onSnapshot, collection, query, where, Timestamp, documentId } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


function PageSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-3/4" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-10 w-full max-w-sm" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-6 space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

type ChatUser = {
  uid: string;
  displayName: string;
  avatarUrl?: string;
};

export default function FriendsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    
    const [chattingWith, setChattingWith] = useState<Friend | null>(null);
    const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);
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

    // Listener for friends and friend requests
    useEffect(() => {
        if (!user) {
            setFriends([]);
            setRequests([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        // --- FRIENDS LISTENER ---
        const userDocRef = doc(db, "users", user.uid);
        const unsubscribeFriends = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const friendIds = docSnap.data().friends || [];
                if (friendIds.length > 0) {
                    // Fetch full profiles for friends in chunks of 10
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
                                primaryRole: data.primaryRole || 'Player',
                            });
                        });
                    }
                    setFriends(friendsData);
                } else {
                    setFriends([]);
                }
            } else {
                 setFriends([]);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error listening to friend updates:", error);
            toast({ variant: 'destructive', title: 'Error', description: "No se pudo sincronizar tu lista de amigos." });
            setIsLoading(false);
        });

        // --- FRIEND REQUESTS LISTENER ---
        const requestsQuery = query(collection(db, "friendRequests"), where("to", "==", user.uid), where("status", "==", "pending"));
        const unsubscribeRequests = onSnapshot(requestsQuery, async (snapshot) => {
            if (snapshot.empty) {
                setRequests([]);
                return;
            }

            const senderIds = [...new Set(snapshot.docs.map(doc => doc.data().from))].filter(id => id);
            
            if (senderIds.length === 0) {
                setRequests([]);
                return;
            }

            const usersRef = collection(db, "users");
            const sendersQuery = query(usersRef, where(documentId(), "in", senderIds));
            const sendersSnapshot = await getDocs(sendersQuery);
            const sendersData = new Map(sendersSnapshot.docs.map(doc => [doc.id, doc.data()]));

            const fetchedRequests: FriendRequest[] = snapshot.docs.map(doc => {
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
            setRequests(fetchedRequests);
        }, (error) => {
            console.error("Error listening to friend requests:", error);
            toast({ variant: 'destructive', title: 'Error', description: "No se pudieron sincronizar las solicitudes de amistad." });
        });

        return () => {
            unsubscribeFriends();
            unsubscribeRequests();
        };
    }, [user, toast]);

    const handleRespondToRequest = async (requestId: string, accept: boolean) => {
        setIsProcessing(requestId);
        const result = await respondToFriendRequest(requestId, accept);
        if (result.success) {
            toast({ title: '¡Decisión procesada!', description: `La solicitud ha sido ${accept ? 'aceptada' : 'rechazada'}.` });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsProcessing(null);
    };

    const handleRemoveFriend = async () => {
        if (!friendToRemove) return;
        
        setIsProcessing(friendToRemove.uid);
        const result = await removeFriend(friendToRemove.uid);
        if (result.success) {
            toast({ title: 'Amigo eliminado', description: `${friendToRemove.displayName} ya no está en tu lista de amigos.` });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setFriendToRemove(null);
        setIsProcessing(null);
    };

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    const currentUserProfile: ChatUser | null = user ? {
        uid: user.uid,
        displayName: user.displayName || "Me",
        avatarUrl: user.photoURL || "",
    } : null;

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Amigos</h1>
                <p className="text-muted-foreground">Gestiona tu lista de amigos y solicitudes pendientes.</p>
            </div>
            
            <Tabs defaultValue="friends" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="friends">Mis Amigos ({friends.length})</TabsTrigger>
                    <TabsTrigger value="requests">
                        Solicitudes Pendientes
                        {requests.length > 0 && <Badge className="ml-2">{requests.length}</Badge>}
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="friends" className="pt-4">
                    <Card>
                        <CardContent className="p-0">
                           {friends.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Rol</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {friends.map((friend) => (
                                        <TableRow key={friend.uid}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border">
                                                        <AvatarImage src={friend.avatarUrl} />
                                                        <AvatarFallback>{friend.displayName.substring(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <Link href={`/dashboard/profile/${friend.uid}`} className="font-medium hover:underline">
                                                        {friend.displayName}
                                                    </Link>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="outline">{friend.primaryRole}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => setChattingWith(friend)}>
                                                    <MessageSquare className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setFriendToRemove(friend)}>
                                                    <UserMinus className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                           ) : (
                                <div className="text-center p-10 text-muted-foreground">
                                    <p>Tu lista de amigos está vacía.</p>
                                    <p className="text-sm">¡Busca jugadores en el Marketplace para empezar a conectar!</p>
                                    <Button asChild variant="link" className="mt-2"><Link href="/dashboard/marketplace">Ir al Marketplace</Link></Button>
                                </div>
                           )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="requests" className="pt-4">
                     <Card>
                        <CardContent className="p-0">
                           {requests.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {requests.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border">
                                                        <AvatarImage src={request.sender?.avatarUrl} />
                                                        <AvatarFallback>{request.sender?.displayName.substring(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <Link href={`/dashboard/profile/${request.from}`} className="font-medium hover:underline">
                                                        {request.sender?.displayName}
                                                    </Link>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" className="mr-2" onClick={() => handleRespondToRequest(request.id, false)} disabled={isProcessing === request.id}>
                                                     {isProcessing === request.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                                                </Button>
                                                <Button size="sm" onClick={() => handleRespondToRequest(request.id, true)} disabled={isProcessing === request.id}>
                                                     {isProcessing === request.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                           ) : (
                                <div className="text-center p-10 text-muted-foreground">
                                    <p>No tienes solicitudes de amistad pendientes.</p>
                                </div>
                           )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            
            {chattingWith && currentUserProfile && (
                <ChatModal
                    isOpen={!!chattingWith}
                    onClose={() => setChattingWith(null)}
                    friend={chattingWith}
                    currentUser={currentUserProfile}
                />
            )}
            
             <AlertDialog open={!!friendToRemove} onOpenChange={(open) => !open && setFriendToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará a <span className="font-semibold">{friendToRemove?.displayName}</span> de tu lista de amigos. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveFriend}
                            disabled={!!isProcessing}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isProcessing === friendToRemove?.uid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sí, eliminar amigo
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
