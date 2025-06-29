"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, Users } from "lucide-react";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, getDocs, DocumentData } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

interface Team {
  id: string;
  name: string;
  logo: string;
  members: number;
  role: string; // This might need more logic later (e.g., founder, member)
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const q = query(collection(db, "teams"), where("ownerId", "==", currentUser.uid));
          const querySnapshot = await getDocs(q);
          const fetchedTeams: Team[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || "Unnamed Team",
              logo: data.logoUrl || "https://placehold.co/64x64.png",
              members: data.members?.length || 1,
              role: "Founder", // Simplification for now
            };
          });
          setTeams(fetchedTeams);
        } catch (error) {
          console.error("Error fetching teams:", error);
        }
      } else {
        setTeams([]);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">My Teams</h1>
          <p className="text-muted-foreground">Manage your teams or create a new one.</p>
        </div>
        <Button disabled={!user}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Team
        </Button>
      </div>

      {isLoading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-5 w-24" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
        </div>
      ) : teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader className="flex flex-row items-center gap-4">
                <Image
                  src={team.logo}
                  alt={`${team.name} logo`}
                  width={64}
                  height={64}
                  className="rounded-lg"
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
      ) : (
         <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center text-center p-10 gap-4">
                <Users className="h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-semibold">No Teams Found</h3>
                <p className="text-muted-foreground">
                    You are not a part of any team yet.
                </p>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Your First Team
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
