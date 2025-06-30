import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const ensureAuthenticated = (context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  return context.auth.uid;
};

export const processFriendRequest = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const uid = ensureAuthenticated(context);
    const { requestId, accept } = data;

    if (!requestId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with a 'requestId'."
      );
    }

    const requestRef = db.collection("friendRequests").doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Friend request not found.");
    }
    const requestData = requestSnap.data()!;

    if (uid !== requestData.to) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You do not have permission to process this request."
      );
    }

    const fromUid = requestData.from;
    const toUid = requestData.to;
    const fromUserRef = db.collection("users").doc(fromUid);
    const toUserRef = db.collection("users").doc(toUid);

    if (accept) {
      const batch = db.batch();
      batch.update(fromUserRef, {
        friends: admin.firestore.FieldValue.arrayUnion(toUid),
      });
      batch.update(toUserRef, {
        friends: admin.firestore.FieldValue.arrayUnion(fromUid),
      });
      batch.delete(requestRef);
      await batch.commit();
      return { success: true, message: "Friend added." };
    } else {
      await requestRef.delete();
      return { success: true, message: "Request declined." };
    }
  });


export const processTeamApplication = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const uid = ensureAuthenticated(context);
    const { applicationId, accept } = data;

    if (!applicationId) {
       throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with an 'applicationId'."
      );
    }
    
    const appRef = db.collection("teamApplications").doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
       throw new functions.https.HttpsError("not-found", "Application not found.");
    }
    const appData = appSnap.data()!;
    const teamRef = db.collection("teams").doc(appData.teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Team not found.");
    }
    const teamData = teamSnap.data()!;
    
    if (uid !== teamData.ownerId) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Only the team owner can process applications."
        );
    }

    const applicantId = appData.userId;
    const applicantRef = db.collection("users").doc(applicantId);
    const applicantSnap = await applicantRef.get();

    if (!applicantSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Applicant user not found.");
    }
    const applicantData = applicantSnap.data()!;

    if (accept) {
        const newMember = {
            uid: applicantId,
            displayName: applicantData.displayName,
            avatarUrl: applicantData.avatarUrl || "",
            valorantRoles: applicantData.valorantRoles || ["Flex"],
        };
        
        const batch = db.batch();
        batch.update(teamRef, {
            memberIds: admin.firestore.FieldValue.arrayUnion(applicantId),
            members: admin.firestore.FieldValue.arrayUnion(newMember),
        });
        batch.delete(appRef);

        await batch.commit();
        return { success: true, message: "Player added to the team." };
    } else {
        await appRef.delete();
        return { success: true, message: "Application rejected." };
    }
});
