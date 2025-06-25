// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

export interface Receipt {
  id: string;
  messageId: string; // Reference to the message
  userId: string; // User who received the message
  receivedAt: FirestoreTimestamp; // When the message was received/downloaded by this user
  viewedAt: FirestoreTimestamp | null; // When the message was first opened by this user
  conversationId?: string; // For group message receipts
} 