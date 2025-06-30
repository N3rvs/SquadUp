import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const sendFriendRequest = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    const fromId = auth?.uid;
    const { to: toId } = data;

    if (!fromId) {
        throw new HttpsError("unauthenticated", "You must be logged in to send a friend request.");
    }

    if (!toId || fromId === toId) {
        throw new HttpsError("invalid-argument", "Invalid recipient ID.");
    }

    const fromRef = db.collection("users").doc(fromId);
    const toRef = db.collection("users").doc(toId);

    const [fromDoc, toDoc] = await Promise.all([fromRef.get(), toRef.get()]);

    if (!fromDoc.exists() || !toDoc.exists()) {
        throw new HttpsError("not-found", "One or both users could not be found.");
    }
    
    const fromData = fromDoc.data();
    if (!fromData) {
        throw new HttpsError("internal", "Could not retrieve sender data.");
    }

    // Check if they are already friends
    if (fromData.friends?.includes(toId)) {
        throw new HttpsError("already-exists", "You are already friends with this user.");
    }

    // Check for existing request
    const requestsRef = db.collection("friendRequests");
    const q1 = requestsRef.where("from", "==", fromId).where("to", "==", toId);
    const q2 = requestsRef.where("from", "==", toId).where("to", "==", fromId);

    const [snap1, snap2] = await Promise.all([q1.get(), q2.get()]);
    if (!snap1.empty || !snap2.empty) {
        throw new HttpsError("already-exists", "A friend request already exists between you and this user.");
    }

    // Create new request with denormalized data
    await requestsRef.add({
        from: fromId,
        to: toId,
        fromDisplayName: fromData.displayName,
        fromAvatarUrl: fromData.avatarUrl || "",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: "Friend request sent." };
});

export const removeFriend = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { friendId } = data;
  const userId = auth?.uid;

  if (!userId || !friendId || typeof friendId !== 'string' || friendId.length < 10) {
    console.error("ID inválido recibido:", friendId);
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }

  const userRef = admin.firestore().collection("users").doc(userId);
  const friendRef = admin.firestore().collection("users").doc(friendId);

  const batch = admin.firestore().batch();

  // 1. Quitar de los arrays `friends`
  batch.update(userRef, {
    friends: admin.firestore.FieldValue.arrayRemove(friendId),
  });
  batch.update(friendRef, {
    friends: admin.firestore.FieldValue.arrayRemove(userId),
  });

  // 2. Eliminar solicitudes mutuas
  const requestsRef = admin.firestore().collection("friendRequests");
  const query1 = requestsRef.where("from", "==", userId).where("to", "==", friendId);
  const query2 = requestsRef.where("from", "==", friendId).where("to", "==", userId);

  const [snap1, snap2] = await Promise.all([query1.get(), query2.get()]);

  [...snap1.docs, ...snap2.docs].forEach(doc => {
    batch.delete(doc.ref);
  });

  // 3. Ejecutar todo
  await batch.commit();

  console.log(`✅ Amistad y solicitudes entre ${userId} y ${friendId} eliminadas.`);
  return { message: "Amigo eliminado correctamente." };
});

// --- Placeholder Functions ---

// This is a placeholder. Replace with your actual implementation.
export const respondToFriendRequest = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("respondToFriendRequest called with:", data);
    if (!auth) { throw new HttpsError("unauthenticated", "Not authenticated."); }
    // TODO: Implement logic to accept/reject friend requests
    return { success: true, message: "Placeholder response." };
});

// This is a placeholder. Replace with your actual implementation.
export const setUserRoleAndSync = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("setUserRoleAndSync called with:", data);
    if (!auth) { throw new HttpsError("unauthenticated", "Not authenticated."); }
    // TODO: Implement logic to set user roles
    return { success: true, message: "Placeholder response." };
});

// This is a placeholder. Replace with your actual implementation.
export const banUser = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("banUser called with:", data);
    if (!auth) { throw new HttpsError("unauthenticated", "Not authenticated."); }
    // TODO: Implement logic to ban users
    return { success: true, message: "Placeholder response." };
});

// This is a placeholder. Replace with your actual implementation.
export const approveTournament = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("approveTournament called with:", data);
    if (!auth) { throw new HttpsError("unauthenticated", "Not authenticated."); }
    // TODO: Implement logic to approve tournaments
    return { success: true, message: "Placeholder response." };
});

// This is a placeholder. Replace with your actual implementation.
export const getTeamApplicationsInbox = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("getTeamApplicationsInbox called with:", data);
    if (!auth) { throw new HttpsError("unauthenticated", "Not authenticated."); }
    // TODO: Implement logic to get team applications
    return { applications: [] };
});

// This is a placeholder. Replace with your actual implementation.
export const processTeamApplication = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("processTeamApplication called with:", data);
    if (!auth) { throw new HttpsError("unauthenticated", "Not authenticated."); }
    // TODO: Implement logic to process applications
    return { success: true, message: "Placeholder response." };
});

// This is a placeholder. Replace with your actual implementation.
export const deleteTeam = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("deleteTeam called with:", data);
    if (!auth) { throw new HttpsError("unauthenticated", "Not authenticated."); }
    // TODO: Implement logic to delete teams
    return { success: true, message: "Placeholder response." };
});

// This is a placeholder. Replace with your actual implementation.
export const deleteTournament = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("deleteTournament called with:", data);
    if (!auth) { throw new HttpsError("unauthenticated", "Not authenticated."); }
    // TODO: Implement logic to delete tournaments
    return { success: true, message: "Placeholder response." };
});
