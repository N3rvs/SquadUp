
"use client";

import { useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, Timestamp, where, doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PlusCircle,
  Users,
  Trophy,
  Calendar as CalendarIcon,
  DollarSign,
  Shield,
  Loader2,
  ListTree,
  Globe,
  Link as LinkIcon,
  Swords,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface UserProfile {
  primaryRole?: 'player' | 'moderator' | 'admin';
  twitchUrl?: string;
  youtubeUrl?: string;
}

interface Tournament {
  id: string;
  name: string;
  premierRank: string;
  status: 'Pending' | 'Open' | 'In Progress' | 'Finished' | 'Rejected';
  region: string;
  prizePool: string;
  slots: {
    current: number;
    total: number;
  };
  startDate: string;
  creatorId: string;
  description: string;
  streamUrl: string;
  format: string;
}

type TournamentStatus = Tournament['status'];

const tournamentFormSchema = z.object({
  name: z.string().min(5, { message: "El nombre debe tener al menos 5 caracteres." }).max(50, { message: "El nombre no puede tener más de 50 caracteres."}),
  description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }).max(200, { message: "La descripción no puede tener más de 200 caracteres."}),
  streamUrl: z.string().url({ message: "Por favor, introduce una URL válida de Twitch, Kick o YouTube." }),
  format: z.string({ required_error: "Debes seleccionar un formato." }),
  premierRank: z.string({ required_error: "Debes seleccionar un rango." }),
  region: z.string({ required_error: "Debes seleccionar una región." }),
  prizePool: z.string().min(1, { message: "El premio no puede estar vacío." }).max(50, { message: "La descripción del premio es muy larga."}),
  totalSlots: z.coerce.number().int().min(2, { message: "Debe haber al menos 2 equipos." }).max(128, { message: "No puede haber más de 128 equipos." }),
  startDate: z.date({ required_error: "Debes seleccionar una fecha de inicio." }),
});

type TournamentFormValues = z.infer<typeof tournamentFormSchema>;

const premierRanks = [
  "Cualquier Rango",
  "Gold - Platinum",
  "Diamond - Ascendant",
  "Ascendant - Immortal",
  "Immortal+",
];

const tournamentFormats = [
    { value: 'masters', label: 'Estilo Masters (Round Robin + Eliminación)' },
    { value: 'knockout', label: 'Eliminación directa (Knockout)' },
    { value: 'classic', label: 'Bracket clásico (Octavos, Cuartos, etc.)' },
];

const regions = ["EMEA"];

