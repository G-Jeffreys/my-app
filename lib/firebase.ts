import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { env } from "../env";

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

const auth = initializeAuth(app);

const firestore = getFirestore(app);
const storage = getStorage(app);
const database = getDatabase(app);

export { app, auth, firestore, storage, database }; 