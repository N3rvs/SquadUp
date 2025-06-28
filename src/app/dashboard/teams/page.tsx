import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Image from "next/image";

export default function TeamsPage() {
  const teams = [
    {
      name: "Cyber Eagles",
      logo: "https://placehold.co/64x64.png",
      dataAiHint: "eagle logo",
      members: 5,
      role: "Founder",
    },
    {
      name: "Shadow Wolves",
      logo: "https://placehold.co/64x64.png",
      dataAiHint: "wolf logo",
      members: 5,
      role: "Member",
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">My Teams</h1>
          <p className="text-muted-foreground">Manage your teams or create a new one.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Team
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <Card key={team.name}>
            <CardHeader className="flex flex-row items-center gap-4">
              <Image
                src={team.logo}
                alt={`${team.name} logo`}
                width={64}
                height={64}
                className="rounded-lg"
                data-ai-hint={team.dataAiHint}
              />
              <div>
                <CardTitle className="font-headline text-xl">{team.name}</CardTitle>
                <CardDescription>{team.role}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p>{team.members}/5 Members</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Manage Team</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
