import { GoogleAuthProvider, signInWithCredential, onAuthStateChanged, User } from "firebase/auth";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { create } from "zustand";
import { auth } from "../config/firebase";
import { env } from "../env";
import { useEffect } from "react";

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  signInWithGoogle: async () => {
    set({ loading: true });
    const redirectUri = makeRedirectUri();
    const [request, , promptAsync] = useAuthRequest(
      {
        clientId: env.GOOGLE_IOS_CLIENT_ID,
        redirectUri,
        scopes: ["profile", "email"],
      },
      { authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth" }
    );
    const result = await promptAsync();
    if (result?.type === "success") {
      const { id_token } = result.params;
      const credential = GoogleAuthProvider.credential(id_token);
      await signInWithCredential(auth, credential);
    }
    set({ loading: false });
  },
  signOut: async () => {
    set({ loading: true });
    await auth.signOut();
    set({ user: null, loading: false });
  },
}));

// Initialize auth state
const unsub = onAuthStateChanged(auth, (user) => {
  useAuth.setState({ user, loading: false });
  unsub();
});
