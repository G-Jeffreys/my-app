import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { Platform } from "react-native";
import { env } from "../env";

console.log('[Firebase] Initializing Firebase with config:', {
  projectId: env.FB_PROJECT_ID,
  authDomain: env.FB_AUTH_DOMAIN,
  platform: Platform.OS,
});

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

// Initialize Firebase
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with proper cross-platform compatibility
let auth;
try {
  // For Expo/React Native, use initializeAuth for better persistence handling
  // For web, getAuth is sufficient and more reliable
  if (Platform.OS === 'web') {
    console.log('[Firebase] Using getAuth for web platform');
    auth = getAuth(app);
  } else {
    console.log('[Firebase] Using initializeAuth for mobile platform');
    // Firebase v9+ handles persistence automatically on mobile
    auth = initializeAuth(app);
  }
} catch (error) {
  console.log('[Firebase] Auth already initialized, using getAuth');
  auth = getAuth(app);
}

console.log('[Firebase] Auth initialized successfully');

const firestore = getFirestore(app);
const storage = getStorage(app);
const database = getDatabase(app);

console.log('[Firebase] All Firebase services initialized');

export { app, auth, firestore, storage, database }; 