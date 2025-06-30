import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

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


// --- PLACEHOLDERS FOR OTHER FUNCTIONS ---
// To prevent your app from breaking, I've added placeholders for other
// functions called by the frontend. You should replace these with your
// actual implementations.

export const approveTournament = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  console.log("approveTournament called with:", data);
  if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
  throw new HttpsError("unimplemented", "Function not implemented.");
});

export const banUser = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  console.log("banUser called with:", data);
  if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
  throw new HttpsError("unimplemented", "Function not implemented.");
});

export const deleteTeam = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  console.log("deleteTeam called with:", data);
  if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
  throw new HttpsError("unimplemented", "Function not implemented.");
});

export const deleteTournament = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
    console.log("deleteTournament called with:", data);
    if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
    throw new HttpsError("unimplemented", "Function not implemented.");
});

export const getTeamApplicationsInbox = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  console.log("getTeamApplicationsInbox called with:", data);
  if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
  // This function is expected to return data, so an error might break UI.
  // Returning an empty array is safer for a placeholder.
  return { applications: [] };
});

export const processTeamApplication = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  console.log("processTeamApplication called with:", data);
  if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
  throw new HttpsError("unimplemented", "Function not implemented.");
});

export const respondToFriendRequest = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  console.log("respondToFriendRequest called with:", data);
  if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
  throw new HttpsError("unimplemented", "Function not implemented.");
});

export const sendFriendRequest = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  console.log("sendFriendRequest called with:", data);
  if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
  throw new HttpsError("unimplemented", "Function not implemented.");
});

export const setUserRoleAndSync = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  console.log("setUserRoleAndSync called with:", data);
  if (!auth) throw new HttpsError("unauthenticated", "Not authenticated.");
  throw new HttpsError("unimplemented", "Function not implemented.");
});
