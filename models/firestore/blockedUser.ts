// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

export interface BlockedUser {
  userId: string; // The user who is blocked
  blockedAt: FirestoreTimestamp;
} 