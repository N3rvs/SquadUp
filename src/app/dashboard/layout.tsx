
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import {
  User,
  Users,
  Store,
  Trophy,
  Swords,
  LogOut,
  BrainCircuit,
  MessageSquare,
  Bell,
  Settings,
  LifeBuoy,
  Circle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SupportForm } from "@/components/support-form";

function Notifications() {
    const notifications = {
        all: [],
        messages: [],
        requests: []
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative shrink-0">
                    <Bell className="h-5 w-5" />
                    {notifications.all.length > 0 && <Badge className="absolute -top-1 -right-1 h-4 w-4 justify-center p-0">{notifications.all.length}</Badge>}
                    <span className="sr-only">Open notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                 <Tabs defaultValue="all" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="messages">Messages</TabsTrigger>
                        <TabsTrigger value="requests">Requests</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="max-h-96 overflow-y-auto">
                        <div className="space-y-4 pt-4">
                            {notifications.all.length > 0 ? (
                                notifications.all.map((n: any, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarImage src={`https://placehold.co/40x40.png`} data-ai-hint={n.avatarHint} />
                                            <AvatarFallback>{n.user.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-sm">
                                            <p><span className="font-semibold">{n.user}</span> {n.action || n.text} <span className="font-semibold">{n.team || ''}</span></p>
                                            {(n.type === 'request' || n.type === 'friend') && (
                                                <div className="mt-2 flex gap-2">
                                                    <Button size="sm" className="h-7">Accept</Button>
                                                    <Button size="sm" variant="outline" className="h-7">Decline</Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-sm text-muted-foreground py-10">
                                    <p>No new notifications.</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                    <TabsContent value="messages" className="max-h-96 overflow-y-auto">
                        <div className="space-y-4 pt-4">
                           {notifications.messages.length > 0 ? (
                                notifications.messages.map((n: any, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarImage src={`https://placehold.co/40x40.png`} data-ai-hint={n.avatarHint} />
                                            <AvatarFallback>{n.user.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-sm">
                                            <p><span className="font-semibold">{n.user}</span> {n.text}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-sm text-muted-foreground py-10">
                                    <p>No new messages.</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                    <TabsContent value="requests" className="max-h-96 overflow-y-auto">
                         <div className="space-y-4 pt-4">
                           {notifications.requests.length > 0 ? (
                                notifications.requests.map((n: any, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarImage src={`https://placehold.co/40x40.png`} data-ai-hint={n.avatarHint} />
                                            <AvatarFallback>{n.user.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="text-sm">
                                            <p><span className="font-semibold">{n.user}</span> {n.action} <span className="font-semibold">{n.team || ''}</span></p>
                                            <div className="mt-2 flex gap-2">
                                                <Button size="sm" className="h-7">Accept</Button>
                                                <Button size="sm" variant="outline" className="h-7">Decline</Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-sm text-muted-foreground py-10">
                                    <p>No new requests.</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = React.useState<{
    displayName: string;
    email: string;
    avatarUrl: string;
  } | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [status, setStatus] = React.useState<'disponible' | 'ausente' | 'ocupado'>('disponible');


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserProfile({
            displayName: data.displayName || 'Usuario',
            email: user.email || 'usuario@example.com',
            avatarUrl: data.avatarUrl || '',
          });
        } else {
            setUserProfile({
                displayName: user.displayName || 'Usuario',
                email: user.email || 'usuario@example.com',
                avatarUrl: user.photoURL || '',
            });
        }
      } else {
        router.push("/login");
      }
      setIsLoadingProfile(false);
    });
    return () => unsubscribe();
  }, [router]);

  const navItems = [
    { href: "/dashboard/profile", icon: User, label: "Perfil" },
    { href: "/dashboard/teams", icon: Users, label: "Equipos" },
    { href: "/dashboard/marketplace", icon: Store, label: "Marketplace" },
    { href: "/dashboard/tournaments", icon: Trophy, label: "Torneos" },
    { href: "/dashboard/scrims", icon: Swords, label: "Scrims" },
    { href: "/dashboard/ai-coach", icon: BrainCircuit, label: "Coach AI" },
    { href: "/dashboard/chat", icon: MessageSquare, label: "Chat" },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push("/login");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred during logout. Please try again.",
      });
    }
  };

  const statusInfo = {
    disponible: { text: "Disponible", color: "text-green-500" },
    ausente: { text: "Ausente", color: "text-yellow-500" },
    ocupado: { text: "Ocupado", color: "text-red-500" },
  };

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex flex-col w-64 bg-card border-r">
        <div className="flex-1 flex flex-col gap-6 p-4">
          <Link href="/dashboard" className="px-2">
            <h1 className="text-2xl font-bold font-headline">SquadUp</h1>
          </Link>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname.startsWith(item.href) ? "secondary" : "ghost"}
                  className="w-full justify-start gap-3"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>
      <div className="flex flex-col flex-1">
        <header className="flex h-16 items-center justify-end gap-4 border-b bg-card px-6">
            <Notifications />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
                    {isLoadingProfile ? (
                        <Skeleton className="h-9 w-9 rounded-full" />
                    ) : (
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={userProfile?.avatarUrl} alt={userProfile?.displayName || ''} />
                            <AvatarFallback>{userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                    )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userProfile?.displayName || 'Usuario'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userProfile?.email || 'cargando...'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Circle className={cn("mr-2 h-3 w-3 fill-current", statusInfo[status].color)} />
                        <span>{statusInfo[status].text}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => setStatus('disponible')}>
                                <Circle className="mr-2 h-3 w-3 text-green-500 fill-current" />
                                <span>Disponible</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatus('ausente')}>
                                <Circle className="mr-2 h-3 w-3 text-yellow-500 fill-current" />
                                <span>Ausente</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatus('ocupado')}>
                                <Circle className="mr-2 h-3 w-3 text-red-500 fill-current" />
                                <span>Ocupado</span>
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
                <Dialog>
                    <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <LifeBuoy className="mr-2 h-4 w-4" />
                          <span>Soporte</span>
                        </DropdownMenuItem>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Contactar a Soporte</DialogTitle>
                            <DialogDescription>
                                Describe tu problema y nuestra IA te ayudará a categorizarlo para una respuesta más rápida.
                            </DialogDescription>
                        </DialogHeader>
                        <SupportForm />
                    </DialogContent>
                </Dialog>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </header>

        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
