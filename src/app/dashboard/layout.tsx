
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
  Inbox,
  Settings,
  LifeBuoy,
  Circle,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SupportForm } from "@/components/support-form";
import type { SecurityRole } from "@/hooks/useAuthRole";
import { BannedScreen } from "@/components/BannedScreen";
import { NotificationsInbox } from "@/components/notifications-inbox";

interface UserProfile {
    displayName: string;
    email: string;
    avatarUrl: string;
    uid: string;
    isBanned?: boolean;
    banExpiresAt?: Timestamp;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<SecurityRole | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [status, setStatus] = useState<'disponible' | 'ausente' | 'ocupado'>('disponible');


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoadingProfile(true);
        try {
          const idTokenResult = await user.getIdTokenResult(true); // Force refresh
          const claims = idTokenResult.claims;
          const userRole = (claims.role as SecurityRole) || 'player';
          setUserRole(userRole);

          // The custom auth claim is the source of truth for the ban status.
          // If the claim says the user is banned, we immediately block access
          // without trying to read from Firestore, which would fail due to the security rules.
          if (claims.isBanned === true) {
            setUserProfile({
              uid: user.uid,
              displayName: user.displayName || 'Usuario',
              email: user.email || 'usuario@example.com',
              avatarUrl: user.photoURL || '',
              isBanned: true,
              // We can't fetch the real expiry date from Firestore due to the rules.
              // We set a far-future date to trigger the "permanent ban" message
              // in the BannedScreen component as a generic but functional fallback.
              banExpiresAt: Timestamp.fromDate(new Date('3000-01-01')),
            });
            setIsLoadingProfile(false);
            return; // Exit early for banned users
          }
          
          // If the user is not banned, proceed to fetch their profile from Firestore.
          const userDocRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile({
              uid: user.uid,
              displayName: data.displayName || 'Usuario',
              email: user.email || 'usuario@example.com',
              avatarUrl: data.avatarUrl || '',
              isBanned: data.isBanned || false,
              banExpiresAt: data.banExpiresAt || null,
            });
          } else {
            // This case might happen for a newly signed-up user whose doc hasn't been created yet.
            setUserProfile({
                uid: user.uid,
                displayName: user.displayName || 'Usuario',
                email: user.email || 'usuario@example.com',
                avatarUrl: user.photoURL || '',
            });
          }
        } catch (error) {
            // This catch block will now mostly handle network errors or other unexpected issues,
            // as the main permission error for banned users is handled above.
            console.error("Error fetching user data:", error);
            // Redirecting to login is a safe fallback.
            router.push("/login");
        }
      } else {
        router.push("/login");
      }
      setIsLoadingProfile(false);
    });
    return () => unsubscribe();
  }, [router]);

  const isPrivilegedUser = userRole === 'admin' || userRole === 'moderator';

  const navItems = [
    { href: "/dashboard/profile", icon: User, label: "Perfil" },
    { href: "/dashboard/teams", icon: Users, label: "Mi Equipo" },
    { href: "/dashboard/marketplace", icon: Store, label: "Marketplace" },
    { href: "/dashboard/tournaments", icon: Trophy, label: "Torneos" },
    { href: "/dashboard/scrims", icon: Swords, label: "Scrims" },
    { href: "/dashboard/ai-coach", icon: BrainCircuit, label: "Coach AI" },
    { href: "/dashboard/chat", icon: MessageSquare, label: "Chat" },
    { href: "/dashboard/inbox", icon: Inbox, label: "Bandeja de Entrada" },
  ];
  
  if (isPrivilegedUser) {
    navItems.push({ href: "/dashboard/admin", icon: Shield, label: "Panel Admin" });
  }


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

  if (userProfile?.isBanned && (!userProfile.banExpiresAt || userProfile.banExpiresAt.toDate() > new Date())) {
    return <BannedScreen banExpiresAt={userProfile.banExpiresAt.toDate().toISOString()} />;
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex flex-col w-64 bg-card border-r">
        <div className="flex-1 flex flex-col gap-6 p-4">
          <Link href="/dashboard/profile" className="px-2">
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
            <NotificationsInbox />
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
                                Describe tu problema y nuestros moderadores te ayudaran a categorizarlo para una respuesta más rápida.
                            </DialogDescription>
                        </DialogHeader>
                        {userProfile && <SupportForm userProfile={userProfile} />}
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
