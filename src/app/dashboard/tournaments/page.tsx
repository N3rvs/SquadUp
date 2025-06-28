import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle } from "lucide-react";

export default function TournamentsPage() {
  const tournaments = [
    {
      name: "Valorant Regional Clash",
      status: "Open",
      date: "July 25, 2024",
      prize: "$5,000",
    },
    {
      name: "Amateur Weekly #12",
      status: "In Progress",
      date: "July 20, 2024",
      prize: "$500",
    },
    {
      name: "Cyber Eagles Scrim vs Shadow Wolves",
      status: "Upcoming",
      date: "July 18, 2024",
      prize: "Practice",
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Tournaments & Scrims</h1>
          <p className="text-muted-foreground">Find competitions or create your own.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <CardDescription>Register your team for upcoming tournaments.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {tournaments.map((tournament) => (
              <li key={tournament.name} className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <h3 className="font-semibold">{tournament.name}</h3>
                  <p className="text-sm text-muted-foreground">{tournament.date} - Prize: {tournament.prize}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={tournament.status === 'Open' ? 'secondary' : 'outline'}>{tournament.status}</Badge>
                  <Button variant="outline" size="sm">Details</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
