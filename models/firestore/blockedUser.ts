import { Timestamp } from 'firebase/firestore';

export interface BlockedUser {
  userId: string; // The user who is blocked
  blockedAt: Timestamp;
} 