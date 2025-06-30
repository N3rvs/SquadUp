'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import {
  getPendingNotifications,
  handleFriendRequestDecision,
  handleTeamApplicationDecision,
  type Notification,
} from './notifications/actions';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, Loader2, Check, X, Inbox } from 'lucide-react';
import Link from 'next/link';

export function NotificationsInbox() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
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
      }
    });
    return () => unsubscribe();
  }, [fetchNotifications]);

  const handleDecision = async (notification: Notification, accept: boolean) => {
    setIsProcessing(notification.id);
    let result;
    if (notification.type === 'friendRequest') {
      result = await handleFriendRequestDecision(notification.id, accept);
    } else {
      result = await handleTeamApplicationDecision(notification.id, accept);
    }

    if (result.success) {
      toast({ title: "Éxito", description: `Solicitud ${accept ? 'aceptada' : 'rechazada'}.` });
      fetchNotifications(); // Refresh notifications
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
    setIsProcessing(null);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
              {notifications.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <DropdownMenuItem disabled className="flex justify-center items-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </DropdownMenuItem>
        ) : notifications.length > 0 ? (
          notifications.map((n) => (
            <React.Fragment key={n.id}>
                <DropdownMenuItem className="flex flex-col items-start gap-2 p-2" onSelect={(e) => e.preventDefault()}>
                    <div className='flex items-center gap-2'>
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={n.from_avatarUrl} />
                            <AvatarFallback>{n.from_displayName.substring(0, 1)}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs text-wrap">
                            <b>{n.from_displayName}</b> {n.type === 'friendRequest' ? 'te envió una solicitud de amistad.' : `quiere unirse a tu equipo ${n.teamName}.`}
                        </p>
                    </div>
                    <div className="flex w-full justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleDecision(n, true)} disabled={isProcessing === n.id}>
                            <Check className="h-4 w-4" /> Aceptar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDecision(n, false)} disabled={isProcessing === n.id}>
                            <X className="h-4 w-4" /> Rechazar
                        </Button>
                    </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
            </React.Fragment>
          ))
        ) : (
          <DropdownMenuItem disabled className="flex flex-col items-center justify-center text-center py-4">
             <Inbox className="h-8 w-8 text-muted-foreground mb-2"/>
            <p className="text-sm font-medium">Todo al día</p>
            <p className="text-xs text-muted-foreground">No tienes notificaciones.</p>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
             <Link href="/dashboard/inbox" className="w-full flex justify-center mt-2">
                Ver todas en la Bandeja de Entrada
             </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
