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
} from "lucide-react";


interface UserProfile {
  twitchUrl?: string;
  youtubeUrl?: string;
}

interface Tournament {
  id: string;
  name: string;
  premierRank: string;
  status: 'Pending' | 'Open' | 'In Progress' | 'Finished';
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
      return 'destructive';
    case 'Open':
      return 'secondary';
    case 'In Progress':
      return 'default';
    case 'Finished':
      return 'outline';
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      const q = query(collection(db, "tournaments"), where("status", "==", "Open"), orderBy("startDate", "asc"));
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
      setIsDialogOpen(false);
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

  const hasStreamingLink = !!(profile?.twitchUrl || profile?.youtubeUrl);
  const canCreateTournament = user && !isProfileLoading && hasStreamingLink;

  const triggerButton = (
    <Button disabled={!canCreateTournament}>
      <PlusCircle className="mr-2 h-4 w-4" />
      Crear Evento
    </Button>
  );

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Torneos de la Comunidad</h1>
          <p className="text-muted-foreground">Encuentra tu próximo desafío y escala en la clasificación.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
      ) : tournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
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
                <Button variant="outline" className="w-full">
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
                <h3 className="text-xl font-semibold">No Hay Torneos Disponibles</h3>
                <p className="text-muted-foreground">
                    Aún no se han publicado torneos. ¡Vuelve a comprobarlo más tarde!
                </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
