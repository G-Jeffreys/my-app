import { Timestamp } from 'firebase/firestore';

export interface Receipt {
  userId: string;
  receivedAt: Timestamp;
  viewedAt: Timestamp | null;
} 