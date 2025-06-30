
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth, functions } from '@/lib/firebase';
import { httpsCallable, FunctionsError } from "firebase/functions";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDays } from 'date-fns';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import { MoreHorizontal, Loader2, Edit, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuthRole } from '@/hooks/useAuthRole';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type UserData = {
    uid: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    primaryRole?: string;
    isBanned?: boolean;
    banExpiresAt?: Timestamp | null;
    createdAt: string;
};

const securityRoles = ['admin', 'moderator', 'player', 'coach', 'fundador'];
const banOptions = {
    'none': 'No Baneado',
    '1day': 'Banear 24 horas',
    '7days': 'Banear 7 días',
    '30days': 'Banear 30 días',
    'permanent': 'Baneo Permanente',
};
type BanOptionKey = keyof typeof banOptions;

const editUserFormSchema = z.object({
  role: z.string().refine(val => securityRoles.includes(val)),
  banOption: z.custom<BanOptionKey>(val => typeof val === 'string' && Object.keys(banOptions).includes(val)),
});

function getErrorMessage(error: any): string {
    if (error instanceof FunctionsError) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "La operación o el usuario no fue encontrado en el servidor.";
            case 'invalid-argument':
                return "Los datos enviados son incorrectos. Por favor, revisa la información.";
            default:
                return `Ocurrió un error con la función: ${error.message}`;
        }
    }
    return "Ocurrió un error desconocido al contactar con el servidor.";
}

function UserEditDialog({ user, open, onOpenChange, onUserUpdate }: { user: UserData | null, open: boolean, onOpenChange: (open: boolean) => void, onUserUpdate: () => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<z.infer<typeof editUserFormSchema>>({
        resolver: zodResolver(editUserFormSchema),
        defaultValues: {
            role: 'player',
            banOption: 'none',
        }
    });

    useEffect(() => {
        if (user) {
            let currentBanOption: BanOptionKey = 'none';
            const isCurrentlyBanned = user.isBanned && user.banExpiresAt && user.banExpiresAt.toDate() > new Date();
            
            if (isCurrentlyBanned) {
                if (user.banExpiresAt!.toDate().getFullYear() >= 3000) {
                    currentBanOption = 'permanent';
                }
            }
            
            form.reset({
                role: user.primaryRole || 'player',
                banOption: currentBanOption,
            });
        }
    }, [user, form]);
    
    if (!user) return null;

    const isTemporarilyBanned = user.isBanned && user.banExpiresAt && user.banExpiresAt.toDate() > new Date() && user.banExpiresAt.toDate().getFullYear() < 3000;

    const onSubmit = async (data: z.infer<typeof editUserFormSchema>) => {
        setIsSaving(true);
        
        if (!auth.currentUser) {
            toast({ variant: 'destructive', title: 'Error de Autenticación', description: 'No estás autenticado.' });
            setIsSaving(false);
            return;
        }

        try {
            await auth.currentUser.getIdToken(true);

            let banExpiresAt: string | null;
            switch (data.banOption) {
                case '1day': banExpiresAt = addDays(new Date(), 1).toISOString(); break;
                case '7days': banExpiresAt = addDays(new Date(), 7).toISOString(); break;
                case '30days': banExpiresAt = addDays(new Date(), 30).toISOString(); break;
                case 'permanent': banExpiresAt = new Date('3000-01-01').toISOString(); break;
                default: banExpiresAt = null;
            }

            const isBanned = banExpiresAt !== null;

            // Call Cloud Functions for security changes
            const setUserRoleFunc = httpsCallable(functions, 'setUserRoleAndSync');
            await setUserRoleFunc({ uid: user.uid, role: data.role });

            const banUserFunc = httpsCallable(functions, 'banUser');
            await banUserFunc({ uid: user.uid, isBanned });
            
            toast({ title: 'Usuario actualizado', description: 'Los cambios se han guardado. La interfaz puede tardar en reflejar todos los cambios.' });
            onUserUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error al actualizar', description: getErrorMessage(error) });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Usuario: {user.displayName}</DialogTitle>
                    <DialogDescription>
                        Modifica el rol y el estado de baneo del usuario.
                        {isTemporarilyBanned && (
                            <span className="text-destructive font-semibold block mt-2">
                                Baneado hasta {format(user.banExpiresAt!.toDate(), "P 'a las' p", { locale: es })}.
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rol de Seguridad</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona un rol" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {securityRoles.map(role => (
                                                <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>Este rol de seguridad se sincronizará con el rol principal.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="banOption"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Estado de Baneo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona un estado de baneo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.entries(banOptions).map(([key, value]) => (
                                                <SelectItem key={key} value={key}>{value}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>El baneo se aplicará inmediatamente. Seleccionar 'No Baneado' levantará cualquier suspensión activa.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Cancelar</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                 </Form>
            </DialogContent>
        </Dialog>
    )
}

export default function UsersAdminPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const { role: adminRole } = useAuthRole();

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedUsers = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    uid: doc.id,
                    createdAt: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A'
                } as UserData;
            });
            setUsers(fetchedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los usuarios.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);
    
    const [userToEdit, setUserToEdit] = useState<UserData | null>(null);

    return (
        <div className="grid gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Gestión de Usuarios</h1>
                    <p className="text-muted-foreground">Administra todos los usuarios de la plataforma.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard/admin">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel
                    </Link>
                </Button>
            </div>
            
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-2">
                           {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol Principal</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Registrado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(user => {
                                const isCurrentlyBanned = user.isBanned && (!user.banExpiresAt || user.banExpiresAt.toDate() > new Date());
                                const isCurrentUser = auth.currentUser?.uid === user.uid;
                                return (
                                <TableRow key={user.uid} className={isCurrentlyBanned ? 'bg-destructive/10' : ''}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.avatarUrl} />
                                                <AvatarFallback>{user.displayName.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <Link href={`/dashboard/profile/${user.uid}`} className="font-medium hover:underline">
                                                {user.displayName}
                                            </Link>
                                        </div>
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell><Badge variant="outline">{user.primaryRole}</Badge></TableCell>
                                    <TableCell>
                                        {isCurrentlyBanned && user.banExpiresAt && user.banExpiresAt.toDate().getFullYear() < 3000 ? (
                                            <Badge variant="destructive">
                                                Baneado hasta {format(user.banExpiresAt.toDate(), "P", { locale: es })}
                                            </Badge>
                                        ) : isCurrentlyBanned ? (
                                             <Badge variant="destructive">Baneado</Badge>
                                        ) : null}
                                    </TableCell>
                                    <TableCell>{user.createdAt}</TableCell>
                                    <TableCell className="text-right">
                                        {adminRole === 'admin' && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={isCurrentUser}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setUserToEdit(user)}>
                                                        <Edit className="mr-2 h-4 w-4"/>
                                                        Editar Usuario
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                    )}
                </CardContent>
            </Card>

            <UserEditDialog 
                user={userToEdit} 
                open={!!userToEdit} 
                onOpenChange={(open) => !open && setUserToEdit(null)}
                onUserUpdate={() => {
                    fetchUsers();
                    setUserToEdit(null);
                }}
            />
        </div>
    );
}
