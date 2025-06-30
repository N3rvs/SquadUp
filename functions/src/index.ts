import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

/* === FUNCIONES DE ADMIN / MODERADOR === */

export const setUserRoleAndSync = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { uid, role } = data;
  if (!auth || auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Solo los admins pueden cambiar roles.");
  }
  const validRoles = ["admin", "moderator", "player", "coach", "fundador"];
  if (!uid || !validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Rol no válido.");
  }
  const user = await admin.auth().getUser(uid);
  const existingClaims = user.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, { ...existingClaims, role });
  await admin.firestore().collection("users").doc(uid).set({ primaryRole: role }, { merge: true });
  return { message: `Rol "${role}" asignado y sincronizado para ${uid}` };
});

export const getUserClaims = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { uid } = data;
  if (!auth || auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Solo los admins pueden ver claims.");
  }
  if (!uid) throw new HttpsError("invalid-argument", "UID requerido.");
  const user = await admin.auth().getUser(uid);
  return { uid: user.uid, email: user.email, claims: user.customClaims || {} };
});

export const banUser = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { uid, isBanned } = data;
  if (!auth || auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  if (typeof isBanned !== "boolean" || !uid) {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  const user = await admin.auth().getUser(uid);
  const existingClaims = user.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, { ...existingClaims, isBanned });
  return { message: isBanned ? `Usuario ${uid} baneado.` : `Usuario ${uid} desbaneado.` };
});

/* === TORNEOS === */

export const deleteTournament = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { tournamentId } = data;
  if (!auth || auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  if (!tournamentId) throw new HttpsError("invalid-argument", "ID de torneo requerido.");
  await admin.firestore().collection("tournaments").doc(tournamentId).delete();
  return { message: `Torneo ${tournamentId} eliminado.` };
});

export const approveTournament = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { tournamentId, approved } = data;
  if (!auth || !["admin", "moderator"].includes(auth.token.role)) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  if (!tournamentId || typeof approved !== "boolean") {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  await admin.firestore().collection("tournaments").doc(tournamentId).update({ approved });
  return { message: approved ? `Torneo ${tournamentId} aprobado` : `Torneo ${tournamentId} rechazado` };
});

/* === EQUIPOS === */

export const getTeamApplicationsInbox = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { teamId } = data;
  if (!auth || !["admin", "moderator", "fundador"].includes(auth.token.role)) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  if (!teamId) throw new HttpsError("invalid-argument", "ID de equipo requerido.");
  const snapshot = await admin.firestore().collection("teamApplications").where("teamId", "==", teamId).get();
  const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return { applications };
});

export const processTeamApplication = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { applicationId, approved } = data;
  if (!auth || !["admin", "moderator", "fundador"].includes(auth.token.role)) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  if (!applicationId || typeof approved !== "boolean") {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  const appRef = admin.firestore().collection("teamApplications").doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new HttpsError("not-found", "Solicitud no encontrada.");
  const appData = appSnap.data();
  if (!appData) throw new HttpsError("internal", "Error leyendo la solicitud.");
  await appRef.update({ status: approved ? "approved" : "rejected" });
  if (approved) {
    await admin.firestore().collection("teams").doc(appData.teamId).update({
      memberIds: admin.firestore.FieldValue.arrayUnion(appData.userId),
    });
  }
  return { message: approved ? "Solicitud aprobada y usuario añadido al equipo." : "Solicitud rechazada." };
});

export const deleteTeam = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { teamId } = data;
  if (!auth || !teamId) {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  const teamRef = admin.firestore().collection("teams").doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) throw new HttpsError("not-found", "Equipo no encontrado.");
  const team = teamSnap.data();
  if (!team) throw new HttpsError("internal", "Error leyendo el equipo.");
  const role = auth.token.role;
  const isOwner = auth.uid === team.ownerId;
  const canDelete = isOwner || ["admin", "moderator"].includes(role);
  if (!canDelete) {
    throw new HttpsError("permission-denied", "No tienes permiso para eliminar este equipo.");
  }
  await teamRef.delete();
  return { message: `Equipo ${teamId} eliminado correctamente.` };
});

/* === AMISTADES === */

export const sendFriendRequest = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { to } = data;
  if (!auth || !to) throw new HttpsError("invalid-argument", "Datos inválidos.");
  const from = auth.uid;
  const ref = admin.firestore().collection("friendRequests");
  const existing = await ref.where("from", "==", from).where("to", "==", to).get();
  if (!existing.empty) throw new HttpsError("already-exists", "Ya enviaste solicitud.");
  await ref.add({ from, to, status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { message: "Solicitud enviada." };
});

export const respondToFriendRequest = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { requestId, accept } = data;
  if (!auth || typeof accept !== "boolean") throw new HttpsError("invalid-argument", "Datos inválidos.");
  const reqRef = admin.firestore().collection("friendRequests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "Solicitud no encontrada.");
  const reqData = reqSnap.data();
  if (!reqData) throw new HttpsError("internal", "Error leyendo la solicitud.");
  if (reqData.to !== auth.uid) throw new HttpsError("permission-denied", "No eres el destinatario.");
  await reqRef.update({ status: accept ? "accepted" : "rejected" });
  if (accept) {
    const userRef = admin.firestore().collection("users").doc(auth.uid);
    const friendRef = admin.firestore().collection("users").doc(reqData.from);
    await userRef.update({ friends: admin.firestore.FieldValue.arrayUnion(reqData.from) });
    await friendRef.update({ friends: admin.firestore.FieldValue.arrayUnion(auth.uid) });
  }
  return { message: accept ? "Solicitud aceptada." : "Solicitud rechazada." };
});

export const removeFriend = onCall({ region: "europe-west1" }, async ({ auth, data }) => {
  const { friendId } = data;
  if (!auth || !friendId) throw new HttpsError("invalid-argument", "Datos inválidos.");
  const userRef = admin.firestore().collection("users").doc(auth.uid);
  const friendRef = admin.firestore().collection("users").doc(friendId);
  await userRef.update({ friends: admin.firestore.FieldValue.arrayRemove(friendId) });
  await friendRef.update({ friends: admin.firestore.FieldValue.arrayRemove(auth.uid) });
  return { message: "Amigo eliminado." };
});
