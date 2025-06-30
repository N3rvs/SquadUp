'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useChatMessages } from '@/hooks/useChatMessages';
import { sendMessage } from '@/app/dashboard/chat/actions';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Send } from 'lucide-react';
import { Form, FormControl, FormField, FormItem } from './ui/form';
import { Skeleton } from './ui/skeleton';
import { format } from 'date-fns';

const messageSchema = z.object({
  text: z.string().min(1, { message: "Message cannot be empty." }),
});

interface ChatWindowProps {
  chatId: string;
  currentUserId: string;
}

export function ChatWindow({ chatId, currentUserId }: ChatWindowProps) {
  const { messages, isLoading } = useChatMessages(chatId);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof messageSchema>>({
    resolver: zodResolver(messageSchema),
    defaultValues: { text: '' },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [messages]);

  const onSubmit = async (values: z.infer<typeof messageSchema>) => {
    setIsSending(true);
    await sendMessage(chatId, values.text, currentUserId);
    form.reset();
    setIsSending(false);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Skeleton className="h-10 w-48 rounded-lg" /></div>
            <div className="flex items-center justify-end gap-2"><Skeleton className="h-10 w-48 rounded-lg" /></div>
             <div className="flex items-center gap-2"><Skeleton className="h-8 w-32 rounded-lg" /></div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end gap-2 w-full',
                msg.senderId === currentUserId ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-3 py-2',
                  msg.senderId === currentUserId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                 <p className={cn("text-xs mt-1 opacity-70", msg.senderId === currentUserId ? 'text-right' : 'text-left')}>
                  {format(msg.timestamp, 'HH:mm')}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t bg-background">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input {...field} placeholder="Escribe un mensaje..." autoComplete="off" disabled={isSending} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" size="icon" disabled={isSending || !form.formState.isValid}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
