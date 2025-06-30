
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import {
  User,
  Users,
  Store,
  Trophy,
  Swords,
  LogOut,
  BrainCircuit,
  Inbox,
  LifeBuoy,
  Circle,
  Shield,
  UserPlus,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SupportForm } from '@/components/support-form';
import type { SecurityRole } from '@/hooks/useAuthRole';
import { BannedScreen } from '@/components/BannedScreen';
import { NotificationsInbox } from '@/components/notifications-inbox';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

interface UserProfile {
  displayName: string;
  email: string;
  avatarUrl: string;
  uid: string;
  primaryRole?: SecurityRole;
  isBanned?: boolean;
  banExpiresAt?: Timestamp;
}

function ProfileDropdown() {
    const router = useRouter();
    const { toast } = useToast();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [status, setStatus] = useState<'disponible' | 'ausente' | 'ocupado'>('disponible');

     useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            setIsLoadingProfile(true);
            const userDocRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserProfile({
                    uid: user.uid,
                    displayName: data.displayName || 'Usuario',
                    email: user.email || 'usuario@example.com',
                    avatarUrl: data.avatarUrl || '',
                    primaryRole: data.primaryRole,
                    isBanned: data.isBanned || false,
                    banExpiresAt: data.banExpiresAt || null,
                });
            } else {
                 setUserProfile({
                    uid: user.uid,
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
        disponible: { text: "Disponible", color: "text-green-500", bg: "bg-green-500" },
        ausente: { text: "Ausente", color: "text-yellow-500", bg: "bg-yellow-500" },
        ocupado: { text: "Ocupado", color: "text-red-500", bg: "bg-red-500" },
    };
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full p-0"
            >
                {isLoadingProfile ? (
                    <Skeleton className="h-9 w-9 rounded-full" />
                ) : (
                    <div className="relative h-9 w-9">
                        <Avatar className="h-full w-full">
                            <AvatarImage src={userProfile?.avatarUrl} alt={userProfile?.displayName || ''} />
                            <AvatarFallback>{userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className={cn("absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-card", statusInfo[status].bg)} />
                    </div>
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
    )
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<SecurityRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idTokenResult = await user.getIdTokenResult(true);
        const claims = idTokenResult.claims;
        setUserRole((claims.role as SecurityRole) || 'player');
      }
    });
    return () => unsubscribe();
  }, []);

  const isPrivilegedUser = userRole === 'admin' || userRole === 'moderator';

  const navItems = [
    { href: "/dashboard/profile", icon: User, label: "Perfil" },
    { href: "/dashboard/teams", icon: Users, label: "Mi Equipo" },
    { href: "/dashboard/marketplace", icon: Store, label: "Marketplace" },
    { href: "/dashboard/tournaments", icon: Trophy, label: "Torneos" },
    { href: "/dashboard/scrims", icon: Swords, label: "Scrims" },
    { href: "/dashboard/ai-coach", icon: BrainCircuit, label: "Coach AI" },
    { href: "/dashboard/friends", icon: UserPlus, label: "Amigos" },
    { href: "/dashboard/inbox", icon: Inbox, label: "Bandeja de Entrada" },
  ];

  if (isPrivilegedUser) {
    navItems.push({ href: "/dashboard/admin", icon: Shield, label: "Panel Admin" });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          {/* Footer can go here */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
          <SidebarTrigger />
          <div className="flex w-full items-center justify-end gap-2 md:gap-4">
            <NotificationsInbox />
            <ProfileDropdown />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [isBanned, setIsBanned] = useState(false);
    const [banExpiresAt, setBanExpiresAt] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const userIsBanned = data.isBanned === true;
                    const expires = data.banExpiresAt instanceof Timestamp ? data.banExpiresAt.toDate() : null;
                    
                    if (userIsBanned && (!expires || expires > new Date())) {
                        setIsBanned(true);
                        setBanExpiresAt(expires ? expires.toISOString() : new Date('3000-01-01').toISOString());
                    } else {
                        setIsBanned(false);
                    }
                }
            } else {
                router.push('/login');
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [router]);
    
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (isBanned && banExpiresAt) {
        return <BannedScreen banExpiresAt={banExpiresAt} />;
    }

    return <MainLayout>{children}</MainLayout>;
}
