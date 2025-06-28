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
  // Support both individual and group messaging
  recipientId?: string; // For individual messages (legacy support)
  conversationId?: string; // For group messages
  mediaURL: string | null; // Null for text messages
  mediaType: MediaType;
  ttlPreset: TtlPreset;
  sentAt: FirestoreTimestamp;
  text: string | null; // For text messages - can be combined with media for captions
  
  // Future-proofing for LLM integration
  hasSummary?: boolean; // Flag to indicate if this message has an LLM summary
  summaryGenerated?: boolean; // Flag to track summary generation status
  ephemeralOnly?: boolean; // Flag to disable summary generation for this message
  /**
   * Lifecycle control flags introduced for Phase 2:
   * – delivered: Message is safe (passed moderation) and can be rendered by clients.
   * – blocked:   Message failed moderation and must not be shown or downloaded.
   *   Only one of these should become true; both default to false on creation.
   */
  delivered?: boolean;
  blocked?: boolean;
} 