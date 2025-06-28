
'use server';

import { suggestTeamComposition, type SuggestTeamCompositionInput } from '@/ai/flows/suggest-team-composition';

export async function getTeamSuggestion(input: SuggestTeamCompositionInput) {
  try {
    const result = await suggestTeamComposition(input);
    return { success: true, data: result };
  } catch (error) {
    console.error(error);
    if (error instanceof Error) {
        return { success: false, error: `An error occurred: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred while getting suggestion.' };
  }
}
