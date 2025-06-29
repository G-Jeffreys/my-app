import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, Auth, initializeAuth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getDatabase, Database } from "firebase/database";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// Initialize Auth with proper React Native persistence for Firebase v10
let auth: Auth;
try {
  console.log('[Firebase] Initializing Auth service for platform:', Platform.OS);
  
  if (Platform.OS !== 'web') {
    // For React Native, use initializeAuth with AsyncStorage persistence
    console.log('[Firebase] Setting up React Native Auth with AsyncStorage persistence...');
    try {
      // Check if auth is already initialized
      auth = getAuth(app);
      console.log('[Firebase] Auth already initialized, using existing instance');
    } catch (authError) {
      // If not initialized, initialize with React Native persistence
      console.log('[Firebase] Initializing new Auth instance with AsyncStorage persistence...');
      // For Firebase v10 web SDK with React Native, use AsyncStorage directly
      auth = initializeAuth(app, {
        persistence: AsyncStorage as any,
      });
      console.log('[Firebase] Auth service initialized with AsyncStorage persistence');
    }
  } else {
    // For web, use regular getAuth
    console.log('[Firebase] Initializing web Auth...');
    auth = getAuth(app);
    console.log('[Firebase] Auth service initialized for web');
  }
} catch (error: any) {
  console.error('[Firebase] Auth initialization failed:', error);
  console.error('[Firebase] Error message:', error.message);
  console.error('[Firebase] Error code:', error.code);
  console.error('[Firebase] Error stack:', error.stack);
  
  // Fallback to basic auth if persistence setup fails
  try {
    console.log('[Firebase] Attempting fallback to basic auth...');
    auth = getAuth(app);
    console.log('[Firebase] Fallback to basic auth successful');
  } catch (fallbackError: any) {
    console.error('[Firebase] Fallback auth also failed:', fallbackError);
    throw fallbackError;
  }
}

// Initialize other Firebase services with error handling
let firestore: Firestore;
let storage: FirebaseStorage | undefined;
let database: Database | undefined;

try {
  console.log('[Firebase] Initializing Firestore...');
  firestore = getFirestore(app);
  console.log('[Firebase] Firestore initialized successfully');
} catch (error: any) {
  console.error('[Firebase] Firestore initialization failed:', error);
  throw error; // Firestore is critical, throw if it fails
}

try {
  console.log('[Firebase] Initializing Storage...');
  storage = getStorage(app);
  console.log('[Firebase] Storage initialized successfully');
} catch (error: any) {
  console.error('[Firebase] Storage initialization failed:', error);
  console.warn('[Firebase] Continuing without Storage service');
}

try {
  console.log('[Firebase] Initializing Realtime Database...');
  database = getDatabase(app);
  console.log('[Firebase] Database initialized successfully');
} catch (error: any) {
  console.error('[Firebase] Database initialization failed:', error);
  console.warn('[Firebase] Continuing without Realtime Database service');
}

console.log('[Firebase] All Firebase services initialization complete');
console.log('[Firebase] Auth instance:', !!auth);
console.log('[Firebase] Firestore instance:', !!firestore);
console.log('[Firebase] Storage instance:', !!storage);
console.log('[Firebase] Database instance:', !!database);

// Validate that essential services are available
if (!auth) {
  throw new Error('[Firebase] Critical: Auth service failed to initialize');
}
if (!firestore) {
  throw new Error('[Firebase] Critical: Firestore service failed to initialize');
}

// Export services
export { app, auth, firestore, storage, database };

// Export aliases for backward compatibility
export const firebaseApp = app; 