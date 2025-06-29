
'use server';

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export async function deleteTournamentAction(tournamentId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const deleteTournamentFunc = httpsCallable(functions, 'deleteTournament');
        await deleteTournamentFunc({ tournamentId });
        return { success: true };
    } catch (error) {
        console.error("Error deleting tournament:", error);
        if (error instanceof Error) {
            if (error.message.includes('permission-denied')) {
                 return { success: false, error: "You are not authorized to perform this action." };
            }
            return { success: false, error: error.message };
        }
        return { success: false, error: "An unknown error occurred while deleting the tournament." };
    }
}
