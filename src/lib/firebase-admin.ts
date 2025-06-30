import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // Explicitly initialize with the correct project ID to ensure the Admin SDK
  // targets the right Firebase project, resolving audience claim mismatches.
  admin.initializeApp({
    projectId: 'valorant-squadfinder',
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
