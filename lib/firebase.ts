import { Platform } from 'react-native';
import { env } from '../env';

const firebaseConfig = {
  apiKey: env.FB_API_KEY,
  authDomain: env.FB_AUTH_DOMAIN,
  projectId: env.FB_PROJECT_ID,
  appId: env.FB_APP_ID,
  databaseURL: env.FB_DATABASE_URL,
  storageBucket: 'snapconnect-6108c.firebasestorage.app',
};

// Platform-agnostic Firebase service types
export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface FirebaseQuerySnapshot {
  docs: FirebaseDocumentSnapshot[];
  forEach: (callback: (doc: FirebaseDocumentSnapshot) => void) => void;
}

export interface FirebaseDocumentSnapshot {
  id: string;
  exists(): boolean;
  data(): any;
}

export interface FirebaseCollectionReference {
  doc(id?: string): FirebaseDocumentReference;
  add(data: any): Promise<FirebaseDocumentReference>;
  where(field: string, operator: any, value: any): FirebaseQuery;
  onSnapshot(callback: (snapshot: FirebaseQuerySnapshot) => void): () => void;
}

export interface FirebaseDocumentReference {
  id: string;
  collection(path: string): FirebaseCollectionReference;
  get(): Promise<FirebaseDocumentSnapshot>;
  set(data: any, options?: any): Promise<void>;
  update(data: any): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(callback: (doc: FirebaseDocumentSnapshot) => void): () => void;
}

export interface FirebaseQuery {
  where(field: string, operator: any, value: any): FirebaseQuery;
  get(): Promise<FirebaseQuerySnapshot>;
  onSnapshot(callback: (snapshot: FirebaseQuerySnapshot) => void): () => void;
}

export interface FirebaseAuth {
  currentUser: any;
  onAuthStateChanged: (callback: (user: any) => void) => () => void;
  signInWithCredential: (credential: any) => Promise<any>;
  signOut: () => Promise<void>;
  GoogleAuthProvider?: any;
}

export interface FirebaseFirestore {
  collection(path: string): FirebaseCollectionReference;
  FieldValue: {
    serverTimestamp(): any;
  };
}

export interface FirebaseStorage {
  ref(path?: string): FirebaseStorageReference;
}

export interface FirebaseStorageReference {
  put(blob: Blob): Promise<any>;
  getDownloadURL(): Promise<string>;
}

export interface FirebaseDatabase {
  ref(path?: string): FirebaseDatabaseReference;
}

export interface FirebaseDatabaseReference {
  on(event: string, callback: (snapshot: any) => void): void;
  off(event: string, callback?: (snapshot: any) => void): void;
  set(value: any): Promise<void>;
  remove(): Promise<void>;
}

// Initialize Firebase services
let firebaseApp: any;
let auth: FirebaseAuth;
let firestore: FirebaseFirestore;
let database: FirebaseDatabase;
let storage: FirebaseStorage;

// Mock helper functions for fallback
const createMockCollection = (path: string): FirebaseCollectionReference => ({
  doc: (id?: string) => createMockDocument(path, id || 'mock-doc'),
  add: async (data: any) => {
    console.log(`[Firebase Mock] Adding document to ${path}:`, data);
    return createMockDocument(path, `mock-${Date.now()}`);
  },
  where: (field: string, operator: any, value: any) => createMockQuery(path, field, operator, value),
  onSnapshot: (callback: (snapshot: FirebaseQuerySnapshot) => void) => {
    console.log(`[Firebase Mock] Setting up snapshot listener for ${path}`);
    setTimeout(() => {
      callback({
        docs: [],
        forEach: () => {}
      });
    }, 100);
    return () => console.log(`[Firebase Mock] Unsubscribing from ${path}`);
  }
});

