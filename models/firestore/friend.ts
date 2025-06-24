import { Timestamp } from 'firebase/firestore';

export interface Friend {
  friendId: string; // UID of the friend
  friendedAt: Timestamp;
} 