
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, type DocumentData } from "firebase/firestore";
import { httpsCallable, FunctionsError } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";
import { getCountryCode } from "@/lib/countries";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Briefcase, Globe, ShieldCheck, Users, Target, MoreHorizontal, Search, Loader2, Crown, Trash2, Edit } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { applyToTeam } from "./actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { valorantRoles } from "@/lib/valorant";


// --- TYPE DEFINITIONS ---

interface Team {
  id: string;
  name: string;
  logoUrl: string;
  bannerUrl: string;
  bio?: string;
  ownerId: string;
  memberIds: string[];
  minRank: string;
  maxRank: string;
  isRecruiting?: boolean;
  seekingCoach?: boolean;
  seekingRoles?: string[];
  videoUrl?: string;
  country: string;
}

interface TeamMember extends DocumentData {
    uid: string;
    displayName: string;
    avatarUrl: string;
    valorantRoles: string[];
    primaryRole?: string;
}

interface UserProfile {
  primaryRole?: 'player' | 'moderator' | 'admin' | 'founder' | 'coach';
}

const rolesFormSchema = z.object({
  roles: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Debes seleccionar al menos un rol.",
  }),
});

function getYoutubeEmbedUrl(url?: string): string | null {
    if (!url) return null;
    let videoId;
    const youtubeRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    if (match && match[1]) {
        videoId = match[1];
    } else {
        return null;
    }
    return `https://www.youtube.com/embed/${videoId}`;
}

// --- HELPER COMPONENTS ---

