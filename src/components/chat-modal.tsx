'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User } from 'firebase/auth';
import { useChatMessages } from '@/hooks/useChatMessages';
import { getOrCreateChat, sendMessage } from '@/app/dashboard/chat/actions';
import { cn } from '@/lib/utils';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Send } from 'lucide-react';
import { Form, FormControl, FormField, FormItem } from './ui/form';
import { Skeleton } from './ui/skeleton';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import type { Friend } from '@/app/dashboard/friends/actions';
import { useToast } from '@/hooks/use-toast';

const messageSchema = z.object({
  text: z.string().min(1, { message: "Message cannot be empty." }),
});

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && currentUser && friend) {
      const setupChat = async () => {
        try {
            const id = await getOrCreateChat(currentUser.uid, friend.uid);
            setChatId(id);
        } catch(e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not open chat.' });
            onOpenChange(false);
        }
      };
      setupChat();
    } else {
        setChatId(null);
    }
  }, [open, currentUser, friend, onOpenChange, toast]);


  const form = useForm<z.infer<typeof messageSchema>>({
    resolver: zodResolver(messageSchema),
    defaultValues: { text: '' },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
        setTimeout(scrollToBottom, 100);
    }
  }, [messages]);

  const onSubmit = async (values: z.infer<typeof messageSchema>) => {
    if (!chatId) return;
    setIsSending(true);
    await sendMessage(chatId, values.text, currentUser.uid);
    form.reset();
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2 w-full">
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input {...field} placeholder="Escribe un mensaje..." autoComplete="off" disabled={isSending || !chatId} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" size="icon" disabled={isSending || !chatId || !form.formState.isValid}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
