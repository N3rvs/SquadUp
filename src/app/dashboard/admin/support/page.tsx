'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, getDocs, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, ArrowLeft } from 'lucide-react';
import { useAuthRole } from '@/hooks/useAuthRole';

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  status: 'new' | 'in-progress' | 'resolved';
  userDisplayName: string;
  createdAt: string;
}

type TicketStatus = 'new' | 'in-progress' | 'resolved';

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TicketStatus>('new');
  const { isLoading: isRoleLoading } = useAuthRole();

  useEffect(() => {
    if (isRoleLoading) return;

    const fetchTickets = async () => {
      setIsLoading(true);
      try {
        const ticketsRef = collection(db, 'supportTickets');
        const q = query(ticketsRef, where('status', '==', activeTab), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedTickets = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
          return {
            id: doc.id,
            subject: data.subject,
            category: data.category,
            status: data.status,
            userDisplayName: data.userDisplayName,
            createdAt: format(createdAt, "PPP 'a las' p", { locale: es }),
          };
        });
        setTickets(fetchedTickets as SupportTicket[]);
      } catch (error) {
        console.error('Error fetching support tickets:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTickets();
  }, [activeTab, isRoleLoading]);

  const getStatusVariant = (status: TicketStatus) => {
    switch (status) {
      case 'new': return 'default';
      case 'in-progress': return 'secondary';
      case 'resolved': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Bandeja de Soporte</h1>
          <p className="text-muted-foreground">Visualiza y gestiona las solicitudes de los usuarios.</p>
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
          <CardTitle>Tickets por Estado</CardTitle>
          <CardDescription>Utiliza las pestañas para filtrar las solicitudes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TicketStatus)}>
            <TabsList>
              <TabsTrigger value="new">Nuevos</TabsTrigger>
              <TabsTrigger value="in-progress">En Progreso</TabsTrigger>
              <TabsTrigger value="resolved">Resueltos</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="pt-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : tickets.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Asunto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>{ticket.userDisplayName}</TableCell>
                        <TableCell className="font-medium">{ticket.subject}</TableCell>
                        <TableCell>{ticket.category}</TableCell>
                        <TableCell>{ticket.createdAt}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                   <div className="text-center py-10">
                      <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-xl font-semibold">No hay tickets en esta categoría</h3>
                   </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
