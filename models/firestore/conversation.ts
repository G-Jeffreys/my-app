// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

export interface Conversation {
  id: string;
  participantIds: string[]; // Array of user IDs in the conversation (max 5)
  name?: string; // Optional group name (defaults to participant names)
  createdAt: FirestoreTimestamp;
  createdBy: string; // User ID who created the group
  lastMessageAt?: FirestoreTimestamp; // Timestamp of last message for sorting
  lastMessageText?: string; // Preview text for conversation list
  
  // Future-proofing for RAG system
  messageCount?: number; // Track total messages for RAG chunking (every ~20 messages)
  lastRAGUpdateAt?: FirestoreTimestamp; // When RAG was last updated for this conversation
  ragEnabled?: boolean; // Flag to enable/disable RAG for this conversation
  lastActivity: FirestoreTimestamp;
  lastProcessedMessageCount?: number; // Track how many messages were included in last conversation summary
  lastConversationSummaryAt?: FirestoreTimestamp; // When was the last conversation summary generated
} 