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
  isSigningIn: boolean;
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
  isSigningIn: false,
  error: null,
  initialize: () => {
    console.log('[Auth] Initializing web Firebase auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log(
        "[Auth] Auth state changed:",
        firebaseUser ? firebaseUser.email : "signed out"
      );
      
      if (firebaseUser) {
        console.log('[Auth] User authenticated, fetching user document from Firestore...');
        try {
          // Fetch the full user document from Firestore
          const userDocRef = doc(firestore, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('[Auth] ✅ User document found in Firestore');
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
              isSigningIn: false,
            });
          } else {
            // Fallback to Firebase Auth data if Firestore doc doesn't exist
            console.log('[Auth] No Firestore user document found, creating one...');
            
            // Create the user document in Firestore
            const newUserData = {
              id: firebaseUser.uid,
              displayName: firebaseUser.displayName || generateDefaultDisplayName(firebaseUser.email),
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
                isSigningIn: false,
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
                isSigningIn: false,
              });
            }
          }
        } catch (error) {
          console.error("[Auth] Error fetching user data from Firestore:", error);
          console.log('[Auth] Creating user document due to fetch error...');
          
          // Create user document in Firestore as fallback
          const fallbackUserData = {
            id: firebaseUser.uid,
            displayName: firebaseUser.displayName || generateDefaultDisplayName(firebaseUser.email),
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
            isSigningIn: false,
          });
        }
      } else {
        console.log('[Auth] User signed out');
        set({ user: null, loading: false, isSigningIn: false });
      }
    });
    return unsubscribe;
  },
  handleGoogleSignIn: async (id_token) => {
    console.log('[Auth] Google sign-in initiated with token:', id_token ? 'Present' : 'Missing');
    if (id_token) {
      set({ isSigningIn: true, loading: true, error: null });
      try {
        console.log('[Auth] Creating Google credential...');
        const credential = GoogleAuthProvider.credential(id_token);
        console.log('[Auth] Signing in with Google credential...');
        await signInWithCredential(auth, credential);
        console.log('[Auth] Google sign-in successful!');
      } catch (error: any) {
        console.error('[Auth] Google Firebase sign in error:', error);
        set({ loading: false, isSigningIn: false, error: "Failed to sign in with Google." });
      }
    } else {
      console.warn('[Auth] Google Sign-In was cancelled or failed - no id token');
      set({ loading: false, isSigningIn: false, error: "Google Sign-In was cancelled or failed." });
    }
  },
  handleGitHubSignIn: async (access_token) => {
    console.log('[Auth] GitHub sign-in initiated with token:', access_token ? 'Present' : 'Missing');
    if (access_token) {
      set({ isSigningIn: true, loading: true, error: null });
      try {
        console.log('[Auth] Creating GitHub credential...');
        const credential = GithubAuthProvider.credential(access_token);
        console.log('[Auth] Signing in with GitHub credential...');
        await signInWithCredential(auth, credential);
        console.log('[Auth] GitHub sign-in successful!');
      } catch (error: any) {
        console.error('[Auth] GitHub Firebase sign in error:', error);
        console.error('[Auth] Error details:', JSON.stringify(error, null, 2));
        set({ loading: false, isSigningIn: false, error: "Failed to sign in with GitHub." });
      }
    } else {
      console.warn('[Auth] GitHub Sign-In was cancelled or failed - no access token');
      set({ loading: false, isSigningIn: false, error: "GitHub Sign-In was cancelled or failed." });
    }
  },
  signOut: async () => {
    console.log('[Auth] Sign out initiated');
    try {
      set({ loading: true, error: null });
      await firebaseSignOut(auth);
      console.log('[Auth] Firebase sign out successful');
      set({ user: null, loading: false, isSigningIn: false, error: null });
    } catch (error: any) {
      console.error('[Auth] Sign out error:', error);
      set({ 
        loading: false, 
        isSigningIn: false,
        error: 'Failed to sign out. Please try again.' 
      });
      throw error;
    }
  },
  setUser: (user) => set({ user }),
}));

/**
 * Generate a default display name when Firebase Auth doesn't provide one
 * Uses the email username portion with proper capitalization
 */
function generateDefaultDisplayName(email: string | null): string {
  console.log('[Auth] Generating default display name for email:', email);
  
  if (!email) {
    const randomName = `User${Math.floor(Math.random() * 1000)}`;
    console.log('[Auth] No email provided, using random name:', randomName);
    return randomName;
  }

  // Extract username from email (before @)
  const username = email.split('@')[0];
  
  // Clean up common patterns and capitalize properly
  const cleanUsername = username
    .replace(/[._-]/g, ' ') // Replace dots, underscores, dashes with spaces
    .replace(/\d+/g, '') // Remove numbers
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
    .join(' ')
    .substring(0, 20); // Limit length

  const defaultName = cleanUsername || `User${Math.floor(Math.random() * 1000)}`;
  console.log('[Auth] Generated default display name:', defaultName, 'from email:', email);
  
  return defaultName;
}

// Note: Initialize auth listener manually in App.tsx after Firebase is ready