/**
 * This file contains all the Cloud Functions for the SquadUp application.
 * It is organized by feature area (Users, Teams, Tournaments, Friends).
 */

import {
  onCall,
  HttpsError,
  type CallableRequest,
} from 'firebase-functions/v2/https';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
initializeApp();
const auth = getAuth();
const db = getFirestore();

// --- UTILITY FUNCTIONS ---

/**
 * Checks if a user is authenticated and has a specific security role.
 * Throws an HttpsError if not authorized.
 * @param {CallableRequest} request - The request object from the onCall function.
 * @param {string[]} allowedRoles - An array of roles that are allowed to perform the action.
 */
const ensureHasRole = (request: CallableRequest, allowedRoles: string[]) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }
  const userRole = request.auth.token.role;
  if (!userRole || !allowedRoles.includes(userRole as string)) {
    throw new HttpsError(
      'permission-denied',
      'You do not have permission to perform this action.'
    );
  }
};

/**
 * Checks if a user is authenticated.
 * Throws an HttpsError if not authenticated.
 * @param {CallableRequest} request - The request object from the onCall function.
 */
const isAuthenticated = (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }
};

// --- USER MANAGEMENT ---

/**
 * Sets a custom claim for a user's role and syncs it to their Firestore profile.
 * Only callable by 'admin' users.
 */
export const setUserRoleAndSync = onCall(async (data, context) => {
  ensureHasRole(context, ['admin']);

  const {uid, role} = data;
  if (!uid || !role) {
    throw new HttpsError(
      'invalid-argument',
      'The function must be called with "uid" and "role" arguments.'
    );
  }

  try {
    // Set custom claim for security rules
    await auth.setCustomUserClaims(uid, {role: role});

    // Update the user's primaryRole in Firestore for UI purposes
    const userRef = db.collection('users').doc(uid);
    await userRef.update({primaryRole: role});

    logger.info(`Successfully set role '${role}' for user ${uid}`);
    return {message: `Role '${role}' successfully assigned to user ${uid}.`};
  } catch (error) {
    logger.error(`Error setting role for user ${uid}:`, error);
    throw new HttpsError('internal', 'Unable to set user role.');
  }
});

/**
 * Sets the 'isBanned' custom claim and Firestore field for a user.
 * Only callable by 'admin' users.
 */
export const banUser = onCall(async (data, context) => {
  ensureHasRole(context, ['admin']);
  const {uid, isBanned} = data;
  if (!uid || typeof isBanned !== 'boolean') {
    throw new HttpsError('invalid-argument', 'UID and isBanned are required.');
  }
  try {
    const user = await auth.getUser(uid);
    const currentClaims = user.customUserClaims || {};
    await auth.setCustomUserClaims(uid, {...currentClaims, isBanned});
    await db.collection('users').doc(uid).update({isBanned});

    return {
      message: `User ${uid} has been ${isBanned ? 'banned' : 'unbanned'}.`,
    };
  } catch (error) {
    logger.error('Error banning user:', error);
    throw new HttpsError('internal', 'Could not update user ban status.');
  }
});

// --- TEAM MANAGEMENT ---

/**
 * Approves a team application, adding the user to the team.
 * Can only be called by the team owner, an admin, or a moderator.
 */
