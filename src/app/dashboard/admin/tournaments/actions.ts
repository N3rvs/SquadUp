
'use server';

import { functions, db } from "@/lib/firebase";
import { httpsCallable, FunctionsError } from "firebase/functions";
import { collection, doc, getDocs, orderBy, query, updateDoc, Timestamp } from "firebase/firestore";
import { revalidatePath } from "next/cache";

function getErrorMessage(error: any): string {
    if (error instanceof FunctionsError) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "La operación solicitada no fue encontrada en el servidor. Verifica que la función esté desplegada en la región correcta.";
            case 'invalid-argument':
                return "Los datos enviados son incorrectos. Por favor, revisa la información.";
            case 'already-exists':
                 return "El torneo ya ha sido aprobado o está en un estado que no permite esta acción.";
            default:
                return `Ocurrió un error con la función: ${error.message}`;
        }
    }
    return "Ocurrió un error desconocido al contactar con el servidor.";
}

export async function getAdminTournaments(): Promise<{ success: boolean; tournaments?: any[]; error?: string }> {
    try {
        const tournamentsRef = collection(db, "tournaments");
        const q = query(tournamentsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const tournaments = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                startDate: (data.startDate as Timestamp).toDate().toISOString(),
            };
        });
        return { success: true, tournaments };
    } catch (error) {
        console.error("Error fetching tournaments for admin:", error);
        return { success: false, error: "Failed to fetch tournaments." };
    }
}

export async function updateTournamentStatusAction(tournamentId: string, status: 'Open' | 'Rejected'): Promise<{ success: boolean; error?: string }> {
    try {
        // According to the provided backend function, we should call 'approveTournament' for both cases.
        const approveTournamentFunc = httpsCallable(functions, 'approveTournament');
        const approved = status === 'Open';
        await approveTournamentFunc({ tournamentId, approved });

        // The backend function updates a field `approved`, but the UI relies on `status`.
        // To make the UI work without changing the backend, we update the `status` field here.
        const tournamentRef = doc(db, 'tournaments', tournamentId);
        await updateDoc(tournamentRef, { status: status });

        revalidatePath('/dashboard/admin/tournaments');
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating tournament status to ${status}:`, error);
        return { success: false, error: getErrorMessage(error) };
    }
}
