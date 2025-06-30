import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

admin.initializeApp();
const db = admin.firestore();

// Helper to check for admin/moderator roles
const isPrivilegedUser = (context: functions.https.CallableContext): boolean => {
  return (
    context.auth?.token?.role === "admin" ||
    context.auth?.token?.role === "moderator"
  );
};

// Helper to check for admin role
const isAdmin = (context: functions.https.CallableContext): boolean => {
  return context.auth?.token?.role === "admin";
};


// --- AUTH & USER MANAGEMENT FUNCTIONS ---

/**
 * Sets a user's role as a custom claim and syncs it to their Firestore profile.
 * Only callable by admins.
 */
export const setUserRoleAndSync = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!isAdmin(context)) {
        throw new functions.https.HttpsError("permission-denied", "You must be an admin to set user roles.");
      }

      const {uid, role} = data;
      if (!uid || !role) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'uid' and 'role'.");
      }

      try {
        await admin.auth().setCustomUserClaims(uid, {role});
        await db.collection("users").doc(uid).update({primaryRole: role});
        return {success: true, message: `Role '${role}' assigned to user ${uid}.`};
      } catch (error) {
        console.error("Error setting user role:", error);
        throw new functions.https.HttpsError("internal", "Unable to set user role.");
      }
    });


/**
 * Bans or un-bans a user by disabling/enabling their Auth account
 * and updating their Firestore document. Only callable by admins.
 */
export const banUser = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!isAdmin(context)) {
        throw new functions.https.HttpsError("permission-denied", "You must be an admin to ban users.");
      }

      const {uid, isBanned} = data;
      if (!uid || typeof isBanned !== "boolean") {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'uid' and 'isBanned'.");
      }

      try {
        await admin.auth().updateUser(uid, {disabled: isBanned});
        await db.collection("users").doc(uid).update({isBanned});
        return {success: true, message: `User ${uid} has been ${isBanned ? "banned" : "unbanned"}.`};
      } catch (error) {
        console.error("Error updating ban status:", error);
        throw new functions.https.HttpsError("internal", "Unable to update user ban status.");
      }
    });

// --- FRIEND MANAGEMENT FUNCTIONS ---

/**
 * Creates a friend request, denormalizing the sender's info.
 */
export const sendFriendRequest = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
      }

      const {to: toId} = data;
      const fromId = context.auth.uid;

      if (fromId === toId) {
        throw new functions.https.HttpsError("invalid-argument", "You cannot send a friend request to yourself.");
      }

      // Denormalize sender's data
      const fromUserDoc = await db.collection("users").doc(fromId).get();
      if (!fromUserDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Sender's profile not found.");
      }
      const {displayName, avatarUrl} = fromUserDoc.data()!;

      const requestData = {
        from: fromId,
        fromDisplayName: displayName,
        fromAvatarUrl: avatarUrl || "",
        to: toId,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      };

      await db.collection("friendRequests").add(requestData);
      return {success: true, message: "Friend request sent."};
    });

/**
 * Responds to a friend request (accept/reject). If accepted, adds both users
 * to each other's friends list.
 */
export const respondToFriendRequest = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
      }
      const {requestId, accept} = data;
      const currentUserId = context.auth.uid;

      const requestRef = db.collection("friendRequests").doc(requestId);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists || requestDoc.data()?.to !== currentUserId) {
        throw new functions.https.HttpsError("permission-denied", "You cannot respond to this request.");
      }

      if (accept) {
        const fromId = requestDoc.data()?.from;
        const toId = requestDoc.data()?.to;
        const fromRef = db.collection("users").doc(fromId);
        const toRef = db.collection("users").doc(toId);

        await db.runTransaction(async (t) => {
          t.update(fromRef, {friends: FieldValue.arrayUnion(toId)});
          t.update(toRef, {friends: FieldValue.arrayUnion(fromId)});
          t.update(requestRef, {status: "accepted"});
        });
      } else {
        await requestRef.update({status: "rejected"});
      }

      return {success: true, message: `Request ${accept ? "accepted" : "rejected"}.`};
    });

/**
 * Removes a friend from both users' friends lists.
 */
