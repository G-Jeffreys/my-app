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

export interface ConversationSummary {
  id: string; // conversationId_batchNumber format (e.g., "conv123_5")
  conversationId: string;
  batchNumber: number; // Which batch this represents (1, 2, 3, etc.)
  summaryText: string; // The 150-token conversation digest
  messagesIncluded: number; // Total messages processed up to this point
  messageRange: {
    startCount: number; // First message number included in this summary
    endCount: number; // Last message number included in this summary
  };
  generatedAt: FirestoreTimestamp;
  model: string; // AI model used (e.g., 'gpt-4o-mini')
  processingTimeMs: number;
  confidence: number; // AI confidence score
  // Context information for recency bias
  recentMessagesWeight: number; // Weight given to recent messages (e.g., 0.7-1.0)
  olderMessagesWeight: number; // Weight given to older messages (e.g., 0.3-0.5)
} 