const createMockDocument = (collectionPath: string, docId: string): FirebaseDocumentReference => ({
  id: docId,
  collection: (path: string) => createMockCollection(`${collectionPath}/${docId}/${path}`),
  get: async () => ({
    id: docId,
    exists: () => false,
    data: () => null
  }),
  set: async (data: any, options?: any) => {
    console.log(`[Firebase Mock] Setting document ${collectionPath}/${docId}:`, data);
  },
  update: async (data: any) => {
    console.log(`[Firebase Mock] Updating document ${collectionPath}/${docId}:`, data);
  },
  delete: async () => {
    console.log(`[Firebase Mock] Deleting document ${collectionPath}/${docId}`);
  },
  onSnapshot: (callback: (doc: FirebaseDocumentSnapshot) => void) => {
    console.log(`[Firebase Mock] Setting up document snapshot listener for ${collectionPath}/${docId}`);
    setTimeout(() => {
      callback({
        id: docId,
        exists: () => false,
        data: () => null
      });
    }, 100);
    return () => console.log(`[Firebase Mock] Unsubscribing from document ${collectionPath}/${docId}`);
  }
});

const createMockQuery = (path: string, field: string, operator: any, value: any): FirebaseQuery => ({
  where: (newField: string, newOperator: any, newValue: any) => createMockQuery(path, newField, newOperator, newValue),
  get: async () => ({
    docs: [],
    forEach: () => {}
  }),
  onSnapshot: (callback: (snapshot: FirebaseQuerySnapshot) => void) => {
    console.log(`[Firebase Mock] Setting up query snapshot listener for ${path}`);
    setTimeout(() => {
      callback({
        docs: [],
        forEach: () => {}
      });
    }, 100);
    return () => console.log(`[Firebase Mock] Unsubscribing from query ${path}`);
  }
});

// Utility function to convert timestamps
export const convertTimestamp = (timestamp: any): FirebaseTimestamp => {
  if (timestamp && timestamp.seconds !== undefined) {
    return { seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds || 0 };
  }
  if (timestamp instanceof Date) {
    return { seconds: Math.floor(timestamp.getTime() / 1000), nanoseconds: 0 };
  }
  if (timestamp && timestamp.toDate) {
    const date = timestamp.toDate();
    return { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 };
  }
  return { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
};

// Utility function to create Date from timestamp
export const timestampToDate = (timestamp: any): Date => {
  if (timestamp && timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000);
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate();
  }
  return new Date();
};

