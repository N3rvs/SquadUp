import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Users, Trophy, Calendar, DollarSign, Shield } from "lucide-react";

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
    id: "valorant-regional-clash-2024",
    name: "Valorant Regional Clash",
    premierRank: "Contender",
    status: "Open",
    region: "EMEA",
    prizePool: "$5,000",
    slots: { current: 12, total: 32 },
    startDate: "July 25, 2024",
  },
  {
    id: "premier-open-weekly-12",
    name: "Premier Open Weekly #12",
    premierRank: "Open 4",
    status: "In Progress",
    region: "EMEA",
    prizePool: "$500",
    slots: { current: 16, total: 16 },
    startDate: "July 20, 2024",
  },
  {
    id: "elite-division-qualifier",
    name: "Elite Division Qualifier",
    premierRank: "Elite 1-2",
    status: "Finished",
    region: "EMEA",
    prizePool: "$2,500",
    slots: { current: 8, total: 8 },
    startDate: "July 15, 2024",
  },
  {
    id: "intermediate-showdown-august",
    name: "Intermediate Showdown",
    premierRank: "Intermediate 3",
    status: "Open",
    region: "EMEA",
    prizePool: "$1,000",
    slots: { current: 4, total: 16 },
    startDate: "August 5, 2024",
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
  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Valorant Premier Hub</h1>
          <p className="text-muted-foreground">Find your next challenge and climb the Premier ranks.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                  <CardTitle className="font-headline text-xl leading-tight">{tournament.name}</CardTitle>
                  <Badge variant={getStatusVariant(tournament.status)}>{tournament.status}</Badge>
              </div>
              <CardDescription className="flex items-center gap-2 pt-2">
                <Shield className="h-4 w-4" /> Premier Rank: {tournament.premierRank}
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
    </div>
  );
}
