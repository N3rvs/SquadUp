
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { countries, getCountryCode } from "@/lib/countries";
import { valorantRanks as allValorantRanks, valorantRoles } from "@/lib/valorant";
import { useAuthRole } from "@/hooks/useAuthRole";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Users, Camera, Briefcase, ShieldCheck, Upload, Edit, Target, Globe, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Team } from "@/components/team-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


// --- DATA & TYPE DEFINITIONS ---

interface UserProfile {
  primaryRole?: 'player' | 'moderator' | 'admin' | 'founder' | 'coach';
}

const valorantRanks = ["Any", ...allValorantRanks.filter(r => r !== 'Unranked')];

const teamFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre del equipo debe tener al menos 3 caracteres." }).max(30, { message: "El nombre del equipo no puede tener más de 30 caracteres." }),
  bio: z.string().max(200, "La biografía no puede exceder los 200 caracteres.").optional(),
  minRank: z.string({ required_error: "Debes seleccionar un rango mínimo." }),
  maxRank: z.string({ required_error: "Debes seleccionar un rango máximo." }),
  country: z.string({ required_error: "Debes seleccionar un país." }),
  seekingCoach: z.boolean().default(false).optional(),
  isRecruiting: z.boolean().default(false).optional(),
  seekingRoles: z.array(z.string()).optional(),
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
}: {
  control: Control<TeamFormValues>;
  logoInputRef: React.RefObject<HTMLInputElement>;
  bannerInputRef: React.RefObject<HTMLInputElement>;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => void;
  logoPreview: string | null;
  bannerPreview: string | null;
}) {
  return (
    <div className="space-y-6 pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div>
          <FormLabel>Logo del Equipo</FormLabel>
          <div className="relative mt-2 w-fit mx-auto sm:mx-0 cursor-pointer" onClick={() => logoInputRef.current?.click()}>
              <Avatar className="h-24 w-24">
                  <AvatarImage src={logoPreview || undefined} alt="Team logo preview" />
                  <AvatarFallback><Users className="h-10 w-10" /></AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="h-8 w-8 text-white"/>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'logo')} />
          </div>
        </div>
        <div>
          <FormLabel>Banner del Equipo</FormLabel>
          <div className="relative mt-2 aspect-video w-full rounded-md border border-dashed flex items-center justify-center cursor-pointer" onClick={() => bannerInputRef.current?.click()}>
            {bannerPreview ? (
              <Image src={bannerPreview} fill alt="Banner preview" className="rounded-md object-cover" />
            ) : (
              <div className="text-center text-muted-foreground p-2">
                <Upload className="mx-auto h-8 w-8"/>
                <p className="text-xs">Click para subir (16:9)</p>
              </div>
            )}
             <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'banner')} />
          </div>
        </div>
      </div>
      <FormField control={control} name="name" render={({ field }) => (
        <FormItem><FormLabel>Nombre del Equipo</FormLabel><FormControl><Input placeholder="Ej: Cyber Eagles" {...field} /></FormControl><FormMessage /></FormItem>
      )}/>
      <FormField control={control} name="bio" render={({ field }) => (
        <FormItem><FormLabel>Biografía del Equipo</FormLabel><FormControl><Textarea placeholder="Nuestra misión, estilo de juego..." {...field} /></FormControl><FormMessage /></FormItem>
      )}/>
      <FormField control={control} name="videoUrl" render={({ field }) => (
        <FormItem><FormLabel>Video de Presentación (URL YouTube)</FormLabel><FormControl><Input placeholder="https://youtube.com/watch?v=..." {...field} /></FormControl><FormMessage /></FormItem>
      )}/>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control} name="minRank" render={({ field }) => (
          <FormItem><FormLabel>Rango Mínimo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rango" /></SelectTrigger></FormControl><SelectContent>{valorantRanks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
        )}/>
        <FormField control={control} name="maxRank" render={({ field }) => (
          <FormItem><FormLabel>Rango Máximo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rango" /></SelectTrigger></FormControl><SelectContent>{valorantRanks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
        )}/>
      </div>

       <FormField control={control} name="country" render={({ field }) => (
          <FormItem><FormLabel>País del Equipo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger></FormControl><SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
        )}/>
      
      <FormField
        control={control}
        name="seekingRoles"
        render={() => (
          <FormItem>
             <FormLabel>Roles Buscados</FormLabel>
             <FormDescription>Marca los roles que tu equipo necesita.</FormDescription>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {valorantRoles.map((role) => (
                    <FormField
                    key={role}
                    control={control}
                    name="seekingRoles"
                    render={({ field }) => {
                        return (
                        <FormItem
                            key={role}
                            className="flex flex-row items-center space-x-2 space-y-0"
                        >
                            <FormControl>
                            <Checkbox
                                checked={field.value?.includes(role)}
                                onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                    field.onChange([...currentValue, role]);
                                } else {
                                    field.onChange(
                                    currentValue.filter((value) => value !== role)
                                    );
                                }
                                }}
                            />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">
                            {role}
                            </FormLabel>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={control} name="isRecruiting" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Buscando Miembros</FormLabel><FormDescription>Activa para aparecer en el marketplace.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )}/>
            <FormField control={control} name="seekingCoach" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Buscando Coach</FormLabel><FormDescription>Activa si buscas un coach.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )}/>
        </div>
    </div>
  );
}