export const removeFriend = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
      }
      const {friendId} = data;
      const currentUserId = context.auth.uid;

      const currentUserRef = db.collection("users").doc(currentUserId);
      const friendRef = db.collection("users").doc(friendId);

      await db.runTransaction(async (t) => {
        t.update(currentUserRef, {friends: FieldValue.arrayRemove(friendId)});
        t.update(friendRef, {friends: FieldValue.arrayRemove(currentUserId)});
      });

      return {success: true, message: "Friend removed."};
    });

// --- TEAM MANAGEMENT FUNCTIONS ---

/**
 * Gets all pending applications for a given team. Callable by team owner/staff.
 */
export const getTeamApplicationsInbox = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
      }
      const {teamId} = data;
      const teamDoc = await db.collection("teams").doc(teamId).get();
      if (!teamDoc.exists || (teamDoc.data()?.ownerId !== context.auth.uid && !isPrivilegedUser(context))) {
        throw new functions.https.HttpsError("permission-denied", "You do not manage this team.");
      }

      const appsSnapshot = await db.collection("teamApplications")
          .where("teamId", "==", teamId)
          .where("status", "==", "pending")
          .get();

      const applications = appsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
      return {applications};
    });

/**
 * Processes a team application. If approved, adds user to team members
 * and denormalizes their data into the team document.
 */
export const processTeamApplication = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
      }

      const {applicationId, approved} = data;
      const appRef = db.collection("teamApplications").doc(applicationId);
      const appDoc = await appRef.get();

      if (!appDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Application not found.");
      }

      const {teamId, userId} = appDoc.data()!;
      const teamRef = db.collection("teams").doc(teamId);
      const teamDoc = await teamRef.get();

      if (teamDoc.data()?.ownerId !== context.auth.uid && !isPrivilegedUser(context)) {
        throw new functions.https.HttpsError("permission-denied", "You cannot manage this team's applications.");
      }

      if (approved) {
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          throw new functions.https.HttpsError("not-found", "Applicant's profile does not exist.");
        }
        const {displayName, avatarUrl, valorantRoles, primaryRole} = userDoc.data()!;
        const memberData = {uid: userId, displayName, avatarUrl, valorantRoles, primaryRole};

        await db.runTransaction(async (t) => {
          t.update(teamRef, {
            memberIds: FieldValue.arrayUnion(userId),
            members: FieldValue.arrayUnion(memberData),
          });
          t.update(appRef, {status: "approved"});
        });
      } else {
        await appRef.update({status: "rejected"});
      }

      return {success: true, message: `Application ${approved ? "approved" : "rejected"}.`};
    });

/**
 * Deletes a team. Callable only by admins.
 */
export const deleteTeam = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!isAdmin(context)) {
        throw new functions.https.HttpsError("permission-denied", "You must be an admin to delete teams.");
      }
      const {teamId} = data;
      await db.collection("teams").doc(teamId).delete();
      return {success: true, message: "Team deleted."};
    });


// --- TOURNAMENT MANAGEMENT FUNCTIONS ---

/**
 * Approves or rejects a tournament. Callable by admin/moderator.
 */
export const approveTournament = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!isPrivilegedUser(context)) {
        throw new functions.https.HttpsError("permission-denied", "You must be an admin or moderator.");
      }
      const {tournamentId, approved} = data;
      if (!tournamentId || typeof approved !== "boolean") {
        throw new functions.https.HttpsError("invalid-argument", "Missing tournamentId or approved status.");
      }

      const tournamentRef = db.doc(`tournaments/${tournamentId}`);
      const status = approved ? "Open" : "Rejected";

      await tournamentRef.update({approved, status});
      return {success: true, message: "Tournament status updated."};
    });

/**
 * Deletes a tournament. Callable by admin.
 */
export const deleteTournament = functions
    .region("europe-west1")
    .https.onCall(async (data, context) => {
      if (!isAdmin(context)) {
        throw new functions.https.HttpsError("permission-denied", "You must be an admin to delete tournaments.");
      }
      const {tournamentId} = data;
      await db.collection("tournaments").doc(tournamentId).delete();
      return {success: true, message: "Tournament deleted."};
    });
