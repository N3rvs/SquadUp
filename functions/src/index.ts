
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

admin.initializeApp();
const db = admin.firestore();

// Helper to check for authentication and roles
const ensureAuthenticated = (context: any, requiredRoles: string[] = []) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    
    if (requiredRoles.length > 0) {
        const userRole = context.auth.token.role;
        if (!userRole || !requiredRoles.includes(userRole)) {
            throw new HttpsError("permission-denied", "You do not have the required role to perform this action.");
        }
    }
    return context.auth.uid;
};

/* ------------------ FRIEND MANAGEMENT ------------------ */

export const sendFriendRequest = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    const fromId = ensureAuthenticated({auth});
    const { to: toId } = data;

    if (!toId || typeof toId !== 'string') {
        throw new HttpsError('invalid-argument', 'The function must be called with a "to" user ID string.');
    }
    if (fromId === toId) {
        throw new HttpsError('invalid-argument', 'You cannot send a friend request to yourself.');
    }
    
    const fromUserDoc = await db.collection('users').doc(fromId).get();
    if (!fromUserDoc.exists) {
        throw new HttpsError('not-found', 'Your user profile could not be found.');
    }

    const toUserDoc = await db.collection('users').doc(toId).get();
    if (!toUserDoc.exists) {
        throw new HttpsError('not-found', 'The target user could not be found.');
    }
    
    const friends = fromUserDoc.data()?.friends || [];
    if (friends.includes(toId)) {
        throw new HttpsError('already-exists', 'You are already friends with this user.');
    }

    const requestsRef = db.collection('friendRequests');
    const q1 = requestsRef.where('from', '==', fromId).where('to', '==', toId);
    const q2 = requestsRef.where('from', '==', toId).where('to', '==', fromId);

    const [snap1, snap2] = await Promise.all([q1.get(), q2.get()]);

    if (!snap1.empty || !snap2.empty) {
        throw new HttpsError('already-exists', 'A friend request already exists between you and this user.');
    }

    const fromData = fromUserDoc.data();
    await requestsRef.add({
        from: fromId,
        fromDisplayName: fromData?.displayName || 'Unknown User',
        fromAvatarUrl: fromData?.avatarUrl || '',
        to: toId,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: 'Friend request sent.' };
});

export const respondToFriendRequest = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    const userId = ensureAuthenticated({ auth });
    const { requestId, accept } = data;

    if (typeof requestId !== 'string' || typeof accept !== 'boolean') {
        throw new HttpsError('invalid-argument', 'Invalid data provided.');
    }
    
    const requestRef = db.collection('friendRequests').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists || requestSnap.data()?.to !== userId) {
        throw new HttpsError('permission-denied', 'This request is not for you or does not exist.');
    }

    if (accept) {
        const fromId = requestSnap.data()?.from;
        const userRef = db.collection('users').doc(userId);
        const friendRef = db.collection('users').doc(fromId);
        
        const batch = db.batch();
        batch.update(userRef, { friends: admin.firestore.FieldValue.arrayUnion(fromId) });
        batch.update(friendRef, { friends: admin.firestore.FieldValue.arrayUnion(userId) });
        batch.delete(requestRef);
        await batch.commit();

        return { success: true, message: 'Friend added.' };
    } else {
        await requestRef.delete();
        return { success: true, message: 'Request rejected.' };
    }
});

export const removeFriend = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { friendId } = data;
  const userId = ensureAuthenticated({auth});

  if (!userId || !friendId || typeof friendId !== 'string' || friendId.length < 10) {
    logger.error("Invalid ID received:", friendId);
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }

  const userRef = db.collection("users").doc(userId);
  const friendRef = db.collection("users").doc(friendId);
  const batch = db.batch();

  batch.update(userRef, { friends: admin.firestore.FieldValue.arrayRemove(friendId) });
  batch.update(friendRef, { friends: admin.firestore.FieldValue.arrayRemove(userId) });

  const requestsRef = db.collection("friendRequests");
  const query1 = requestsRef.where("from", "==", userId).where("to", "==", friendId);
  const query2 = requestsRef.where("from", "==", friendId).where("to", "==", userId);
  const [snap1, snap2] = await Promise.all([query1.get(), query2.get()]);
  [...snap1.docs, ...snap2.docs].forEach(doc => batch.delete(doc.ref));

  await batch.commit();

  logger.info(`Friendship and requests between ${userId} and ${friendId} removed.`);
  return { message: "Amigo eliminado correctamente." };
});


/* ------------------ TEAM MANAGEMENT ------------------ */

