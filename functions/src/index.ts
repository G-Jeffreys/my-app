/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

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
setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();
const db = admin.firestore();

export const acceptFriendRequest = onDocumentUpdated(
  "friendRequests/{requestId}",
  async (event) => {
    if (!event.data || !event.data.before || !event.data.after) {
      logger.info("Event data is missing, exiting function.");
      return null;
    }
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before?.status === after?.status || after?.status !== "accepted") {
      logger.info(
        `Request ${event.params.requestId} not changed to accepted.`
      );
      return null;
    }

    logger.info(`Processing request: ${event.params.requestId}`);

    const { senderId, recipientId } = after;

    if (!senderId || !recipientId) {
      logger.error("Sender or Recipient ID missing.", { senderId, recipientId });
      return null;
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
      return { success: true };
    } catch (error) {
      logger.error("Batch commit failed for friend request.", {
        requestId: event.params.requestId,
        error,
      });
      return { success: false };
    }
  });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
