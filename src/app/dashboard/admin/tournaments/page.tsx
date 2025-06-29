
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, Loader2, Trophy, X } from 'lucide-react';
import { getAdminTournaments, updateTournamentStatusAction } from './actions';

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

export default function TournamentsAdminPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TournamentStatus>('Pending');
    const { toast } = useToast();

    const fetchTournaments = async () => {
        setIsLoading(true);
        const result = await getAdminTournaments();
        if (result.success && result.tournaments) {
            setTournaments(result.tournaments as Tournament[]);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleUpdateStatus = async (id: string, status: 'Open' | 'Rejected') => {
        setIsUpdating(id);
        const result = await updateTournamentStatusAction(id, status);
        if (result.success) {
            toast({ title: 'Éxito', description: `El torneo ha sido ${status === 'Open' ? 'aprobado' : 'rechazado'}.` });
            fetchTournaments();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsUpdating(null);
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
