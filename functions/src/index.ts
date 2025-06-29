
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const setUserRole = functions.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "No autorizado");
  }

  const { uid, role } = data;

  if (!uid || !["admin", "moderator", "player", "founder", "coach"].includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Datos inválidos");
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { role });
    await admin.firestore().collection("users").doc(uid).update({ primaryRole: role });
    return { message: `Rol '${role}' asignado a ${uid}.` };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

export const deleteTournament = functions.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "No autorizado para realizar esta acción.");
  }

  const { tournamentId } = data;
  if (!tournamentId) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el ID del torneo.");
  }

  try {
    await admin.firestore().collection("tournaments").doc(tournamentId).delete();
    return { message: `Torneo ${tournamentId} eliminado exitosamente.` };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

export const deleteUser = functions.https.onCall(async (data, context) => {
    if (context.auth?.token?.role !== "admin") {
        throw new functions.https.HttpsError("permission-denied", "No autorizado para realizar esta acción.");
    }

    const { uid } = data;
    if (!uid) {
        throw new functions.https.HttpsError("invalid-argument", "Se requiere el UID del usuario.");
    }

    try {
        await admin.auth().deleteUser(uid);
        await admin.firestore().collection("users").doc(uid).delete();
        
        return { message: `Usuario ${uid} eliminado exitosamente.` };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});
