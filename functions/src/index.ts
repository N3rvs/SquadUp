
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const setUserRole = functions.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "No autorizado");
  }

  const { uid, role, isBanned } = data;

  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "Datos inválidos: UID de usuario requerido.");
  }

  try {
    const firestoreUpdates: { primaryRole?: string; isBanned?: boolean } = {};
    const authUpdates: { disabled?: boolean } = {};

    // Handle role update
    if (role) {
      if (!["admin", "moderator", "player", "founder", "coach"].includes(role)) {
        throw new functions.https.HttpsError("invalid-argument", "Rol inválido proporcionado.");
      }
      await admin.auth().setCustomUserClaims(uid, { role });
      firestoreUpdates.primaryRole = role;
    }

    // Handle ban status update
    if (typeof isBanned === 'boolean') {
        authUpdates.disabled = isBanned;
        firestoreUpdates.isBanned = isBanned;
    }

    if (Object.keys(authUpdates).length > 0) {
        await admin.auth().updateUser(uid, authUpdates);
    }

    if (Object.keys(firestoreUpdates).length > 0) {
      await admin.firestore().collection("users").doc(uid).update(firestoreUpdates);
    }

    return { message: `Usuario ${uid} actualizado.` };
  } catch (error: any) {
    console.error("Error updating user:", error);
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
