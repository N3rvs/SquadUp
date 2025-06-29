
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TeamCard, type Team } from "@/components/team-card";
import { Gamepad2, Globe, Search, User, Users } from "lucide-react";
import Image from "next/image";

// --- DATA & TYPE DEFINITIONS ---

interface Player {
  uid: string;
  displayName: string;
  avatarUrl: string;
  valorantRoles: string[];
  valorantRank: string;
  country: string;
}

const valorantRanks = ["All", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];
const countries = ["All", "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City", "Bahrain", "Egypt", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "Turkey", "United Arab Emirates", "Yemen", "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Cote d'Ivoire", "Djibouti", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"].sort((a,b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
const countryNameToCode: { [key: string]: string } = { "Albania": "AL", "Andorra": "AD", "Austria": "AT", "Belarus": "BY", "Belgium": "BE", "Bosnia and Herzegovina": "BA", "Bulgaria": "BG", "Croatia": "HR", "Cyprus": "CY", "Czech Republic": "CZ", "Denmark": "DK", "Estonia": "EE", "Finland": "FI", "France": "FR", "Germany": "DE", "Greece": "GR", "Hungary": "HU", "Iceland": "IS", "Ireland": "IE", "Italy": "IT", "Latvia": "LV", "Liechtenstein": "LI", "Lithuania": "LT", "Luxembourg": "LU", "Malta": "MT", "Moldova": "MD", "Monaco": "MC", "Montenegro": "ME", "Netherlands": "NL", "North Macedonia": "MK", "Norway": "NO", "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Russia": "RU", "San Marino": "SM", "Serbia": "RS", "Slovakia": "SK", "Slovenia": "SI", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH", "Ukraine": "UA", "United Kingdom": "GB", "Vatican City": "VA", "Bahrain": "BH", "Egypt": "EG", "Iran": "IR", "Iraq": "IQ", "Israel": "IL", "Jordan": "JO", "Kuwait": "KW", "Lebanon": "LB", "Oman": "OM", "Palestine": "PS", "Qatar": "QA", "Saudi Arabia": "SA", "Syria": "SY", "Turkey": "TR", "United Arab Emirates": "AE", "Yemen": "YE", "Algeria": "DZ", "Angola": "AO", "Benin": "BJ", "Botswana": "BW", "Burkina Faso": "BF", "Burundi": "BI", "Cameroon": "CM", "Cape Verde": "CV", "Central African Republic": "CF", "Chad": "TD", "Comoros": "KM", "Congo, Democratic Republic of the": "CD", "Congo, Republic of the": "CG", "Cote d'Ivoire": "CI", "Djibouti": "DJ", "Equatorial Guinea": "GQ", "Eritrea": "ER", "Eswatini": "SZ", "Ethiopia": "ET", "Gabon": "GA", "Gambia": "GM", "Ghana": "GH", "Guinea": "GN", "Guinea-Bissau": "GW", "Kenya": "KE", "Lesotho": "LS", "Liberia": "LR", "Libya": "LY", "Madagascar": "MG", "Malawi": "MW", "Mali": "ML", "Mauritania": "MR", "Mauritius": "MU", "Morocco": "MA", "Mozambique": "MZ", "Namibia": "NA", "Niger": "NE", "Nigeria": "NG", "Rwanda": "RW", "Sao Tome and Principe": "ST", "Senegal": "SN", "Seychelles": "SC", "Sierra Leone": "SL", "Somalia": "SO", "South Africa": "ZA", "South Sudan": "SS", "Sudan": "SD", "Tanzania": "TZ", "Togo": "TG", "Tunisia": "TN", "Uganda": "UG", "Zambia": "ZM", "Zimbabwe": "ZW" };
function getCountryCode(countryName?: string): string | null { if (!countryName) return null; return countryNameToCode[countryName] || null; }

// --- COMPONENTS ---

function PlayerCard({ player }: { player: Player }) {
    const countryCode = getCountryCode(player.country);
    return (
        <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 h-full">
            <CardHeader className="p-0">
                <div className="flex items-center gap-4 p-4">
                     <Avatar className="h-16 w-16 border-2 border-primary">
                        <AvatarImage src={player.avatarUrl || undefined} alt={player.displayName} />
                        <AvatarFallback>{player.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="w-full truncate">
                        <CardTitle className="font-headline text-xl truncate">{player.displayName}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                             {countryCode ? ( <Image src={`https://flagsapi.com/${countryCode}/flat/16.png`} alt={player.country} width={16} height={16} /> ) : ( <Globe className="h-4 w-4" /> )}
                             {player.country}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <Badge variant="secondary" className="w-full justify-center">{player.valorantRank || 'Unranked'}</Badge>
                <div className="flex flex-wrap gap-2 justify-center">
                    {player.valorantRoles?.map(role => (
                        <Badge key={role} variant="outline"><Gamepad2 className="mr-1 h-3 w-3" />{role}</Badge>
                    ))}
                </div>
            </CardContent>
             <CardFooter>
                <Button asChild className="w-full" variant="outline">
                    <Link href={`/dashboard/profile/${player.uid}`}>
                        <User className="mr-2 h-4 w-4"/> View Profile
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

function LoadingSkeleton() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 w-full">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <div className="flex justify-center gap-2">
                 <Skeleton className="h-5 w-20" />
                 <Skeleton className="h-5 w-20" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {players.map(player => (
                               <PlayerCard key={player.uid} player={player} />
                            ))}
                        </div>
                    ) : (
                        <Card><CardContent className="text-center p-10"><User className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-xl font-semibold">No Players Found</h3><p className="text-muted-foreground">Try adjusting your filters or check back later.</p></CardContent></Card>
                    )}
                </TabsContent>
                <TabsContent value="teams" className="pt-4">
                     {isLoading ? <LoadingSkeleton /> : filteredTeams.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTeams.map(team => (
                                <Link href={`/dashboard/teams/${team.id}`} key={team.id}>
                                    <TeamCard team={team} />
                                </Link>
                            ))}
                        </div>
                    ) : (
                       <Card><CardContent className="text-center p-10"><Users className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-xl font-semibold">No Teams Found</h3><p className="text-muted-foreground">Try adjusting your filters or check back later.</p></CardContent></Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

    