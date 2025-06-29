"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Mail } from "lucide-react";
import Link from "next/link";
import { AssignRoleWithEmail } from "@/components/admin/AssignRoleWithEmail";
import { useAuthRole } from "@/hooks/useAuthRole";

export default function AdminDashboardPage() {
  const { role, isLoading } = useAuthRole();

  return (
    <div className="grid gap-8">
       <div>
        <h1 className="text-3xl font-bold font-headline">Panel de Administración</h1>
        <p className="text-muted-foreground">Herramientas para la gestión de la comunidad y la plataforma.</p>
       </div>
       <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/admin/support">
            <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Tickets de Soporte</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Gestionar las solicitudes de soporte de los usuarios.</p>
                </CardContent>
            </Card>
        </Link>
        
        {!isLoading && role === 'admin' && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Gestión de Usuarios</CardTitle>
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
