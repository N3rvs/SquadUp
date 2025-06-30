
import { auth, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import type { Timestamp } from 'firebase/firestore';

export interface Application {
    id: string;
    teamId: string;
    teamName: string;
    teamOwnerId: string;
    userId: string;
    userDisplayName: string;
    userAvatarUrl: string;
    status: "pending" | "approved" | "rejected";
    createdAt: Timestamp;
    type: 'application';
}

interface SuccessResult<T> {
  success: true;
  data: T;
}

interface AppsResult {
    success: true;
    applications: Application[];
}

interface ErrorResult {
  success: false;
  error: string;
}

function getErrorMessage(error: any): string {
    if (error.code && error.message) {
        return `Error (${error.code}): ${error.message}`;
    }
    return error.message || "An unknown error occurred.";
}


export async function getTeamApplications(teamId: string): Promise<AppsResult | ErrorResult> {
    try {
        const getAppsFunc = httpsCallable(functions, 'getTeamApplicationsInbox');
        const result = await getAppsFunc({ teamId });
        return { success: true, applications: result.data.applications as Application[] };
    } catch (error: any) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function processApplication(applicationId: string, approved: boolean): Promise<{ success: boolean; error?: string }> {
     try {
        const processAppFunc = httpsCallable(functions, 'processTeamApplication');
        await processAppFunc({ applicationId, approved });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: getErrorMessage(error) };
    }
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
