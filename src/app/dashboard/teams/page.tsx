"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, getDocs, doc, getDoc, addDoc, orderBy } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Users, Camera, Eye } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Team {
  id: string;
  name: string;
  logo: string;
  members: number;
  role: string;
}

interface UserProfile {
  primaryRole?: 'player' | 'moderator' | 'admin';
}

const teamFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre del equipo debe tener al menos 3 caracteres." }).max(30, { message: "El nombre del equipo no puede tener más de 30 caracteres." }),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { name: "" },
    mode: "onChange",
  });

  const fetchTeams = async (userId: string | null) => {
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
          logo: data.logoUrl || "https://placehold.co/64x64.png",
          members: data.memberIds?.length || 1,
          role: role,
        };
      });
      setTeams(fetchedTeams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast({ variant: "destructive", title: "Error al cargar equipos", description: "No se pudieron cargar los equipos." });
    }
  };

  useEffect(() => {
    setIsLoading(true);
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
      await fetchTeams(currentUser?.uid || null);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Archivo demasiado grande", description: "La imagen del logo debe ser menor de 2MB." });
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast({ variant: "destructive", title: "Tipo de archivo inválido", description: "Por favor, selecciona un archivo de imagen." });
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const onDialogOpenChange = (open: boolean) => {
    if (!open) {
      setLogoPreview(null);
      setLogoFile(null);
      form.reset();
    }
    setIsCreateDialogOpen(open);
  };
  
  async function onSubmit(data: TeamFormValues) {
    if (!user) {
      toast({ variant: "destructive", title: "No autenticado", description: "Debes iniciar sesión para crear un equipo." });
      return;
    }
    setIsSubmitting(true);
    try {
      let logoUrl = "https://placehold.co/128x128.png";
      if (logoFile) {
        const fileRef = storageRef(storage, `team-logos/${user.uid}/${Date.now()}_${logoFile.name}`);
        const uploadResult = await uploadBytes(fileRef, logoFile);
        logoUrl = await getDownloadURL(uploadResult.ref);
      }

      await addDoc(collection(db, "teams"), {
        name: data.name,
        logoUrl: logoUrl,
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: new Date().toISOString(),
      });

      toast({ title: "¡Equipo Creado!", description: "Tu nuevo equipo ha sido creado con éxito." });
      await fetchTeams(user.uid);
      onDialogOpenChange(false);
    } catch (error) {
      console.error("Error creating team:", error);
      toast({ variant: "destructive", title: "Error al crear el equipo", description: "Hubo un problema al guardar tu equipo. Por favor, inténtalo de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const canCreateTeam = user && profile && (profile.primaryRole === 'admin' || profile.primaryRole === 'moderator');
  
  const createTeamButton = (
    <Button disabled={isLoading || !canCreateTeam}>
      <PlusCircle className="mr-2 h-4 w-4" />
      Crear Equipo
    </Button>
  );

  return (
    <Dialog open={isCreateDialogOpen} onOpenChange={onDialogOpenChange}>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Equipos</h1>
            <p className="text-muted-foreground">Explora los equipos existentes o crea el tuyo.</p>
          </div>
          
          <DialogTrigger asChild>
              {isLoading ? (
                  <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...</Button>
              ) : !canCreateTeam ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        {createTeamButton}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Solo los moderadores y administradores pueden crear equipos.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                createTeamButton
              )}
          </DialogTrigger>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-5 w-24" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
          </div>
        ) : teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card key={team.id}>
                <CardHeader className="flex flex-row items-center gap-4">
                  <Image
                    src={team.logo}
                    alt={`${team.name} logo`}
                    width={64}
                    height={64}
                    className="rounded-lg object-cover h-16 w-16"
                    data-ai-hint="team logo"
                  />
                  <div>
                    <CardTitle className="font-headline text-xl">{team.name}</CardTitle>
                    {team.role && <CardDescription>{team.role}</CardDescription>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p>{team.members}/5 Miembros</p>
                  </div>
                </CardContent>
                <CardFooter>
                    {team.role ? (
                        <Button variant="outline" className="w-full">Gestionar Equipo</Button>
                    ) : (
                        <Button variant="outline" className="w-full"><Eye className="mr-2 h-4 w-4" />Ver Equipo</Button>
                    )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center text-center p-10 gap-4">
                  <Users className="h-12 w-12 text-muted-foreground" />
                  <h3 className="text-xl font-semibold">No hay equipos creados</h3>
                  <p className="text-muted-foreground">
                      Sé el primero en crear uno para empezar a competir.
                  </p>
                  <DialogTrigger asChild>
                    {createTeamButton}
                  </DialogTrigger>
              </CardContent>
          </Card>
        )}
      </div>

       <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear un Nuevo Equipo</DialogTitle>
              <DialogDescription>
                  Dale un nombre y un logo a tu equipo para empezar.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="flex flex-col items-center gap-4">
                      <div className="relative w-fit cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                          <Avatar className="h-24 w-24">
                              <AvatarImage src={logoPreview || undefined} alt="Team logo preview" />
                              <AvatarFallback><Users className="h-10 w-10" /></AvatarFallback>
                          </Avatar>
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity">
                          <Camera className="h-8 w-8 text-white"/>
                          </div>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      </div>
                      <p className="text-sm text-muted-foreground">Sube el logo de tu equipo (opcional)</p>
                  </div>
                  <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Nombre del Equipo</FormLabel>
                              <FormControl>
                              <Input placeholder="Ej: Cyber Eagles" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                    <DialogFooter>
                      <DialogClose asChild>
                          <Button type="button" variant="ghost">Cancelar</Button>
                      </DialogClose>
                      <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isSubmitting ? "Creando..." : "Crear Equipo"}
                      </Button>
                  </DialogFooter>
              </form>
            </Form>
      </DialogContent>
    </Dialog>
  );
}
