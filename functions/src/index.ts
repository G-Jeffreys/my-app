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

admin.initializeApp();
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

export const cleanupExpiredMessages = onSchedule("every 1 hours", async () => {
  logger.info("Running cleanup for expired messages.");

  const now = admin.firestore.Timestamp.now();
  const messagesRef = db.collection("messages");
  const snapshot = await messagesRef.get();

  if (snapshot.empty) {
    logger.info("No messages to process.");
    return;
  }

  const batch = db.batch();
  const storage = admin.storage();

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
      return 0;
    }
  };

  snapshot.forEach((doc) => {
    const message = doc.data();
    const sentAt = message.sentAt as admin.firestore.Timestamp;
    const ttlMillis = ttlToMillis(message.ttlPreset);

    if (sentAt.toMillis() + ttlMillis < now.toMillis()) {
      logger.info(`Deleting message ${doc.id} and associated media.`);

      if (message.mediaURL) {
        try {
          const fileUrl = new URL(message.mediaURL);
          const filePath = decodeURIComponent(
            fileUrl.pathname.split("/").slice(3).join("/")
          );
          storage.bucket().file(filePath).delete().catch((err) =>
            logger.error(`Failed to delete media for ${doc.id}`, err)
          );
        } catch (e) {
          logger.error(
            `Invalid mediaURL for message ${doc.id}: ${message.mediaURL}`,
            e
          );
        }
      }
      batch.delete(doc.ref);
    }
  });

  try {
    await batch.commit();
    logger.info("Expired messages cleanup finished successfully.");
  } catch (error) {
    logger.error("Batch commit failed during cleanup.", {error});
  }
});

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
