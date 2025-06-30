
"use client";

import React, { useState, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useChatMessages } from '@/hooks/useChatMessages';
import { getOrCreateChat, sendMessage, type ChatParticipantInfo } from '@/app/dashboard/chat/actions';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Send } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import type { Friend } from '@/app/dashboard/friends/actions';
import { useToast } from '@/hooks/use-toast';

interface ChatModalProps {
  friend: Friend;
  currentUser: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatModal({ friend, currentUser, open, onOpenChange }: ChatModalProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const { messages, isLoading } = useChatMessages(chatId);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setChatId(null);
      return;
    }

    if (!currentUser?.uid || !friend?.uid) {
        console.error("ChatModal: currentUser or friend UID is missing.", { currentUser, friend });
        toast({
            variant: 'destructive',
            title: 'Error de Datos',
            description: 'No se puede iniciar el chat. La información del usuario es incompleta.',
        });
        onOpenChange(false);
        return;
    }

    const setupChat = async () => {
      try {
        const currentUserInfo: ChatParticipantInfo = {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            avatarUrl: currentUser.photoURL,
        };
        const friendInfo: ChatParticipantInfo = {
            uid: friend.uid,
            displayName: friend.displayName,
            avatarUrl: friend.avatarUrl,
        };
        const id = await getOrCreateChat(currentUserInfo, friendInfo);
        setChatId(id);
      } catch (e: any) {
        console.error("Error setting up chat:", e);
        toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudo abrir el chat.' });
        onOpenChange(false);
      }
    };
    setupChat();
  }, [open, currentUser, friend, onOpenChange, toast]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
        setTimeout(scrollToBottom, 100);
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatId || !newMessage.trim()) return;
    
    setIsSending(true);
    const textToSend = newMessage;
    setNewMessage(""); // Clear input immediately
    
    await sendMessage(chatId, textToSend, currentUser.uid);
    setIsSending(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Chat con {friend.displayName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading || !chatId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><Skeleton className="h-10 w-48 rounded-lg" /></div>
              <div className="flex items-center justify-end gap-2"><Skeleton className="h-10 w-48 rounded-lg" /></div>
              <div className="flex items-center gap-2"><Skeleton className="h-8 w-32 rounded-lg" /></div>
            </div>
          ) : messages.length > 0 ? (
            messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end gap-2 w-full',
                  msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-xs md:max-w-sm rounded-lg px-3 py-2',
                    msg.senderId === currentUser.uid
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                   <p className={cn("text-xs mt-1 opacity-70", msg.senderId === currentUser.uid ? 'text-right' : 'text-left')}>
                    {format(msg.timestamp, 'HH:mm')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground pt-10">
              <p>Aún no hay mensajes. ¡Sé el primero en saludar!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <DialogFooter className="p-4 border-t bg-background">
          <form onSubmit={handleSend} className="flex items-center gap-2 w-full">
            <Input 
                placeholder="Escribe un mensaje..." 
                autoComplete="off" 
                disabled={isSending || !chatId}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
            />
            <Button type="submit" size="icon" disabled={isSending || !chatId || !newMessage.trim()}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
