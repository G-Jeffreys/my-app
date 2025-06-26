import { create } from "zustand";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, firestore } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { User } from "../models/firestore/user";
import { DEFAULT_TTL_PRESET } from "../config/messaging";

interface AuthState {
  user: (User & { uid: string }) | null; // Keep uid for backward compatibility
  loading: boolean;
  error: string | null;
  initialize: () => () => void; // Returns the unsubscribe function
  handleGoogleSignIn: (id_token: string | undefined) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: (User & { uid: string }) | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(
        "[Auth] Auth state changed:",
        firebaseUser ? firebaseUser.email : "signed out"
      );
      if (firebaseUser) {
        try {
          // Fetch the full user document from Firestore
          const userDocRef = doc(firestore, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            set({
              user: {
                id: firebaseUser.uid,
                uid: firebaseUser.uid, // Keep for backward compatibility
                email: firebaseUser.email,
                displayName: userData.displayName || firebaseUser.displayName || "",
                photoURL: userData.photoURL || firebaseUser.photoURL,
                createdAt: userData.createdAt,
                defaultTtl: userData.defaultTtl || DEFAULT_TTL_PRESET,
              } as User & { uid: string }, // Add uid for compatibility
              loading: false,
            });
          } else {
            // Fallback to Firebase Auth data if Firestore doc doesn't exist
            set({
              user: {
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || "",
                photoURL: firebaseUser.photoURL,
                createdAt: new Date(),
                defaultTtl: DEFAULT_TTL_PRESET,
              } as User & { uid: string },
              loading: false,
            });
          }
        } catch (error) {
          console.error("[Auth] Error fetching user data from Firestore:", error);
          // Fallback to Firebase Auth data
          set({
            user: {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || "",
              photoURL: firebaseUser.photoURL,
              createdAt: new Date(),
              defaultTtl: DEFAULT_TTL_PRESET,
            } as User & { uid: string },
            loading: false,
          });
        }
      } else {
        set({ user: null, loading: false });
      }
    });
    return unsubscribe;
  },
  handleGoogleSignIn: async (id_token) => {
    if (id_token) {
      set({ loading: true, error: null });
      try {
        const credential = GoogleAuthProvider.credential(id_token);
        await signInWithCredential(auth, credential);
        set({ loading: false });
      } catch (e: any) {
        console.error("Firebase sign in error", e);
        set({ loading: false, error: "Failed to sign in with Google." });
      }
    } else {
      set({ loading: false, error: "Google Sign-In was cancelled or failed." });
    }
  },
  signOut: async () => {
    console.log('[Auth] Sign out initiated');
    try {
      set({ loading: true, error: null });
      await firebaseSignOut(auth);
      console.log('[Auth] Firebase sign out successful');
      set({ user: null, loading: false, error: null });
    } catch (error: any) {
      console.error('[Auth] Sign out error:', error);
      set({ 
        loading: false, 
        error: 'Failed to sign out. Please try again.' 
      });
      throw error; // Re-throw so calling component can handle
    }
  },
  setUser: (user) => set({ user }),
}));

// Initialize auth listener on app load
useAuth.getState().initialize();