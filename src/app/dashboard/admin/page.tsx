"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Users, Trophy, Mail, Shield, Loader2, ArrowRight } from "lucide-react";
import { useAuthRole } from "@/hooks/useAuthRole";
import { AssignRoleWithEmail } from "@/components/admin/AssignRoleWithEmail";

interface Stats {
    totalUsers: number;
    pendingTournaments: number;
    openSupportTickets: number;
}

const adminTools = [
    {
        href: "/dashboard/admin/users",
        icon: Users,
        title: "Gestión de Usuarios",
        description: "Ver, editar y eliminar usuarios de la plataforma."
    },
    {
        href: "/dashboard/admin/tournaments",
        icon: Trophy,
        title: "Gestión de Torneos",
        description: "Aprobar, rechazar y administrar todos los torneos."
    },
    {
        href: "/dashboard/admin/support",
        icon: Mail,
        title: "Bandeja de Soporte",
        description: "Gestionar y responder a las solicitudes de los usuarios."
    }
];

export default function AdminDashboardPage() {
    const { role, isLoading: isRoleLoading } = useAuthRole();
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isRoleLoading) {
            return;
        }

        if (role !== 'admin' && role !== 'moderator') {
            setIsLoading(false);
            return;
        }

        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const usersRef = collection(db, "users");
                const tournamentsRef = collection(db, "tournaments");
                const supportTicketsRef = collection(db, "supportTickets");

                const usersSnapshotPromise = getDocs(usersRef);
                const pendingTournamentsPromise = getDocs(query(tournamentsRef, where("status", "==", "Pending")));
                const openTicketsPromise = getDocs(query(supportTicketsRef, where("status", "==", "new")));

                const [usersSnapshot, pendingTournamentsSnapshot, openTicketsSnapshot] = await Promise.all([
                    usersSnapshotPromise,
                    pendingTournamentsPromise,
                    openTicketsPromise
                ]);

                setStats({
                    totalUsers: usersSnapshot.size,
                    pendingTournaments: pendingTournamentsSnapshot.size,
                    openSupportTickets: openTicketsSnapshot.size,
                });
            } catch (error) {
                console.error("Error fetching admin stats:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchStats();
    }, [role, isRoleLoading]);

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
                <p className="text-muted-foreground">Vista general y herramientas de gestión de la plataforma.</p>
            </div>
            {isLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.totalUsers}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Torneos Pendientes</CardTitle>
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.pendingTournaments}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tickets de Soporte</CardTitle>
                            <Mail className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.openSupportTickets}</div>
                        </CardContent>
                    </Card>
                </div>
            )}
            
            <div className="grid gap-6">
                 <div>
                    <h2 className="text-2xl font-bold font-headline">Herramientas de Administración</h2>
                    <p className="text-muted-foreground">Accede a las diferentes secciones de gestión.</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {adminTools.map((tool) => (
                        <Link key={tool.href} href={tool.href} className="flex">
                            <Card className="flex flex-col w-full hover:border-primary transition-colors">
                                <CardHeader>
                                    <div className="flex items-center gap-4">
                                        <div className="bg-secondary p-3 rounded-md">
                                            <tool.icon className="h-6 w-6 text-primary" />
                                        </div>
                                        <CardTitle className="text-lg">{tool.title}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-muted-foreground text-sm">{tool.description}</p>
                                </CardContent>
                                <CardFooter>
                                    <p className="text-sm font-medium text-primary flex items-center gap-1">
                                        Gestionar <ArrowRight className="h-4 w-4" />
                                    </p>
                                </CardFooter>
                            </Card>
                        </Link>
                    ))}
                    {role === 'admin' && (
                        <Card className="flex flex-col">
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className="bg-secondary p-3 rounded-md">
                                        <Shield className="h-6 w-6 text-primary" />
                                    </div>
                                    <CardTitle className="text-lg">Gestión de Roles</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                               <p className="text-muted-foreground text-sm mb-4">Asigna un rol a un usuario por su email.</p>
                               <AssignRoleWithEmail />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
