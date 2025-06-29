
'use server';

import { functions } from "@/lib/firebase";
import { httpsCallable, FunctionsError } from "firebase/functions";
import { revalidatePath } from "next/cache";

function getErrorMessage(error: any): string {
    if (error instanceof FunctionsError) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "El torneo o la operación no fue encontrada en el servidor.";
            case 'invalid-argument':
                return "Los datos enviados son incorrectos. Por favor, revisa la información.";
            default:
                return `Ocurrió un error con la función: ${error.message}`;
        }
    }
    return "Ocurrió un error desconocido al contactar con el servidor.";
}

export async function deleteTournamentAction(tournamentId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const deleteTournamentFunc = httpsCallable(functions, 'deleteTournament');
        await deleteTournamentFunc({ tournamentId });
        revalidatePath('/dashboard/tournaments');
        revalidatePath('/dashboard/admin/tournaments');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting tournament:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}
