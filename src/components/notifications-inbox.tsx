'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Inbox, Check, X, Loader2, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { getPendingNotifications, handleApplicationDecision } from './notifications/actions';
import { respondToFriendRequest } from '@/app/dashboard/friends/actions';
import type { Notification } from './notifications/actions';
import { auth } from '@/lib/firebase';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

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

  const onHandleApplication = async (notificationId: string, decision: 'accept' | 'reject') => {
    setIsProcessing(notificationId);
    const result = await handleApplicationDecision(notificationId, decision);
    if (result.success) {
      toast({ title: '¡Decisión procesada!', description: `La solicitud ha sido ${decision === 'accept' ? 'aceptada' : 'rechazada'}.`});
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsProcessing(null);
  };
  
  const onHandleFriendRequest = async (notification: Notification, decision: 'accept' | 'reject') => {
    if (!user || !notification.sender) return;
    setIsProcessing(notification.id);
    const result = await respondToFriendRequest(notification.id, decision, user.uid, notification.sender.uid);
    if (result.success) {
        toast({ title: '¡Decisión procesada!', description: `La solicitud de amistad ha sido ${decision === 'accept' ? 'aceptada' : 'rechazada'}.` });
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsProcessing(null);
  };

  const handleDismissNotification = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const hasNotifications = notifications.length > 0;

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Inbox className="h-5 w-5" />
          {hasNotifications && !isLoading &&(
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-xs">{notifications.length}</Badge>
          )}
          <span className="sr-only">Abrir bandeja de entrada</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 flex justify-between items-center">
            <h3 className="font-semibold">Notificaciones</h3>
             <Button asChild variant="link" className="p-0 h-auto text-xs"><Link href="/dashboard/inbox">Ver todo</Link></Button>
        </div>
        <Separator />
        <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
                <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : notifications.length > 0 ? (
                <div className="flex flex-col">
                    {notifications.map((notification) => {
                      if (notification.type === 'application' && notification.applicant && notification.team) {
                        return (
                          <div key={notification.id} className="p-4 hover:bg-secondary/50">
                            <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10 border"><AvatarImage src={notification.applicant.avatarUrl} /><AvatarFallback>{notification.applicant.displayName.substring(0, 2)}</AvatarFallback></Avatar>
                                <div className="flex-1 text-sm">
                                    <p><Link href={`/dashboard/profile/${notification.applicant.uid}`} className="font-semibold hover:underline">{notification.applicant.displayName}</Link>{' '}quiere unirse a tu equipo{' '}<Link href={`/dashboard/teams/${notification.team.id}`} className="font-semibold hover:underline">{notification.team.name}</Link>.</p>
                                    <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <Button size="sm" variant="outline" onClick={() => onHandleApplication(notification.id, 'reject')} disabled={isProcessing === notification.id}>{isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}<span className="ml-2">Rechazar</span></Button>
                                <Button size="sm" onClick={() => onHandleApplication(notification.id, 'accept')} disabled={isProcessing === notification.id}>{isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}<span className="ml-2">Aceptar</span></Button>
                            </div>
                          </div>
                        );
                      }
                      if (notification.type === 'invite' && notification.team) {
                        return (
                          <div key={notification.id} className="p-4 hover:bg-secondary/50">
                              <div className="flex items-start gap-3">
                                  <Avatar className="h-10 w-10 border"><AvatarImage src={notification.team.logoUrl} /><AvatarFallback>{notification.team.name.substring(0, 2)}</AvatarFallback></Avatar>
                                  <div className="flex-1 text-sm">
                                      <p>El equipo{' '}<Link href={`/dashboard/teams/${notification.team.id}`} className="font-semibold hover:underline">{notification.team.name}</Link>{' '}te ha invitado a unirte.</p>
                                      <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}</p>
                                  </div>
                              </div>
                               <div className="flex justify-end gap-2 mt-3">
                                <TooltipProvider>
                                    <Tooltip><TooltipTrigger><span tabIndex={0}><Button size="sm" variant="outline" disabled={true}><X className="h-4 w-4" /><span className="ml-2">Rechazar</span></Button></span></TooltipTrigger><TooltipContent><p>Próximamente</p></TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger><span tabIndex={0}><Button size="sm" disabled={true}><Check className="h-4 w-4" /><span className="ml-2">Aceptar</span></Button></span></TooltipTrigger><TooltipContent><p>Próximamente</p></TooltipContent></Tooltip>
                                </TooltipProvider>
                              </div>
                          </div>
                        );
                      }
                      if (notification.type === 'friend_request' && notification.sender) {
                        return (
                          <div key={notification.id} className="p-4 hover:bg-secondary/50">
                            <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10 border"><AvatarImage src={notification.sender.avatarUrl} /><AvatarFallback>{notification.sender.displayName.substring(0, 2)}</AvatarFallback></Avatar>
                                <div className="flex-1 text-sm">
                                    <p><Link href={`/dashboard/profile/${notification.sender.uid}`} className="font-semibold hover:underline">{notification.sender.displayName}</Link>{' '}te ha enviado una solicitud de amistad.</p>
                                    <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <Button size="sm" variant="outline" onClick={() => onHandleFriendRequest(notification, 'reject')} disabled={isProcessing === notification.id}>{isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}<span className="ml-2">Rechazar</span></Button>
                                <Button size="sm" onClick={() => onHandleFriendRequest(notification, 'accept')} disabled={isProcessing === notification.id}>{isProcessing === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}<span className="ml-2">Aceptar</span></Button>
                            </div>
                          </div>
                        );
                      }
                      if (notification.type === 'friend_request_accepted' && notification.acceptedBy) {
                        return (
                          <div key={notification.id} className="p-4 hover:bg-secondary/50">
                              <div className="flex items-start gap-3">
                                  <Avatar className="h-10 w-10 border"><AvatarImage src={notification.acceptedBy.avatarUrl} /><AvatarFallback>{notification.acceptedBy.displayName.substring(0, 2)}</AvatarFallback></Avatar>
                                  <div className="flex-1 text-sm">
                                      <p><Link href={`/dashboard/profile/${notification.acceptedBy.uid}`} className="font-semibold hover:underline">{notification.acceptedBy.displayName}</Link>{' '}ha aceptado tu solicitud de amistad.</p>
                                      <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}</p>
                                  </div>
                              </div>
                               <div className="flex justify-end gap-2 mt-3">
                                 <Button size="sm" onClick={() => handleDismissNotification(notification.id)}>
                                    <Check className="h-4 w-4" />
                                    <span className="ml-2">Ok</span>
                                  </Button>
                              </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                </div>
            ) : (
                <div className="text-center text-sm text-muted-foreground py-10"><Inbox className="mx-auto h-12 w-12" /><p className="mt-4">No tienes notificaciones pendientes.</p></div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
