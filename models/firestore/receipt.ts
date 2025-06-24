// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

export interface Receipt {
  userId: string;
  receivedAt: FirestoreTimestamp | null;
  viewedAt: FirestoreTimestamp | null;
} 