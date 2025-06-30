import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // When running in a Firebase/Google Cloud environment, the SDK
  // is automatically configured. To ensure it targets the correct
  // project, we explicitly provide the project ID from environment variables.
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
