import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import {
  Swords,
  Users,
  Bot,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Team Management",
      description:
        "Create and manage your team with professional tools. Invite members, assign roles, and track your progress.",
    },
    {
      icon: <Swords className="h-8 w-8 text-primary" />,
      title: "Tournaments & Scrims",
      description:
        "Compete in organized tournaments and scrims. View brackets, report results, and climb the ranks.",
    },
    {
      icon: <Bot className="h-8 w-8 text-primary" />,
      title: "AI-Powered Coaching",
      description:
        "Get AI-driven suggestions for team compositions based on map, player roles, and the current meta.",
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-primary" />,
      title: "Integrated Chat",
      description:
        "Communicate with your team and friends through our built-in chat system. Stay connected and coordinated.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav>
            <Button asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative py-20 md:py-32">
          <div
            aria-hidden="true"
            className="absolute inset-0 top-0 h-full w-full bg-background [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
          ></div>
          <div className="container relative text-center">
            <div className="mx-auto max-w-3xl">
              <h1 className="text-4xl font-bold font-headline md:text-6xl">
                Your Professional Valorant Hub
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                SquadUp provides amateur Valorant players with the tools to
                organize, train, and compete like the pros.
              </p>
            </div>
            <div className="mt-10 flex justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/login">
                  Create Your Squad <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 md:py-24 bg-secondary">
          <div className="container">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-3xl font-bold font-headline md:text-4xl">
                Everything You Need to Compete
              </h2>
              <p className="mt-4 text-muted-foreground">
                From team creation to AI analysis, we've got you covered.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="text-center">
                  <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                      {feature.icon}
                    </div>
                    <CardTitle className="font-headline text-xl">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32">
          <div className="container text-center">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold font-headline md:text-4xl">
                Ready to Level Up?
              </h2>
              <p className="mt-6 text-lg text-muted-foreground">
                Join hundreds of players and teams building their legacy on
                SquadUp.
              </p>
              <Button asChild size="lg" className="mt-10">
                <Link href="/login">Join for Free</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
          <Logo />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SquadUp. All rights reserved. Not affiliated with Riot Games.
          </p>
          <div className="flex gap-4">
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
