
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Inbox, Check, X, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { getPendingNotifications, handleNotification } from './notifications/actions';
import type { Notification } from './notifications/actions';
import { auth } from '@/lib/firebase';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

export function NotificationsInbox() {
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

  const onOpenChange = (open: boolean) => {
    if (open) {
      fetchNotifications();
    }
  };

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

  const hasNotifications = notifications.length > 0;

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Inbox className="h-5 w-5" />
          {hasNotifications && !isLoading &&(
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-xs"
            >
              {notifications.length}
            </Badge>
          )}
          <span className="sr-only">Abrir bandeja de entrada</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4">
            <h3 className="font-semibold">Notificaciones</h3>
        </div>
        <Separator />
        <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
                <div className="flex justify-center items-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : notifications.length > 0 ? (
                <div className="flex flex-col">
                    {notifications.map((notification) => {
                      if (notification.type === 'application' && notification.applicant) {
                        return (
                          <div key={notification.id} className="p-4 hover:bg-secondary/50">
                            <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10 border">
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
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onHandleNotification(notification.id, notification.applicant!.uid, notification.team.id, 'reject')}
                                    disabled={isProcessing === notification.id}
                                >
                                    {isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                    <span className="ml-2">Rechazar</span>
                                </Button>
                                <Button 
                                    size="sm"
                                    onClick={() => onHandleNotification(notification.id, notification.applicant!.uid, notification.team.id, 'accept')}
                                    disabled={isProcessing === notification.id}
                                >
                                    {isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    <span className="ml-2">Aceptar</span>
                                </Button>
                            </div>
                          </div>
                        );
                      }
                      if (notification.type === 'invite' && user) {
                        return (
                          <div key={notification.id} className="p-4 hover:bg-secondary/50">
                              <div className="flex items-start gap-3">
                                  <Avatar className="h-10 w-10 border">
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
                              </div>
                              <div className="flex justify-end gap-2 mt-3">
                                  <Button 
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onHandleNotification(notification.id, user.uid, notification.team.id, 'reject')}
                                      disabled={isProcessing === notification.id}
                                  >
                                      {isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                      <span className="ml-2">Rechazar</span>
                                  </Button>
                                  <Button 
                                      size="sm"
                                      onClick={() => onHandleNotification(notification.id, user.uid, notification.team.id, 'accept')}
                                      disabled={isProcessing === notification.id}
                                  >
                                      {isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                      <span className="ml-2">Aceptar</span>
                                  </Button>
                              </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                </div>
            ) : (
                <div className="text-center text-sm text-muted-foreground py-10">
                    <Inbox className="mx-auto h-12 w-12" />
                    <p className="mt-4">No tienes notificaciones pendientes.</p>
                </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
