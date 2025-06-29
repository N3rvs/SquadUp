"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User,
  Users,
  Store,
  Trophy,
  Swords,
  UserPlus,
  LogOut,
  BrainCircuit,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const navItems = [
    { href: "/dashboard/profile", icon: User, label: "Perfil" },
    { href: "/dashboard/teams", icon: Users, label: "Equipos" },
    { href: "/dashboard/marketplace", icon: Store, label: "Marketplace" },
    { href: "/dashboard/tournaments", icon: Trophy, label: "Torneos" },
    { href: "/dashboard/scrims", icon: Swords, label: "Scrims" },
    { href: "/dashboard/friends", icon: UserPlus, label: "Amigos" },
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
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
