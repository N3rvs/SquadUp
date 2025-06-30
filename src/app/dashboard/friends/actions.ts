
'use server';

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface Friend {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    primaryRole?: string;
}

export interface FriendRequest {
    id: string;
    from: string;
    sender?: {
        displayName: string;
        avatarUrl?: string;
    }
    createdAt: string;
}

function getErrorMessage(error: any): string {
    if (error.code && error.message) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "La operación o el usuario no fue encontrado en el servidor.";
            case 'already-exists':
                return "Ya existe una solicitud de amistad pendiente con este usuario.";
            default:
                return `Ocurrió un error con la función: ${error.message}`;
        }
    }
    return error.message || "An unknown error occurred.";
}


export async function sendFriendRequest(
    receiverId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const sendRequestFunc = httpsCallable(functions, 'sendFriendRequest');
        await sendRequestFunc({ to: receiverId });
        return { success: true };
    } catch (error: any) {
        console.error("Error sending friend request:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}


export async function respondToFriendRequest(
    requestId: string,
    accept: boolean
): Promise<{ success: boolean; error?: string; }> {
    try {
        const respondToRequestFunc = httpsCallable(functions, 'respondToFriendRequest');
        await respondToRequestFunc({ requestId, accept });
        return { success: true };
    } catch (error: any) {
        console.error(`Error handling friend request decision ${accept}:`, error);
        return { success: false, error: getErrorMessage(error) };
    }
}


export async function removeFriend(
    friendId: string
): Promise<{ success: boolean; error?: string; }> {
    if (!friendId) {
        return { success: false, error: "Friend ID is required." };
    }
    try {
        const removeFriendFunc = httpsCallable(functions, 'removeFriend');
        await removeFriendFunc({ friendId });
        return { success: true };
    } catch (error: any) {
        console.error("Error removing friend:", error);
        return { success: false, error: getErrorMessage(error) };
    }
}

    