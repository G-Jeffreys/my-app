import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string; // Corresponds to Firebase Auth UID
  displayName: string;
  email: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
} 