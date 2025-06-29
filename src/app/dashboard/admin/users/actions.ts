
'use server';

import { functions } from "@/lib/firebase";
import { httpsCallable, FunctionsError } from "firebase/functions";

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
        
        if (error instanceof FunctionsError) {
            return { success: false, error: error.message };
        }
        
        return { success: false, error: "Ocurrió un error desconocido al contactar con el servidor." };
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
    // Check if banExpiresAt is part of the data object to decide if we should send it
    if (typeof banExpiresAt !== 'undefined') {
        payload.banExpiresAt = banExpiresAt;
    }

    try {
        const updateUserFunc = httpsCallable(functions, 'setUserRole');
        await updateUserFunc(payload);
        return { success: true };
    } catch (error: any) {
        console.error("Error updating user:", error);
        
        if (error instanceof FunctionsError) {
            return { success: false, error: error.message };
        }
        
        return { success: false, error: "Ocurrió un error desconocido al contactar con el servidor." };
    }
}
