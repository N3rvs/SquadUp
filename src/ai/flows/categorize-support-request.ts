'use server';
/**
 * @fileOverview An AI flow to categorize and summarize user support requests.
 *
 * - categorizeSupportRequest - A function that handles the categorization.
 * - CategorizeSupportRequestInput - The input type for the function.
 * - CategorizeSupportRequestOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeSupportRequestInputSchema = z.object({
  problemDescription: z.string().describe('The user\'s description of their problem.'),
});
export type CategorizeSupportRequestInput = z.infer<typeof CategorizeSupportRequestInputSchema>;

const CategorizeSupportRequestOutputSchema = z.object({
  category: z.enum(["Reporte de Usuario", "Problema Técnico", "Consulta de Torneo", "Feedback General", "Otro"])
    .describe('The category of the support request.'),
  summary: z.string().describe('A concise, one-paragraph summary of the user\'s problem, written in Spanish.'),
  subject: z.string().describe('A short, descriptive subject line for the support email, written in Spanish.'),
});
export type CategorizeSupportRequestOutput = z.infer<typeof CategorizeSupportRequestOutputSchema>;

export async function categorizeSupportRequest(input: CategorizeSupportRequestInput): Promise<CategorizeSupportRequestOutput> {
  return categorizeSupportRequestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeSupportRequestPrompt',
  input: {schema: CategorizeSupportRequestInputSchema},
  output: {schema: CategorizeSupportRequestOutputSchema},
  prompt: `You are a support agent for a gaming platform called SquadUp. Your task is to analyze a user's problem description, written in Spanish, and prepare it for a support ticket.

Based on the user's description, you must perform the following actions:
1.  Categorize the problem into one of the following categories: "Reporte de Usuario", "Problema Técnico", "Consulta de Torneo", "Feedback General", "Otro".
2.  Write a clear and concise summary of the issue in a single paragraph. The summary must be in Spanish.
3.  Create a short, descriptive subject line for the support email. The subject line must be in Spanish.

User's problem description:
{{{problemDescription}}}

Generate the output in the specified JSON format.
`,
});

const categorizeSupportRequestFlow = ai.defineFlow(
  {
    name: 'categorizeSupportRequestFlow',
    inputSchema: CategorizeSupportRequestInputSchema,
    outputSchema: CategorizeSupportRequestOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