export const processTeamApplication = onCall(async (data, context) => {
  isAuthenticated(context);
  const uid = context.auth!.uid;
  const {applicationId, approved} = data;

  if (!applicationId || typeof approved !== 'boolean') {
    throw new HttpsError(
      'invalid-argument',
      'applicationId and approved status are required.'
    );
  }

  const appRef = db.collection('teamApplications').doc(applicationId);
  const appDoc = await appRef.get();
  if (!appDoc.exists) {
    throw new HttpsError('not-found', 'Application not found.');
  }
  const appData = appDoc.data()!;

  const teamRef = db.collection('teams').doc(appData.teamId);
  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) {
    throw new HttpsError('not-found', 'Team not found.');
  }

  const isOwner = teamDoc.data()!.ownerId === uid;
  const userRole = context.auth!.token.role;
  const isStaff = userRole === 'admin' || userRole === 'moderator';

  if (!isOwner && !isStaff) {
    throw new HttpsError('permission-denied', 'You cannot manage this team.');
  }

  const batch = db.batch();

  if (approved) {
    const userDoc = await db.collection('users').doc(appData.userId).get();
    if (!userDoc.exists) {
      throw new HttpsError(
        'not-found',
        'El perfil del solicitante no existe.'
      );
    }

    const memberData = {
      uid: appData.userId,
      displayName: userDoc.data()?.displayName || 'Miembro sin Nombre',
      avatarUrl: userDoc.data()?.avatarUrl || '',
      valorantRoles: userDoc.data()?.valorantRoles || ['Flex'],
      primaryRole: userDoc.data()?.primaryRole || 'player',
    };

    batch.update(teamRef, {
      memberIds: FieldValue.arrayUnion(appData.userId),
      members: FieldValue.arrayUnion(memberData),
    });
    batch.update(appRef, {status: 'approved'});
  } else {
    batch.update(appRef, {status: 'rejected'});
  }

  await batch.commit();
  return {success: true};
});

/**
 * Gets the list of pending applications for a specific team.
 * Can only be called by the team owner, an admin, or a moderator.
 */
export const getTeamApplicationsInbox = onCall(async (data, context) => {
  isAuthenticated(context);
  const uid = context.auth!.uid;
  const teamId = data.teamId;

  if (!teamId) {
    throw new HttpsError('invalid-argument', 'teamId is required.');
  }

  const teamDoc = await db.collection('teams').doc(teamId).get();
  if (!teamDoc.exists) {
    throw new HttpsError('not-found', 'Team not found.');
  }

  const isOwner = teamDoc.data()!.ownerId === uid;
  const userRole = context.auth!.token.role;
  const isStaff = userRole === 'admin' || userRole === 'moderator';

  if (!isOwner && !isStaff) {
    throw new HttpsError('permission-denied', 'You cannot view this inbox.');
  }

  const applicationsSnapshot = await db
    .collection('teamApplications')
    .where('teamId', '==', teamId)
    .where('status', '==', 'pending')
    .get();

  const applications = applicationsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {applications};
});

/**
 * Deletes a team and all associated data.
 * Can only be called by an admin.
 */
export const deleteTeam = onCall(async (data, context) => {
  ensureHasRole(context, ['admin']);
  const teamId = data.teamId;

  if (!teamId) {
    throw new HttpsError('invalid-argument', 'teamId is required.');
  }

  const batch = db.batch();
  const teamRef = db.collection('teams').doc(teamId);
  batch.delete(teamRef);

  // You could expand this to delete applications, etc.
  await batch.commit();
  return {success: true, message: 'Team deleted successfully.'};
});

// --- TOURNAMENT MANAGEMENT ---

/**
 * Approves or rejects a tournament.
 * Can only be called by an admin or a moderator.
 */
export const approveTournament = onCall(async (data, context) => {
  ensureHasRole(context, ['admin', 'moderator']);

  const {tournamentId, approved} = data;
  if (!tournamentId || typeof approved !== 'boolean') {
    throw new HttpsError(
      'invalid-argument',
      'tournamentId and approved status are required.'
    );
  }

  const tournamentRef = db.collection('tournaments').doc(tournamentId);
  const newStatus = approved ? 'Open' : 'Rejected';

  await tournamentRef.update({status: newStatus, approved: approved});
  return {message: `Tournament status updated to ${newStatus}`};
});

/**
 * Deletes a tournament.
 * Can only be called by an admin.
 */
export const deleteTournament = onCall(async (data, context) => {
  ensureHasRole(context, ['admin']);
  const {tournamentId} = data;
  if (!tournamentId) {
    throw new HttpsError('invalid-argument', 'A tournamentId is required.');
  }
  await db.collection('tournaments').doc(tournamentId).delete();
  return {success: true, message: 'Tournament deleted.'};
});

// --- FRIEND MANAGEMENT ---

/**
 * Sends a friend request from the authenticated user to another user.
 */