if (Platform.OS === 'web') {
  console.log('[Firebase] Initializing Firebase for web with mock services');
  
  // Mock Firebase for web development
  firebaseApp = { name: '[DEFAULT]' };
  
  // Mock auth with better state management
  let mockCurrentUser: any = null;
  const authListeners: Array<(user: any) => void> = [];
  
  auth = {
    currentUser: mockCurrentUser,
    onAuthStateChanged: (callback: (user: any) => void) => {
      console.log('[Firebase Mock] Setting up auth state listener');
      authListeners.push(callback);
      // Immediately call with current user
      callback(mockCurrentUser);
      console.log('[Firebase Mock] Initial auth state: no user');
      return () => {
        const index = authListeners.indexOf(callback);
        if (index > -1) authListeners.splice(index, 1);
      };
    },
    signInWithCredential: async (credential: any) => {
      console.log('[Firebase Mock] Mock sign in started');
      // Mock successful sign in
      mockCurrentUser = {
        uid: 'mock-user-123',
        email: 'mock@example.com',
        displayName: 'Mock User',
        photoURL: null
      };
      
      // Notify all listeners
      authListeners.forEach(listener => listener(mockCurrentUser));
      console.log('[Firebase Mock] Mock sign in completed:', mockCurrentUser.email);
      
      return { user: mockCurrentUser };
    },
    signOut: async () => {
      console.log('[Firebase Mock] Mock sign out');
      mockCurrentUser = null;
      authListeners.forEach(listener => listener(null));
      return Promise.resolve();
    }
  };

  // Mock firestore with consistent API
  firestore = {
    collection: createMockCollection,
    FieldValue: {
      serverTimestamp: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })
    }
  };

  // Mock database
  database = {
    ref: (path?: string) => ({
      on: (event: string, callback: (snapshot: any) => void) => {
        console.log(`[Firebase Mock] Setting up database listener for ${path}`);
        setTimeout(() => callback({ val: () => null }), 100);
      },
      off: (event: string, callback?: (snapshot: any) => void) => {
        console.log(`[Firebase Mock] Removing database listener for ${path}`);
      },
      set: async (value: any) => {
        console.log(`[Firebase Mock] Setting database value at ${path}:`, value);
      },
      remove: async () => {
        console.log(`[Firebase Mock] Removing database value at ${path}`);
      }
    })
  };

  // Mock storage
  storage = {
    ref: (path?: string) => ({
      put: async (blob: Blob) => {
        console.log(`[Firebase Mock] Uploading to ${path}`);
        return { ref: { getDownloadURL: async () => `mock://uploaded-${Date.now()}` } };
      },
      getDownloadURL: async () => `mock://download-${Date.now()}`
    })
  };

} else {
  // React Native Firebase v22+ - proper initialization
  console.log('[Firebase] Setting up React Native Firebase v22+');
  
  try {
    console.log('[Firebase] Importing React Native Firebase modules...');
    
    // Import Firebase modules
    const RNFirebaseApp = require('@react-native-firebase/app');
    const RNFirebaseAuth = require('@react-native-firebase/auth');  
    const RNFirebaseFirestore = require('@react-native-firebase/firestore');
    const RNFirebaseDatabase = require('@react-native-firebase/database');
    const RNFirebaseStorage = require('@react-native-firebase/storage');
    
    console.log('[Firebase] Modules imported successfully');
    
    // React Native Firebase auto-detects configuration from google-services.json
    // We should use the default app which is automatically initialized
    let app;
    try {
      // Get the default app (should be auto-initialized from google-services.json)
      app = RNFirebaseApp.getApp();
      console.log('[Firebase] Using default app (auto-configured):', app.name);
    } catch (error) {
      console.log('[Firebase] Default app not found, this should not happen with proper setup');
      // Fallback: initialize manually (e.g. when the native files were cleaned or when running a fresh dev-client).
      // We pass the explicit firebaseConfig so that the SDK has all the required
      // keys even when google-services files are missing or have not been linked yet.
      // This removes the "No Firebase App '[DEFAULT]' has been created" / "Firebase not initialised" runtime errors
      // that occasionally occur when the default app can not be detected automatically.
      app = RNFirebaseApp.initializeApp(firebaseConfig);
      console.log('[Firebase] Initialized default app manually with explicit config');
    }
    
    firebaseApp = app;
    console.log('[Firebase] Using app:', firebaseApp.name);
    console.log('[Firebase] App options:', app.options);
    console.log('[Firebase] Storage bucket from app:', app.options?.storageBucket);
    
    // Initialize services with the app instance
    const rawAuth = RNFirebaseAuth.getAuth(app);
    console.log('[Firebase] Auth instance created');
    
    const rawFirestore = RNFirebaseFirestore.getFirestore(app);
    console.log('[Firebase] Firestore instance created');
    
    const rawDatabase = RNFirebaseDatabase.getDatabase(app);
    console.log('[Firebase] Database instance created');
    
    const rawStorage = RNFirebaseStorage.getStorage(app);
    console.log('[Firebase] Storage instance created');
    console.log('[Firebase] Storage app details:', {
      appName: rawStorage.app.name,
      appOptions: rawStorage.app.options,
      storageBucket: rawStorage.app.options?.storageBucket
    });
    
    console.log('[Firebase] All services initialized successfully');
    
    // Wrap services with unified API
    auth = {
      currentUser: rawAuth.currentUser,
      onAuthStateChanged: rawAuth.onAuthStateChanged.bind(rawAuth),
      signInWithCredential: rawAuth.signInWithCredential.bind(rawAuth),
      signOut: rawAuth.signOut.bind(rawAuth),
      GoogleAuthProvider: RNFirebaseAuth.GoogleAuthProvider
    };

    // Wrap Firestore with unified API
    const wrapCollection = (collection: any): FirebaseCollectionReference => ({
      doc: (id?: string) => {
        const docRef = id ? collection.doc(id) : collection.doc();
        return wrapDocument(docRef);
      },
      add: async (data: any) => {
        const docRef = await collection.add(data);
        return wrapDocument(docRef);
      },
      where: (field: string, operator: any, value: any) => wrapQuery(collection.where(field, operator, value)),
      onSnapshot: (callback: (snapshot: FirebaseQuerySnapshot) => void) => {
        return collection.onSnapshot((snapshot: any) => {
          callback({
            docs: snapshot.docs.map((doc: any) => wrapDocumentSnapshot(doc)),
            forEach: (cb: (doc: FirebaseDocumentSnapshot) => void) => {
              snapshot.forEach((doc: any) => cb(wrapDocumentSnapshot(doc)));
            }
          });
        });
      }
    });

    const wrapDocument = (docRef: any): FirebaseDocumentReference => ({
      id: docRef.id,
      collection: (path: string) => wrapCollection(docRef.collection(path)),
      get: async () => {
        const snap = await docRef.get();
        return wrapDocumentSnapshot(snap);
      },
      set: docRef.set.bind(docRef),
      update: docRef.update.bind(docRef),
      delete: docRef.delete.bind(docRef),
      onSnapshot: (callback: (doc: FirebaseDocumentSnapshot) => void) => {
        return docRef.onSnapshot((doc: any) => callback(wrapDocumentSnapshot(doc)));
      }
    });

    const wrapDocumentSnapshot = (snap: any): FirebaseDocumentSnapshot => ({
      id: snap.id,
      exists: snap.exists.bind(snap),
      data: snap.data.bind(snap)
    });

    const wrapQuery = (query: any): FirebaseQuery => ({
      where: (field: string, operator: any, value: any) => wrapQuery(query.where(field, operator, value)),
      get: async () => {
        const snapshot = await query.get();
        return {
          docs: snapshot.docs.map((doc: any) => wrapDocumentSnapshot(doc)),
          forEach: (cb: (doc: FirebaseDocumentSnapshot) => void) => {
            snapshot.forEach((doc: any) => cb(wrapDocumentSnapshot(doc)));
          }
        };
      },
      onSnapshot: (callback: (snapshot: FirebaseQuerySnapshot) => void) => {
        return query.onSnapshot((snapshot: any) => {
          callback({
            docs: snapshot.docs.map((doc: any) => wrapDocumentSnapshot(doc)),
            forEach: (cb: (doc: FirebaseDocumentSnapshot) => void) => {
              snapshot.forEach((doc: any) => cb(wrapDocumentSnapshot(doc)));
            }
          });
        });
      }
    });

    firestore = {
      collection: (path: string) => wrapCollection(rawFirestore.collection(path)),
      FieldValue: RNFirebaseFirestore.FieldValue
    };

    database = {
      ref: (path?: string) => {
        const ref = path ? rawDatabase.ref(path) : rawDatabase.ref();
        return {
          on: ref.on.bind(ref),
          off: ref.off.bind(ref),
          set: ref.set.bind(ref),
          remove: ref.remove.bind(ref)
        };
      }
    };

    storage = {
      ref: (path?: string) => {
        // Try to explicitly specify the bucket if path is provided
        let ref;
        if (path) {
          try {
            // Try with explicit bucket reference
            ref = rawStorage.refFromURL(`gs://snapconnect-6108c.firebasestorage.app/${path}`);
            console.log('[Firebase] Created storage ref with explicit bucket URL for path:', path);
          } catch (urlError) {
            console.log('[Firebase] Fallback to standard ref for path:', path);
            ref = rawStorage.ref(path);
          }
        } else {
          ref = rawStorage.ref();
        }
        
        return {
          put: ref.put.bind(ref),
          getDownloadURL: ref.getDownloadURL.bind(ref)
        };
      }
    };
    
    // Validate auth instance
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      console.log('[Firebase] Auth instance validated successfully');
    } else {
      console.error('[Firebase] Auth instance validation failed - onAuthStateChanged not available');
      console.error('[Firebase] Available auth methods:', Object.keys(auth || {}));
    }
    
    console.log('[Firebase] All services wrapped with unified API');
    
  } catch (error: any) {
    console.error('[Firebase] Error initializing React Native Firebase:', error);
    console.error('[Firebase] Error details:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      name: error?.name || 'Unknown error type'
    });
    
    // Initialize with mock services as fallback
    auth = {
      currentUser: null,
      onAuthStateChanged: () => () => {},
      signInWithCredential: async () => ({ user: null }),
      signOut: async () => {},
    };
    firestore = {
      collection: () => createMockCollection('fallback'),
      FieldValue: { serverTimestamp: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }) }
    };
    database = { ref: () => ({ on: () => {}, off: () => {}, set: async () => {}, remove: async () => {} }) };
    storage = { ref: () => ({ put: async () => ({}), getDownloadURL: async () => 'fallback-url' }) };
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