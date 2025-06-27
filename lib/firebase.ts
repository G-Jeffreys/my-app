import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { Platform } from "react-native";
import { env } from "../env";

console.log('[Firebase] Initializing Firebase Web SDK for platform:', Platform.OS);

// Add detailed configuration logging to diagnose issues
console.log('[Firebase] Configuration check:');
console.log('[Firebase] API Key present:', !!env.FB_API_KEY);
console.log('[Firebase] Auth Domain:', env.FB_AUTH_DOMAIN);
console.log('[Firebase] Project ID:', env.FB_PROJECT_ID);
console.log('[Firebase] App ID present:', !!env.FB_APP_ID);
console.log('[Firebase] Storage Bucket:', env.FB_STORAGE_BUCKET);
console.log('[Firebase] Messaging Sender ID:', env.FB_MESSAGING_SENDER_ID);

const firebaseConfig = {
  apiKey: env.FB_API_KEY,
  authDomain: env.FB_AUTH_DOMAIN,
  projectId: env.FB_PROJECT_ID,
  storageBucket: env.FB_STORAGE_BUCKET,
  messagingSenderId: env.FB_MESSAGING_SENDER_ID,
  appId: env.FB_APP_ID,
  databaseURL: env.FB_DATABASE_URL,
  measurementId: env.FB_MEASUREMENT_ID,
};

console.log('[Firebase] Complete config object:', JSON.stringify(firebaseConfig, null, 2));

// Initialize Firebase
let app;
try {
  console.log('[Firebase] Checking existing apps:', getApps().length);
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('[Firebase] New app initialized successfully, name:', app.name);
  } else {
    // Try to get existing app first
    try {
      app = getApp();
      console.log('[Firebase] Using existing default app, name:', app.name);
    } catch (error) {
      // If default app doesn't exist, create it
      app = initializeApp(firebaseConfig);
      console.log('[Firebase] Created new default app, name:', app.name);
    }
  }
} catch (error: any) {
  console.error('[Firebase] Failed to initialize app:', error);
  throw error;
}

// Initialize Auth - simple approach that works reliably
let auth: Auth;
try {
  console.log('[Firebase] Initializing Auth service...');
  auth = getAuth(app);
  console.log('[Firebase] Auth service initialized successfully');
  // Note: AsyncStorage persistence warning is expected with this approach
  // This is due to Firebase v10 TypeScript export limitations with getReactNativePersistence
} catch (error: any) {
  console.error('[Firebase] Auth initialization failed:', error);
  console.error('[Firebase] Error message:', error.message);
  console.error('[Firebase] Error code:', error.code);
  throw error;
}

// Initialize other Firebase services with error handling
let firestore, storage, database;

try {
  firestore = getFirestore(app);
  console.log('[Firebase] Firestore initialized successfully');
} catch (error: any) {
  console.error('[Firebase] Firestore initialization failed:', error);
}

try {
  storage = getStorage(app);
  console.log('[Firebase] Storage initialized successfully');
} catch (error: any) {
  console.error('[Firebase] Storage initialization failed:', error);
}

try {
  database = getDatabase(app);
  console.log('[Firebase] Database initialized successfully');
} catch (error: any) {
  console.error('[Firebase] Database initialization failed:', error);
}

console.log('[Firebase] All Firebase services initialization complete');

// Export services
export { app, auth, firestore, storage, database };

// Export aliases for backward compatibility
export { app as firebaseApp }; 