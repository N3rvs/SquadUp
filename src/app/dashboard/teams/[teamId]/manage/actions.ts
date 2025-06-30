'use server';

import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import type { Timestamp } from 'firebase/firestore';


function getErrorMessage(error: any): string {
    if (error.code && error.message) {
        return `Error (${error.code}): ${error.message}`;
    }
    return error.message || "An unknown error occurred.";
}


export async function deleteTeamAction(teamId: string): Promise<{ success: boolean; error?: string }> {
     try {
        const deleteTeamFunc = httpsCallable(functions, 'deleteTeam');
        await deleteTeamFunc({ teamId });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: getErrorMessage(error) };
    }
}