function TeamPageSkeleton() {
    return (
        <div className="space-y-8">
            <Skeleton className="h-10 w-36" />
            <div className="relative">
                <Skeleton className="h-60 w-full rounded-lg" />
                 <div className="absolute -bottom-12 left-6 md:left-10">
                    <Skeleton className="h-24 w-24 md:h-32 md:w-32 rounded-full border-4 border-background" />
                </div>
            </div>
             <div className="pt-16 px-2 md:px-4">
                <Skeleton className="h-10 w-1/2 mb-2" />
                <Skeleton className="h-5 w-3/4" />
             </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-48" />
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => (
                       <Card key={i}><CardContent className="pt-6"><div className="flex flex-col items-center gap-2"><Skeleton className="h-20 w-20 rounded-full" /><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-16" /></div></CardContent></Card>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

function getErrorMessage(error: any): string {
    if (error instanceof FunctionsError) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "El recurso solicitado no fue encontrado. Verifica la información.";
            case 'invalid-argument':
                return "Los datos enviados son incorrectos. Por favor, revisa la información.";
            default:
                return `Ocurrió un error con la función: ${error.message}`;
        }
    }
    return "Ocurrió un error desconocido al contactar con el servidor.";
}

// --- MAIN COMPONENT ---

export default function TeamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const teamId = typeof params.teamId === 'string' ? params.teamId : '';

  const [isApplying, setIsApplying] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<'idle' | 'applied' | 'member'>('idle');
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const [memberToKick, setMemberToKick] = useState<TeamMember | null>(null);
  const [isKicking, setIsKicking] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);
  const [isUpdatingRoles, setIsUpdatingRoles] = useState(false);

  const rolesForm = useForm<z.infer<typeof rolesFormSchema>>({
    resolver: zodResolver(rolesFormSchema),
    defaultValues: {
      roles: [],
    },
  });

  useEffect(() => {
    if (memberToEdit) {
      rolesForm.reset({
        roles: memberToEdit.valorantRoles || [],
      });
    }
  }, [memberToEdit, rolesForm]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchTeamAndMembers = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    // Only check application status if a user might be logged in
    if (user !== undefined) {
        setIsCheckingStatus(true);
    }

    try {
      const teamDocRef = doc(db, "teams", teamId);
      const teamDocSnap = await getDoc(teamDocRef);

      if (!teamDocSnap.exists()) {
        toast({ variant: "destructive", title: "Equipo no encontrado" });
        router.push("/dashboard/teams");
        return;
      }
      const teamData = { id: teamDocSnap.id, ...teamDocSnap.data() } as Team;
      setTeam(teamData);

      if (user) {
        if (teamData.memberIds.includes(user.uid)) {
          setApplicationStatus('member');
        } else {
          const applicationsRef = collection(db, "teamApplications");
          const q = query(applicationsRef, where("teamId", "==", teamId), where("userId", "==", user.uid), where("status", "==", "pending"));
          const appSnapshot = await getDocs(q);
          setApplicationStatus(!appSnapshot.empty ? 'applied' : 'idle');
        }
      } else {
        setApplicationStatus('idle');
      }

      if (teamData.memberIds && teamData.memberIds.length > 0) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("uid", "in", teamData.memberIds));
        const querySnapshot = await getDocs(q);
        const fetchedMembers = querySnapshot.docs.map(doc => doc.data() as TeamMember);
        setMembers(fetchedMembers);
      }

    } catch (error) {
      console.error("Error fetching team details:", error);
      toast({ variant: "destructive", title: "Error al cargar el equipo" });
    } finally {
      setIsLoading(false);
      setIsCheckingStatus(false);
    }
  }, [teamId, router, toast, user]);

  useEffect(() => {
    fetchTeamAndMembers();
  }, [fetchTeamAndMembers]);


  const handleApply = async () => {
    if (!user || !team) return;
    setIsApplying(true);
    const result = await applyToTeam(team.id, user.uid);
    if (result.success) {
      setApplicationStatus('applied');
      toast({ title: "¡Solicitud Enviada!", description: "Tu solicitud para unirte al equipo ha sido enviada." });
    } else {
      toast({ variant: "destructive", title: "Error en la solicitud", description: result.error });
    }
    setIsApplying(false);
  };
  
  const handleKickMember = async () => {
    if (!memberToKick || !team || !auth.currentUser) return;
    setIsKicking(true);
    try {
        await auth.currentUser.getIdToken(true);
        const kickTeamMemberFunc = httpsCallable(functions, 'kickTeamMember');
        await kickTeamMemberFunc({ teamId: team.id, memberId: memberToKick.uid });
        toast({ title: "Miembro expulsado", description: `${memberToKick.displayName} ha sido eliminado del equipo.` });
        setMemberToKick(null);
        fetchTeamAndMembers();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error al expulsar", description: getErrorMessage(error) });
    } finally {
        setIsKicking(false);
    }
  };

  const handleUpdateRoles = async (data: z.infer<typeof rolesFormSchema>) => {
    if (!memberToEdit || !team || !auth.currentUser) return;
    
    setIsUpdatingRoles(true);
    try {
        await auth.currentUser.getIdToken(true); // Force token refresh
        const updateRolesFunc = httpsCallable(functions, 'updateTeamMemberRoles');
        
        await updateRolesFunc({ 
            teamId: team.id, 
            memberId: memberToEdit.uid,
            roles: data.roles 
        });

        toast({ title: "Roles actualizados", description: `Los roles de juego de ${memberToEdit.displayName} han sido actualizados.` });
        setMemberToEdit(null);
        fetchTeamAndMembers(); // Refresh data
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error al actualizar roles", description: getErrorMessage(error) });
    } finally {
        setIsUpdatingRoles(false);
    }
  };

  if (isLoading) {
    return <TeamPageSkeleton />;
  }

  if (!team) {
    return (
        <div className="text-center py-10">
            <p>No se pudo cargar la información del equipo.</p>
            <Button asChild variant="link" className="mt-4"><Link href="/dashboard/teams">Volver a Equipos</Link></Button>
        </div>
    );
  }

  const countryCode = getCountryCode(team.country);
  const embedUrl = getYoutubeEmbedUrl(team.videoUrl);
  const isManager = user && team && profile && (
    user.uid === team.ownerId ||
    profile.primaryRole === 'admin' ||
    profile.primaryRole === 'moderator' ||
    profile.primaryRole === 'founder'
  );
  
  const canApply = user && team.isRecruiting && applicationStatus === 'idle';

  return (
    <div className="space-y-8">
       <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>
      <div className="relative">
        <div className="relative h-48 md:h-64 w-full overflow-hidden rounded-lg">
            <Image
                src={team.bannerUrl || 'https://placehold.co/1200x400.png'}
                alt={`${team.name} banner`}
                fill
                className="object-cover"
                data-ai-hint="team banner abstract"
            />
        </div>
        <div className="absolute -bottom-12 left-6 md:left-10">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background bg-background">
                <AvatarImage src={team.logoUrl || 'https://placehold.co/128x128.png'} alt={`${team.name} logo`} data-ai-hint="team logo gaming" />
                <AvatarFallback>{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
        </div>
      </div>
      
      <div className="pt-16 px-2 md:px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
                 <h1 className="text-3xl md:text-4xl font-bold font-headline">{team.name}</h1>
                 <p className="text-muted-foreground mt-1 max-w-prose">{team.bio}</p>
            </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
            <Badge variant="secondary" className="text-sm py-1 px-3"><ShieldCheck className="mr-2 h-4 w-4 text-primary" />Rango: {team.minRank} - {team.maxRank}</Badge>
            <Badge variant="secondary" className="text-sm py-1 px-3"><Users className="mr-2 h-4 w-4 text-primary" />{members.length}/{5} Miembros</Badge>
            {team.country && (
                <Badge variant="secondary" className="text-sm py-1 px-3 inline-flex items-center gap-1.5">
                    {countryCode ? (
                        <Image 
                            src={`https://flagsapi.com/${countryCode}/flat/16.png`} 
                            alt={team.country}
                            width={16}
                            height={16}
                            className="rounded-sm" 
                        />
                    ) : (
                        <Globe className="h-4 w-4 text-primary" />
                    )}
                    {team.country}
                </Badge>
            )}
            {team.isRecruiting && <Badge variant="default" className="text-sm py-1 px-3"><Search className="mr-2 h-4 w-4" /> Reclutando</Badge>}
            {team.seekingCoach && <Badge variant="secondary" className="text-sm py-1 px-3"><Briefcase className="mr-2 h-4 w-4 text-primary" /> Buscando Coach</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Miembros del Equipo</CardTitle>
                    <CardDescription>Conoce a los jugadores que forman parte de {team.name}.</CardDescription>
                </CardHeader>
                <CardContent>
                    {members.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Jugador</TableHead>
                                    <TableHead>Roles de Juego</TableHead>
                                    {isManager && <TableHead className="text-right">Acciones</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map(member => (
                                    <TableRow key={member.uid}>
                                        <TableCell>
                                            <div className="flex items-center gap-4">
                                                <Avatar>
                                                    <AvatarImage src={member.avatarUrl || undefined} alt={member.displayName} />
                                                    <AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/dashboard/profile/${member.uid}`} className="font-medium hover:underline">
                                                        {member.displayName}
                                                    </Link>
                                                    {team.ownerId === member.uid && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <Crown className="h-4 w-4 text-yellow-500" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Fundador del Equipo</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {member.valorantRoles?.map(role => (
                                                    <Badge key={role} variant="outline">{role}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        {isManager && (
                                            <TableCell className="text-right">
                                                {user?.uid !== member.uid && team.ownerId !== member.uid && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">Abrir menú</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => setMemberToEdit(member)}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Cambiar Rol de Juego
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setMemberToKick(member)}>
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Expulsar
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No se encontraron miembros para este equipo.</p>
                    )}
                </CardContent>
            </Card>
            {embedUrl && (
                <Card className="overflow-hidden">
                    <CardContent className="p-0">
                        <div className="aspect-video">
                            <iframe
                                className="w-full h-full"
                                src={embedUrl}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
        <div className="md:col-span-1 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>¿Quieres unirte?</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        {team.isRecruiting ? '¿Crees que tienes lo que se necesita? ¡Envía tu solicitud!' : 'Este equipo no está reclutando actualmente.'}
                    </p>
                    <Button 
                        className="w-full" 
                        onClick={handleApply}
                        disabled={isCheckingStatus || !canApply || isApplying}
                    >
                        {(isApplying || isCheckingStatus) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isCheckingStatus ? "Verificando..." :
                            isApplying ? "Enviando..." : 
                            applicationStatus === 'applied' ? "Solicitud Enviada" : 
                            applicationStatus === 'member' ? "Ya eres miembro" :
                            "Aplicar al Equipo"
                        }
                    </Button>
                </CardContent>
            </Card>
            {team.seekingRoles && team.seekingRoles.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Buscando Roles
                        </CardTitle>
                        <CardDescription>El equipo está reclutando activamente para estas posiciones.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        {team.seekingRoles.map(role => (
                            <Badge key={role} variant="default">{role}</Badge>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
      </div>

       <AlertDialog open={!!memberToKick} onOpenChange={(open) => !open && setMemberToKick(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de que quieres expulsar a {memberToKick?.displayName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. El jugador será eliminado permanentemente del equipo.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleKickMember} disabled={isKicking} className="bg-destructive hover:bg-destructive/90">
                        {isKicking && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Sí, expulsar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!memberToEdit} onOpenChange={(open) => !open && setMemberToEdit(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cambiar Roles de Juego de {memberToEdit?.displayName}</DialogTitle>
                    <DialogDescription>
                        Selecciona los roles que este jugador desempeñará en el equipo.
                    </DialogDescription>
                </DialogHeader>
                <Form {...rolesForm}>
                    <form onSubmit={rolesForm.handleSubmit(handleUpdateRoles)} className="space-y-6 pt-4">
                        <FormField
                            control={rolesForm.control}
                            name="roles"
                            render={() => (
                                <FormItem>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {valorantRoles.map((role) => (
                                    <FormField
                                        key={role}
                                        control={rolesForm.control}
                                        name="roles"
                                        render={({ field }) => {
                                        return (
                                            <FormItem key={role} className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(role)}
                                                        onCheckedChange={(checked) => {
                                                            return checked
                                                            ? field.onChange([...field.value, role])
                                                            : field.onChange(field.value?.filter((value) => value !== role));
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">{role}</FormLabel>
                                            </FormItem>
                                        );
                                        }}
                                    />
                                    ))}
                                </div>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setMemberToEdit(null)}>Cancelar</Button>
                            <Button type="submit" disabled={rolesForm.formState.isSubmitting || isUpdatingRoles}>
                                {(rolesForm.formState.isSubmitting || isUpdatingRoles) && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </div>
  );
}
