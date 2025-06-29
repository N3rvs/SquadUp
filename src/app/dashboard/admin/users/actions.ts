
'use server';

import { functions } from "@/lib/firebase";
import { httpsCallable, FunctionsError } from "firebase/functions";

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

    const payload: { uid: string, role?: string, banExpiresAt?: string | null } = { uid };
    if (role) {
        payload.role = role;
    }
    if (typeof banExpiresAt !== 'undefined') {
        payload.banExpiresAt = banExpiresAt;
    }

    try {
        const updateUserFunc = httpsCallable(functions, 'setUserRole');
        await updateUserFunc(payload);
        return { success: true };
    } catch (error: any) {
        console.error("Error updating user:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}
