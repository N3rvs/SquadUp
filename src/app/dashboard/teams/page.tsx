
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Users, Camera, Eye, Trash2, Edit, Briefcase, ShieldCheck, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// --- TYPE DEFINITIONS ---

interface Team {
  id: string;
  name: string;
  logoUrl: string;
  bannerUrl: string;
  bio: string;
  ownerId: string;
  memberIds: string[];
  minRank: string;
  maxRank: string;
  seekingCoach: boolean;
  videoUrl: string;
  createdAt: Timestamp;
}

interface UserProfile {
  primaryRole?: 'player' | 'moderator' | 'admin';
}

const valorantRanks = ["Cualquiera", "Hierro", "Bronce", "Plata", "Oro", "Platino", "Diamante", "Ascendente", "Inmortal", "Radiante"];

const teamFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre del equipo debe tener al menos 3 caracteres." }).max(30, { message: "El nombre del equipo no puede tener más de 30 caracteres." }),
  bio: z.string().max(200, "La biografía no puede exceder los 200 caracteres.").optional(),
  minRank: z.string({ required_error: "Debes seleccionar un rango mínimo." }),
  maxRank: z.string({ required_error: "Debes seleccionar un rango máximo." }),
  seekingCoach: z.boolean().default(false).optional(),
  videoUrl: z.string().url("Por favor, introduce una URL de YouTube o similar válida.").optional().or(z.literal('')),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

// --- HELPER COMPONENTS ---

function TeamFormFields({
  control,
  logoInputRef,
  bannerInputRef,
  handleImageChange,
  logoPreview,
  bannerPreview,
  isReadOnly,
}: {
  control: Control<TeamFormValues>;
  logoInputRef: React.RefObject<HTMLInputElement>;
  bannerInputRef: React.RefObject<HTMLInputElement>;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => void;
  logoPreview: string | null;
  bannerPreview: string | null;
  isReadOnly: boolean;
}) {
  return (
    <div className="space-y-6 pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div>
          <FormLabel>Logo del Equipo</FormLabel>
          <div className={`relative mt-2 w-fit mx-auto sm:mx-0 ${!isReadOnly && 'cursor-pointer'}`} onClick={() => !isReadOnly && logoInputRef.current?.click()}>
              <Avatar className="h-24 w-24">
                  <AvatarImage src={logoPreview || undefined} alt="Team logo preview" />
                  <AvatarFallback><Users className="h-10 w-10" /></AvatarFallback>
              </Avatar>
              {!isReadOnly && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity">
                    <Camera className="h-8 w-8 text-white"/>
                </div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'logo')} disabled={isReadOnly} />
          </div>
        </div>
        <div>
          <FormLabel>Banner del Equipo</FormLabel>
          <div className={`relative mt-2 aspect-video w-full rounded-md border border-dashed flex items-center justify-center ${!isReadOnly && 'cursor-pointer'}`} onClick={() => !isReadOnly && bannerInputRef.current?.click()}>
            {bannerPreview ? (
              <Image src={bannerPreview} fill alt="Banner preview" className="rounded-md object-cover" />
            ) : (
              <div className="text-center text-muted-foreground p-2">
                <Upload className="mx-auto h-8 w-8"/>
                <p className="text-xs">Click para subir (16:9)</p>
              </div>
            )}
             <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'banner')} disabled={isReadOnly} />
          </div>
        </div>
      </div>
      <FormField control={control} name="name" render={({ field }) => (
        <FormItem><FormLabel>Nombre del Equipo</FormLabel><FormControl><Input placeholder="Ej: Cyber Eagles" {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem>
      )}/>
      <FormField control={control} name="bio" render={({ field }) => (
        <FormItem><FormLabel>Biografía del Equipo</FormLabel><FormControl><Textarea placeholder="Nuestra misión, estilo de juego..." {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem>
      )}/>
      <FormField control={control} name="videoUrl" render={({ field }) => (
        <FormItem><FormLabel>Video de Presentación (URL)</FormLabel><FormControl><Input placeholder="https://youtube.com/watch?v=..." {...field} readOnly={isReadOnly} /></FormControl><FormMessage /></FormItem>
      )}/>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control} name="minRank" render={({ field }) => (
          <FormItem><FormLabel>Rango Mínimo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rango" /></SelectTrigger></FormControl><SelectContent>{valorantRanks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
        )}/>
        <FormField control={control} name="maxRank" render={({ field }) => (
          <FormItem><FormLabel>Rango Máximo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rango" /></SelectTrigger></FormControl><SelectContent>{valorantRanks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
        )}/>
      </div>
      <FormField control={control} name="seekingCoach" render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Buscando Coach</FormLabel><FormDescription>Activa si buscas un coach para tu equipo.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isReadOnly} /></FormControl></FormItem>
      )}/>
    </div>
  );
}

