
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

// Placeholder types
type Message = {
  id: number;
  text: string;
  sender: 'me' | 'other';
};

type ChatUser = {
  uid: string;
  displayName: string;
  avatarUrl?: string;
};

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  friend: ChatUser;
  currentUser: ChatUser;
}

export function ChatModal({ isOpen, onClose, friend, currentUser }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: `Este es el comienzo de tu conversación con ${friend.displayName}.`, sender: 'other' }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
      scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (newMessage.trim() === '') return;

      const message: Message = {
          id: messages.length + 1,
          text: newMessage,
          sender: 'me',
      };
      
      setMessages([...messages, message]);
      setNewMessage('');
      
      // Simulate a reply for demonstration
      setTimeout(() => {
          const reply: Message = {
              id: messages.length + 3, // Use a different id to avoid key collision
              text: `Esta es una respuesta automática. La funcionalidad de chat en tiempo real se implementará más adelante.`,
              sender: 'other',
          };
          setMessages(prev => [...prev, reply]);
      }, 1000);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />
                <AvatarFallback>{friend.displayName.substring(0, 2)}</AvatarFallback>
              </Avatar>
              <p className="font-semibold">{friend.displayName}</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 bg-muted/20">
            <div className="p-4 space-y-4">
                {messages.map((message) => (
                    <div key={message.id} className={cn("flex items-end gap-2 w-full", message.sender === 'me' && "justify-end")}>
                        {message.sender === 'other' && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={friend.avatarUrl} />
                                <AvatarFallback>{friend.displayName.substring(0,2)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn("p-3 rounded-xl max-w-[70%]", message.sender === 'me' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-secondary rounded-bl-none' )}>
                            <p className="text-sm">{message.text}</p>
                        </div>
                         {message.sender === 'me' && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={currentUser.avatarUrl} />
                                <AvatarFallback>{currentUser.displayName.substring(0,2)}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
        </ScrollArea>
        <div className="p-4 border-t bg-background">
          <form onSubmit={handleSendMessage} className="relative">
            <Input 
              placeholder="Escribe un mensaje..." 
              className="pr-12" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
