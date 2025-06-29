
"use client";

import { useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, Trophy, Calendar, DollarSign, Shield } from "lucide-react";
import { auth } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";

// Define a more detailed structure for tournaments
interface Tournament {
  id: string;
  name: string;
  premierRank: string;
  status: 'Open' | 'In Progress' | 'Finished';
  region: string;
  prizePool: string;
  slots: {
    current: number;
    total: number;
  };
  startDate: string;
}

// Mock data reflecting the new structure for Premier-style tournaments
const tournaments: Tournament[] = [
  {
    id: "ascendant-series-1",
    name: "Ascendant Series #1",
    premierRank: "Diamond - Ascendant",
    status: "Open",
    region: "EMEA",
    prizePool: "$1,500",
    slots: { current: 12, total: 32 },
    startDate: "August 1, 2024",
  },
  {
    id: "platinum-clash-weekly",
    name: "Platinum Clash Weekly",
    premierRank: "Gold - Platinum",
    status: "In Progress",
    region: "EMEA",
    prizePool: "Premium Skin Bundle",
    slots: { current: 16, total: 16 },
    startDate: "July 28, 2024",
  },
  {
    id: "radiant-elite-qualifier",
    name: "Radiant Elite Qualifier",
    premierRank: "Ascendant - Immortal",
    status: "Finished",
    region: "EMEA",
    prizePool: "$5,000 + Invite",
    slots: { current: 8, total: 8 },
    startDate: "July 15, 2024",
  },
  {
    id: "immortal-invitational-august",
    name: "Immortal Invitational",
    premierRank: "Immortal+",
    status: "Open",
    region: "EMEA",
    prizePool: "$10,000",
    slots: { current: 4, total: 16 },
    startDate: "August 10, 2024",
  },
];

const getStatusVariant = (status: Tournament['status']) => {
  switch (status) {
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Torneos de la Comunidad</h1>
          <p className="text-muted-foreground">Encuentra tu próximo desafío y escala en la clasificación.</p>
        </div>
        <Button disabled={isLoading || !user}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Evento
        </Button>
      </div>

      {isLoading ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <Card key={tournament.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-xl leading-tight">{tournament.name}</CardTitle>
                    <Badge variant={getStatusVariant(tournament.status)}>{tournament.status}</Badge>
                </div>
                <CardDescription className="flex items-center gap-2 pt-2">
                  <Shield className="h-4 w-4" /> Rango: {tournament.premierRank}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                 <div className="text-sm text-muted-foreground flex items-center gap-2">
                   <DollarSign className="h-4 w-4 text-primary" />
                   <span>Prize Pool: <span className="font-semibold text-foreground">{tournament.prizePool}</span></span>
                 </div>
                 <div className="text-sm text-muted-foreground flex items-center gap-2">
                   <Calendar className="h-4 w-4 text-primary" />
                   <span>Starts: <span className="font-semibold text-foreground">{tournament.startDate}</span></span>
                 </div>
                 <div className="text-sm text-muted-foreground flex items-center gap-2">
                   <Users className="h-4 w-4 text-primary" />
                   <span>Slots: <span className="font-semibold text-foreground">{tournament.slots.current}/{tournament.slots.total}</span></span>
                 </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  <Trophy className="mr-2 h-4 w-4" /> View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
