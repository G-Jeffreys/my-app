// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

export interface Friend {
  friendId: string; // UID of the friend
  addedAt: FirestoreTimestamp;
} 