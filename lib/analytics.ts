import { Platform } from 'react-native';

// Platform-agnostic analytics service
let analytics: any;

if (Platform.OS === 'web') {
  console.log('[Analytics] Using mock analytics for web development');
  
  // Mock analytics for web
  analytics = () => ({
    logEvent: async (eventName: string, params?: { [key: string]: any }) => {
      console.log(`[Analytics Mock] Event logged: ${eventName}`, params);
    },
    setUserId: async (userId: string | null) => {
      console.log(`[Analytics Mock] User ID set: ${userId}`);
    },
    setUserProperties: async (properties: { [key: string]: any } | null) => {
      console.log('[Analytics Mock] User properties set:', properties);
    }
  });
} else {
  // Real React Native Firebase Analytics
  analytics = require('@react-native-firebase/analytics').default;
  console.log('[Analytics] Using React Native Firebase Analytics');
}

export const logEvent = async (eventName: string, params?: { [key: string]: any }) => {
  try {
    console.log(`[Analytics] Logging event: ${eventName}`, params);
    await analytics().logEvent(eventName, params);
  } catch (error) {
    console.error(`[Analytics] Error logging event: ${eventName}`, error);
  }
};

export const setUserId = async (userId: string | null) => {
  try {
    console.log(`[Analytics] Setting user ID: ${userId}`);
    await analytics().setUserId(userId);
  } catch (error) {
    console.error('[Analytics] Error setting user ID:', error);
  }
};

export const setUserProperties = async (properties: { [key: string]: any } | null) => {
  try {
    console.log('[Analytics] Setting user properties:', properties);
    await analytics().setUserProperties(properties);
  } catch (error) {
    console.error('[Analytics] Error setting user properties:', error);
  }
};

export const ANALYTICS_EVENTS = {
  MEDIA_SENT: 'media_sent',
  MEDIA_RECEIVED: 'media_received',
  MEDIA_OPENED: 'media_opened',
  MEDIA_EXPIRED_UNOPENED: 'media_expired_unopened',
  TTL_SELECTED: 'ttl_selected',
}; 