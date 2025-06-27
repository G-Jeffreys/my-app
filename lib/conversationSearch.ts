// ---------------------------
// 🔍 Phase 3: RAG Conversation Search
// ---------------------------

import { TASK_QUEUE_CONFIG } from '../config/messaging';

export interface ConversationSearchResult {
  messageId: string;
  summaryText: string;
  senderId: string;
  timestamp: number;
  score: number;
  mediaType: string;
  sentAt: any;
}

export interface ConversationSearchResponse {
  results: ConversationSearchResult[];
  query: string;
  conversationId: string;
  resultCount: number;
}

/**
 * RAG-Client-1: Search conversation history semantically
 * Uses the Cloud Run worker's RAG functionality to find relevant messages
 */
export async function searchConversationHistory(
  conversationId: string,
  query: string,
  maxResults: number = 10
): Promise<ConversationSearchResponse | null> {
  try {
    console.log('[ConversationSearch] Searching conversation:', { conversationId, query, maxResults });

    const response = await fetch(`${TASK_QUEUE_CONFIG.WORKER_ENDPOINT.replace('/moderate-summary-job', '/search-conversation')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        query,
        maxResults
      }),
    });

    if (!response.ok) {
      console.error('[ConversationSearch] Search failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('[ConversationSearch] Search completed:', { 
      conversationId, 
      resultCount: data.resultCount 
    });

    return data;

  } catch (error) {
    console.error('[ConversationSearch] Search error:', error);
    return null;
  }
}

/**
 * RAG-Client-2: Get conversation context for a specific message
 * Useful for understanding what was being discussed around a particular message
 */
export async function getMessageContext(
  conversationId: string,
  messageText: string,
  maxResults: number = 5
): Promise<ConversationSearchResult[]> {
  try {
    console.log('[ConversationSearch] Getting message context:', { conversationId, messageText: messageText.substring(0, 50) });

    const searchResponse = await searchConversationHistory(conversationId, messageText, maxResults);
    
    if (!searchResponse) {
      console.warn('[ConversationSearch] No context found');
      return [];
    }

    console.log('[ConversationSearch] Context retrieved:', { count: searchResponse.results.length });
    return searchResponse.results;

  } catch (error) {
    console.error('[ConversationSearch] Context retrieval error:', error);
    return [];
  }
}

/**
 * RAG-Client-3: Find similar topics discussed in conversation
 * Helps users discover related discussions in the conversation history
 */
export async function findSimilarTopics(
  conversationId: string,
  topic: string,
  maxResults: number = 8
): Promise<ConversationSearchResult[]> {
  try {
    console.log('[ConversationSearch] Finding similar topics:', { conversationId, topic });

    const searchResponse = await searchConversationHistory(conversationId, topic, maxResults);
    
    if (!searchResponse) {
      return [];
    }

    // Filter results with good similarity scores (>0.7)
    const relevantResults = searchResponse.results.filter(result => result.score > 0.7);
    
    console.log('[ConversationSearch] Similar topics found:', { 
      total: searchResponse.results.length,
      relevant: relevantResults.length 
    });

    return relevantResults;

  } catch (error) {
    console.error('[ConversationSearch] Similar topics error:', error);
    return [];
  }
}

/**
 * RAG-Client-4: Format search results for display
 * Helper function to format search results consistently
 */
export function formatSearchResults(results: ConversationSearchResult[]): Array<{
  id: string;
  text: string;
  score: number;
  timestamp: string;
  mediaType: string;
}> {
  return results.map(result => ({
    id: result.messageId,
    text: result.summaryText,
    score: Math.round(result.score * 100) / 100, // Round to 2 decimal places
    timestamp: new Date(result.timestamp).toLocaleString(),
    mediaType: result.mediaType
  }));
}

/**
 * RAG-Client-5: Check if conversation has sufficient history for RAG
 * Determines if a conversation has enough messages to provide meaningful context
 */
export function isConversationRAGReady(messageCount: number): boolean {
  const MIN_MESSAGES_FOR_RAG = 5; // Need at least 5 messages for meaningful context
  return messageCount >= MIN_MESSAGES_FOR_RAG;
}

/**
 * RAG-Client-6: Analyze conversation search patterns
 * Provides insights into what users are searching for in conversations
 */
export interface SearchAnalytics {
  totalSearches: number;
  averageResultCount: number;
  commonTopics: string[];
  searchSuccessRate: number;
}

let searchAnalytics: SearchAnalytics = {
  totalSearches: 0,
  averageResultCount: 0,
  commonTopics: [],
  searchSuccessRate: 0
};

export function trackSearchUsage(query: string, resultCount: number) {
  searchAnalytics.totalSearches++;
  searchAnalytics.averageResultCount = 
    (searchAnalytics.averageResultCount * (searchAnalytics.totalSearches - 1) + resultCount) / 
    searchAnalytics.totalSearches;
  
  if (resultCount > 0) {
    searchAnalytics.searchSuccessRate = 
      (searchAnalytics.searchSuccessRate * (searchAnalytics.totalSearches - 1) + 1) / 
      searchAnalytics.totalSearches;
  }

  console.log('[ConversationSearch] Analytics updated:', searchAnalytics);
}

export function getSearchAnalytics(): SearchAnalytics {
  return { ...searchAnalytics };
} 