
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db, functions } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, onSnapshot, doc, documentId, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseErrorMessage } from '@/lib/firebase-errors';

import type { Friend, FriendRequest } from './actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Users, Check, X, MessageSquare, UserMinus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChatModal } from '@/components/chat-modal';


function LoadingSkeleton() {
    return (
        <div className="space-y-8">
            <Card>
                <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                         <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <Skeleton className="h-5 w-32" />
                            </div>
                            <div className="flex gap-2">
                                <Skeleton className="h-9 w-20" />
                                <Skeleton className="h-9 w-20" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <Skeleton className="h-5 w-32" />
                            </div>
                            <Skeleton className="h-9 w-24" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

export default function FriendsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const { toast } = useToast();
    const [chatWithFriend, setChatWithFriend] = useState<Friend | null>(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setIsLoadingFriends(false);
                setFriends([]);
                setIncomingRequests([]);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    // Combined listener for friends and requests
    useEffect(() => {
        if (!user) {
            // This is important to stop listeners when user logs out.
            setFriends([]);
            setIncomingRequests([]);
            setIsLoadingFriends(false);
            return; 
        }

        setIsLoadingFriends(true);

        // Listener for friends list
        const userDocRef = doc(db, 'users', user.uid);
        const friendsUnsubscribe = onSnapshot(userDocRef, async (userDoc) => {
            const friendIds = (userDoc.data()?.friends || []).filter((id: any): id is string => !!id);
            if (friendIds.length > 0) {
                const friendsQuery = query(collection(db, 'users'), where(documentId(), 'in', friendIds));
                const friendsSnapshot = await getDocs(friendsQuery);
                const fetchedFriends = friendsSnapshot.docs
                    .map(d => {
                        if (!d.id || !d.exists() || !d.data().displayName) return null;
                        return { uid: d.id, ...d.data() } as Friend;
                    })
                    .filter((f): f is Friend => f !== null);
                setFriends(fetchedFriends);
            } else {
                setFriends([]);
            }
            setIsLoadingFriends(false);
        }, (error) => {
            console.error("Error fetching friends:", error);
            // Don't toast on permission denied, it's expected on logout
            if (error.code !== 'permission-denied') {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los amigos.' });
            }
            setIsLoadingFriends(false);
        });

        // Listener for incoming friend requests
        const requestsQuery = query(collection(db, 'friendRequests'), where('to', '==', user.uid), where('status', '==', 'pending'));
        const requestsUnsubscribe = onSnapshot(requestsQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    from: data.from,
                    to: data.to,
                    status: data.status,
                    fromDisplayName: data.fromDisplayName || 'Usuario Desconocido',
                    fromAvatarUrl: data.fromAvatarUrl,
                } as FriendRequest;
            });
            setIncomingRequests(requests);
        }, (error) => {
            console.error("Error fetching friend requests:", error);
            if (error.code !== 'permission-denied') {
              toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las solicitudes.' });
            }
        });

        // Cleanup function
        return () => {
            friendsUnsubscribe();
            requestsUnsubscribe();
        };
    }, [user, toast]);
    
    const handleRespond = async (requestId: string, accept: boolean) => {
        if (!auth.currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: "Debes estar autenticado." });
            return;
        }
        setIsProcessing(requestId);
        try {
            await auth.currentUser.getIdToken(true);
            const respondToFriendRequest = httpsCallable(functions, 'respondToFriendRequest');
            await respondToFriendRequest({ requestId, accept });
            // The UI will update automatically via the onSnapshot listener
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: getFirebaseErrorMessage(error) });
        }
        setIsProcessing(null);
    };

    const handleRemove = async (friendId: string) => {
        if (!auth.currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: "Debes estar autenticado." });
            return;
        }
        setIsProcessing(friendId);
        try {
            await auth.currentUser.getIdToken(true);
            const removeFriend = httpsCallable(functions, 'removeFriend');
            const result = await removeFriend({ friendId: friendId });
            toast({ title: 'Éxito', description: (result.data as {message: string}).message });
             // The UI will update automatically via the onSnapshot listener
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: getFirebaseErrorMessage(error) });
        }
        setIsProcessing(null);
    }
    
    if (isLoadingFriends) {
        return <LoadingSkeleton />;
    }
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Amigos</h1>
                <p className="text-muted-foreground">Gestiona tus contactos y solicitudes de amistad.</p>
            </div>

            {incomingRequests.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Solicitudes de Amistad ({incomingRequests.length})</CardTitle>
                        <CardDescription>Otros jugadores quieren conectar contigo.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {incomingRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between">
                                <Link href={`/dashboard/profile/${req.from}`} className="flex items-center gap-3 hover:underline">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={req.fromAvatarUrl} />
                                        <AvatarFallback>{req.fromDisplayName.substring(0,2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{req.fromDisplayName}</span>
                                </Link>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" disabled={isProcessing === req.id} onClick={() => handleRespond(req.id, false)}>
                                        {isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                                    </Button>
                                    <Button size="sm" disabled={isProcessing === req.id} onClick={() => handleRespond(req.id, true)}>
                                        {isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Amigos ({friends.length})</CardTitle>
                    <CardDescription>Aquí están tus conexiones actuales.</CardDescription>
                </CardHeader>
                <CardContent>
                    {friends.length > 0 ? (
                        <div className="space-y-4">
                            {friends.map(friend => (
                                <div key={friend.uid} className="flex items-center justify-between">
                                    <Link href={`/dashboard/profile/${friend.uid}`} className="flex items-center gap-3 hover:underline">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarImage src={friend.avatarUrl} />
                                            <AvatarFallback>{friend.displayName.substring(0,2)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{friend.displayName}</span>
                                    </Link>
                                    <div className="flex gap-2">
                                        <Button 
                                            size="icon" 
                                            variant="outline" 
                                            onClick={() => {
                                                if (!friend?.uid) {
                                                    toast({
                                                        variant: 'destructive',
                                                        title: 'Error de Datos',
                                                        description: 'No se puede iniciar el chat, el ID del amigo no es válido.',
                                                    });
                                                    return;
                                                }
                                                setChatWithFriend(friend)
                                            }}
                                        >
                                            <MessageSquare />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="icon" variant="destructive" disabled={isProcessing === friend.uid}>
                                                    {isProcessing === friend.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserMinus />}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Eliminar a {friend.displayName}?</AlertDialogTitle>
                                                    <AlertDialogDescription>Esta acción no se puede deshacer. Dejarán de ser amigos.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRemove(friend.uid)}>Eliminar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-xl font-semibold">Tu lista de amigos está vacía</h3>
                            <p className="text-muted-foreground">Encuentra jugadores en el Marketplace para empezar a conectar.</p>
                            <Button asChild className="mt-4"><Link href="/dashboard/marketplace">Buscar Jugadores</Link></Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {chatWithFriend && user && (
                <ChatModal
                    friend={chatWithFriend}
                    currentUser={user}
                    open={!!chatWithFriend}
                    onOpenChange={(open) => {
                        if (!open) {
                            setChatWithFriend(null);
                        }
                    }}
                />
            )}
        </div>
    );
}