export const processTeamApplication = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    const managerId = ensureAuthenticated({auth});
    const { applicationId, approved } = data;

    if (typeof applicationId !== 'string' || typeof approved !== 'boolean') {
        throw new HttpsError('invalid-argument', 'Invalid data provided.');
    }

    const applicationRef = db.collection('teamApplications').doc(applicationId);
    const applicationSnap = await applicationRef.get();

    if (!applicationSnap.exists) { throw new HttpsError('not-found', 'Application not found.'); }

    const applicationData = applicationSnap.data()!;
    const teamId = applicationData.teamId;
    const applicantId = applicationData.userId;
    
    const teamRef = db.collection('teams').doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) { throw new HttpsError('not-found', 'Team not found.'); }
    const teamData = teamSnap.data()!;
    
    const userRole = auth?.token.role;
    if (teamData.ownerId !== managerId && userRole !== 'admin' && userRole !== 'moderator') {
        throw new HttpsError('permission-denied', 'You do not have permission to manage this team.');
    }
    
    if (approved) {
        const applicantRef = db.collection('users').doc(applicantId);
        const applicantSnap = await applicantRef.get();
        if (!applicantSnap.exists) { throw new HttpsError('not-found', 'Applicant user profile not found.'); }
        const applicantData = applicantSnap.data()!;

        const newMemberData = {
            uid: applicantId,
            displayName: applicantData.displayName || 'Unnamed User',
            avatarUrl: applicantData.avatarUrl || '',
            valorantRoles: applicantData.valorantRoles || ['Flex'],
            primaryRole: applicantData.primaryRole || 'player',
        };

        const batch = db.batch();
        batch.update(teamRef, {
            memberIds: admin.firestore.FieldValue.arrayUnion(applicantId),
            members: admin.firestore.FieldValue.arrayUnion(newMemberData)
        });
        batch.update(applicationRef, { status: 'approved' });
        await batch.commit();

        return { success: true, message: 'Application approved.' };
    } else {
        await applicationRef.update({ status: 'rejected' });
        return { success: true, message: 'Application rejected.' };
    }
});

export const getTeamApplicationsInbox = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    ensureAuthenticated({auth});
    const { teamId } = data;
    if (!teamId) { throw new HttpsError("invalid-argument", "Team ID is required."); }

    const applicationsRef = db.collection("teamApplications");
    const q = applicationsRef.where("teamId", "==", teamId).where("status", "==", "pending");
    const querySnapshot = await q.get();
    const applications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { applications };
});

export const deleteTeam = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    ensureAuthenticated({auth}, ['admin', 'moderator']);
    const { teamId } = data;
    if (!teamId) { throw new HttpsError("invalid-argument", "Team ID is required."); }

    await db.collection("teams").doc(teamId).delete();
    return { success: true, message: "Team deleted successfully." };
});


/* ------------------ ADMIN/MODERATOR ACTIONS ------------------ */

export const approveTournament = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    ensureAuthenticated({auth}, ['admin', 'moderator']);
    const { tournamentId, approved } = data;

    if (typeof tournamentId !== 'string' || typeof approved !== 'boolean') {
        throw new HttpsError('invalid-argument', 'Invalid data provided.');
    }
    
    await db.collection('tournaments').doc(tournamentId).update({
        approved: approved,
        status: approved ? 'Open' : 'Rejected',
    });
    return { success: true };
});

export const deleteTournament = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    ensureAuthenticated({auth}, ['admin']);
    const { tournamentId } = data;
    if (!tournamentId) { throw new HttpsError("invalid-argument", "Tournament ID is required."); }

    await db.collection("tournaments").doc(tournamentId).delete();
    return { success: true, message: "Tournament deleted successfully." };
});

export const banUser = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    ensureAuthenticated({auth}, ['admin', 'moderator']);
    const { uid, isBanned } = data;

    if (typeof uid !== 'string' || typeof isBanned !== 'boolean') {
        throw new HttpsError('invalid-argument', 'Invalid data provided.');
    }
    await admin.auth().updateUser(uid, { disabled: isBanned });
    await db.collection('users').doc(uid).update({ isBanned: isBanned });

    return { success: true };
});

export const setUserRoleAndSync = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    ensureAuthenticated({auth}, ['admin']);
    const { uid, role } = data;

    if (typeof uid !== 'string' || typeof role !== 'string') {
        throw new HttpsError('invalid-argument', 'Invalid data provided.');
    }
    
    await admin.auth().setCustomUserClaims(uid, { role });
    await db.collection('users').doc(uid).update({ primaryRole: role });

    return { success: true };
});
