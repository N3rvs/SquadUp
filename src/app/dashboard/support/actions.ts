'use server';

import { categorizeSupportRequest, type CategorizeSupportRequestOutput } from '@/ai/flows/categorize-support-request';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

interface CategorizeResult {
    success: true;
    data: CategorizeSupportRequestOutput;
}

interface ErrorResult {
    success: false;
    error: string;
}

export async function categorizeProblem(
    problemDescription: string
): Promise<CategorizeResult | ErrorResult> {
    try {
        const result = await categorizeSupportRequest({ problemDescription });
        return { success: true, data: result };
    } catch (error) {
        console.error("Error categorizing problem:", error);
        if (error instanceof Error) {
            return { success: false, error: `An error occurred: ${error.message}` };
        }
        return { success: false, error: 'An unknown error occurred while analyzing the request.' };
    }
}

export async function createSupportTicket(formData: {
    subject: string;
    body: string;
    category: string;
    userId: string;
    userDisplayName: string;
}): Promise<{ success: boolean; error?: string }> {
    
    try {
        await addDoc(collection(db, "supportTickets"), {
            ...formData,
            status: 'new',
            createdAt: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error creating support ticket:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "An unknown error occurred while creating the ticket." };
    }
}
