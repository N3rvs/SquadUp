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
