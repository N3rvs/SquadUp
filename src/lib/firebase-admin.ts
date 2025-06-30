import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // Use service account credentials from environment variables to ensure
  // the Admin SDK is authenticated for the correct Firebase project.
  // This directly solves the 'incorrect "aud" (audience) claim' error.
  // The user needs to provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
  // and FIREBASE_PRIVATE_KEY in their .env file.
  const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  // Initialize the app with the service account credentials
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
