
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Users, Camera, Briefcase, ShieldCheck, Upload, Edit, Target, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TeamCard, type Team } from "@/components/team-card";

// --- DATA & TYPE DEFINITIONS ---

const countries = [
  "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City",
  "Bahrain", "Egypt", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "Turkey", "United Arab Emirates", "Yemen",
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Cote d'Ivoire", "Djibouti", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"
].sort();

interface UserProfile {
  primaryRole?: 'player' | 'moderator' | 'admin';
}

const valorantRanks = ["Any", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];
const valorantRoles = ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"];

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
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

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


  const isPrivilegedUser = profile?.primaryRole === 'admin' || profile?.primaryRole === 'moderator';
  const myTeams = teams.filter(team => user && team.memberIds.includes(user.uid));
  const canCreateTeam = isPrivilegedUser;

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
                <Button disabled={!canCreateTeam} onClick={() => setIsFormDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Equipo
                </Button>
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
            {isLoading ? <LoadingSkeleton /> : teams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map(team => (
                        <Link href={`/dashboard/teams/${team.id}`} key={team.id}>
                            <TeamCard team={team} />
                        </Link>
                    ))}
                </div>
            ) : <Card><CardContent className="text-center p-10"><Users className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-xl font-semibold">No hay equipos creados</h3></CardContent></Card>}
          </TabsContent>
          <TabsContent value="mi-equipo" className="pt-4">
          {isLoading ? <LoadingSkeleton /> : myTeams.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myTeams.map(team => (
                       <div key={team.id} className="relative">
                         {(user?.uid === team.ownerId || isPrivilegedUser) && (
                           <Button
                             variant="secondary"
                             size="icon"
                             className="absolute top-4 right-4 z-10 h-8 w-8"
                             onClick={(e) => {
                               e.preventDefault();
                               handleEditClick(team);
                             }}
                           >
                             <Edit className="h-4 w-4" />
                             <span className="sr-only">Gestionar Equipo</span>
                           </Button>
                         )}
                         <Link href={`/dashboard/teams/${team.id}`}>
                           <TeamCard team={team} />
                         </Link>
                       </div>
                    ))}
                </div>
            ) : <Card><CardContent className="text-center p-10"><Users className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-xl font-semibold">No perteneces a ningún equipo</h3></CardContent></Card>}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    