import { Timestamp } from 'firebase/firestore';
import { TtlPreset } from '../../config/messaging';

export type MediaType = 'image' | 'video' | 'text';

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  mediaURL: string | null; // Null for text messages
  mediaType: MediaType;
  ttlPreset: TtlPreset;
  sentAt: Timestamp;
  text: string | null; // For text messages
} 