import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send } from "lucide-react";

export default function ChatPage() {
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
            {[
              { name: "Team: Cyber Eagles", msg: "Let's practice at 8.", active: true, avatarHint: "eagle logo" },
              { name: "JohnDoe", msg: "Hey, are you free for a match?", avatarHint: "male avatar" },
              { name: "JaneSmith", msg: "Great game yesterday!", avatarHint: "female avatar" },
            ].map((chat) => (
              <div key={chat.name} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${chat.active ? 'bg-secondary' : 'hover:bg-secondary/50'}`}>
                <Avatar>
                  <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint={chat.avatarHint} />
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
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="flex items-end gap-2">
            <Avatar>
              <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="eagle logo" />
              <AvatarFallback>CE</AvatarFallback>
            </Avatar>
            <div className="p-3 rounded-lg bg-secondary max-w-xs">
              <p>Hey team, don't forget practice tonight at 8 PM on Ascent. We need to work on our B-site executes.</p>
            </div>
          </div>
          <div className="flex items-end gap-2 justify-end">
            <div className="p-3 rounded-lg bg-primary text-primary-foreground max-w-xs">
              <p>Got it, coach. I'll be there. I've been practicing my Sova lineups.</p>
            </div>
            <Avatar>
              <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="male avatar" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </div>
        </div>
        <div className="p-4 border-t">
          <div className="relative">
            <Input placeholder="Type a message..." className="pr-12" />
            <Button size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
