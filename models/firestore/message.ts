import { TtlPreset } from '../../config/messaging';

// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

export type MediaType = 'image' | 'video' | 'text';

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