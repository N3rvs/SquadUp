"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, onSnapshot, doc, getDoc, documentId, getDocs } from 'firebase/firestore';

import { respondToFriendRequestAction, removeFriendAction, type Friend, type FriendRequest } from './actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, UserPlus, Users, Check, X, MessageSquare, UserMinus } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setIsLoadingFriends(true);
            }
        });
        return () => unsubscribe();
    }, []);

    // Listener for friends list
    useEffect(() => {
        if (!user) return;

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, async (userDoc) => {
            setIsLoadingFriends(true);
            const friendIds = userDoc.data()?.friends || [];
            if (friendIds.length > 0) {
                const friendsQuery = query(collection(db, 'users'), where(documentId(), 'in', friendIds));
                const friendsSnapshot = await getDocs(friendsQuery);
                const fetchedFriends = friendsSnapshot.docs.map(d => ({ uid: d.id, ...d.data() } as Friend));
                setFriends(fetchedFriends);
            } else {
                setFriends([]);
            }
            setIsLoadingFriends(false);
        }, (error) => {
            console.error("Error fetching friends:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los amigos.' });
            setIsLoadingFriends(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    // Listener for incoming friend requests
    useEffect(() => {
        if (!user) return;

        const requestsQuery = query(collection(db, 'friendRequests'), where('to', '==', user.uid), where('status', '==', 'pending'));
        const unsubscribe = onSnapshot(requestsQuery, async (snapshot) => {
            const fromIds = snapshot.docs.map(doc => doc.data().from);

            if (fromIds.length === 0) {
                setIncomingRequests([]);
                return;
            }

            const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', fromIds));
            const usersSnapshot = await getDocs(usersQuery);
            const fromUsers = usersSnapshot.docs.map(d => ({ uid: d.id, ...d.data() } as Friend));

            const requests = snapshot.docs.map(doc => {
                const data = doc.data();
                const sender = fromUsers.find(u => u.uid === data.from);
                return {
                    id: doc.id,
                    from: data.from,
                    to: data.to,
                    status: data.status,
                    fromDisplayName: sender?.displayName || 'Usuario Desconocido',
                    fromAvatarUrl: sender?.avatarUrl,
                } as FriendRequest;
            });
            setIncomingRequests(requests);
        }, (error) => {
            console.error("Error fetching friend requests:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las solicitudes.' });
        });

        return () => unsubscribe();
    }, [user, toast]);
    
    const handleRespond = async (requestId: string, accept: boolean) => {
        setIsProcessing(requestId);
        const result = await respondToFriendRequestAction(requestId, accept);
        if (!result.success) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        // No need to refetch, onSnapshot will handle it.
        setIsProcessing(null);
    };

    const handleRemove = async (friendId: string) => {
        setIsProcessing(friendId);
        const result = await removeFriendAction(friendId);
        if (!result.success) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        // No need to refetch, onSnapshot will handle it.
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
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button asChild size="icon" variant="outline" disabled={true}>
                                                        <Link href={`/dashboard/chat?u=${friend.uid}`}><MessageSquare /></Link>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Chatear (Próximamente)</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
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
        </div>
    );
}
