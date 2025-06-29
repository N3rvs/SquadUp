"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Trophy, Mail, Shield, Loader2 } from "lucide-react";
import { getAdminDashboardStats } from "./actions";
import { useAuthRole } from "@/hooks/useAuthRole";
import { AssignRoleWithEmail } from "@/components/admin/AssignRoleWithEmail";

interface Stats {
    totalUsers: number;
    pendingTournaments: number;
    openSupportTickets: number;
}

export default function AdminDashboardPage() {
    const { role } = useAuthRole();
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            const result = await getAdminDashboardStats();
            if (result.success) {
                setStats(result.stats);
            }
            setIsLoading(false);
        }
        fetchStats();
    }, []);

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
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {role === 'admin' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Gestión de Roles Rápida</CardTitle>
                            <CardDescription>Asigna un rol a un usuario por su email.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AssignRoleWithEmail />
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
