"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, collection, query, where, documentId, getDocs } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Users } from 'lucide-react';
import type { Friend } from './../friends/actions';


export default function ChatPage() {
    const [user, setUser] = useState<User | null>(null);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchFriends = useCallback(async (userId: string) => {
        setIsLoading(true);
        try {
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                throw new Error('User not found');
            }
            const friendIds = userDocSnap.data().friends || [];

            if (friendIds.length > 0) {
                 const friendPromises = [];
                for (let i = 0; i < friendIds.length; i += 10) {
                    const batch = friendIds.slice(i, i + 10);
                    const q = query(collection(db, 'users'), where(documentId(), 'in', batch));
                    friendPromises.push(getDocs(q));
                }
                const friendSnapshots = await Promise.all(friendPromises);
                const fetchedFriends = friendSnapshots.flatMap(snap => snap.docs.map(d => ({ uid: d.id, ...d.data() } as Friend)));
                setFriends(fetchedFriends);
            } else {
                setFriends([]);
            }
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los amigos.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                fetchFriends(currentUser.uid);
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchFriends]);
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[calc(100vh-10rem)]">
            <Card className="md:col-span-1 flex flex-col">
                <CardHeader>
                    <CardTitle>Contactos</CardTitle>
                    <CardDescription>Selecciona un amigo para chatear.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <Skeleton className="h-5 w-3/4" />
                                </div>
                            ))}
                        </div>
                    ) : friends.length > 0 ? (
                        <div className="space-y-2">
                            {friends.map(friend => (
                                <Button key={friend.uid} variant="ghost" className="w-full justify-start h-12 gap-3">
                                    <Avatar className="h-9 w-9 border">
                                        <AvatarImage src={friend.avatarUrl} />
                                        <AvatarFallback>{friend.displayName.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span>{friend.displayName}</span>
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-sm text-muted-foreground pt-10">
                            <Users className="mx-auto h-10 w-10" />
                            <p className="mt-4">No tienes amigos para chatear.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card className="md:col-span-2 flex flex-col items-center justify-center text-center">
                 <CardContent>
                    <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h2 className="mt-6 text-2xl font-semibold">Selecciona un chat</h2>
                    <p className="mt-2 text-muted-foreground">La funcionalidad de chat está en desarrollo.</p>
                </CardContent>
            </Card>
        </div>
    );
}