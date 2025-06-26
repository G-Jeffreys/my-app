// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

import { TtlPreset } from '../../config/messaging';

export interface User {
  id: string; // Corresponds to Firebase Auth UID
  displayName: string;
  email: string | null;
  photoURL: string | null;
  createdAt: FirestoreTimestamp;
  defaultTtl?: TtlPreset; // Optional default TTL setting for messages
} 