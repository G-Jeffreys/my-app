import { create } from "zustand";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../lib/firebase";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialize: () => () => void; // Returns the unsubscribe function
  handleGoogleSignIn: (id_token: string | undefined) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log(
        "[Auth] Auth state changed:",
        firebaseUser ? firebaseUser.email : "signed out"
      );
      if (firebaseUser) {
        set({
          user: {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
          },
          loading: false,
        });
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
    set({ user: null });
    await firebaseSignOut(auth);
  },
  setUser: (user) => set({ user }),
}));

// Initialize auth listener on app load
useAuth.getState().initialize();