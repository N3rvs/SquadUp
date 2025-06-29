
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { countries as allCountries, getCountryCode } from "@/lib/countries";
import { valorantRanks as allValorantRanks } from "@/lib/valorant";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gamepad2, Globe, Search, User, Users, ShieldCheck, Target } from "lucide-react";
import Image from "next/image";
import type { Team } from "@/components/team-card";

// --- DATA & TYPE DEFINITIONS ---

interface Player {
  uid: string;
  displayName: string;
  avatarUrl: string;
  valorantRoles: string[];
  valorantRank: string;
  country: string;
  bio?: string;
  bannerUrl?: string;
}

const valorantRanks = ["All", ...allValorantRanks];
const countries = ["All", ...allCountries];

// --- COMPONENTS ---

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
                            <TableCell>
                                <div className="flex gap-2">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-5 w-16" />
                                </div>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}


// --- MAIN PAGE COMPONENT ---

export default function MarketplacePage() {
    const [activeTab, setActiveTab] = useState('players');
    const [players, setPlayers] = useState<Player[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rankFilter, setRankFilter] = useState('All');
    const [countryFilter, setCountryFilter] = useState('All');
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                if (activeTab === 'players') {
                    let playerQuery = query(collection(db, "users"), where("lookingForTeam", "==", true));
                    if(countryFilter !== 'All') {
                        playerQuery = query(playerQuery, where("country", "==", countryFilter));
                    }
                    if(rankFilter !== 'All') {
                        playerQuery = query(playerQuery, where("valorantRank", "==", rankFilter));
                    }
                    const querySnapshot = await getDocs(playerQuery);
                    const fetchedPlayers = querySnapshot.docs.map(doc => doc.data() as Player);
                    setPlayers(fetchedPlayers);
                } else {
                    let teamQuery = query(collection(db, "teams"), where("isRecruiting", "==", true));
                     if(countryFilter !== 'All') {
                        teamQuery = query(teamQuery, where("country", "==", countryFilter));
                    }
                    const querySnapshot = await getDocs(teamQuery);
                    const fetchedTeams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
                    setTeams(fetchedTeams);
                }
            } catch (error) {
                console.error("Error fetching marketplace data:", error);
                toast({ variant: "destructive", title: "Error loading data" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [activeTab, rankFilter, countryFilter, toast]);
    
    const filteredTeams = useMemo(() => {
        if (rankFilter === 'All') return teams;
        const rankIndex = valorantRanks.indexOf(rankFilter);
        return teams.filter(team => {
            const minRankIndex = valorantRanks.indexOf(team.minRank);
            const maxRankIndex = valorantRanks.indexOf(team.maxRank);
            return rankIndex >= minRankIndex && rankIndex <= maxRankIndex;
        });
    }, [teams, rankFilter]);

    return (
        <div className="flex flex-col gap-8">
            <div>
                 <h1 className="text-3xl font-bold font-headline">Marketplace</h1>
                <p className="text-muted-foreground">Find the perfect match for your team or join a new squad.</p>
            </div>
           
            <Card>
                <CardHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <h2 className="text-lg font-semibold sm:col-span-3 flex items-center gap-2"><Search className="h-5 w-5"/> Filters</h2>
                         <Select value={countryFilter} onValueChange={setCountryFilter}>
                            <SelectTrigger><SelectValue placeholder="Filter by Country" /></SelectTrigger>
                            <SelectContent>
                                {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={rankFilter} onValueChange={setRankFilter}>
                            <SelectTrigger><SelectValue placeholder="Filter by Rank" /></SelectTrigger>
                            <SelectContent>
                               {valorantRanks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="players">Players (LFT)</TabsTrigger>
                    <TabsTrigger value="teams">Teams (LFP)</TabsTrigger>
                </TabsList>
                <TabsContent value="players" className="pt-4">
                    {isLoading ? <LoadingSkeleton /> : players.length > 0 ? (
                        <Card>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Jugador</TableHead>
                                <TableHead>País</TableHead>
                                <TableHead>Rango</TableHead>
                                <TableHead>Roles</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {players.map((player) => {
                                const countryCode = getCountryCode(player.country);
                                return (
                                <TableRow key={player.uid}>
                                    <TableCell>
                                      <HoverCard>
                                        <HoverCardTrigger asChild>
                                          <div className="flex items-center gap-3 cursor-pointer">
                                              <Avatar className="h-10 w-10 border">
                                                  <AvatarImage src={player.avatarUrl} alt={player.displayName} />
                                                  <AvatarFallback>{player.displayName.substring(0,2)}</AvatarFallback>
                                              </Avatar>
                                              <span className="font-medium">{player.displayName}</span>
                                          </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-80" align="start">
                                            <div className="flex justify-between space-x-4">
                                            <Avatar>
                                                <AvatarImage src={player.avatarUrl} />
                                                <AvatarFallback>{player.displayName.substring(0,2)}</AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-semibold">{player.displayName}</h4>
                                                <p className="text-sm text-muted-foreground line-clamp-3">
                                                    {player.bio || 'Este jugador no tiene una biografía.'}
                                                </p>
                                                <div className="flex items-center pt-2">
                                                    <Button asChild variant="link" className="p-0 h-auto">
                                                        <Link href={`/dashboard/profile/${player.uid}`}>
                                                            Ver Perfil
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                            </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {countryCode && <Image src={`https://flagsapi.com/${countryCode}/flat/16.png`} alt={player.country} width={16} height={16} />}
                                            {player.country}
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{player.valorantRank}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {player.valorantRoles?.map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                                        </div>
                                    </TableCell>
                                </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </Card>
                    ) : (
                        <Card><CardContent className="text-center p-10"><User className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-xl font-semibold">No Players Found</h3><p className="text-muted-foreground">Try adjusting your filters or check back later.</p></CardContent></Card>
                    )}
                </TabsContent>
                <TabsContent value="teams" className="pt-4">
                     {isLoading ? <LoadingSkeleton /> : filteredTeams.length > 0 ? (
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
                                    {filteredTeams.map((team) => {
                                      const countryCode = getCountryCode(team.country);
                                      return (
                                        <TableRow key={team.id}>
                                          <TableCell>
                                            <HoverCard>
                                              <HoverCardTrigger asChild>
                                                <div className="flex items-center gap-3 cursor-pointer">
                                                  <Avatar className="h-10 w-10 border">
                                                    <AvatarImage src={team.logoUrl} alt={team.name} />
                                                    <AvatarFallback>{team.name.substring(0,2)}</AvatarFallback>
                                                  </Avatar>
                                                  <span className="font-medium">{team.name}</span>
                                                </div>
                                              </HoverCardTrigger>
                                              <HoverCardContent className="w-80 p-0" align="start">
                                                <div className="relative h-24 w-full">
                                                  <Image
                                                    src={team.bannerUrl || 'https://placehold.co/320x96.png'}
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
                                                      <AvatarFallback>{team.name.substring(0,2)}</AvatarFallback>
                                                    </Avatar>
                                                    <h4 className="text-sm font-semibold">{team.name}</h4>
                                                  </div>
                                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                                    {team.bio || 'Este equipo no tiene una biografía.'}
                                                  </p>
                                                  {team.seekingRoles && team.seekingRoles.length > 0 && (
                                                    <div>
                                                      <h5 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                                                        <Target className="h-4 w-4" />
                                                        Buscando Roles
                                                      </h5>
                                                      <div className="flex flex-wrap gap-1">
                                                        {team.seekingRoles.map(role => (
                                                          <Badge key={role} variant="default">{role}</Badge>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                  <div className="flex items-center pt-2">
                                                    <Button asChild variant="link" className="p-0 h-auto">
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
                                              {countryCode && <Image src={`https://flagsapi.com/${countryCode}/flat/16.png`} alt={team.country} width={16} height={16} />}
                                              {team.country}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-1">
                                              <Badge variant="outline">{team.minRank}</Badge> - <Badge variant="outline">{team.maxRank}</Badge>
                                            </div>
                                          </TableCell>
                                          <TableCell>{team.memberIds.length} / 5</TableCell>
                                        </TableRow>
                                      )
                                    })}
                                </TableBody>
                            </Table>
                        </Card>
                    ) : (
                       <Card><CardContent className="text-center p-10"><Users className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-xl font-semibold">No Teams Found</h3><p className="text-muted-foreground">Try adjusting your filters or check back later.</p></CardContent></Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
