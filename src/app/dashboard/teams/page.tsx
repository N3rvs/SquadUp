
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { collection, query, getDocs, doc, getDoc, addDoc, orderBy, deleteDoc, updateDoc, Timestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const valorantRanks = ["Cualquiera", "Hierro", "Bronce", "Plata", "Oro", "Platino", "Diamante", "Ascendente", "Inmortal", "Radiante"];

interface Team {
  id: string;
  name: string;
  logo: string;
  banner: string;
  bio: string;
  members: number;
  role: string;
  ownerId: string;
  minRank: string;
  maxRank: string;
  seekingCoach: boolean;
  videoUrl: string;
}

interface UserProfile {
  primaryRole?: 'player' | 'moderator' | 'admin';
}

const teamFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre del equipo debe tener al menos 3 caracteres." }).max(30, { message: "El nombre del equipo no puede tener más de 30 caracteres." }),
  bio: z.string().max(200, "La biografía no puede exceder los 200 caracteres.").optional(),
  minRank: z.string({ required_error: "Debes seleccionar un rango mínimo." }),
  maxRank: z.string({ required_error: "Debes seleccionar un rango máximo." }),
  seekingCoach: z.boolean().default(false).optional(),
  videoUrl: z.string().url("Por favor, introduce una URL de YouTube o similar válida.").optional().or(z.literal('')),
}).refine(data => {
    if (data.minRank && data.maxRank) {
        const minIndex = valorantRanks.indexOf(data.minRank);
        const maxIndex = valorantRanks.indexOf(data.maxRank);
        if (minIndex === -1 || maxIndex === -1) return true;
        return minIndex <= maxIndex;
    }
    return true;
}, {
    message: "El rango mínimo no puede ser superior al máximo.",
    path: ["minRank"],
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

interface TeamFormFieldsProps {
  control: Control<TeamFormValues>;
  logoInputRef: React.RefObject<HTMLInputElement>;
  bannerInputRef: React.RefObject<HTMLInputElement>;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => void;
  logoPreview: string | null;
  bannerPreview: string | null;
  isReadOnly: boolean;
}

interface TeamGridProps {
  teamList: Team[];
  user: User | null;
  profile: UserProfile | null;
  setSelectedTeam: (team: Team) => void;
  onManageDialogChange: (open: boolean) => void;
}

function TeamFormFields({
  control,
  logoInputRef,
  bannerInputRef,
  handleImageChange,
  logoPreview,
  bannerPreview,
  isReadOnly,
}: TeamFormFieldsProps) {
  return (
    <>
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
    </>
  );
}

function TeamGrid({ teamList, user, profile, setSelectedTeam, onManageDialogChange }: TeamGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {teamList.map((team) => {
        const canManage = user?.uid === team.ownerId || profile?.primaryRole === 'admin' || profile?.primaryRole === 'moderator';
        return (
          <Card key={team.id} className="flex flex-col overflow-hidden">
            <div className="relative h-36 w-full">
              <Image
                src={team.banner}
                alt={`${team.name} banner`}
                fill
                className="w-full h-full object-cover"
                data-ai-hint="team banner"
              />
              <div className="absolute -bottom-8 left-4">
                <Avatar className="h-16 w-16 border-4 border-card bg-card">
                  <AvatarImage src={team.logo} alt={`${team.name} logo`} data-ai-hint="team logo" />
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
                <span>{team.members}/5 Miembros</span>
              </div>
              {team.seekingCoach && (
                <Badge variant="secondary"><Briefcase className="mr-1 h-3 w-3" /> Buscando Coach</Badge>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => { setSelectedTeam(team); onManageDialogChange(true); }}>
                {canManage ? <Edit className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {canManage ? "Gestionar Equipo" : "Ver Equipo"}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
          <Card key={i} className="overflow-hidden">
          <div className="relative h-36 w-full bg-muted"><Skeleton className="w-full h-full" /></div>
              <CardHeader className="pt-12">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full mt-2" />
              <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-1/3" />
              </CardContent>
              <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
          </Card>
      ))}
      </div>
  );
}


export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("explorar");

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

  const fetchTeams = useCallback(async (userId: string | null) => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "teams"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTeams: Team[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let role = "";
        if (userId && data.memberIds?.includes(userId)) {
          role = data.ownerId === userId ? "Founder" : "Member";
        }
        return {
          id: doc.id,
          name: data.name || "Unnamed Team",
          logo: data.logoUrl || "https://placehold.co/128x128.png",
          banner: data.bannerUrl || "https://placehold.co/400x150.png",
          bio: data.bio || "Este equipo aún no tiene biografía.",
          members: data.memberIds?.length || 1,
          role: role,
          ownerId: data.ownerId,
          minRank: data.minRank || "Cualquiera",
          maxRank: data.maxRank || "Radiante",
          seekingCoach: data.seekingCoach || false,
          videoUrl: data.videoUrl || "",
        };
      });
      setTeams(fetchedTeams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast({ variant: "destructive", title: "Error al cargar equipos", description: "No se pudieron cargar los equipos." });
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
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      await fetchTeams(currentUser?.uid || null);
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
      if (!file.type.startsWith("image/")) {
        toast({ variant: "destructive", title: "Tipo de archivo inválido", description: "Por favor, selecciona un archivo de imagen." });
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

  const resetPreviews = useCallback(() => {
    setLogoFile(null);
    setLogoPreview(null);
    setBannerFile(null);
    setBannerPreview(null);
  }, []);

  const onCreateDialogChange = useCallback((open: boolean) => {
    if (!open) {
      resetPreviews();
      form.reset();
    }
    setIsCreateDialogOpen(open);
  }, [form, resetPreviews]);

  const onManageDialogChange = useCallback((open: boolean) => {
    setIsManageDialogOpen(open);
    if (!open) {
      setSelectedTeam(null);
      resetPreviews();
      form.reset();
    } else if (selectedTeam) {
      form.reset({
        name: selectedTeam.name,
        bio: selectedTeam.bio,
        minRank: selectedTeam.minRank,
        maxRank: selectedTeam.maxRank,
        seekingCoach: selectedTeam.seekingCoach,
        videoUrl: selectedTeam.videoUrl
      });
      setLogoPreview(selectedTeam.logo);
      setBannerPreview(selectedTeam.banner);
    }
  }, [form, resetPreviews, selectedTeam]);
  
  const uploadImage = useCallback(async (file: File, path: string): Promise<string> => {
    const fileRef = storageRef(storage, path);
    const uploadResult = await uploadBytes(fileRef, file);
    return getDownloadURL(uploadResult.ref);
  }, []);

  const handleCreateTeam = useCallback(async (data: TeamFormValues) => {
    if (!user) {
      toast({ variant: "destructive", title: "No autenticado", description: "Debes iniciar sesión para crear un equipo." });
      return;
    }
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "teams"), {
        ...data,
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: Timestamp.now(),
        logoUrl: 'https://placehold.co/128x128.png',
        bannerUrl: 'https://placehold.co/400x150.png',
      });

      const teamId = docRef.id;
      let logoUrl = 'https://placehold.co/128x128.png';
      let bannerUrl = 'https://placehold.co/400x150.png';

      if (logoFile) {
        logoUrl = await uploadImage(logoFile, `team-logos/${teamId}/${logoFile.name}`);
      }
      if (bannerFile) {
        bannerUrl = await uploadImage(bannerFile, `team-banners/${teamId}/${bannerFile.name}`);
      }
      
      await updateDoc(doc(db, "teams", teamId), { logoUrl, bannerUrl });

      toast({ title: "¡Equipo Creado!", description: "Tu nuevo equipo ha sido creado con éxito." });
      await fetchTeams(user.uid);
      onCreateDialogChange(false);
    } catch (error) {
      console.error("Error creating team:", error);
      toast({ variant: "destructive", title: "Error al crear el equipo", description: "Hubo un problema al guardar tu equipo." });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, logoFile, bannerFile, uploadImage, toast, fetchTeams, onCreateDialogChange]);

  const handleUpdateTeam = useCallback(async (data: TeamFormValues) => {
    if (!user || !selectedTeam || !profile) return;

    const canManage = user.uid === selectedTeam.ownerId || profile.primaryRole === 'admin' || profile.primaryRole === 'moderator';
    if (!canManage) {
        toast({ variant: "destructive", title: "Sin permisos", description: "No tienes permiso para editar este equipo." });
        return;
    }

    setIsSubmitting(true);
    try {
      let logoUrl = selectedTeam.logo;
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, `team-logos/${selectedTeam.id}/${logoFile.name}`);
      }
      let bannerUrl = selectedTeam.banner;
      if (bannerFile) {
        bannerUrl = await uploadImage(bannerFile, `team-banners/${selectedTeam.id}/${bannerFile.name}`);
      }

      await updateDoc(doc(db, "teams", selectedTeam.id), { ...data, logoUrl, bannerUrl });

      toast({ title: "¡Equipo Actualizado!", description: "Los cambios se han guardado." });
      await fetchTeams(user.uid);
      onManageDialogChange(false);
    } catch (error) {
      console.error("Error updating team:", error);
      toast({ variant: "destructive", title: "Error al actualizar", description: "Hubo un problema al guardar los cambios." });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedTeam, profile, logoFile, bannerFile, uploadImage, toast, fetchTeams, onManageDialogChange]);

  const handleDeleteTeam = useCallback(async () => {
    if (!user || !selectedTeam || !profile) return;

    const canManage = user.uid === selectedTeam.ownerId || profile.primaryRole === 'admin' || profile.primaryRole === 'moderator';
    if (!canManage) {
        toast({ variant: "destructive", title: "Sin permisos", description: "No tienes permiso para eliminar este equipo." });
        return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "teams", selectedTeam.id));
      toast({ title: "Equipo eliminado", description: "El equipo ha sido eliminado con éxito." });
      await fetchTeams(user.uid);
      onManageDialogChange(false);
    } catch (error) {
      console.error("Error deleting team:", error);
      toast({ variant: "destructive", title: "Error al eliminar", description: "No se pudo eliminar el equipo." });
    } finally {
      setIsDeleting(false);
    }
  }, [user, selectedTeam, profile, toast, fetchTeams, onManageDialogChange]);

  const myTeams = teams.filter(team => team.role);
  
  const isPrivilegedUser = profile?.primaryRole === 'admin' || profile?.primaryRole === 'moderator';
  const canCreateTeam = !!(user && profile && isPrivilegedUser);
  const isOwner = selectedTeam && user ? user.uid === selectedTeam.ownerId : false;
  const canManageSelectedTeam = !!(selectedTeam && user && profile && (isOwner || isPrivilegedUser));

  return (
    <div>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Equipos</h1>
            <p className="text-muted-foreground">Explora los equipos existentes o únete a uno.</p>
          </div>
          <div>
            {isLoading ? (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...
              </Button>
            ) : canCreateTeam ? (
              <Dialog open={isCreateDialogOpen} onOpenChange={onCreateDialogChange}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Crear Equipo
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Crear un Nuevo Equipo</DialogTitle><DialogDescription>Dale una identidad a tu equipo para empezar a competir.</DialogDescription></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateTeam)} className="space-y-6 pr-2">
                      <TeamFormFields 
                          control={form.control}
                          logoInputRef={logoInputRef}
                          bannerInputRef={bannerInputRef}
                          handleImageChange={handleImageChange}
                          logoPreview={logoPreview}
                          bannerPreview={bannerPreview}
                          isReadOnly={false}
                      />
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isSubmitting ? "Creando..." : "Crear Equipo"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            ) : (
                <Button disabled>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Equipo
                </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="explorar">Explorar Equipos</TabsTrigger>
            <TabsTrigger value="mis-equipos">Mis Equipos</TabsTrigger>
          </TabsList>
          <TabsContent value="explorar" className="pt-4">
            {isLoading ? <LoadingSkeleton /> : (teams.length > 0 ? <TeamGrid teamList={teams} user={user} profile={profile} setSelectedTeam={setSelectedTeam} onManageDialogChange={onManageDialogChange} /> : <Card className="col-span-full"><CardContent className="flex flex-col items-center justify-center text-center p-10 gap-4"><Users className="h-12 w-12 text-muted-foreground" /><h3 className="text-xl font-semibold">No hay equipos creados</h3><p className="text-muted-foreground">Sé el primero en crear uno para empezar a competir.</p></CardContent></Card>))}
          </TabsContent>
          <TabsContent value="mis-equipos" className="pt-4">
            {isLoading ? <LoadingSkeleton /> : (myTeams.length > 0 ? <TeamGrid teamList={myTeams} user={user} profile={profile} setSelectedTeam={setSelectedTeam} onManageDialogChange={onManageDialogChange} /> : <Card className="col-span-full"><CardContent className="flex flex-col items-center justify-center text-center p-10 gap-4"><Users className="h-12 w-12 text-muted-foreground" /><h3 className="text-xl font-semibold">No perteneces a ningún equipo</h3><p className="text-muted-foreground">Explora los equipos existentes o crea uno si tienes permisos.</p></CardContent></Card>))}
          </TabsContent>
        </Tabs>
      </div>
      
      {selectedTeam && (
         <Dialog open={isManageDialogOpen} onOpenChange={onManageDialogChange}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {canManageSelectedTeam ? `Gestionar: ${selectedTeam.name}` : `Viendo: ${selectedTeam.name}`}
              </DialogTitle>
              <DialogDescription>
                {canManageSelectedTeam
                    ? "Ajusta la configuración de tu equipo. Los cambios serán visibles públicamente."
                    : "Estás viendo el perfil de este equipo."
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdateTeam)} className="space-y-6 pr-2">
                <TeamFormFields 
                    control={form.control}
                    logoInputRef={logoInputRef}
                    bannerInputRef={bannerInputRef}
                    handleImageChange={handleImageChange}
                    logoPreview={logoPreview}
                    bannerPreview={bannerPreview}
                    isReadOnly={!canManageSelectedTeam}
                />
                
                {canManageSelectedTeam ? (
                  <DialogFooter className="sm:justify-between flex-wrap gap-2 pt-4">
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                      <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar Equipo</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Esto eliminará permanentemente el equipo.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteTeam} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <div className="flex gap-2">
                      <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                      <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isSubmitting ? "Guardando..." : "Guardar Cambios"}</Button>
                  </div>
                  </DialogFooter>
                ) : (
                  <DialogFooter className="pt-4">
                      <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>
                  </DialogFooter>
                )}
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
