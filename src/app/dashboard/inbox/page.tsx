'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { getPendingNotifications, handleNotification, type Notification } from '@/components/notifications/actions';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Inbox, Check, X, Loader2 } from 'lucide-react';

function NotificationSkeleton() {
    return (
        <Card>
            <CardHeader className="p-4">
                <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/4 mt-1" />
                    </div>
                </div>
            </CardHeader>
            <CardFooter className="p-4 flex justify-end gap-2">
                 <Skeleton className="h-9 w-24" />
                 <Skeleton className="h-9 w-24" />
            </CardFooter>
        </Card>
    )
}


export default function InboxPage() {
    const [user, setUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const result = await getPendingNotifications(user.uid);
        if (result.success && result.notifications) {
            setNotifications(result.notifications);
        } else if (result.error) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    }, [user, toast]);

    useEffect(() => {
        if (user) {
            fetchNotifications();
        }
    }, [user, fetchNotifications]);

    const onHandleNotification = async (
        notificationId: string,
        userId: string,
        teamId: string,
        decision: 'accept' | 'reject'
    ) => {
        setIsProcessing(notificationId);
        const result = await handleNotification(notificationId, userId, teamId, decision);
        if (result.success) {
            toast({
                title: '¡Decisión procesada!',
                description: `La solicitud ha sido ${decision === 'accept' ? 'aceptada' : 'rechazada'}.`,
            });
            setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsProcessing(null);
    };

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Bandeja de Entrada</h1>
                <p className="text-muted-foreground">Gestiona tus solicitudes de equipo e invitaciones pendientes.</p>
            </div>
            
            {isLoading ? (
                <div className="space-y-4">
                    <NotificationSkeleton />
                    <NotificationSkeleton />
                </div>
            ) : notifications.length > 0 ? (
                <div className="space-y-4">
                    {notifications.map((notification) => {
                        if (notification.type === 'application' && notification.applicant) {
                            return (
                                <Card key={notification.id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-12 w-12 border">
                                                <AvatarImage src={notification.applicant.avatarUrl} />
                                                <AvatarFallback>{notification.applicant.displayName.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 text-sm">
                                                <p>
                                                    <Link href={`/dashboard/profile/${notification.applicant.uid}`} className="font-semibold hover:underline">{notification.applicant.displayName}</Link>
                                                    {' '}quiere unirse a tu equipo{' '}
                                                    <Link href={`/dashboard/teams/${notification.team.id}`} className="font-semibold hover:underline">{notification.team.name}</Link>.
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onHandleNotification(notification.id, notification.applicant!.uid, notification.team.id, 'reject')}
                                                    disabled={isProcessing === notification.id}
                                                >
                                                    {isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                                    <span className="ml-2 hidden sm:inline">Rechazar</span>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => onHandleNotification(notification.id, notification.applicant!.uid, notification.team.id, 'accept')}
                                                    disabled={isProcessing === notification.id}
                                                >
                                                    {isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                    <span className="ml-2 hidden sm:inline">Aceptar</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        }
                         if (notification.type === 'invite' && user) {
                            return (
                                <Card key={notification.id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-12 w-12 border">
                                                <AvatarImage src={notification.team.logoUrl} />
                                                <AvatarFallback>{notification.team.name.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 text-sm">
                                                <p>
                                                    El equipo{' '}
                                                    <Link href={`/dashboard/teams/${notification.team.id}`} className="font-semibold hover:underline">{notification.team.name}</Link>
                                                    {' '}te ha invitado a unirte.
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onHandleNotification(notification.id, user.uid, notification.team.id, 'reject')}
                                                    disabled={isProcessing === notification.id}
                                                >
                                                    {isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                                    <span className="ml-2 hidden sm:inline">Rechazar</span>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => onHandleNotification(notification.id, user.uid, notification.team.id, 'accept')}
                                                    disabled={isProcessing === notification.id}
                                                >
                                                    {isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                     <span className="ml-2 hidden sm:inline">Aceptar</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        }
                        return null;
                    })}
                </div>
            ) : (
                <Card>
                    <CardContent className="text-center p-10">
                        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-xl font-semibold">Bandeja de Entrada Vacía</h3>
                        <p className="text-muted-foreground">No tienes notificaciones pendientes.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