export const sendFriendRequest = onCall(async (data, context) => {
  isAuthenticated(context);
  const from = context.auth!.uid;
  const to = data.to;

  if (from === to) {
    throw new HttpsError(
      'invalid-argument',
      'You cannot send a friend request to yourself.'
    );
  }

  const existingRequestQuery = db
    .collection('friendRequests')
    .where('from', '==', from)
    .where('to', '==', to);
  const existingRequest = await existingRequestQuery.get();
  if (!existingRequest.empty) {
    throw new HttpsError('already-exists', 'Friend request already sent.');
  }

  const userDocRef = db.collection('users').doc(from);
  const userDoc = await userDocRef.get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'Tu perfil no existe.');
  }
  const userData = userDoc.data()!;

  await db.collection('friendRequests').add({
    from: from,
    to: to,
    fromDisplayName: userData.displayName || 'Usuario Desconocido',
    fromAvatarUrl: userData.avatarUrl || '',
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });

  return {success: true};
});

/**
 * Responds to a friend request (accept or reject).
 */
export const respondToFriendRequest = onCall(async (data, context) => {
  isAuthenticated(context);
  const uid = context.auth!.uid;
  const {requestId, accept} = data;

  const requestRef = db.collection('friendRequests').doc(requestId);
  const requestDoc = await requestRef.get();

  if (!requestDoc.exists || requestDoc.data()!.to !== uid) {
    throw new HttpsError('permission-denied', 'This is not your request.');
  }

  const batch = db.batch();
  if (accept) {
    const fromId = requestDoc.data()!.from;
    const fromRef = db.collection('users').doc(fromId);
    const toRef = db.collection('users').doc(uid);
    batch.update(fromRef, {friends: FieldValue.arrayUnion(uid)});
    batch.update(toRef, {friends: FieldValue.arrayUnion(fromId)});
    batch.update(requestRef, {status: 'accepted'});
  } else {
    batch.update(requestRef, {status: 'rejected'});
  }

  await batch.commit();
  return {success: true};
});

/**
 * Removes a friend from both users' friend lists.
 */
export const removeFriend = onCall(async (data, context) => {
  isAuthenticated(context);
  const uid = context.auth!.uid;
  const friendId = data.friendId;

  if (!friendId) {
    throw new HttpsError('invalid-argument', 'friendId is required.');
  }

  const batch = db.batch();
  const userRef = db.collection('users').doc(uid);
  const friendRef = db.collection('users').doc(friendId);
  batch.update(userRef, {friends: FieldValue.arrayRemove(friendId)});
  batch.update(friendRef, {friends: FieldValue.arrayRemove(uid)});

  await batch.commit();
  return {success: true, message: 'Friend removed.'};
});

// --- DATABASE TRIGGERS ---

/**
 * Trigger to update denormalized team member data when a user's profile changes.
 */
export const onUserUpdate = onDocumentWritten('users/{userId}', async (event) => {
  const userId = event.params.userId;
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!afterData) return; // User deleted, handle separately if needed

  const nameChanged = beforeData?.displayName !== afterData.displayName;
  const avatarChanged = beforeData?.avatarUrl !== afterData.avatarUrl;

  if (nameChanged || avatarChanged) {
    const teamsSnapshot = await db
      .collection('teams')
      .where('memberIds', 'array-contains', userId)
      .get();

    if (teamsSnapshot.empty) {
      logger.info(
        `User ${userId} is not in any teams, no denormalization needed.`
      );
      return;
    }

    const batch = db.batch();
    teamsSnapshot.forEach((doc) => {
      const teamData = doc.data();
      const members = teamData.members || [];
      const memberIndex = members.findIndex((m: any) => m.uid === userId);

      if (memberIndex > -1) {
        // Create a new members array with the updated data
        const updatedMembers = [...members];
        updatedMembers[memberIndex] = {
          ...updatedMembers[memberIndex],
          displayName: afterData.displayName,
          avatarUrl: afterData.avatarUrl,
        };
        batch.update(doc.ref, {members: updatedMembers});
      }
    });

    try {
      await batch.commit();
      logger.info(`Denormalized user data for ${userId} across teams.`);
    } catch (error) {
      logger.error(
        `Error denormalizing user data for ${userId}:`,
        error
      );
    }
  }
});
