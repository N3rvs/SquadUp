'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function getAdminDashboardStats() {
    try {
        const usersRef = collection(db, "users");
        const tournamentsRef = collection(db, "tournaments");
        const supportTicketsRef = collection(db, "supportTickets");

        const usersSnapshotPromise = getDocs(usersRef);
        const pendingTournamentsPromise = getDocs(query(tournamentsRef, where("status", "==", "Pending")));
        const openTicketsPromise = getDocs(query(supportTicketsRef, where("status", "==", "new")));

        const [usersSnapshot, pendingTournamentsSnapshot, openTicketsSnapshot] = await Promise.all([
            usersSnapshotPromise,
            pendingTournamentsPromise,
            openTicketsPromise
        ]);

        return {
            success: true,
            stats: {
                totalUsers: usersSnapshot.size,
                pendingTournaments: pendingTournamentsSnapshot.size,
                openSupportTickets: openTicketsSnapshot.size,
            }
        };
    } catch (error) {
        console.error("Error fetching admin stats:", error);
        return { success: false, error: "Failed to fetch dashboard stats." };
    }
}
