
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, type DocumentData } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Briefcase, Edit, ShieldCheck, Users } from "lucide-react";

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
  seekingCoach?: boolean;
  videoUrl?: string;
}

interface TeamMember extends DocumentData {
    uid: string;
    displayName: string;
    avatarUrl: string;
    valorantRole: string;
}

// --- HELPER COMPONENTS ---

function TeamMemberCard({ member }: { member: TeamMember }) {
    return (
        <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 mb-4">
                    <AvatarImage src={member.avatarUrl || `https://placehold.co/128x128.png`} alt={member.displayName} data-ai-hint="valorant agent" />
                    <AvatarFallback>{member.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold">{member.displayName}</h3>
                <p className="text-sm text-muted-foreground">{member.valorantRole}</p>
            </CardContent>
        </Card>
    );
}

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const fetchTeamAndMembers = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);

    try {
      // Fetch team data
      const teamDocRef = doc(db, "teams", teamId);
      const teamDocSnap = await getDoc(teamDocRef);

      if (!teamDocSnap.exists()) {
        toast({ variant: "destructive", title: "Equipo no encontrado" });
        router.push("/dashboard/teams");
        return;
      }
      const teamData = { id: teamDocSnap.id, ...teamDocSnap.data() } as Team;
      setTeam(teamData);

      // Fetch members data
      if (teamData.memberIds && teamData.memberIds.length > 0) {
        const usersRef = collection(db, "users");
        // Firestore 'in' query is limited to 30 elements, which is fine for team members.
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
    }
  }, [teamId, router, toast]);

  useEffect(() => {
    fetchTeamAndMembers();
  }, [fetchTeamAndMembers]);


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

  const isOwner = user?.uid === team.ownerId;
  const canManage = isOwner; // In the future, we can add admin/moderator roles here.

  return (
    <div className="space-y-8">
       <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a Equipos
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
            {canManage && (
                <Button disabled>
                    <Edit className="mr-2 h-4 w-4" />
                    Gestionar Equipo (Próximamente)
                </Button>
            )}
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
            <Badge variant="secondary" className="text-sm py-1 px-3"><ShieldCheck className="mr-2 h-4 w-4 text-primary" />Rango: {team.minRank} - {team.maxRank}</Badge>
            <Badge variant="secondary" className="text-sm py-1 px-3"><Users className="mr-2 h-4 w-4 text-primary" />{members.length}/{5} Miembros</Badge>
            {team.seekingCoach && <Badge variant="secondary" className="text-sm py-1 px-3"><Briefcase className="mr-2 h-4 w-4 text-primary" /> Buscando Coach</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Miembros del Equipo</CardTitle>
            <CardDescription>Conoce a los jugadores que forman parte de {team.name}.</CardDescription>
        </CardHeader>
        <CardContent>
            {members.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {members.map(member => (
                       <TeamMemberCard key={member.uid} member={member} />
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-8">No se encontraron miembros para este equipo.</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
