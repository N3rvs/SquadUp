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


export async function updateUserAction(data: { uid: string, role: string, isBanned: boolean }): Promise<{ success: boolean; error?: string }> {
    const { uid, role, isBanned } = data;
    if (!uid) {
        return { success: false, error: "UID de usuario no proporcionado." };
    }

    try {
        // This function now handles role and ban status updates
        const updateUserFunc = httpsCallable(functions, 'setUserRole');
        await updateUserFunc({ uid, role, isBanned });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating user:", error);
        
        if (error instanceof FunctionsError) {
            return { success: false, error: error.message };
        }
        
        return { success: false, error: "Ocurrió un error desconocido al contactar con el servidor." };
    }
}
