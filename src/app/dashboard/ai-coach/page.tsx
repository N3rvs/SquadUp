"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getTeamSuggestion } from "./actions";
import type { SuggestTeamCompositionOutput } from "@/ai/flows/suggest-team-composition";
import { BrainCircuit, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import Image from "next/image";
import { WinProbabilityChart } from "@/components/win-probability-chart";

const formSchema = z.object({
  mapName: z.string().min(1, "Please select a map."),
  playerRoles: z.string().min(1, "Please enter player roles."),
  agentPreferences: z.string().min(1, "Please enter agent preferences."),
  currentMeta: z.string().min(1, "Please describe the current meta."),
});

const valorantMaps = [
  "Ascent", "Bind", "Breeze", "Fracture", "Haven",
  "Icebox", "Lotus", "Pearl", "Split", "Sunset",
];

export default function AiCoachPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SuggestTeamCompositionOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mapName: "",
      playerRoles: "Duelist, Controller, Initiator, Sentinel, Flex",
      agentPreferences: "Jett, Omen, Sova, Cypher, KAY/O",
      currentMeta: "Double controller is meta on smaller maps, with a focus on fast executes and information gathering.",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);
    const response = await getTeamSuggestion({
      ...values,
      playerRoles: values.playerRoles.split(',').map(s => s.trim()),
      agentPreferences: values.agentPreferences.split(',').map(s => s.trim()),
    });

    if (response.success && response.data) {
      setResult(response.data);
      toast({
        title: "Suggestion Ready!",
        description: "Your new team composition is here.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: response.error,
      });
    }
    setIsLoading(false);
  }

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center gap-2">
            <BrainCircuit className="h-6 w-6" /> AI Team Coach
          </CardTitle>
          <CardDescription>
            Get an AI-powered team composition suggestion based on your team's
            needs and the current meta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="mapName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valorant Map</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a map" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {valorantMaps.map((map) => (
                            <SelectItem key={map} value={map}>
                              {map}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="playerRoles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player Roles</FormLabel>
                      <FormControl>
                        <Input placeholder="Duelist, Controller, ..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Comma-separated list of roles your players will fill.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="agentPreferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Preferences</FormLabel>
                    <FormControl>
                      <Input placeholder="Jett, Omen, ..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of agents your team prefers to play.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentMeta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Meta Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the current meta, strategies, or any other relevant information."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isLoading ? "Analyzing..." : "Get Suggestion"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      {result && (
        <div className="grid md:grid-cols-3 gap-8">
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Suggested Composition</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
                    {result.suggestedComposition.map((agent) => (
                        <div key={agent} className="flex flex-col items-center gap-2">
                           <Image src={`https://placehold.co/100x100.png`} width={100} height={100} alt={agent} className="rounded-lg border-2 border-primary" data-ai-hint="valorant agent" />
                           <p className="font-semibold">{agent}</p>
                        </div>
                    ))}
                </CardContent>
                <CardFooter className="grid md:grid-cols-2 gap-6 pt-6">
                    <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-2"><ShieldCheck className="h-5 w-5 text-green-500" /> Team Strengths</h3>
                        <p className="text-sm text-muted-foreground">{result.teamStrengths}</p>
                    </div>
                     <div>
                        <h3 className="font-semibold flex items-center gap-2 mb-2"><ShieldAlert className="h-5 w-5 text-orange-500" /> Team Weaknesses</h3>
                        <p className="text-sm text-muted-foreground">{result.teamWeaknesses}</p>
                    </div>
                </CardFooter>
            </Card>
            <WinProbabilityChart probability={result.winProbability} />
        </div>
      )}
    </div>
  );
}
