import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import winston from 'winston';

// Initialize logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Initialize Firebase Admin (if not already initialized)
let db: any, storage: any, openai: any, pinecone: any;

try {
  if (!getApps().length) {
    initializeApp();
    logger.info('🔥 Firebase Admin initialized');
  }
  
  db = getFirestore();
  storage = getStorage();
  logger.info('✅ Firestore and Storage initialized');
} catch (error) {
  logger.warn('⚠️ Firebase initialization failed', { error: (error as Error).message });
}

// Initialize OpenAI
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    logger.info('✅ OpenAI initialized');
  } else {
    logger.warn('⚠️ OPENAI_API_KEY not found');
  }
} catch (error) {
  logger.warn('⚠️ OpenAI initialization failed', { error: (error as Error).message });
}

// Initialize Pinecone
try {
  if (process.env.PINECONE_API_KEY) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    logger.info('✅ Pinecone initialized');
  } else {
    logger.warn('⚠️ PINECONE_API_KEY not found');
  }
} catch (error) {
  logger.warn('⚠️ Pinecone initialization failed', { error: (error as Error).message });
}

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firebase: !!db,
      openai: !!openai,
      pinecone: !!pinecone,
      ragEnabled: !!(db && openai && pinecone)
    },
    version: '3.0.0-rag'
  });
});

