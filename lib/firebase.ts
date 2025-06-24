import { Platform } from 'react-native';
import { env } from '../env';

const firebaseConfig = {
  apiKey: env.FB_API_KEY,
  authDomain: env.FB_AUTH_DOMAIN,
  projectId: env.FB_PROJECT_ID,
  appId: env.FB_APP_ID,
  databaseURL: env.FB_DATABASE_URL,
};

// For now, let's just use a mock implementation for web to get the app running
// We'll implement proper Firebase Web SDK integration later
let firebaseApp: any;
let auth: any;
let firestore: any;
let database: any;
let storage: any;

if (Platform.OS === 'web') {
  console.log('[Firebase] Using mock Firebase for web development');
  
  // Mock Firebase for web development
  firebaseApp = { name: '[DEFAULT]' };
  
  // Mock auth with better state management
  let mockCurrentUser: any = null;
  const authListeners: Array<(user: any) => void> = [];
  
  auth = {
    onAuthStateChanged: (callback: any) => {
      console.log('[Firebase Mock] Setting up auth state listener');
      authListeners.push(callback);
      // Initially call with no user
      setTimeout(() => {
        console.log('[Firebase Mock] Initial auth state: no user');
        callback(null);
      }, 100);
      
      return () => {
        const index = authListeners.indexOf(callback);
        if (index > -1) {
          authListeners.splice(index, 1);
        }
      }; // unsubscribe function
    },
    signInWithPopup: async () => {
      console.log('[Firebase Mock] Mock sign in started');
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      mockCurrentUser = { 
        uid: 'mock-user-' + Date.now(), 
        email: 'test@example.com', 
        displayName: 'Test User' 
      };
      
      console.log('[Firebase Mock] Mock sign in completed:', mockCurrentUser.email);
      
      // Notify all listeners
      authListeners.forEach(listener => {
        listener(mockCurrentUser);
      });
      
      return { user: mockCurrentUser };
    },
    signOut: async () => {
      console.log('[Firebase Mock] Mock sign out');
      mockCurrentUser = null;
      
      // Notify all listeners
      authListeners.forEach(listener => {
        listener(null);
      });
    },
    get currentUser() {
      return mockCurrentUser;
    }
  };
  
  // Mock firestore
  firestore = {
    collection: () => ({
      where: () => ({
        get: async () => ({ docs: [] })
      }),
      add: async () => ({ id: 'mock-doc-id' }),
      doc: () => ({
        get: async () => ({ exists: false, data: () => ({}) }),
        update: async () => {},
        set: async () => {},
        collection: () => firestore.collection()
      })
    })
  };
  
  // Mock database and storage
  database = { ref: () => ({ on: () => {}, off: () => {} }) };
  storage = { ref: () => ({ put: async () => {}, getDownloadURL: async () => 'mock-url' }) };
  
} else {
  // React Native Firebase - proper initialization for v22+
  console.log('[Firebase] Setting up React Native Firebase');
  
  try {
    console.log('[Firebase] Importing React Native Firebase modules...');
    
    // Import Firebase modules - for RN Firebase v22+, we import the default export
    const authModule = require('@react-native-firebase/auth');
    const firestoreModule = require('@react-native-firebase/firestore');
    const databaseModule = require('@react-native-firebase/database');
    const storageModule = require('@react-native-firebase/storage');
    const appModule = require('@react-native-firebase/app');
    
    console.log('[Firebase] Modules imported, initializing services...');
    
    // Initialize Firebase services - React Native Firebase auto-initializes from native config
    auth = authModule.default;
    firestore = firestoreModule.default;
    database = databaseModule.default;
    storage = storageModule.default;
    
    console.log('[Firebase] Services initialized successfully');
    console.log('[Firebase] Auth exists:', !!auth);
    console.log('[Firebase] Firestore exists:', !!firestore);
    
    // Test auth functionality
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      console.log('[Firebase] Auth instance validated successfully');
    } else {
      console.error('[Firebase] Auth instance validation failed');
    }
    
    // Get the default app instance
    try {
      firebaseApp = appModule.default.app();
      console.log('[Firebase] App instance obtained:', firebaseApp?.name || 'Unknown');
    } catch (error) {
      console.log('[Firebase] Using default app instance fallback');
      firebaseApp = { name: '[DEFAULT]' };
    }

  } catch (error: any) {
    console.error('[Firebase] Error initializing React Native Firebase:', error);
    console.error('[Firebase] Error details:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace'
    });
    throw error;
  }
}

console.log('[Firebase] Initialization complete. Services available:', {
  auth: !!auth,
  firestore: !!firestore,
  database: !!database,
  storage: !!storage,
  app: !!firebaseApp
});

export { firebaseApp, auth, firestore, database, storage };
export default firebaseApp; 