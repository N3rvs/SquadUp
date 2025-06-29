
'use server';

import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";

export async function getAdminTournaments(): Promise<{ success: boolean; tournaments?: any[]; error?: string }> {
    try {
        const tournamentsRef = collection(db, "tournaments");
        const q = query(tournamentsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const tournaments = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                startDate: (data.startDate as Timestamp).toDate().toISOString(),
            };
        });
        return { success: true, tournaments };
    } catch (error) {
        console.error("Error fetching tournaments for admin:", error);
        return { success: false, error: "Failed to fetch tournaments." };
    }
}
