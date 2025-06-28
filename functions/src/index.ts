/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import * as logger from "firebase-functions/logger";
import {onDocumentUpdated, onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
// Cloud Tasks client for enqueuing moderation jobs
// Using dynamic import to avoid CommonJS/ESM issues

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

// Initialize the Firebase Admin app
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const acceptFriendRequest = onDocumentUpdated(
  "friendRequests/{requestId}",
  async (event) => {
    if (!event.data || !event.data.before || !event.data.after) {
      logger.info("Event data is missing, exiting function.");
      return;
    }
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before?.status === after?.status || after?.status !== "accepted") {
      logger.info(
        `Request ${event.params.requestId} not changed to accepted.`
      );
      return;
    }

    logger.info(`Processing request: ${event.params.requestId}`);

    const {senderId, recipientId} = after;

    if (!senderId || !recipientId) {
      logger.error("Sender or Recipient ID missing.", {senderId, recipientId});
      return;
    }

    const batch = db.batch();

    const senderFriendRef = db
      .collection("users").doc(senderId)
      .collection("friends").doc(recipientId);
    batch.set(senderFriendRef, {
      friendId: recipientId,
      friendedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const recipientFriendRef = db
      .collection("users").doc(recipientId)
      .collection("friends").doc(senderId);
    batch.set(recipientFriendRef, {
      friendId: senderId,
      friendedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.delete(event.data.after.ref);

    try {
      await batch.commit();
      logger.info(
        `Created friendship between ${senderId} and ${recipientId}.`
      );
    } catch (error) {
      logger.error("Batch commit failed for friend request.", {
        requestId: event.params.requestId,
        error,
      });
    }
  });

// Helper function for TTL-based cleanup logic
const performCleanup = async () => {
  logger.info("🧹 Running TTL-based cleanup for expired messages...");

  const now = admin.firestore.Timestamp.now();
  const messagesRef = db.collection("messages");
  const receiptsRef = db.collection("receipts");

  let messagesProcessed = 0;
  let messagesDeleted = 0;
  let mediaFilesDeleted = 0;
  let errors = 0;

  // Helper function to convert TTL string to milliseconds
  const ttlToMillis = (ttl: string): number => {
    const unit = ttl.slice(-1);
    const value = parseInt(ttl.slice(0, -1), 10);

    switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 3600 * 1000;
    default:
      logger.warn(`⚠️ Invalid TTL format: ${ttl}, defaulting to 1 hour`);
      return 3600 * 1000; // Default to 1 hour
    }
  };

  try {
    // Get all messages
    const messagesSnapshot = await messagesRef.get();

    if (messagesSnapshot.empty) {
      logger.info("📭 No messages to process.");
      return {messagesProcessed, messagesDeleted, mediaFilesDeleted, errors};
    }

    logger.info(`📊 Processing ${messagesSnapshot.size} messages for cleanup...`);

    // Process messages in batches to avoid timeout
    const batch = db.batch();
    const storage = admin.storage();

    for (const messageDoc of messagesSnapshot.docs) {
      messagesProcessed++;
      const message = messageDoc.data();
      const messageId = messageDoc.id;

      logger.info(`🔍 Checking message ${messageId} (TTL: ${message.ttlPreset})`);

      try {
        // For individual messages: check single recipient
        if (message.recipientId) {
          const receiptId = `${messageId}_${message.recipientId}`;
          const receiptDoc = await receiptsRef.doc(receiptId).get();

          if (receiptDoc.exists) {
            const receipt = receiptDoc.data();
            const receivedAt = receipt?.receivedAt as admin.firestore.Timestamp;
            const ttlMillis = ttlToMillis(message.ttlPreset);

            if (receivedAt && receivedAt.toMillis() + ttlMillis < now.toMillis()) {
              logger.info(`⏰ Message ${messageId} expired for recipient ${message.recipientId}`);

              // Check if message is already marked as expired to avoid duplicate work
              if (!message.expired) {
                // Delete media file if exists (free up storage)
                if (message.mediaURL) {
                  try {
                    const fileUrl = new URL(message.mediaURL);
                    const filePath = decodeURIComponent(
                      fileUrl.pathname.split("/").slice(3).join("/")
                    );
                    await storage.bucket().file(filePath).delete();
                    mediaFilesDeleted++;
                    logger.info(`🗑️ Deleted media file: ${filePath}`);
                  } catch (mediaError) {
                    logger.error(`❌ Failed to delete media for ${messageId}`, mediaError);
                    errors++;
                  }
                }

                // Mark message as expired but keep document for AI summary access
                batch.update(messageDoc.ref, {
                  expired: true,
                  expiredAt: now,
                  // Remove the mediaURL since we deleted the file
                  mediaURL: null,
                });

                // Delete receipt (no longer needed for expired messages)
                batch.delete(receiptDoc.ref);

                messagesDeleted++;
                logger.info(`📝 Message ${messageId} marked as expired, AI summary preserved`);
              } else {
                logger.info(`⏭️ Message ${messageId} already marked as expired, skipping`);
              }
            } else {
              logger.info(`⏳ Message ${messageId} not yet expired (received: ${receivedAt?.toDate()?.toISOString()})`);
            }
          } else {
            logger.warn(`⚠️ No receipt found for message ${messageId}, using sentAt fallback`);
            // Fallback to old behavior for messages without receipts
            const sentAt = message.sentAt as admin.firestore.Timestamp;
            const ttlMillis = ttlToMillis(message.ttlPreset);

            if (sentAt.toMillis() + ttlMillis < now.toMillis()) {
              logger.info(`⏰ Message ${messageId} expired (using sentAt fallback)`);

              // Check if message is already marked as expired
              if (!message.expired) {
                if (message.mediaURL) {
                  try {
                    const fileUrl = new URL(message.mediaURL);
                    const filePath = decodeURIComponent(
                      fileUrl.pathname.split("/").slice(3).join("/")
                    );
                    await storage.bucket().file(filePath).delete();
                    mediaFilesDeleted++;
                  } catch (mediaError) {
                    logger.error(`❌ Failed to delete media for ${messageId}`, mediaError);
                    errors++;
                  }
                }

                // Mark message as expired but preserve for AI summary
                batch.update(messageDoc.ref, {
                  expired: true,
                  expiredAt: now,
                  mediaURL: null,
                });

                messagesDeleted++;
                logger.info(`📝 Message ${messageId} marked as expired (fallback), AI summary preserved`);
              } else {
                logger.info(`⏭️ Message ${messageId} already marked as expired, skipping`);
              }
            }
          }
        }

        // For group messages: check all participants' receipts
        else if (message.conversationId) {
          const receiptsQuery = await receiptsRef
            .where("messageId", "==", messageId)
            .get();

          if (!receiptsQuery.empty) {
            let allExpired = true;
            const ttlMillis = ttlToMillis(message.ttlPreset);

            // Check if message has expired for ALL recipients
            for (const receiptDoc of receiptsQuery.docs) {
              const receipt = receiptDoc.data();
              const receivedAt = receipt?.receivedAt as admin.firestore.Timestamp;

              if (!receivedAt || receivedAt.toMillis() + ttlMillis >= now.toMillis()) {
                allExpired = false;
                break;
              }
            }

            if (allExpired) {
              logger.info(`⏰ Group message ${messageId} expired for all recipients`);

              // Check if message is already marked as expired
              if (!message.expired) {
                // Delete media file
                if (message.mediaURL) {
                  try {
                    const fileUrl = new URL(message.mediaURL);
                    const filePath = decodeURIComponent(
                      fileUrl.pathname.split("/").slice(3).join("/")
                    );
                    await storage.bucket().file(filePath).delete();
                    mediaFilesDeleted++;
                  } catch (mediaError) {
                    logger.error(`❌ Failed to delete media for ${messageId}`, mediaError);
                    errors++;
                  }
                }

                // Mark message as expired but preserve for AI summary
                batch.update(messageDoc.ref, {
                  expired: true,
                  expiredAt: now,
                  mediaURL: null,
                });

                // Delete all receipts (no longer needed for expired messages)
                receiptsQuery.docs.forEach((receiptDoc) => {
                  batch.delete(receiptDoc.ref);
                });

                messagesDeleted++;
                logger.info(`📝 Group message ${messageId} marked as expired, AI summary preserved`);
              } else {
                logger.info(`⏭️ Group message ${messageId} already marked as expired, skipping`);
              }
            } else {
              logger.info(`⏳ Group message ${messageId} not yet expired for all recipients`);
            }
          } else {
            logger.warn(`⚠️ No receipts found for group message ${messageId}`);
          }
        }
      } catch (messageError) {
        logger.error(`❌ Error processing message ${messageId}`, messageError);
        errors++;
      }
    }

    // Commit all deletions
    if (messagesDeleted > 0) {
      await batch.commit();
      logger.info("✅ Cleanup batch committed successfully");
    }

    // Return cleanup stats
    const cleanupStats = {
      messagesProcessed,
      messagesDeleted,
      mediaFilesDeleted,
      errors,
      timestamp: now.toDate().toISOString(),
    };

    logger.info("📊 Cleanup completed", cleanupStats);

    // Log cleanup_success event for analytics
    logger.info("📈 cleanup_success", {
      structuredData: true,
      ...cleanupStats,
    });

    return cleanupStats;
  } catch (error) {
    logger.error("❌ Batch commit failed during cleanup.", {error});

    // Log cleanup_error event
    logger.error("📈 cleanup_error", {
      structuredData: true,
      error: error?.toString(),
      messagesProcessed,
      timestamp: now.toDate().toISOString(),
    });

    throw error;
  }
};

// T9 - Updated Cleanup Pipeline: Use receivedAt + TTL for proper timing
export const cleanupExpiredMessages = onSchedule("every 10 minutes", async () => {
  await performCleanup();
});

// Manual cleanup function for testing - can be called via HTTP
export const manualCleanup = onRequest(async (request, response) => {
  logger.info("🧪 Manual cleanup triggered via HTTP request");
  
  try {
    const stats = await performCleanup();
    
    response.status(200).json({
      success: true,
      message: "Manual cleanup completed successfully",
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("❌ Manual cleanup failed", error);
    response.status(500).json({
      success: false,
      error: error?.toString(),
      timestamp: new Date().toISOString()
    });
  }
});

// Future LLM Summary Pipeline (scaffolding for Phase 3)
// Commented out for now as it's low priority
/*
export const generateMessageSummary = onDocumentCreated(
  "messages/{messageId}",
  async (event) => {
    // This will trigger OpenAI summary generation
    // Implementation deferred to Phase 3
    logger.info("🤖 LLM summary generation triggered", { messageId: event.params.messageId });
  }
);
*/

/**
 * T1.1 – enqueueModerationJob
 * Firestore onCreate trigger that fires for every newly created message.
 * It filters out messages that are either marked `ephemeralOnly`, already
 * have `summaryGenerated==true`, or are system messages. For qualifying
 * messages we push a task to Cloud Tasks so the `moderateAndSummarize`
 * Cloud Run worker can process it asynchronously.
 */
// Note: Import path needs to be adjusted for functions deployment
// For now, we'll define the config inline to avoid path issues
const TASK_QUEUE_CONFIG = {
  LOCATION: process.env.TASK_QUEUE_LOCATION ?? 'us-central1',
  QUEUE_NAME: process.env.MODERATION_TASK_QUEUE_NAME ?? 'moderate-summary-queue',
  WORKER_ENDPOINT: process.env.MODERATION_WORKER_URL ?? 
    'https://moderation-worker-yyaoaphbjq-uc.a.run.app/moderate-summary-job',
};

export const enqueueModerationJob = onDocumentCreated(
  "messages/{messageId}",
  async (event) => {
    try {
      // Dynamic import of CloudTasksClient
      const { CloudTasksClient } = await import("@google-cloud/tasks");
      
      const message = event.data?.data();

      logger.info("📩 New message created – evaluating for queue", {
        messageId: event.params.messageId,
        senderId: message?.senderId,
        mediaType: message?.mediaType,
      });

      if (!message) {
        logger.warn("No message data; exiting enqueue job");
        return;
      }

      // Skip if message is explicitly marked as `ephemeralOnly`
      if (message.ephemeralOnly) {
        logger.info("🚫 Message marked ephemeralOnly – skipping", {
          messageId: event.params.messageId,
        });
        return;
      }

      // Skip if summary already generated (idempotency)
      if (message.summaryGenerated) {
        logger.info("↩️ summaryGenerated already true – skipping", {
          messageId: event.params.messageId,
        });
        return;
      }

      // Build task payload
      const payload = {
        messageId: event.params.messageId,
        conversationId: message.conversationId ?? null,
        senderId: message.senderId,
        mediaType: message.mediaType,
        timestamp: Date.now(),
      };

      const client = new CloudTasksClient();
      const parent = client.queuePath(
        process.env.GCP_PROJECT || 
        process.env.GCLOUD_PROJECT || "_",
        TASK_QUEUE_CONFIG.LOCATION,
        TASK_QUEUE_CONFIG.QUEUE_NAME
      );

      const task = {
        httpRequest: {
          httpMethod: "POST" as const,
          url: TASK_QUEUE_CONFIG.WORKER_ENDPOINT,
          headers: {
            "Content-Type": "application/json",
          },
          body: Buffer.from(JSON.stringify(payload))
            .toString("base64"),
        },
        // Up to 3 retries handled by Cloud Tasks config
      };

      const [response] = await client.createTask({ parent, task });

      logger.info("✅ Enqueued moderation task", {
        messageId: event.params.messageId,
        taskName: response.name,
      });
    } catch (error) {
      logger.error("❌ Failed to enqueue moderation task", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        messageId: event.params.messageId,
      });
    }
  }
);
