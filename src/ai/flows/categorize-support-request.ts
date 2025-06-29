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
  isAppropriate: z.boolean().describe('Whether the user\'s request is appropriate and related to the platform.'),
  rejectionReason: z.string().optional().describe('If the request is not appropriate, the reason for rejection, written in Spanish in a respectful tone.'),
  category: z.enum(["Reporte de Usuario", "Problema Técnico", "Consulta de Torneo", "Feedback General", "Otro"])
    .optional()
    .describe('The category of the support request. Only present if the request is appropriate.'),
  summary: z.string().optional().describe('A concise, one-paragraph summary of the user\'s problem, written in Spanish. Only present if the request is appropriate.'),
  subject: z.string().optional().describe('A short, descriptive subject line for the support email, written in Spanish. Only present if the request is appropriate.'),
});
export type CategorizeSupportRequestOutput = z.infer<typeof CategorizeSupportRequestOutputSchema>;

export async function categorizeSupportRequest(input: CategorizeSupportRequestInput): Promise<CategorizeSupportRequestOutput> {
  return categorizeSupportRequestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeSupportRequestPrompt',
  input: {schema: CategorizeSupportRequestInputSchema},
  output: {schema: CategorizeSupportRequestOutputSchema},
  prompt: `You are a support agent for a gaming platform called SquadUp. Your primary task is to analyze a user's problem description, written in Spanish, and prepare it for a support ticket, while also acting as a content moderator.

First, you must determine if the user's message is appropriate and relevant to the SquadUp platform.
- An appropriate message is one that is not offensive, abusive, hateful, or contains spam.
- A relevant message is one that relates to the platform's features (teams, tournaments, profiles, etc.) or is a genuine support request.

If the message is inappropriate or irrelevant:
- Set \`isAppropriate\` to \`false\`.
- Provide a brief, respectful reason for the rejection in the \`rejectionReason\` field. The reason should be in Spanish. For example: "El mensaje no parece estar relacionado con la plataforma SquadUp." or "El contenido del mensaje es inapropiado y no se puede procesar."
- Do not fill in the \`category\`, \`summary\`, or \`subject\` fields.

If the message is appropriate and relevant:
- Set \`isAppropriate\` to \`true\`.
- Categorize the problem into one of the following: "Reporte de Usuario", "Problema Técnico", "Consulta de Torneo", "Feedback General", "Otro".
- Write a clear and concise summary of the issue in a single paragraph (in Spanish).
- Create a short, descriptive subject line for the support email (in Spanish).
- Do not fill in the \`rejectionReason\` field.

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
