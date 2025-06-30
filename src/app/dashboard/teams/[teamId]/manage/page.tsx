
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthRole } from '@/hooks/useAuthRole';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, Loader2, Trash2, Users, X } from 'lucide-react';
import { getTeamApplications, processApplication, deleteTeamAction, type Application } from './actions';


function TeamManagementSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-3/4" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-2">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                <CardContent className="flex justify-start">
                    <Skeleton className="h-10 w-32" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function TeamManagePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const { role } = useAuthRole();
    
    const teamId = typeof params.teamId === 'string' ? params.teamId : '';
    const [teamName, setTeamName] = useState('');
    const [isOwnerOrStaff, setIsOwnerOrStaff] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoadingApps, setIsLoadingApps] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchTeamData = useCallback(async (uid: string, userRole: string | null) => {
        const teamDocRef = doc(db, "teams", teamId);
        const teamDocSnap = await getDoc(teamDocRef);

        if (!teamDocSnap.exists()) {
            toast({ variant: "destructive", title: "Equipo no encontrado" });
            router.push('/dashboard/teams');
            return;
        }

        const teamData = teamDocSnap.data();
        setTeamName(teamData.name);

        const isManager = teamData.ownerId === uid || userRole === 'admin' || userRole === 'moderator';
        setIsOwnerOrStaff(isManager);
        
        if (!isManager) {
            toast({ variant: "destructive", title: "Acceso denegado" });
            router.push(`/dashboard/teams/${teamId}`);
        }
    }, [teamId, router, toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const idTokenResult = await currentUser.getIdTokenResult(true);
                const userClaimRole = idTokenResult.claims.role as string | null;
                await fetchTeamData(currentUser.uid, userClaimRole);
            } else {
                router.push('/login');
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [fetchTeamData, router]);
    

    const fetchApplications = useCallback(async () => {
        if (!isOwnerOrStaff) return;
        setIsLoadingApps(true);
        const result = await getTeamApplications(teamId);
        if (result.success && result.applications) {
            // Filter to only show pending applications, not invites or processed ones.
            const pendingApplications = result.applications.filter(
                (app): app is Application => app.type === 'application' && app.status === 'pending'
            );
            setApplications(pendingApplications);
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
        setIsLoadingApps(false);
    }, [teamId, toast, isOwnerOrStaff]);

    useEffect(() => {
        if (!isLoading && isOwnerOrStaff) {
            fetchApplications();
        }
    }, [isLoading, isOwnerOrStaff, fetchApplications]);
    
    const handleApplication = async (applicationId: string, decision: 'accept' | 'reject') => {
        setIsProcessing(applicationId);
        const result = await processApplication(applicationId, decision === 'accept');
        if (result.success) {
            toast({ title: "Éxito", description: `Solicitud ${decision === 'accept' ? 'aceptada' : 'rechazada'}.` });
            setApplications(prev => prev.filter(app => app.id !== applicationId));
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
        setIsProcessing(null);
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        const result = await deleteTeamAction(teamId);
         if (result.success) {
            toast({ title: "Éxito", description: "El equipo ha sido eliminado." });
            router.push('/dashboard/teams');
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
        setIsDeleting(false);
    };

    if (isLoading || !isOwnerOrStaff) {
        return <TeamManagementSkeleton />;
    }

    return (
        <div className="space-y-8">
            <div>
                <Button variant="outline" asChild className="mb-4">
                    <Link href={`/dashboard/teams/${teamId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Equipo
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Gestionar Equipo: {teamName}</h1>
                <p className="text-muted-foreground">Administra las solicitudes y la configuración de tu equipo.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Solicitudes Pendientes</CardTitle>
                    <CardDescription>Revisa los jugadores que quieren unirse a tu equipo.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingApps ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : applications.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Jugador</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {applications.map(app => (
                                    <TableRow key={app.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={app.userAvatarUrl} />
                                                    <AvatarFallback>{app.userDisplayName?.substring(0, 2) ?? 'NA'}</AvatarFallback>
                                                </Avatar>
                                                <Link href={`/dashboard/profile/${app.userId}`} className="font-medium hover:underline">
                                                    {app.userDisplayName || 'Usuario Desconocido'}
                                                </Link>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mr-2"
                                                onClick={() => handleApplication(app.id, 'reject')}
                                                disabled={isProcessing === app.id}
                                            >
                                                {isProcessing === app.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handleApplication(app.id, 'accept')}
                                                disabled={isProcessing === app.id}
                                            >
                                                {isProcessing === app.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            <Users className="mx-auto h-12 w-12" />
                            <p className="mt-4">No hay solicitudes pendientes.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {role === 'admin' && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                        <CardDescription>Estas acciones son irreversibles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar Equipo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro de que quieres eliminar este equipo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará el equipo permanentemente.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                         {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Sí, eliminar equipo
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
