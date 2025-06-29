'use server';

import { categorizeSupportRequest } from '@/ai/flows/categorize-support-request';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';

interface CategorizeResult {
    success: true;
    data: {
        category: string;
        summary: string;
        subject: string;
    };
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

export async function sendSupportEmail(formData: {
    subject: string;
    body: string;
    category: string;
}): Promise<{ success: boolean; error?: string }> {
    
    // In a real app, you'd get the user from the session, but since we don't have full auth session on server actions yet, we'll log a placeholder.
    // This part of the code is illustrative.
    try {
        // In a real application, you would use an email service like SendGrid, Resend, or Nodemailer.
        // For this example, we'll just log the details to the console.
        console.log("--- New Support Email ---");
        console.log(`From User (note: auth state is not passed to server actions in this setup)`);
        console.log(`Category: ${formData.category}`);
        console.log(`Subject: ${formData.subject}`);
        console.log("Body:");
        console.log(formData.body);
        console.log("-------------------------");

        return { success: true };
    } catch (error) {
        console.error("Error sending support email:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "An unknown error occurred while sending the email." };
    }
}
