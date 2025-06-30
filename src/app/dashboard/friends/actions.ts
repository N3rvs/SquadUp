
'use server';

import type { Timestamp } from 'firebase/firestore';

// Types
export interface FriendRequest {
    id: string;
    from: string;
    fromDisplayName: string;
    fromAvatarUrl?: string;
    to: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Timestamp;
}

export interface Friend {
    uid: string;
    displayName: string;
    avatarUrl?: string;
    primaryRole?: string;
}

// Action wrappers for Cloud Functions have been moved into their respective
// client components (e.g., friends/page.tsx) to ensure the Firebase auth
// token is refreshed immediately before the call, resolving permission issues.

// Data fetching is now handled in real-time with onSnapshot in the client component.
