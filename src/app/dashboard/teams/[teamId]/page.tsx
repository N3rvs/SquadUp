
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, type DocumentData } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getCountryCode } from "@/lib/countries";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Briefcase, Globe, ShieldCheck, Users, Target, Search, Loader2, Crown, Settings } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { applyToTeam } from "./actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthRole } from "@/hooks/useAuthRole";


// --- TYPE DEFINITIONS ---
interface TeamMember {
    uid: string;
    displayName: string;
    avatarUrl: string;
    valorantRoles: string[];
    primaryRole?: string;
}

interface Team {
  id: string;
  name: string;
  logoUrl: string;
  bannerUrl: string;
  bio?: string;
  ownerId: string;
  memberIds: string[];
  members: TeamMember[];
  minRank: string;
  maxRank:string;
  isRecruiting?: boolean;
  seekingCoach?: boolean;
  seekingRoles?: string[];
  videoUrl?: string;
  country: string;
}


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

// --- MAIN COMPONENT ---

export default function TeamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const teamId = typeof params.teamId === 'string' ? params.teamId : '';
  const { role } = useAuthRole();

  const [isApplying, setIsApplying] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<'idle' | 'applied' | 'member'>('idle');
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const fetchTeamAndMembers = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
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

      if (teamData.members && teamData.members.length > 0) {
        const sortedMembers = [...teamData.members].sort((a, b) => {
            if (a.uid === teamData.ownerId) return -1;
            if (b.uid === teamData.ownerId) return 1;
            return a.displayName.localeCompare(b.displayName);
        });
        setMembers(sortedMembers);
      } else {
          setMembers([]);
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
  
  const canApply = user && team.isRecruiting && applicationStatus === 'idle';
  const isManager = user && (team.ownerId === user.uid || role === 'admin' || role === 'moderator');

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
            {isManager && (
                <Button asChild>
                    <Link href={`/dashboard/teams/${team.id}/manage`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Gestionar Equipo
                    </Link>
                </Button>
            )}
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
    </div>
  );
}
