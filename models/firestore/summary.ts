// Use a platform-agnostic timestamp type that works for both web and mobile
export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | Date;

export interface Summary {
  id: string;
  messageId: string; // Reference to the original message
  conversationId?: string; // Reference to conversation if it's a group message
  senderId: string; // Who sent the original message
  summaryText: string; // The LLM-generated summary (≤30 tokens as per PRD)
  generatedAt: FirestoreTimestamp; // When the summary was created
  
  // LLM processing metadata
  model?: string; // Which LLM model was used (e.g., "gpt-4o-mini")
  processingTimeMs?: number; // How long the summary took to generate
  retryCount?: number; // Number of retries if generation failed initially
  
  // Moderation results
  moderationPassed?: boolean; // If content passed moderation
  moderationFlags?: string[]; // Any moderation flags raised
  
  // Future enhancements
  contextUsed?: string[]; // IDs of other messages used for context in RAG
  confidence?: number; // LLM confidence score for the summary
} 