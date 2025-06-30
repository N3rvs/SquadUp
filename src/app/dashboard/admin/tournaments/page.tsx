
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { httpsCallable, FunctionsError } from "firebase/functions";
import { doc, updateDoc, collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { auth, functions, db } from '@/lib/firebase';
import { ArrowLeft, Check, Loader2, Trophy, X } from 'lucide-react';
import { useAuthRole } from '@/hooks/useAuthRole';

type TournamentStatus = 'Pending' | 'Open' | 'In Progress' | 'Finished' | 'Rejected';

interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  startDate: string;
  createdAt: string;
  creatorId: string;
}

const statusTabs: TournamentStatus[] = ['Pending', 'Open', 'Rejected', 'In Progress', 'Finished'];

const getStatusVariant = (status: Tournament['status']) => {
  switch (status) {
    case 'Pending': return 'outline';
    case 'Open': return 'secondary';
    case 'In Progress': return 'default';
    case 'Finished': return 'outline';
    case 'Rejected': return 'destructive';
    default: return 'outline';
  }
};

function getErrorMessage(error: any): string {
    if (error instanceof FunctionsError) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "La operación solicitada no fue encontrada en el servidor. Verifica que la función esté desplegada en la región correcta.";
            case 'invalid-argument':
                return "Los datos enviados son incorrectos. Por favor, revisa la información.";
            case 'already-exists':
                 return "El torneo ya ha sido aprobado o está en un estado que no permite esta acción.";
            default:
                return `Ocurrió un error con la función: ${error.message}`;
        }
    }
    return "Ocurrió un error desconocido al contactar con el servidor.";
}

export default function TournamentsAdminPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TournamentStatus>('Pending');
    const { toast } = useToast();
    const { isLoading: isRoleLoading } = useAuthRole();

    const fetchTournaments = useCallback(async () => {
        setIsLoading(true);
        try {
            const tournamentsRef = collection(db, "tournaments");
            const q = query(tournamentsRef, orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedTournaments = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                    startDate: (data.startDate as Timestamp).toDate().toISOString(),
                } as Tournament;
            });
            setTournaments(fetchedTournaments);
        } catch (error) {
            console.error("Error fetching tournaments for admin:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Failed to fetch tournaments." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (isRoleLoading) return;
        fetchTournaments();
    }, [fetchTournaments, isRoleLoading]);

    const handleUpdateStatus = async (tournamentId: string, status: 'Open' | 'Rejected') => {
        setIsUpdating(tournamentId);
        
        if (!auth.currentUser) {
            toast({ variant: 'destructive', title: 'Error de Autenticación', description: 'No estás autenticado. Por favor, inicia sesión de nuevo.' });
            setIsUpdating(null);
            return;
        }

        try {
            await auth.currentUser.getIdToken(true); // Force token refresh
            
            const approveTournamentFunc = httpsCallable(functions, 'approveTournament');
            const approved = status === 'Open';
            await approveTournamentFunc({ tournamentId, approved });

            const tournamentRef = doc(db, 'tournaments', tournamentId);
            await updateDoc(tournamentRef, { status: status, approved: approved });

            toast({ title: 'Éxito', description: `El torneo ha sido ${status === 'Open' ? 'aprobado' : 'rechazado'}.` });
            fetchTournaments();

        } catch (error: any) {
            console.error(`Error updating tournament status to ${status}:`, error);
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        } finally {
            setIsUpdating(null);
        }
    };

    const filteredTournaments = useMemo(() => {
        return tournaments.filter(t => t.status === activeTab);
    }, [tournaments, activeTab]);

    return (
        <div className="grid gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Gestión de Torneos</h1>
                    <p className="text-muted-foreground">Administra y modera todos los torneos de la comunidad.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard/admin">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel
                    </Link>
                </Button>
            </div>
             <Card>
                <CardHeader>
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TournamentStatus)}>
                        <TabsList>
                            {statusTabs.map(tab => (
                                <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent>
                   {isLoading ? (
                       <div className="space-y-2">
                           <Skeleton className="h-12 w-full" />
                           <Skeleton className="h-12 w-full" />
                           <Skeleton className="h-12 w-full" />
                       </div>
                   ) : filteredTournaments.length > 0 ? (
                       <Table>
                           <TableHeader>
                               <TableRow>
                                   <TableHead>Nombre</TableHead>
                                   <TableHead>Fecha de Inicio</TableHead>
                                   <TableHead>Estado</TableHead>
                                   <TableHead>Acciones</TableHead>
                               </TableRow>
                           </TableHeader>
                           <TableBody>
                               {filteredTournaments.map((t) => (
                                   <TableRow key={t.id}>
                                       <TableCell className="font-medium">{t.name}</TableCell>
                                       <TableCell>{format(new Date(t.startDate), "PPP", { locale: es })}</TableCell>
                                       <TableCell><Badge variant={getStatusVariant(t.status)}>{t.status}</Badge></TableCell>
                                       <TableCell>
                                            {t.status === 'Pending' && (
                                                <div className="flex gap-2">
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline"
                                                        onClick={() => handleUpdateStatus(t.id, 'Open')}
                                                        disabled={isUpdating === t.id}
                                                    >
                                                        {isUpdating === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="destructive"
                                                        onClick={() => handleUpdateStatus(t.id, 'Rejected')}
                                                        disabled={isUpdating === t.id}
                                                    >
                                                        {isUpdating === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            )}
                                       </TableCell>
                                   </TableRow>
                               ))}
                           </TableBody>
                       </Table>
                   ) : (
                       <div className="text-center py-10">
                           <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
                           <h3 className="mt-4 text-xl font-semibold">No hay torneos en esta categoría</h3>
                       </div>
                   )}
                </CardContent>
            </Card>
        </div>
    );
}
