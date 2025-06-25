import { create } from "zustand";
import { Platform } from "react-native";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  hasHydrated: boolean;
  error: string | null;
  initializeAuth: () => Promise<void>;
}

// Store for auth instance
let authInstance: any = null;
let initialized = false;

// Function to get auth instance
const getAuth = async () => {
  if (!authInstance) {
    console.log('[Auth] Dynamically importing Firebase...');
    const { auth } = await import("../lib/firebase");
    authInstance = auth;
  }
  return authInstance;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  hasHydrated: false,
  error: null,
  
  initializeAuth: async () => {
    if (initialized) return;
    
    try {
      console.log('[Auth] Initializing authentication...');
      const auth = await getAuth();
      
      // Validate that auth is properly initialized
      if (!auth) {
        throw new Error('Auth instance is null or undefined');
      }
      
      if (typeof auth.onAuthStateChanged !== 'function') {
        throw new Error('auth.onAuthStateChanged is not a function - auth instance may be invalid');
      }
      
      console.log('[Auth] Auth instance validated, setting up listener...');
      
      // Set up auth state listener - correct v22+ pattern without extra parameters
      const unsubscribe = auth.onAuthStateChanged((user: any) => {
        console.log('[Auth] Auth state changed:', { user: user?.email });
        set({ 
          user: user ? {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
          } : null, 
          loading: false, 
          hasHydrated: true, 
          error: null 
        });
      });
      
      initialized = true;
      console.log('[Auth] Authentication initialized successfully');
      
      // Return cleanup function (though we won't use it in this case)
      return unsubscribe;
    } catch (error) {
      console.error('[Auth] Failed to initialize authentication:', error);
      set({ error: 'Failed to initialize authentication', loading: false });
    }
  },
  
  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const auth = await getAuth();
      
      if (Platform.OS === 'web') {
        // Web Google Sign-In (mock)
        console.log('[Auth] Starting Mock Web Google Sign-In...');
        const result = await auth.signInWithPopup();
        console.log('[Auth] Successfully signed in with Mock Firebase:', result.user.email);
        
        // Manually update the auth state since we're using a mock
        set({ 
          user: {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName
          }, 
          loading: false, 
          hasHydrated: true, 
          error: null 
        });
      } else {
        // Mobile Google Sign-In
        const {
          GoogleSignin,
          statusCodes,
          isSuccessResponse,
        } = require("@react-native-google-signin/google-signin");

        console.log('[Auth] Checking Google Sign-in configuration...');
        console.log('[Auth] getCurrentUser before sign-in...');
        
        try {
          const currentUser = await GoogleSignin.getCurrentUser();
          console.log('[Auth] Current user:', currentUser);
          if (currentUser) {
            console.log('[Auth] User already signed in, signing out first...');
            await GoogleSignin.signOut();
          }
        } catch (error) {
          console.log('[Auth] No current user or error getting current user:', error);
        }

        console.log('[Auth] Checking Play Services...');
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        
        console.log('[Auth] Starting Google Sign-In...');
        const signInResponse = await GoogleSignin.signIn();
        
        console.log('[Auth] Google Sign-In response:', {
          type: typeof signInResponse,
          hasData: !!signInResponse.data,
          dataKeys: signInResponse.data ? Object.keys(signInResponse.data) : 'no data'
        });
        
        if (!isSuccessResponse(signInResponse)) {
          console.error('[Auth] Invalid response from Google Sign-In:', signInResponse);
          throw new Error('Failed to get valid response from Google Sign-In');
        }
        
        if (!signInResponse.data.idToken) {
          console.error('[Auth] No ID token in response:', signInResponse.data);
          throw new Error("Google Sign-In failed to return an ID token");
        }

        console.log('[Auth] Got Google ID token, signing in with Firebase...');
        const googleCredential = auth.GoogleAuthProvider.credential(
          signInResponse.data.idToken
        );
        
        // Use the correct v22 pattern for signInWithCredential - no extra auth parameter needed
        const userCredential = await auth.signInWithCredential(googleCredential);
        console.log('[Auth] Successfully signed in with Firebase:', userCredential.user.email);
      }
    } catch (error: any) {
      console.error('[Auth] Sign-in error details:', {
        message: error.message,
        code: error.code,
        details: error.details || 'No details',
        stack: error.stack
      });
      
      let errorMessage = 'An unknown error occurred';
      
      if (Platform.OS !== 'web') {
        const { statusCodes } = require("@react-native-google-signin/google-signin");
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          errorMessage = 'Sign in was cancelled';
        } else if (error.code === statusCodes.IN_PROGRESS) {
          errorMessage = 'Sign in is already in progress';
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          errorMessage = 'Play services not available or outdated';
        } else if (error.message && error.message.includes('DEVELOPER_ERROR')) {
          errorMessage = 'Developer configuration error - check SHA-1 fingerprints in Firebase Console';
        } else if (error.message && error.message.includes('INTERNAL_ERROR')) {
          errorMessage = 'Internal Google Services error - check app configuration';
        }
      }
      
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },
  
  signOut: async () => {
    set({ loading: true, error: null });
    try {
      console.log('[Auth] Signing out...');
      const auth = await getAuth();
      
      if (Platform.OS === 'web') {
        await auth.signOut();
        // Manually update the auth state since we're using a mock
        set({ 
          user: null, 
          loading: false, 
          hasHydrated: true, 
          error: null 
        });
      } else {
        const { GoogleSignin } = require("@react-native-google-signin/google-signin");
        await GoogleSignin.signOut();
        // Use the correct v22 pattern for signOut - no extra auth parameter needed
        await auth.signOut();
      }
      console.log('[Auth] Successfully signed out');
    } catch (error) {
      console.error('[Auth] Sign-out error:', error);
      set({ error: 'Failed to sign out', loading: false });
      throw error;
    }
  },
}));