const getStatusVariant = (status: Tournament['status']) => {
  switch (status) {
    case 'Pending':
      return 'outline';
    case 'Open':
      return 'secondary';
    case 'In Progress':
      return 'default';
    case 'Finished':
      return 'outline';
    case 'Rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function TournamentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<TournamentStatus>('Open');
  const { toast } = useToast();

  const form = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      streamUrl: "",
      format: "",
      premierRank: "",
      region: "EMEA",
      prizePool: "",
      totalSlots: 16,
    },
  });

  const fetchTournaments = async () => {
    setIsPageLoading(true);
    try {
      const q = query(collection(db, "tournaments"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTournaments = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const startDate = data.startDate instanceof Timestamp 
          ? data.startDate.toDate() 
          : new Date(data.startDate);

        return {
          id: doc.id,
          name: data.name,
          premierRank: data.premierRank,
          status: data.status,
          region: data.region,
          prizePool: data.prizePool,
          slots: {
            current: data.registeredTeams?.length || 0,
            total: data.totalSlots,
          },
          startDate: format(startDate, "PP", { locale: es }),
          creatorId: data.creatorId,
          description: data.description,
          streamUrl: data.streamUrl,
          format: tournamentFormats.find(f => f.value === data.format)?.label || data.format,
        } as Tournament;
      });
      setTournaments(fetchedTournaments);
    } catch (error) {
      console.error("Error fetching tournaments: ", error);
      toast({
        variant: "destructive",
        title: "Error al cargar torneos",
        description: "No se pudieron cargar los torneos. Inténtalo de nuevo.",
      });
    } finally {
      setIsPageLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
       if (currentUser) {
        setIsProfileLoading(true);
        const userDocRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
        setIsProfileLoading(false);
      } else {
        setProfile(null);
        setIsProfileLoading(false);
      }
      fetchTournaments();
    });
    return () => unsubscribe();
  }, []);

  async function onSubmit(data: TournamentFormValues) {
    if (!user) {
      toast({ variant: "destructive", title: "No autenticado", description: "Debes iniciar sesión para crear un torneo." });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "tournaments"), {
        ...data,
        creatorId: user.uid,
        status: 'Pending',
        registeredTeams: [],
        createdAt: new Date(),
        startDate: Timestamp.fromDate(data.startDate),
      });

      toast({
        title: "¡Torneo enviado a revisión!",
        description: "Tu evento será revisado por un moderador antes de ser publicado.",
      });

      form.reset();
      setIsCreateDialogOpen(false);
      fetchTournaments();
    } catch (error) {
      console.error("Error creating tournament: ", error);
      toast({
        variant: "destructive",
        title: "Error al crear el torneo",
        description: "Hubo un problema al guardar tu evento. Por favor, inténtalo de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleRandomPairing = () => {
    toast({
      title: "Próximamente",
      description: "La generación de emparejamientos estará disponible pronto."
    });
  };

  const hasStreamingLink = !!(profile?.twitchUrl || profile?.youtubeUrl);
  const canCreateTournament = user && !isProfileLoading && hasStreamingLink;
  
  const canManageTournament = user && profile && selectedTournament && (
    profile.primaryRole === 'admin' ||
    profile.primaryRole === 'moderator' ||
    user.uid === selectedTournament.creatorId
  );

  const triggerButton = (
    <Button disabled={!canCreateTournament}>
      <PlusCircle className="mr-2 h-4 w-4" />
      Crear Evento
    </Button>
  );

  const filteredTournaments = tournaments.filter(t => t.status === activeTab);

  const getEmptyStateMessage = () => {
    switch (activeTab) {
      case 'Open': return 'Abiertos';
      case 'Pending': return 'Pendientes';
      case 'In Progress': return 'En Progreso';
      case 'Finished': return 'Finalizados';
      case 'Rejected': return 'Rechazados';
      default: return '';
    }
  };

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Torneos de la Comunidad</h1>
          <p className="text-muted-foreground">Encuentra tu próximo desafío y escala en la clasificación.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            {isProfileLoading ? (
              <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...</Button>
            ) : !user ? (
               <Button disabled>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Evento
                </Button>
            ) : hasStreamingLink ? (
              triggerButton
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button disabled>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Evento
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Debes añadir un enlace de streaming en tu perfil para crear un torneo.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear un Nuevo Torneo</DialogTitle>
              <DialogDescription>
                Completa los detalles de tu evento. Será revisado por un moderador para su aprobación.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Torneo</FormLabel>
                      <FormControl><Input placeholder="Ej: Rising Stars Cup" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Temática, premios, reglas especiales..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Esta información será visible para los moderadores durante la revisión.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="streamUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enlace del Streaming</FormLabel>
                      <FormControl><Input placeholder="https://twitch.tv/yourchannel" {...field} /></FormControl>
                      <FormDescription>
                        El torneo debe ser transmitido en vivo.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <FormField
                    control={form.control}
                    name="format"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Formato del Torneo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un formato" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {tournamentFormats.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="premierRank"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rango de Premier</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rango" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {premierRanks.map(rank => <SelectItem key={rank} value={rank}>{rank}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Región</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una región" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {regions.map(region => <SelectItem key={region} value={region}>{region}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="prizePool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Premio</FormLabel>
                        <FormControl><Input placeholder="Ej: $500, Skins de Valorant" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalSlots"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plazas para equipos</FormLabel>
                        <FormControl><Input type="number" min="2" max="128" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de inicio</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? (format(field.value, "PPP", { locale: es })) : (<span>Selecciona una fecha</span>)}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter className="pt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancelar</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? "Enviando..." : "Enviar a Revisión"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TournamentStatus)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="Open">Abiertos</TabsTrigger>
          <TabsTrigger value="Pending">Pendientes</TabsTrigger>
          <TabsTrigger value="In Progress">En Progreso</TabsTrigger>
          <TabsTrigger value="Finished">Finalizados</TabsTrigger>
          <TabsTrigger value="Rejected">Rechazados</TabsTrigger>
        </TabsList>
      </Tabs>

      {isPageLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-1/4" />
                </div>
                <div className="pt-2">
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredTournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <Card key={tournament.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-xl leading-tight">{tournament.name}</CardTitle>
                    <Badge variant={getStatusVariant(tournament.status)}>{tournament.status}</Badge>
                </div>
                <CardDescription className="flex flex-col gap-2 pt-2">
                  <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Rango: {tournament.premierRank}</span>
                  <span className="flex items-center gap-2"><ListTree className="h-4 w-4" /> Formato: {tournament.format}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                 <div className="text-sm text-muted-foreground flex items-center gap-2">
                   <DollarSign className="h-4 w-4 text-primary" />
                   <span>Premio: <span className="font-semibold text-foreground">{tournament.prizePool}</span></span>
                 </div>
                 <div className="text-sm text-muted-foreground flex items-center gap-2">
                   <CalendarIcon className="h-4 w-4 text-primary" />
                   <span>Empieza: <span className="font-semibold text-foreground">{tournament.startDate}</span></span>
                 </div>
                 <div className="text-sm text-muted-foreground flex items-center gap-2">
                   <Users className="h-4 w-4 text-primary" />
                   <span>Plazas: <span className="font-semibold text-foreground">{tournament.slots.current}/{tournament.slots.total}</span></span>
                 </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  setSelectedTournament(tournament);
                  setIsDetailModalOpen(true);
                }}>
                  <Trophy className="mr-2 h-4 w-4" /> Ver Detalles
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center text-center p-10 gap-4">
                <Trophy className="h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-semibold">No Hay Torneos {getEmptyStateMessage()}</h3>
                <p className="text-muted-foreground">
                    Aún no hay eventos en esta categoría. ¡Vuelve a comprobarlo más tarde!
                </p>
            </CardContent>
        </Card>
      )}

      {selectedTournament && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl">{selectedTournament.name}</DialogTitle>
                    <DialogDescription>
                      {selectedTournament.description}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  <div className="space-y-4">
                    <h4 className="font-semibold">Detalles del Torneo</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground"><Globe className="h-4 w-4 text-primary" /> Región: <span className="font-medium text-foreground">{selectedTournament.region}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Shield className="h-4 w-4 text-primary" /> Rango: <span className="font-medium text-foreground">{selectedTournament.premierRank}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4 text-primary" /> Premio: <span className="font-medium text-foreground">{selectedTournament.prizePool}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><CalendarIcon className="h-4 w-4 text-primary" /> Fecha: <span className="font-medium text-foreground">{selectedTournament.startDate}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4 text-primary" /> Plazas: <span className="font-medium text-foreground">{selectedTournament.slots.current}/{selectedTournament.slots.total}</span></div>
                        <div className="flex items-center gap-2 text-muted-foreground"><ListTree className="h-4 w-4 text-primary" /> Formato: <span className="font-medium text-foreground">{selectedTournament.format}</span></div>
                    </div>
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LinkIcon className="h-4 w-4 text-primary" /> Streaming: <a href={selectedTournament.streamUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline hover:text-primary">{selectedTournament.streamUrl}</a>
                    </div>
                  </div>
                  <div className="space-y-4">
                     <h4 className="font-semibold">Equipos Inscritos ({selectedTournament.slots.current})</h4>
                     <div className="border rounded-lg p-4 h-48 overflow-y-auto">
                        {selectedTournament.slots.current > 0 ? (
                            <p className="text-muted-foreground">Lista de equipos próximamente...</p>
                        ) : (
                            <p className="text-muted-foreground text-center pt-12">Aún no hay equipos inscritos.</p>
                        )}
                     </div>
                  </div>
                </div>

                <Separator />
                
                <DialogFooter className="pt-4">
                    <Button variant="secondary">Inscribir mi Equipo</Button>
                    {canManageTournament && (
                        <Button onClick={handleRandomPairing}>
                            <Swords className="mr-2 h-4 w-4" /> Generar Emparejamientos Aleatorios
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
