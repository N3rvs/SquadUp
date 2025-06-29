'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, Shield, Users, Trophy, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function AdminNav() {
    const pathname = usePathname();
    const navItems = [
        { href: "/dashboard/admin", label: "Dashboard", icon: Shield },
        { href: "/dashboard/admin/users", label: "Usuarios", icon: Users },
        { href: "/dashboard/admin/tournaments", label: "Torneos", icon: Trophy },
        { href: "/dashboard/admin/support", label: "Soporte", icon: Mail },
    ];

    return (
        <nav className="grid items-start gap-2">
            {navItems.map((item, index) => (
                <Link key={index} href={item.href}>
                    <Button variant={pathname === item.href ? 'secondary' : 'ghost'} className="w-full justify-start">
                         <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                    </Button>
                </Link>
            ))}
        </nav>
    );
}


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult(true);
          const userRole = idTokenResult.claims.role;

          if (userRole === 'admin' || userRole === 'moderator') {
            setIsAuthorized(true);
          } else {
            router.push('/dashboard');
          }
        } catch (error) {
            console.error("Authorization check failed:", error);
            router.push('/dashboard');
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
      <div className="flex h-full w-full items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="grid min-h-[calc(100vh_-_theme(spacing.16))] w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] gap-6">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <h2 className="text-lg font-semibold">Panel de Admin</h2>
          </div>
          <div className="flex-1 p-4">
            <AdminNav />
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  );
}
