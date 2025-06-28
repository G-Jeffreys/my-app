import { create } from "zustand";
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, firestore } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User } from "../models/firestore/user";
import { DEFAULT_TTL_PRESET } from "../config/messaging";

interface AuthState {
  user: (User & { uid: string }) | null;
  loading: boolean;
  error: string | null;
  initialize: () => () => void;
  handleGoogleSignIn: (id_token: string | undefined) => Promise<void>;
  handleGitHubSignIn: (access_token: string | undefined) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: (User & { uid: string }) | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  initialize: () => {
    console.log('[Auth] Initializing web Firebase auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
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
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: userData?.displayName || firebaseUser.displayName || "",
                photoURL: userData?.photoURL || firebaseUser.photoURL,
                createdAt: userData?.createdAt,
                defaultTtl: userData?.defaultTtl || DEFAULT_TTL_PRESET,
              } as User & { uid: string },
              loading: false,
            });
          } else {
            // Fallback to Firebase Auth data if Firestore doc doesn't exist
            console.log('[Auth] No Firestore user document found, creating one...');
            
            // Create the user document in Firestore
            const newUserData = {
              id: firebaseUser.uid,
              displayName: firebaseUser.displayName || "",
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
              createdAt: new Date(),
              defaultTtl: DEFAULT_TTL_PRESET,
            };
            
            try {
              // Create the user document in Firestore
              await setDoc(userDocRef, newUserData);
              console.log('[Auth] ✅ Created new user document in Firestore for:', firebaseUser.email);
              
              set({
                user: {
                  ...newUserData,
                  uid: firebaseUser.uid,
                } as User & { uid: string },
                loading: false,
              });
            } catch (createError) {
              console.error('[Auth] ❌ Failed to create user document:', createError);
              // Still set user state with fallback data even if Firestore creation fails
              set({
                user: {
                  ...newUserData,
                  uid: firebaseUser.uid,
                } as User & { uid: string },
                loading: false,
              });
            }
          }
        } catch (error) {
          console.error("[Auth] Error fetching user data from Firestore:", error);
          console.log('[Auth] Creating user document due to fetch error...');
          
          // Create user document in Firestore as fallback
          const fallbackUserData = {
            id: firebaseUser.uid,
            displayName: firebaseUser.displayName || "",
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            createdAt: new Date(),
            defaultTtl: DEFAULT_TTL_PRESET,
          };
          
          try {
            const userDocRef = doc(firestore, "users", firebaseUser.uid);
            await setDoc(userDocRef, fallbackUserData);
            console.log('[Auth] ✅ Created user document after fetch error for:', firebaseUser.email);
          } catch (createError) {
            console.error('[Auth] ❌ Failed to create user document after fetch error:', createError);
          }
          
          // Set user state regardless of Firestore creation success
          set({
            user: {
              ...fallbackUserData,
              uid: firebaseUser.uid,
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
      } catch (error: any) {
        console.error("Firebase sign in error", error);
        set({ loading: false, error: "Failed to sign in with Google." });
      }
    } else {
      set({ loading: false, error: "Google Sign-In was cancelled or failed." });
    }
  },
  handleGitHubSignIn: async (access_token) => {
    console.log('[Auth] GitHub sign-in initiated with token:', access_token ? 'Present' : 'Missing');
    if (access_token) {
      set({ loading: true, error: null });
      try {
        console.log('[Auth] Creating GitHub credential...');
        const credential = GithubAuthProvider.credential(access_token);
        console.log('[Auth] Signing in with GitHub credential...');
        await signInWithCredential(auth, credential);
        console.log('[Auth] GitHub sign-in successful!');
        set({ loading: false });
      } catch (error: any) {
        console.error('[Auth] GitHub Firebase sign in error:', error);
        console.error('[Auth] Error details:', JSON.stringify(error, null, 2));
        set({ loading: false, error: "Failed to sign in with GitHub." });
      }
    } else {
      console.warn('[Auth] GitHub Sign-In was cancelled or failed - no access token');
      set({ loading: false, error: "GitHub Sign-In was cancelled or failed." });
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
      throw error;
    }
  },
  setUser: (user) => set({ user }),
}));

// Note: Initialize auth listener manually in App.tsx after Firebase is ready