// T2 - Main moderation and summarization endpoint
app.post('/moderate-summary-job', async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const { messageId, conversationId, senderId, mediaType, timestamp } = req.body;

  logger.info('🤖 Processing moderation job', {
    messageId,
    conversationId,
    senderId,
    mediaType,
    queueTimestamp: timestamp,
    processingDelay: Date.now() - timestamp
  });

  try {
    // Check if required services are available
    if (!db) {
      logger.error('❌ Database not initialized', { messageId });
      return res.status(500).json({ error: 'Database not available' });
    }
    
    if (!openai) {
      logger.error('❌ OpenAI not initialized', { messageId });
      return res.status(500).json({ error: 'OpenAI not available' });
    }

    // T2.2 - Fetch message and associated media
    const messageDoc = await db.collection('messages').doc(messageId).get();
    
    if (!messageDoc.exists) {
      logger.warn('❌ Message not found', { messageId });
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageDoc.data();
    logger.info('📄 Message fetched', {
      messageId,
      hasText: !!message?.text,
      hasMedia: !!message?.mediaURL,
      mediaType: message?.mediaType
    });

    // Prepare content for moderation and summarization
    let contentText = message?.text || '';
    let mediaCaption = '';

    // T2.2b - Enhanced media captioning for images and videos
    if (message?.mediaURL) {
      // Normalize mediaType to handle whitespace and case variations
      const mediaTypeClean = (message.mediaType || '').trim().toLowerCase();
      const isImage = mediaTypeClean === 'image' || mediaTypeClean === 'photo';
      const isVideo = mediaTypeClean === 'video';
      
      if (isImage) {
        try {
          logger.info('🖼️ Generating image caption', { messageId, mediaURL: message.mediaURL });
          
          const captionResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Describe this image in one short sentence (≤75 tokens). Be factual and neutral.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: message.mediaURL,
                      detail: 'low' // 640px for cost control
                    }
                  }
                ]
              }
            ],
            max_tokens: 75,
            temperature: 0.1
          });

          mediaCaption = captionResponse.choices[0]?.message?.content || '';
          logger.info('✅ Image caption generated', { messageId, caption: mediaCaption });
          
        } catch (captionError) {
          logger.warn('⚠️ Image captioning failed, continuing without caption', {
            messageId,
            error: (captionError as Error).message
          });
        }
      } else if (isVideo) {
        try {
          logger.info('🎥 Processing video for AI analysis', { messageId, mediaURL: message.mediaURL });
          
          // For videos, we'll create a comprehensive description and summary
          // Note: This assumes the video URL is accessible. In production, you might want to:
          // 1. Extract video frames using a video processing service
          // 2. Use video-specific AI models
          // 3. Analyze audio content as well
          
          // For now, use a simple, honest caption since we don't have video analysis
          // TODO: Implement proper video frame extraction and analysis
          mediaCaption = contentText.trim() 
            ? `Video message: ${contentText.trim()}` 
            : 'User shared a video message';
          logger.info('✅ Video summary generated', { messageId, summary: mediaCaption });
          
          // Additional video-specific logging for debugging
          logger.info('📊 Video processing stats', {
            messageId,
            hasText: !!contentText,
            textLength: contentText.length,
            videoURL: message.mediaURL,
            summaryLength: mediaCaption.length
          });
          
        } catch (videoError) {
          logger.warn('⚠️ Video processing failed, using fallback', {
            messageId,
            error: (videoError as Error).message
          });
          
          // Fallback video summary based on text content or generic
          if (contentText.trim()) {
            mediaCaption = `Video message: ${contentText.substring(0, 30)}${contentText.length > 30 ? '...' : ''}`;
          } else {
            mediaCaption = 'Video message shared';
          }
        }
      } else {
        logger.info('📎 Unsupported media type for AI analysis', { 
          messageId, 
          mediaType: message?.mediaType 
        });
      }
      
      // Ensure we always have a fallback caption for media messages
      if (!mediaCaption.trim()) {
        mediaCaption = 'Video message shared';
        logger.info('🔧 Applied fallback media caption', { messageId, mediaType: mediaTypeClean });
      }
    }

    // Combine text and media caption for processing
    const fullContent = [contentText, mediaCaption].filter(Boolean).join(' ');
    
    if (!fullContent.trim()) {
      logger.warn('⚠️ No content to process', { messageId });
      // Still mark as delivered since there's nothing to moderate
      await db.collection('messages').doc(messageId).update({
        delivered: true,
        summaryGenerated: false
      });
      return res.status(200).json({ status: 'no_content', delivered: true });
    }

    // T2.3 - Run OpenAI Moderation
    logger.info('🛡️ Running content moderation', { messageId, contentLength: fullContent.length });
    
    const moderationResponse = await openai.moderations.create({
      input: fullContent,
      model: 'text-moderation-latest'
    });

    const moderationResult = moderationResponse.results[0];
    const isFlagged = moderationResult.flagged;

    logger.info('🛡️ Moderation completed', {
      messageId,
      flagged: isFlagged,
      categories: Object.entries(moderationResult.categories)
        .filter(([, flagged]) => flagged as boolean)
        .map(([category]) => category)
    });

    // T2.3a - If flagged: write to moderation collection, mark as blocked
    if (isFlagged) {
      const flaggedCategories = Object.keys(moderationResult.categories).filter(k => 
        (moderationResult.categories as any)[k] === true
      );
      logger.warn('🚫 Content flagged and blocked', { messageId, categories: flaggedCategories });

      const moderationData = {
        messageId,
        senderId,
        conversationId: conversationId || null,
        flagged: true,
        categories: moderationResult.categories,
        categoryScores: moderationResult.category_scores,
        processedAt: new Date(),
        contentSample: fullContent.substring(0, 200) // First 200 chars for debugging
      };

      await db.collection('moderation').doc(messageId).set(moderationData);
      await db.collection('messages').doc(messageId).update({
        blocked: true,
        delivered: false
      });

      // Log analytics event
      logger.info('📊 moderation_flagged', {
        structuredData: true,
        messageId,
        senderId,
        conversationId,
        categories: flaggedCategories
      });

      return res.status(200).json({ 
        status: 'blocked', 
        flagged: true,
        categories: flaggedCategories
      });
    }

    // T2.4 - Content is safe, generate contextual summary
    logger.info('📝 Generating contextual summary', { messageId, contentLength: fullContent.length });

    let summaryText: string;
    let contextUsed: string[] = [];
    let confidence: number = 0.7;
    let useRAG = false;

    // Check if RAG is enabled for this conversation
    if (conversationId) {
      try {
        const conversationDoc = await db.collection('conversations').doc(conversationId).get();
        const conversationData = conversationDoc.exists ? conversationDoc.data() : null;
        useRAG = conversationData?.ragEnabled === true;
        
        logger.info('🧠 RAG enablement check', { 
          conversationId, 
          ragEnabled: conversationData?.ragEnabled,
          useRAG 
        });
      } catch (error) {
        logger.warn('⚠️ Failed to check RAG enablement, defaulting to basic summary', {
          conversationId,
          error: (error as Error).message
        });
        useRAG = false;
      }
    }

    if (useRAG && conversationId) {
      // Use enhanced RAG-powered summary for group conversations
      const contextualResult = await generateContextualSummary(
        fullContent,
        conversationId,
        messageId,
        senderId
      );
      
      summaryText = contextualResult.summaryText;
      contextUsed = contextualResult.contextUsed;
      confidence = contextualResult.confidence;
      
      logger.info('✅ RAG-enhanced summary generated', { 
        messageId, 
        summary: summaryText,
        contextUsedCount: contextUsed.length,
        confidence
      });
    } else {
      // Fallback to basic summary for individual messages
      const summaryResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Generate a one-sentence neutral summary of the following message. Keep it under 30 tokens and less detailed than the original. Be factual and concise.'
          },
          {
            role: 'user',
            content: fullContent
          }
        ],
        max_tokens: 30,
        temperature: 0.1
      });

      summaryText = summaryResponse.choices[0]?.message?.content || 'Message sent';
      
      logger.info('✅ Basic summary generated', { 
        messageId, 
        summary: summaryText,
        tokensUsed: summaryResponse.usage?.total_tokens || 0
      });
    }

    // T2.4a - Write enhanced summary to Firestore
    const summaryData = {
      id: messageId, // Use messageId as summary ID for simplicity
      messageId,
      conversationId: conversationId || null,
      senderId,
      summaryText,
      generatedAt: new Date(),
      model: 'gpt-4o-mini',
      processingTimeMs: Date.now() - startTime,
      retryCount: 0,
      moderationPassed: true,
      moderationFlags: [],
      contextUsed, // RAG context messages used
      confidence // AI confidence score
    };

    await db.collection('summaries').doc(messageId).set(summaryData);

    // T2.4b - Generate embedding and upsert to Pinecone
    if (useRAG && conversationId) {
      try {
        logger.info('🧠 Generating embedding for RAG', { messageId, conversationId });

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: summaryText,
          encoding_format: 'float'
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Get Pinecone index
        const index = pinecone.index('snaps-prod');

        // Upsert to conversation-specific namespace
        await index.namespace(conversationId).upsert([
          {
            id: messageId,
            values: embedding,
            metadata: {
              messageId,
              conversationId,
              senderId,
              summaryText,
              timestamp: Date.now(),
              mediaType: message?.mediaType || 'text'
            }
          }
        ]);

        logger.info('✅ Embedding stored in Pinecone', { 
          messageId, 
          conversationId,
          embeddingDimensions: embedding.length
        });

      } catch (embeddingError) {
        logger.error('❌ Failed to store embedding', {
          messageId,
          conversationId,
          error: (embeddingError as Error).message
        });
        // Don't fail the whole job for embedding errors
      }
    }

    // Mark message as delivered and summary generated
    await db.collection('messages').doc(messageId).update({
      delivered: true,
      hasSummary: true,
      summaryGenerated: true
    });

    // Update conversation message count and check if we need to generate conversation summary
    if (conversationId) {
      await updateConversationMessageCount(conversationId);
    }

    // Log analytics event
    logger.info('📊 summary_generated', {
      structuredData: true,
      messageId,
      senderId,
      conversationId,
      summaryLength: summaryText.length,
      processingTimeMs: Date.now() - startTime
    });

    logger.info('🎉 Job completed successfully', {
      messageId,
      summary: summaryText,
      totalProcessingTime: Date.now() - startTime
    });

    res.status(200).json({
      status: 'success',
      messageId,
      summary: summaryText,
      delivered: true,
      processingTimeMs: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ Job failed', {
      messageId,
      error: (error as Error).message,
      stack: (error as Error).stack
    });

    // Try to mark message as delivered anyway (better than leaving it stuck)
    try {
      await db.collection('messages').doc(messageId).update({
        delivered: true,
        summaryGenerated: false
      });
    } catch (updateError) {
      logger.error('❌ Failed to mark message as delivered after error', {
        messageId,
        updateError: (updateError as Error).message
      });
    }

    res.status(500).json({
      error: 'Processing failed',
      messageId,
      details: (error as Error).message
    });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`🚀 AI Moderation Worker listening on port ${port}`, {
    environment: process.env.NODE_ENV || 'production',
    pineconeConfigured: !!process.env.PINECONE_API_KEY,
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// ---------------------------
// 🧠 Phase 3: RAG Functions
// ---------------------------

/**
 * RAG-3.1: Retrieve relevant context from conversation history
 * Uses semantic search to find related messages in the conversation
 */
async function retrieveConversationContext(
  conversationId: string, 
  queryText: string, 
  currentMessageId: string,
  maxResults: number = 5
): Promise<Array<{messageId: string, summaryText: string, senderId: string, timestamp: number, score: number}>> {
  try {
    logger.info('🔍 Retrieving conversation context', { 
      conversationId, 
      queryText: queryText.substring(0, 100),
      maxResults 
    });

    if (!pinecone) {
      logger.warn('⚠️ Pinecone not initialized for context retrieval');
      return [];
    }

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
      encoding_format: 'float'
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Get Pinecone index and query the conversation namespace
    const index = pinecone.index('snaps-prod');
    const namespace = index.namespace(conversationId);

    const queryResponse = await namespace.query({
      vector: queryEmbedding,
      topK: maxResults + 1, // +1 because we'll filter out current message
      includeMetadata: true,
      includeValues: false
    });

    // Filter out the current message and format results
    const contextResults = queryResponse.matches
      ?.filter((match: any) => match.id !== currentMessageId)
      .slice(0, maxResults)
      .map((match: any) => ({
        messageId: match.id,
        summaryText: match.metadata?.summaryText as string || '',
        senderId: match.metadata?.senderId as string || '',
        timestamp: match.metadata?.timestamp as number || 0,
        score: match.score || 0
      })) || [];

    logger.info('✅ Context retrieved', { 
      conversationId,
      resultsCount: contextResults.length,
      scores: contextResults.map((r: any) => r.score)
    });

    return contextResults;

  } catch (error) {
    logger.error('❌ Error retrieving conversation context', {
      conversationId,
      error: (error as Error).message
    });
    return [];
  }
}

/**
 * RAG-3.2: Generate enhanced summary with conversation context
 * Uses retrieved context to create more coherent, contextual summaries
 */
async function generateContextualSummary(
  messageContent: string,
  conversationId: string,
  currentMessageId: string,
  senderId: string
): Promise<{summaryText: string, contextUsed: string[], confidence: number}> {
  try {
    logger.info('🤖 Generating contextual summary', { 
      messageId: currentMessageId,
      conversationId,
      contentLength: messageContent.length
    });

    // Retrieve relevant conversation context
    const contextResults = await retrieveConversationContext(
      conversationId,
      messageContent,
      currentMessageId,
      3 // Get top 3 most relevant previous messages
    );

    let summaryText: string;
    let contextUsed: string[] = [];
    let confidence: number = 0.7; // Base confidence

    if (contextResults.length > 0) {
      // Enhanced summary with context
      confidence = 0.9; // Higher confidence with context
      contextUsed = contextResults.map(r => r.messageId);

      // Get participant names for better context
      const participantNames = await getParticipantNames(conversationId);
      
      // Build context window for LLM
      const contextWindow = contextResults
        .map(ctx => `[${getParticipantName(ctx.senderId, participantNames)}]: ${ctx.summaryText}`)
        .join('\n');

      logger.info('🧠 Using conversation context', {
        messageId: currentMessageId,
        contextMessagesCount: contextResults.length,
        contextWindow: contextWindow.substring(0, 200)
      });

      const contextualSummaryResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Generate a one-sentence neutral summary of the current message. Keep it under 30 tokens and less detailed than the original. Be factual and concise.

IMPORTANT: Use the conversation context below to:
1. Resolve pronouns (e.g., "he" → "Tom") when unambiguous
2. Reference ongoing topics or themes
3. Maintain conversational coherence

Recent conversation context:
${contextWindow}`
          },
          {
            role: 'user',
            content: `Current message from ${getParticipantName(senderId, participantNames)}: ${messageContent}`
          }
        ],
        max_tokens: 30,
        temperature: 0.1
      });

      summaryText = contextualSummaryResponse.choices[0]?.message?.content || 'Message sent';
      
      logger.info('✅ Contextual summary generated', {
        messageId: currentMessageId,
        summary: summaryText,
        contextUsed: contextUsed.length,
        tokensUsed: contextualSummaryResponse.usage?.total_tokens || 0
      });

    } else {
      // Fallback to basic summary without context
      logger.info('📝 No context available, generating basic summary', { messageId: currentMessageId });
      
      const basicSummaryResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Generate a one-sentence neutral summary of the following message. Keep it under 30 tokens and less detailed than the original. Be factual and concise.'
          },
          {
            role: 'user',
            content: messageContent
          }
        ],
        max_tokens: 30,
        temperature: 0.1
      });

      summaryText = basicSummaryResponse.choices[0]?.message?.content || 'Message sent';
    }

    return { summaryText, contextUsed, confidence };

  } catch (error) {
    logger.error('❌ Error generating contextual summary', {
      messageId: currentMessageId,
      conversationId,
      error: (error as Error).message
    });

    // Fallback to simple summary
    return { 
      summaryText: 'Message sent', 
      contextUsed: [], 
      confidence: 0.5 
    };
  }
}

/**
 * RAG-3.3: Helper function to get participant names for better context
 */
async function getParticipantNames(conversationId: string): Promise<Record<string, string>> {
  try {
    // Get conversation participants
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      return {};
    }

    const participantIds = conversationDoc.data()?.participantIds || [];
    const participantNames: Record<string, string> = {};

    // Fetch participant display names
    const participantPromises = participantIds.map(async (participantId: string) => {
      try {
        const userDoc = await db.collection('users').doc(participantId).get();
        if (userDoc.exists()) {
          participantNames[participantId] = userDoc.data()?.displayName || 'Unknown';
        }
      } catch (error) {
        logger.warn('⚠️ Could not fetch participant name', { participantId });
        participantNames[participantId] = 'Unknown';
      }
    });

    await Promise.all(participantPromises);
    return participantNames;

  } catch (error) {
    logger.error('❌ Error fetching participant names', { conversationId, error: (error as Error).message });
    return {};
  }
}

/**
 * RAG-3.4: Helper function to get participant name with fallback
 */
function getParticipantName(senderId: string, participantNames: Record<string, string>): string {
  return participantNames[senderId] || 'Someone';
}

// ---------------------------
// 🔍 Phase 3: RAG API Endpoints
// ---------------------------

/**
 * RAG-3.5: Semantic search endpoint for conversation context
 * Allows clients to search conversation history semantically
 */
app.post('/search-conversation', async (req: express.Request, res: express.Response) => {
  try {
    const { conversationId, query, maxResults = 10 } = req.body;

    if (!conversationId || !query) {
      return res.status(400).json({ 
        error: 'Missing required parameters: conversationId and query' 
      });
    }

    logger.info('🔍 Conversation search request', { conversationId, query, maxResults });

    const results = await retrieveConversationContext(
      conversationId,
      query,
      '', // No current message to exclude
      maxResults
    );

    // Enrich results with message details
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        try {
          const messageDoc = await db.collection('messages').doc(result.messageId).get();
          const messageData = messageDoc.exists ? messageDoc.data() : null;
          
          return {
            messageId: result.messageId,
            summaryText: result.summaryText,
            senderId: result.senderId,
            timestamp: result.timestamp,
            score: result.score,
            mediaType: messageData?.mediaType || 'unknown',
            sentAt: messageData?.sentAt || null
          };
        } catch (error) {
          logger.warn('⚠️ Could not enrich search result', { messageId: result.messageId });
          return result;
        }
      })
    );

    logger.info('✅ Conversation search completed', { 
      conversationId, 
      resultsCount: enrichedResults.length 
    });

    res.status(200).json({
      results: enrichedResults,
      query,
      conversationId,
      resultCount: enrichedResults.length
    });

  } catch (error) {
    logger.error('❌ Conversation search failed', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });

    res.status(500).json({
      error: 'Search failed',
      details: (error as Error).message
    });
  }
});

/**
 * RAG-3.6: Health check endpoint with RAG capabilities status
 */
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firebase: !!db,
      openai: !!openai,
      pinecone: !!pinecone,
      ragEnabled: !!(db && openai && pinecone)
    },
    version: '3.0.0-rag'
  });
});

/**
 * Update conversation message count and trigger conversation summary if needed
 */
async function updateConversationMessageCount(conversationId: string): Promise<void> {
  try {
    const conversationRef = db.collection('conversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    
    if (!conversationDoc.exists) {
      logger.warn('Conversation not found for message count update', { conversationId });
      return;
    }

    const conversationData = conversationDoc.data();
    const currentMessageCount = (conversationData?.messageCount || 0) + 1;
    const lastProcessedCount = conversationData?.lastProcessedMessageCount || 0;
    
    // Update message count
    await conversationRef.update({
      messageCount: currentMessageCount,
      lastActivity: new Date()
    });

    logger.info('📊 Conversation message count updated', { 
      conversationId, 
      currentMessageCount,
      lastProcessedCount 
    });

    // Check if we need to generate conversation summary (every 30 messages)
    const BATCH_SIZE = 30;
    const messagesSinceLastSummary = currentMessageCount - lastProcessedCount;
    
    if (messagesSinceLastSummary >= BATCH_SIZE && conversationData?.ragEnabled === true) {
      logger.info('🧠 Triggering conversation summary generation', { 
        conversationId, 
        messagesSinceLastSummary,
        currentMessageCount,
        ragEnabled: conversationData.ragEnabled
      });
      
      // Generate conversation summary asynchronously
      generateConversationSummary(conversationId, currentMessageCount)
        .catch(error => {
          logger.error('❌ Error generating conversation summary', {
            conversationId,
            error: error.message
          });
        });
    } else if (messagesSinceLastSummary >= BATCH_SIZE) {
      logger.info('📝 Skipping conversation summary - RAG disabled', { 
        conversationId, 
        messagesSinceLastSummary,
        ragEnabled: conversationData?.ragEnabled 
      });
    }

  } catch (error) {
    logger.error('❌ Error updating conversation message count', {
      conversationId,
      error: (error as Error).message
    });
  }
}

/**
 * Generate conversation summary from all RAG-processed message summaries
 * with exponential recency bias
 */
async function generateConversationSummary(conversationId: string, currentMessageCount: number): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info('🧠 Starting conversation summary generation', { 
      conversationId, 
      currentMessageCount 
    });

    // Get all summaries for this conversation
    const summariesSnapshot = await db
      .collection('summaries')
      .where('conversationId', '==', conversationId)
      .orderBy('generatedAt', 'asc')
      .get();

    logger.info('🔍 Firestore query executed for summaries', { 
      conversationId, 
      docCount: summariesSnapshot.docs.length,
      isEmpty: summariesSnapshot.empty
    });

    if (summariesSnapshot.empty) {
      logger.warn('No summaries found for conversation', { conversationId });
      return;
    }

    const summaries = summariesSnapshot.docs.map((doc: any) => doc.data());
    logger.info('📚 Retrieved summaries for conversation', { 
      conversationId, 
      summaryCount: summaries.length 
    });

    // Calculate recency weights (exponential decay)
    const summariesWithWeights = summaries.map((summary: any, index: number) => {
      const position = index / (summaries.length - 1); // 0 to 1, where 1 is most recent
      const weight = Math.pow(position, 2) * 0.7 + 0.3; // Exponential bias: 0.3 to 1.0
      return { ...summary, weight };
    });

    // Build weighted context for AI prompt
    const weightedContext = summariesWithWeights
      .map((summary: any) => `[Weight: ${summary.weight.toFixed(1)}] ${summary.summaryText}`)
      .join('\n');

    // Generate conversation summary with recency bias
    const conversationSummaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate a concise conversation summary (max 150 tokens) based on the weighted message summaries below. 
          
          IMPORTANT: Apply strong recency bias - give exponentially more weight to recent messages (higher weight values). 
          Recent messages should dominate the summary.
          
          Focus on:
          - Current topics being discussed (recent messages)
          - Key decisions or conclusions reached
          - Important themes or patterns
          - Participant dynamics
          
          Be factual and neutral. The summary should help someone catch up on the conversation quickly.`
        },
        {
          role: 'user',
          content: `Conversation message summaries (ordered chronologically, with recency weights):\n\n${weightedContext}`
        }
      ],
      max_tokens: 150,
      temperature: 0.2
    });

    const conversationSummaryText = conversationSummaryResponse.choices[0]?.message?.content || 'Conversation summary generated';

    // Calculate batch number
    const batchNumber = Math.ceil(currentMessageCount / 30);
    const summaryId = `${conversationId}_${batchNumber}`;

    // Calculate weights for metadata
    const recentMessagesWeight = summariesWithWeights
      .slice(-Math.ceil(summariesWithWeights.length * 0.3))
      .reduce((sum: number, s: any) => sum + s.weight, 0) / Math.ceil(summariesWithWeights.length * 0.3);
    
    const olderMessagesWeight = summariesWithWeights
      .slice(0, Math.floor(summariesWithWeights.length * 0.7))
      .reduce((sum: number, s: any) => sum + s.weight, 0) / Math.floor(summariesWithWeights.length * 0.7);

    // Store conversation summary
    const conversationSummaryData = {
      id: summaryId,
      conversationId,
      batchNumber,
      summaryText: conversationSummaryText,
      messagesIncluded: currentMessageCount,
      messageRange: {
        startCount: Math.max(1, currentMessageCount - 29), // Last 30 messages
        endCount: currentMessageCount
      },
      generatedAt: new Date(),
      model: 'gpt-4o-mini',
      processingTimeMs: Date.now() - startTime,
      confidence: 0.85, // High confidence for conversation summaries
      recentMessagesWeight,
      olderMessagesWeight
    };

    await db.collection('conversationSummaries').doc(summaryId).set(conversationSummaryData);

    // Update conversation with summary info
    await db.collection('conversations').doc(conversationId).update({
      lastProcessedMessageCount: currentMessageCount,
      lastConversationSummaryAt: new Date()
    });

    logger.info('✅ Conversation summary generated and stored', {
      conversationId,
      summaryId,
      batchNumber,
      messagesIncluded: currentMessageCount,
      summaryLength: conversationSummaryText.length,
      processingTimeMs: Date.now() - startTime
    });

  } catch (error) {
    logger.error('❌ Error generating conversation summary', {
      conversationId,
      currentMessageCount,
      error: (error as Error).message,
      stack: (error as Error).stack
    });
  }
}
