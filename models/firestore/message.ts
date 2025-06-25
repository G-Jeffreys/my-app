import { TtlPreset } from '../../config/messaging';

// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

// Support both naming conventions that exist in the codebase (`photo` coming
// from the camera screen and `image` coming from the Firestore model schema).
export type MediaType = 'photo' | 'image' | 'video' | 'text';

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  mediaURL: string | null; // Null for text messages
  mediaType: MediaType;
  ttlPreset: TtlPreset;
  sentAt: FirestoreTimestamp;
  text: string | null; // For text messages
} 