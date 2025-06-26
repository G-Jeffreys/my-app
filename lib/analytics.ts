import { getAnalytics, logEvent as firebaseLogEvent, setUserId as firebaseSetUserId, setUserProperties as firebaseSetUserProperties } from "firebase/analytics";
import { app } from "./firebase";
import { Platform } from "react-native";

// Initialize Analytics and get a reference to the service
const analytics = Platform.OS === 'web' ? getAnalytics(app) : null;

export const ANALYTICS_EVENTS = {
  LOGIN: "login",
  SIGNUP: "sign_up",
  MEDIA_SENT: "media_sent",
  MEDIA_VIEWED: "media_viewed",
  MEDIA_RECEIVED: "media_received",
  FRIEND_REQUEST_SENT: "friend_request_sent",
  FRIEND_REQUEST_ACCEPTED: "friend_request_accepted",
};

type EventName = keyof typeof ANALYTICS_EVENTS;
type EventParams = { [key: string]: any };

/**
 * Logs an analytics event.
 * On native, this is a no-op for now as we are moving to the JS SDK.
 * On web, it logs to Firebase Analytics.
 * @param eventName The name of the event to log.
 * @param params The parameters to log with the event.
 */
export const logEvent = (eventName: EventName, params: EventParams) => {
  if (analytics) {
    try {
      firebaseLogEvent(analytics, eventName, params);
    } catch (error) {
      console.error("Error logging analytics event:", error);
    }
  } else {
    console.log(`Analytics event (no-op on native): ${eventName}`, params);
  }
};

/**
 * Sets the user ID for analytics.
 * @param userId The user ID to set.
 */
export const setUserId = (userId: string | null) => {
  if (analytics && userId) {
    try {
      firebaseSetUserId(analytics, userId);
    } catch (error) {
      console.error("Error setting analytics user ID:", error);
    }
  }
};

/**
 * Sets the user properties for analytics.
 * @param properties The user properties to set.
 */
export const setUserProperties = (properties: { [key: string]: any } | null) => {
  if (analytics && properties) {
    try {
      firebaseSetUserProperties(analytics, properties);
    } catch (error) {
      console.error("Error setting user properties:", error);
    }
  }
}; 