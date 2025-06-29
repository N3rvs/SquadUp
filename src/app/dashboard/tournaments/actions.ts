
'use server';

import { functions } from "@/lib/firebase";
import { httpsCallable, FunctionsError } from "firebase/functions";

export async function deleteTournamentAction(tournamentId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const deleteTournamentFunc = httpsCallable(functions, 'deleteTournament');
        await deleteTournamentFunc({ tournamentId });
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting tournament:", error);
        
        if (error instanceof FunctionsError) {
            switch (error.code) {
                case 'not-found':
                    return { success: false, error: "La función de eliminar no fue encontrada en el servidor. Asegúrate de haberla desplegado correctamente." };
                case 'permission-denied':
                    return { success: false, error: "No tienes los permisos necesarios para realizar esta acción." };
                case 'invalid-argument':
                     return { success: false, error: "Se enviaron datos inválidos a la función." };
                default:
                    return { success: false, error: `Error inesperado de la función: ${error.message}` };
            }
        }
        
        return { success: false, error: "Ocurrió un error desconocido al contactar con el servidor." };
    }
}
