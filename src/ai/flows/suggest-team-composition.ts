'use server';

/**
 * @fileOverview A team composition suggestion AI agent.
 *
 * - suggestTeamComposition - A function that suggests team compositions.
 * - SuggestTeamCompositionInput - The input type for the suggestTeamComposition function.
 * - SuggestTeamCompositionOutput - The return type for the suggestTeamComposition function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTeamCompositionInputSchema = z.object({
  mapName: z.string().describe('The name of the Valorant map.'),
  playerRoles: z
    .array(z.string())
    .describe('An array of player roles, such as Duelist, Controller, Initiator, Sentinel.'),
  agentPreferences: z
    .array(z.string())
    .describe('An array of preferred agents for each player.'),
  currentMeta: z.string().describe('A description of the current Valorant meta.'),
});
export type SuggestTeamCompositionInput = z.infer<typeof SuggestTeamCompositionInputSchema>;

const SuggestTeamCompositionOutputSchema = z.object({
  suggestedComposition: z
    .array(z.string())
    .describe('An array of suggested agents for the team composition.'),
  teamStrengths: z.string().describe('A description of the team strengths.'),
  teamWeaknesses: z.string().describe('A description of the team weaknesses.'),
  winProbability: z
    .number()
    .describe('The estimated win probability of the suggested team composition.'),
});
export type SuggestTeamCompositionOutput = z.infer<typeof SuggestTeamCompositionOutputSchema>;

export async function suggestTeamComposition(input: SuggestTeamCompositionInput): Promise<SuggestTeamCompositionOutput> {
  return suggestTeamCompositionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTeamCompositionPrompt',
  input: {schema: SuggestTeamCompositionInputSchema},
  output: {schema: SuggestTeamCompositionOutputSchema},
  prompt: `You are an expert Valorant coach, specializing in team composition.

You will use the provided information about the map, player roles, agent preferences, and current meta to suggest an optimal team composition.

Map: {{{mapName}}}
Player Roles: {{#each playerRoles}}{{{this}}}, {{/each}}
Agent Preferences: {{#each agentPreferences}}{{{this}}}, {{/each}}
Current Meta: {{{currentMeta}}}

Based on this information, suggest a team composition with 5 agents, describe the team's strengths and weaknesses, and estimate the win probability (as a number between 0 and 1) of this composition.

{{output.schema.description}}`,
});

const suggestTeamCompositionFlow = ai.defineFlow(
  {
    name: 'suggestTeamCompositionFlow',
    inputSchema: SuggestTeamCompositionInputSchema,
    outputSchema: SuggestTeamCompositionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
