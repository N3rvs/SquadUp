"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  text: string;
  sender: 'user' | 'other';
  avatarHint: string;
  senderName: string;
};

type Chat = {
  name: string;
  msg: string;
  avatarHint: string;
  messages: Message[];
};

const initialChats: Chat[] = [
    {
        name: 'Team: Cyber Eagles',
        msg: 'No problem, see you then!',
        avatarHint: 'eagle logo',
        messages: [
            { id: 1, text: 'Hey team, don\'t forget practice tonight at 8 PM on Ascent. We need to work on our B-site executes.', sender: 'other', avatarHint: 'eagle logo', senderName: 'Coach' },
            { id: 2, text: 'Got it, coach. I\'ll be there. I\'ve been practicing my Sova lineups.', sender: 'user', avatarHint: 'male avatar', senderName: 'You' },
            { id: 3, text: 'I might be 15 minutes late, finishing up some work.', sender: 'other', avatarHint: 'female avatar', senderName: 'JaneSmith'},
            { id: 4, text: 'No problem, see you then!', sender: 'user', avatarHint: 'male avatar', senderName: 'You' },
        ],
    },
    {
        name: 'JohnDoe',
        msg: 'Hey, are you free for a match?',
        avatarHint: 'male avatar',
        messages: [
            { id: 1, text: 'Hey, are you free for a match?', sender: 'other', avatarHint: 'male avatar', senderName: 'JohnDoe' }
        ],
    },
    {
        name: 'JaneSmith',
        msg: 'Great game yesterday!',
        avatarHint: 'female avatar',
        messages: [
             { id: 1, text: 'Great game yesterday!', sender: 'other', avatarHint: 'female avatar', senderName: 'JaneSmith' }
        ]
    }
];

export default function ChatPage() {
    const [chats, setChats] = useState<Chat[]>(initialChats);
    const [selectedChat, setSelectedChat] = useState<Chat>(chats[0]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [selectedChat?.messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !selectedChat) return;

        const message: Message = {
            id: selectedChat.messages.length + 1,
            text: newMessage,
            sender: 'user',
            avatarHint: 'male avatar', // Assuming current user avatar
            senderName: 'You',
        };

        const updatedMessages = [...selectedChat.messages, message];
        const updatedChat = { ...selectedChat, messages: updatedMessages, msg: newMessage };
        
        setSelectedChat(updatedChat);

        const otherChats = chats.filter(c => c.name !== selectedChat.name);
        const newChats = [updatedChat, ...otherChats];
        setChats(newChats);
        
        setNewMessage('');
    };

  return (
    <div className="grid h-[calc(100vh-theme(spacing.24))] grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <Card className="md:col-span-1 lg:col-span-1 h-full flex flex-col">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search chats..." className="pl-8" />
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <CardContent className="space-y-2">
            {chats.map((chat) => (
              <div 
                key={chat.name} 
                className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer", 
                    selectedChat?.name === chat.name ? 'bg-secondary' : 'hover:bg-secondary/50'
                )}
                onClick={() => setSelectedChat(chat)}
              >
                <Avatar>
                  <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint={chat.avatarHint} alt={chat.name} />
                  <AvatarFallback>{chat.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate">
                  <p className="font-semibold">{chat.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{chat.msg}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </ScrollArea>
      </Card>
      <Card className="md:col-span-2 lg:col-span-3 h-full flex flex-col">
        {selectedChat ? (
            <>
                <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                         <Avatar>
                            <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint={selectedChat.avatarHint} alt={selectedChat.name} />
                            <AvatarFallback>{selectedChat.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold">{selectedChat.name}</p>
                    </div>
                </CardHeader>
                <ScrollArea className="flex-1 p-4 space-y-4">
                {selectedChat.messages.map((message) => (
                    <div key={message.id} className={cn("flex items-end gap-2", message.sender === 'user' && "justify-end")}>
                        {message.sender === 'other' && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint={message.avatarHint} />
                                <AvatarFallback>{message.senderName.substring(0,2)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn("p-3 rounded-lg max-w-md", message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary' )}>
                            <p>{message.text}</p>
                        </div>
                         {message.sender === 'user' && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="male avatar" />
                                <AvatarFallback>{message.senderName.substring(0,2)}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
                </ScrollArea>
                <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="relative">
                    <Input 
                        placeholder="Type a message..." 
                        className="pr-12" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                    <Send className="h-4 w-4" />
                    </Button>
                </form>
                </div>
            </>
        ) : (
            <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground">Select a chat to start messaging</p>
            </div>
        )}
      </Card>
    </div>
  );
}
