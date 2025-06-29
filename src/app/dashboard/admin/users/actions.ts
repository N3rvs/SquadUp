
'use server';

import { functions, db } from "@/lib/firebase";
import { httpsCallable, FunctionsError } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";

function getErrorMessage(error: any): string {
    if (error instanceof FunctionsError) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "La operación o el usuario no fue encontrado en el servidor.";
            case 'invalid-argument':
                return "Los datos enviados son incorrectos. Por favor, revisa la información.";
            default:
                return `Ocurrió un error con la función: ${error.message}`;
        }
    }
    return "Ocurrió un error desconocido al contactar con el servidor.";
}

export async function deleteUserAction(uid: string): Promise<{ success: boolean; error?: string }> {
    if (!uid) {
        return { success: false, error: "UID de usuario no proporcionado." };
    }
    
    try {
        const deleteUserFunc = httpsCallable(functions, 'deleteUser');
        await deleteUserFunc({ uid });
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}


export async function updateUserAction(data: { uid: string, role?: string, banExpiresAt?: string | null }): Promise<{ success: boolean; error?: string }> {
    const { uid, role, banExpiresAt } = data;
    if (!uid) {
        return { success: false, error: "UID de usuario no proporcionado." };
    }

    try {
        const dataToUpdate: { [key: string]: any } = {};

        // Update role claim via Cloud Function
        if (role) {
            const setUserRoleFunc = httpsCallable(functions, 'setUserRole');
            await setUserRoleFunc({ uid, role });
            dataToUpdate.primaryRole = role; // Also update Firestore for UI
        }
        
        // Update ban status via Cloud Function
        if (typeof banExpiresAt !== 'undefined') {
            const isBanned = banExpiresAt !== null;
            const banUserFunc = httpsCallable(functions, 'banUser');
            await banUserFunc({ uid, isBanned });
            
            // Also update Firestore for UI (temp bans, banned screen)
            dataToUpdate.isBanned = isBanned;
            dataToUpdate.banExpiresAt = banExpiresAt ? new Date(banExpiresAt) : null;
        }

        // Update Firestore document
        if (Object.keys(dataToUpdate).length > 0) {
            await updateDoc(doc(db, 'users', uid), dataToUpdate);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error updating user:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}