function TeamCard({ team, user, profile, onManageClick }: { team: Team, user: User | null, profile: UserProfile | null, onManageClick: (team: Team) => void }) {
    const isOwner = user?.uid === team.ownerId;
    const isAdmin = profile?.primaryRole === 'admin' || profile?.primaryRole === 'moderator';
    const canManage = isOwner || isAdmin;

    return (
        <Card className="flex flex-col overflow-hidden">
            <div className="relative h-36 w-full">
            <Image
                src={team.bannerUrl || 'https://placehold.co/400x150.png'}
                alt={`${team.name} banner`}
                fill
                className="w-full h-full object-cover"
                data-ai-hint="team banner"
            />
            <div className="absolute -bottom-8 left-4">
                <Avatar className="h-16 w-16 border-4 border-card bg-card">
                <AvatarImage src={team.logoUrl || 'https://placehold.co/128x128.png'} alt={`${team.name} logo`} data-ai-hint="team logo" />
                <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
            </div>
            </div>
            <CardHeader className="pt-12">
            <CardTitle className="font-headline text-xl truncate">{team.name}</CardTitle>
            <CardDescription className="line-clamp-2 h-10">{team.bio}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
            <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Rango: {team.minRank} - {team.maxRank}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>{team.memberIds.length}/5 Miembros</span>
            </div>
            {team.seekingCoach && (
                <Badge variant="secondary"><Briefcase className="mr-1 h-3 w-3" /> Buscando Coach</Badge>
            )}
            </CardContent>
            <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => onManageClick(team)}>
                {canManage ? <Edit className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {canManage ? "Gestionar Equipo" : "Ver Equipo"}
            </Button>
            </CardFooter>
        </Card>
    );
}

function LoadingSkeleton() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="relative h-36 w-full bg-muted">
              <Skeleton className="w-full h-full" />
            </div>
            <CardHeader className="pt-12">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full mt-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
}

