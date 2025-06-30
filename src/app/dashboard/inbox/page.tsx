'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import Link from 'next/link';

import {
  getPendingNotifications,
  handleFriendRequestDecision,
  handleTeamApplicationDecision,
  type Notification,
} from '@/components/notifications/actions';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Check, X, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getFirebaseErrorMessage } from '@/lib/firebase-errors';

function NotificationCard({ notification, onUpdate }: { notification: Notification, onUpdate: () => void }) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleDecision = async (accept: boolean) => {
        setIsProcessing(true);
        let result;
        if (notification.type === 'friendRequest') {
            result = await handleFriendRequestDecision(notification.id, accept);
        } else {
            result = await handleTeamApplicationDecision(notification.id, accept);
        }

        if (result.success) {
            toast({ title: "Éxito", description: `Solicitud ${accept ? 'aceptada' : 'rechazada'}.` });
            onUpdate();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
            setIsProcessing(false);
        }
    };

    const description = notification.type === 'friendRequest'
        ? <>Te ha enviado una solicitud de amistad.</>
        : <>Quiere unirse a tu equipo <Link href={`/dashboard/teams/${notification.teamId}`} className="font-semibold underline">{notification.teamName}</Link>.</>;

    return (
        <Card>
            <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Avatar>
                        <AvatarImage src={notification.from_avatarUrl} />
                        <AvatarFallback>{notification.from_displayName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className='flex flex-col gap-1'>
                        <p className="text-sm">
                            <span className="font-semibold">{notification.from_displayName}</span> {description}
                        </p>
                        <Badge variant="secondary" className="w-fit">{notification.type === 'friendRequest' ? 'Solicitud de Amistad' : 'Aplicación a Equipo'}</Badge>
                    </div>
                </div>
                 <div className="flex gap-2">
                    <Button size="icon" variant="outline" onClick={() => handleDecision(true)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-500" />}
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => handleDecision(false)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

export default function InboxPage() {
    const [user, setUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        const result = await getPendingNotifications();
        if (result.success && result.notifications) {
            setNotifications(result.notifications);
        } else if (result.error) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                fetchNotifications();
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchNotifications]);
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Bandeja de Entrada</h1>
                <p className="text-muted-foreground">Gestiona aquí todas tus solicitudes pendientes.</p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Solicitudes Pendientes ({notifications.length})</CardTitle>
                    <CardDescription>Acepta o rechaza las solicitudes de amistad y de equipo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="space-y-3">
                           <Skeleton className="h-20 w-full" />
                           <Skeleton className="h-20 w-full" />
                        </div>
                    ) : notifications.length > 0 ? (
                        notifications.map(n => <NotificationCard key={n.id} notification={n} onUpdate={fetchNotifications} />)
                    ) : (
                        <div className="text-center py-10">
                            <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-xl font-semibold">Tu bandeja está vacía</h3>
                            <p className="text-muted-foreground">No tienes ninguna solicitud pendiente.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
