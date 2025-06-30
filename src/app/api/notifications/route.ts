import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { Timestamp } from 'firebase-admin/firestore';


export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split('Bearer ')[1];

  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    
    const allNotifications: any[] = [];

    // --- Friend Requests ---
    const friendRequestQuery = adminDb.collection('friendRequests')
        .where('to', '==', uid)
        .where('status', '==', 'pending');
        
    // --- Team Invites ---
    const teamInviteQuery = adminDb.collection('teamApplications')
        .where('userId', '==', uid)
        .where('status', '==', 'pending')
        .where('type', '==', 'invite');
        
    // --- Team Applications ---
    const teamApplicationQuery = adminDb.collection('teamApplications')
        .where('teamOwnerId', '==', uid)
        .where('status', '==', 'pending')
        .where('type', '==', 'application');

    const [
        friendRequestSnapshot, 
        teamInviteSnapshot, 
        teamApplicationSnapshot
    ] = await Promise.all([
        friendRequestQuery.get(),
        teamInviteQuery.get(),
        teamApplicationQuery.get(),
    ]);

    // Process friend requests
    friendRequestSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
            allNotifications.push({
                id: doc.id,
                type: 'friendRequest',
                from_displayName: data.from_displayName,
                from_avatarUrl: data.from_avatarUrl,
                createdAt: (data.createdAt as Timestamp).toMillis(),
            });
        }
    });

    // Process team invites
    teamInviteSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
            allNotifications.push({
                id: doc.id,
                type: 'teamInvite',
                from_displayName: data.teamName,
                from_avatarUrl: data.teamLogoUrl,
                teamName: data.teamName,
                teamId: data.teamId,
                createdAt: (data.createdAt as Timestamp).toMillis(),
            });
        }
    });

    // Process team applications
    if (!teamApplicationSnapshot.empty) {
        const userIdsToFetch = teamApplicationSnapshot.docs.map(doc => doc.data().userId).filter(Boolean);
        const userProfiles: { [key: string]: { displayName: string, avatarUrl?: string } } = {};
        
        if (userIdsToFetch.length > 0) {
            const usersSnapshot = await adminDb.collection('users').where(adminDb.FieldPath.documentId(), 'in', userIdsToFetch.slice(0, 30)).get();
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                userProfiles[doc.id] = {
                    displayName: data.displayName,
                    avatarUrl: data.avatarUrl,
                };
            });
        }
        
        teamApplicationSnapshot.forEach(appDoc => {
            const data = appDoc.data();
            const userProfile = userProfiles[data.userId];
            if (userProfile && data.createdAt && typeof data.createdAt.toMillis === 'function') {
                allNotifications.push({
                    id: appDoc.id,
                    type: 'teamApplication',
                    from_displayName: userProfile.displayName,
                    from_avatarUrl: userProfile.avatarUrl,
                    teamName: data.teamName,
                    teamId: data.teamId,
                    createdAt: (data.createdAt as Timestamp).toMillis(),
                });
            }
        });
    }

    allNotifications.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ notifications: allNotifications });

  } catch (error: any) {
    console.error('API notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications', details: error.message }, { status: 500 });
  }
}