// --- MAIN COMPONENT ---

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dialogState, setDialogState] = useState<{
    mode: 'create' | 'manage' | null;
    team: Team | null;
    isOpen: boolean;
  }>({ mode: null, team: null, isOpen: false });

  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: "",
      bio: "",
      minRank: "Cualquiera",
      maxRank: "Radiante",
      seekingCoach: false,
      videoUrl: ""
    },
    mode: "onChange",
  });

  const fetchTeams = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "teams"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTeams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(fetchedTeams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast({ variant: "destructive", title: "Error al cargar equipos" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        setProfile(docSnap.exists() ? (docSnap.data() as UserProfile) : null);
      } else {
        setProfile(null);
      }
      await fetchTeams();
    });
    return () => unsubscribe();
  }, [fetchTeams]);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Archivo demasiado grande", description: "La imagen debe ser menor de 2MB." });
        return;
      }
      if (type === 'logo') {
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
      } else {
        setBannerFile(file);
        setBannerPreview(URL.createObjectURL(file));
      }
    }
  }, [toast]);

  const resetFormAndPreviews = useCallback(() => {
    form.reset({ name: "", bio: "", minRank: "Cualquiera", maxRank: "Radiante", seekingCoach: false, videoUrl: "" });
    setLogoFile(null);
    setLogoPreview(null);
    setBannerFile(null);
    setBannerPreview(null);
  }, [form]);

  const handleOpenDialog = useCallback((mode: 'create' | 'manage', team: Team | null = null) => {
    resetFormAndPreviews();
    if (mode === 'manage' && team) {
      form.reset(team);
      setLogoPreview(team.logoUrl);
      setBannerPreview(team.bannerUrl);
    }
    setDialogState({ mode, team, isOpen: true });
  }, [resetFormAndPreviews, form]);

  const handleCloseDialog = useCallback(() => {
    setDialogState({ mode: null, team: null, isOpen: false });
  }, []);

  const uploadImage = useCallback(async (file: File, path: string): Promise<string> => {
    const fileRef = storageRef(storage, path);
    const uploadResult = await uploadBytes(fileRef, file);
    return getDownloadURL(uploadResult.ref);
  }, []);
  

  const handleFormSubmit = useCallback(async (data: TeamFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (dialogState.mode === 'create') {
        const newTeamRef = await addDoc(collection(db, "teams"), {
            ...data,
            ownerId: user.uid,
            memberIds: [user.uid],
            createdAt: Timestamp.now(),
            logoUrl: '',
            bannerUrl: '',
        });
        const teamId = newTeamRef.id;
        let updateData: { logoUrl?: string; bannerUrl?: string } = {};
        if (logoFile) updateData.logoUrl = await uploadImage(logoFile, `team-logos/${teamId}/logo`);
        if (bannerFile) updateData.bannerUrl = await uploadImage(bannerFile, `team-banners/${teamId}/banner`);
        if (Object.keys(updateData).length > 0) await updateDoc(doc(db, "teams", teamId), updateData);
        toast({ title: "¡Equipo Creado!" });

      } else if (dialogState.mode === 'manage' && dialogState.team) {
        const teamId = dialogState.team.id;
        let updateData: any = { ...data };
        if (logoFile) updateData.logoUrl = await uploadImage(logoFile, `team-logos/${teamId}/logo`);
        if (bannerFile) updateData.bannerUrl = await uploadImage(bannerFile, `team-banners/${teamId}/banner`);
        await updateDoc(doc(db, "teams", teamId), updateData);
        toast({ title: "¡Equipo Actualizado!" });
      }
      await fetchTeams();
      handleCloseDialog();
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({ variant: "destructive", title: "Error", description: "Hubo un problema al guardar." });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, dialogState, logoFile, bannerFile, uploadImage, toast, fetchTeams, handleCloseDialog]);

  const handleDeleteTeam = useCallback(async () => {
    if (!dialogState.team) return;
    setIsSubmitting(true);
    try {
        await deleteDoc(doc(db, "teams", dialogState.team.id));
        toast({ title: "Equipo eliminado" });
        await fetchTeams();
        handleCloseDialog();
    } catch (error) {
        console.error("Error deleting team:", error);
        toast({ variant: "destructive", title: "Error al eliminar" });
    } finally {
        setIsSubmitting(false);
    }
  }, [dialogState.team, toast, fetchTeams, handleCloseDialog]);

  const isPrivilegedUser = profile?.primaryRole === 'admin' || profile?.primaryRole === 'moderator';
  const myTeams = teams.filter(team => user && team.memberIds.includes(user.uid));

  const isOwner = dialogState.team && user ? user.uid === dialogState.team.ownerId : false;
  const canManageSelectedTeam = dialogState.team && user && profile && (isOwner || isPrivilegedUser);
  const canCreateTeam = isPrivilegedUser;

  return (
    <div>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Equipos</h1>
            <p className="text-muted-foreground">Explora los equipos existentes o únete a uno.</p>
          </div>
          <Button onClick={() => handleOpenDialog('create')} disabled={!canCreateTeam}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Equipo
          </Button>
        </div>

        <Tabs defaultValue="explorar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="explorar">Explorar Equipos</TabsTrigger>
            <TabsTrigger value="mis-equipos">Mis Equipos</TabsTrigger>
          </TabsList>
          <TabsContent value="explorar" className="pt-4">
            {isLoading ? <LoadingSkeleton /> : teams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map(team => <TeamCard key={team.id} team={team} user={user} profile={profile} onManageClick={() => handleOpenDialog('manage', team)} />)}
                </div>
            ) : <Card><CardContent className="text-center p-10"><Users className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-xl font-semibold">No hay equipos creados</h3></CardContent></Card>}
          </TabsContent>
          <TabsContent value="mis-equipos" className="pt-4">
          {isLoading ? <LoadingSkeleton /> : myTeams.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myTeams.map(team => <TeamCard key={team.id} team={team} user={user} profile={profile} onManageClick={() => handleOpenDialog('manage', team)} />)}
                </div>
            ) : <Card><CardContent className="text-center p-10"><Users className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-xl font-semibold">No perteneces a ningún equipo</h3></CardContent></Card>}
          </TabsContent>
        </Tabs>
      </div>
      
      <Dialog open={dialogState.isOpen} onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogState.mode === 'create' ? 'Crear Nuevo Equipo' : canManageSelectedTeam ? `Gestionar: ${dialogState.team?.name}` : `Viendo: ${dialogState.team?.name}`}</DialogTitle>
            <DialogDescription>{dialogState.mode === 'create' ? 'Dale una identidad a tu equipo.' : 'Aquí puedes ver o editar los detalles del equipo.'}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              <TeamFormFields 
                  control={form.control}
                  logoInputRef={logoInputRef}
                  bannerInputRef={bannerInputRef}
                  handleImageChange={handleImageChange}
                  logoPreview={logoPreview}
                  bannerPreview={bannerPreview}
                  isReadOnly={!canManageSelectedTeam && dialogState.mode === 'manage'}
              />
              <DialogFooter className="sm:justify-between flex-wrap gap-2 pt-4">
                {canManageSelectedTeam ? (
                    <>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará el equipo permanentemente.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteTeam} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={handleCloseDialog}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}{dialogState.mode === 'create' ? 'Crear Equipo' : 'Guardar Cambios'}</Button>
                    </div>
                    </>
                ) : (
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>Cerrar</Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
