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
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";

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

              // Delete media file if exists
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

              // Delete message document
              batch.delete(messageDoc.ref);

              // Delete receipt
              batch.delete(receiptDoc.ref);

              messagesDeleted++;
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

              batch.delete(messageDoc.ref);
              messagesDeleted++;
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

              // Delete message and all receipts
              batch.delete(messageDoc.ref);
              receiptsQuery.docs.forEach((receiptDoc) => {
                batch.delete(receiptDoc.ref);
              });

              messagesDeleted++;
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