function LoadingSkeleton() {
    return (
        <Card>
            <CardContent className="p-0">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                            <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                            <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                            <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <Skeleton className="h-5 w-32" />
                                </div>
                            </TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// --- MAIN COMPONENT ---

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const { role: userSecurityRole } = useAuthRole();

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
      minRank: "Any",
      maxRank: "Radiant",
      country: "Spain",
      seekingCoach: false,
      isRecruiting: false,
      seekingRoles: [],
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
    form.reset({ name: "", bio: "", minRank: "Any", maxRank: "Radiant", seekingCoach: false, isRecruiting: false, seekingRoles: [], videoUrl: "", country: "Spain" });
    setLogoFile(null);
    setLogoPreview(null);
    setBannerFile(null);
    setBannerPreview(null);
  }, [form]);


  const uploadImage = useCallback(async (file: File, path: string): Promise<string> => {
    const fileRef = storageRef(storage, path);
    const uploadResult = await uploadBytes(fileRef, file);
    return getDownloadURL(uploadResult.ref);
  }, []);

  const handleEditClick = (team: Team) => {
    setEditingTeam(team);
    form.reset({
      name: team.name,
      bio: team.bio || '',
      minRank: team.minRank,
      maxRank: team.maxRank,
      country: team.country,
      seekingCoach: team.seekingCoach || false,
      isRecruiting: team.isRecruiting || false,
      seekingRoles: team.seekingRoles || [],
      videoUrl: team.videoUrl || '',
    });
    setLogoPreview(team.logoUrl);
    setBannerPreview(team.bannerUrl);
    setIsFormDialogOpen(true);
  };
  
  const handleFormSubmit = useCallback(async (data: TeamFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (editingTeam) {
        // UPDATE LOGIC
        const teamDocRef = doc(db, "teams", editingTeam.id);
        const updateData: any = { ...data };

        if (logoFile) {
          updateData.logoUrl = await uploadImage(logoFile, `team-logos/${editingTeam.id}/logo`);
        }
        if (bannerFile) {
          updateData.bannerUrl = await uploadImage(bannerFile, `team-banners/${editingTeam.id}/banner`);
        }
        
        await updateDoc(teamDocRef, updateData);
        toast({ title: "¡Equipo Actualizado!" });
      } else {
        // CREATE LOGIC
        if (!logoFile || !bannerFile) {
            toast({ variant: "destructive", title: "Imágenes requeridas", description: "Debes subir un logo y un banner para crear el equipo." });
            setIsSubmitting(false);
            return;
        }

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
      }

      await fetchTeams();
      setIsFormDialogOpen(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({ variant: "destructive", title: "Error", description: "Hubo un problema al guardar." });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, logoFile, bannerFile, editingTeam, uploadImage, toast, fetchTeams]);

  const canCreateTeam = profile?.primaryRole === 'founder';
  const isPrivilegedUser = userSecurityRole === 'admin' || userSecurityRole === 'moderator';
  const myTeams = teams.filter(team => user && team.memberIds.includes(user.uid));

  return (
    <div>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Equipos</h1>
            <p className="text-muted-foreground">Explora los equipos existentes o únete a uno.</p>
          </div>
          <Dialog 
            open={isFormDialogOpen} 
            onOpenChange={(open) => {
              if (!open) {
                  resetFormAndPreviews();
                  setEditingTeam(null);
              }
              setIsFormDialogOpen(open);
            }}
          >
            <DialogTrigger asChild>
                {canCreateTeam ? (
                    <Button onClick={() => setIsFormDialogOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Crear Equipo
                    </Button>
                ) : (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                    <Button disabled>
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      Crear Equipo
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Solo los usuarios con el rol "Founder" pueden crear equipos.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTeam ? "Editar Equipo" : "Crear Nuevo Equipo"}</DialogTitle>
                <DialogDescription>{editingTeam ? "Modifica los detalles de tu equipo." : "Dale una identidad a tu equipo."}</DialogDescription>
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
                  />
                  <DialogFooter className="pt-4">
                      <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        {editingTeam ? "Guardar Cambios" : "Crear Equipo"}
                      </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="explorar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="explorar">Explorar Equipos</TabsTrigger>
            <TabsTrigger value="mi-equipo">Mi Equipo</TabsTrigger>
          </TabsList>
          <TabsContent value="explorar" className="pt-4">
            {isLoading ? (
              <LoadingSkeleton />
            ) : teams.length > 0 ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipo</TableHead>
                      <TableHead>País</TableHead>
                      <TableHead>Rango Requerido</TableHead>
                      <TableHead>Miembros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team) => {
                      const countryCode = getCountryCode(team.country);
                      return (
                        <TableRow key={team.id}>
                          <TableCell>
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Link
                                  href={`/dashboard/teams/${team.id}`}
                                  className="flex items-center gap-3"
                                >
                                  <Avatar className="h-10 w-10 border">
                                    <AvatarImage
                                      src={team.logoUrl}
                                      alt={team.name}
                                    />
                                    <AvatarFallback>
                                      {team.name.substring(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium hover:underline">
                                    {team.name}
                                  </span>
                                </Link>
                              </HoverCardTrigger>
                              <HoverCardContent
                                className="w-80 p-0"
                                align="start"
                              >
                                <div className="relative h-24 w-full">
                                  <Image
                                    src={
                                      team.bannerUrl ||
                                      "https://placehold.co/320x96.png"
                                    }
                                    alt={`${team.name} banner`}
                                    fill
                                    className="object-cover rounded-t-lg"
                                    data-ai-hint="team banner abstract"
                                  />
                                </div>
                                <div className="p-4 flex flex-col gap-4">
                                  <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12">
                                      <AvatarImage src={team.logoUrl} />
                                      <AvatarFallback>
                                        {team.name.substring(0, 2)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <h4 className="text-sm font-semibold">
                                      {team.name}
                                    </h4>
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {team.bio ||
                                      "Este equipo no tiene una biografía."}
                                  </p>
                                  {team.seekingRoles &&
                                    team.seekingRoles.length > 0 && (
                                      <div>
                                        <h5 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                                          <Target className="h-4 w-4" />
                                          Buscando Roles
                                        </h5>
                                        <div className="flex flex-wrap gap-1">
                                          {team.seekingRoles.map((role) => (
                                            <Badge
                                              key={role}
                                              variant="default"
                                            >
                                              {role}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  <div className="flex items-center pt-2">
                                    <Button
                                      asChild
                                      variant="link"
                                      className="p-0 h-auto"
                                    >
                                      <Link href={`/dashboard/teams/${team.id}`}>
                                        Ver Equipo
                                      </Link>
                                    </Button>
                                  </div>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {countryCode && (
                                <Image
                                  src={`https://flagsapi.com/${countryCode}/flat/16.png`}
                                  alt={team.country}
                                  width={16}
                                  height={16}
                                />
                              )}
                              {team.country}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline">{team.minRank}</Badge> -{" "}
                              <Badge variant="outline">{team.maxRank}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>{team.memberIds.length} / 5</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center p-10">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-xl font-semibold">
                    No hay equipos creados
                  </h3>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="mi-equipo" className="pt-4">
            {isLoading ? (
              <LoadingSkeleton />
            ) : myTeams.length > 0 ? (
              (() => {
                const myTeam = myTeams[0];
                const countryCode = getCountryCode(myTeam.country);
                const isManager = user?.uid === myTeam.ownerId || isPrivilegedUser;
                return (
                  <div className="max-w-2xl mx-auto">
                    <Card className="overflow-hidden">
                      <div className="relative">
                        <div className="relative h-48 w-full bg-muted">
                          <Image
                            src={myTeam.bannerUrl || 'https://placehold.co/800x300.png'}
                            alt={`${myTeam.name} banner`}
                            fill
                            className="object-cover"
                            data-ai-hint="team banner"
                          />
                        </div>
                        <div className="absolute -bottom-12 left-6">
                          <Avatar className="h-24 w-24 border-4 border-card bg-card">
                            <AvatarImage src={myTeam.logoUrl || 'https://placehold.co/128x128.png'} alt={`${myTeam.name} logo`} data-ai-hint="team logo" />
                            <AvatarFallback>{myTeam.name.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                        </div>
                        {isManager && (
                            <div className="absolute top-4 right-4 z-10 flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => handleEditClick(myTeam)}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                </Button>
                                <Button asChild variant="default">
                                    <Link href={`/dashboard/teams/${myTeam.id}/manage`}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Gestionar
                                    </Link>
                                </Button>
                            </div>
                        )}
                      </div>
                      <CardHeader className="pt-16">
                        <CardTitle className="font-headline text-2xl">{myTeam.name}</CardTitle>
                        <CardDescription>{myTeam.bio || 'Este equipo aún no tiene una biografía.'}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">Rango: {myTeam.minRank} - {myTeam.maxRank}</Badge>
                          <Badge variant="outline">{myTeam.memberIds.length}/5 Miembros</Badge>
                          {myTeam.country && (
                            <Badge variant="outline" className="inline-flex items-center gap-1.5">
                              {countryCode && <Image src={`https://flagsapi.com/${countryCode}/flat/16.png`} alt={myTeam.country} width={16} height={16} />}
                              {myTeam.country}
                            </Badge>
                          )}
                        </div>
                        {myTeam.seekingRoles && myTeam.seekingRoles.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Buscando Roles</h4>
                            <div className="flex flex-wrap gap-1">
                              {myTeam.seekingRoles.map(role => <Badge key={role} variant="default">{role}</Badge>)}
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button asChild className="w-full" variant="secondary">
                          <Link href={`/dashboard/teams/${myTeam.id}`}>
                            Ir a la página del equipo
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                );
              })()
            ) : (
              <Card>
                <CardContent className="text-center p-10">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-xl font-semibold">
                    No perteneces a ningún equipo
                  </h3>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    
