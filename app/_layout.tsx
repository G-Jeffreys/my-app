import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "../store/useAuth";
import { ActivityIndicator, View } from "react-native";
import { usePresence } from "../store/usePresence";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { env } from '../env';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '435345795137-eglsicllj19cur60udu62gnc97d8hh31.apps.googleusercontent.com', // From google-services.json
  iosClientId: env.GOOGLE_IOS_CLIENT_ID, // From GoogleService-Info.plist
});

export default function RootLayout() {
  const { loading, user, initializeAuth } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  usePresence(); // Initialize presence hook

  useEffect(() => {
    // Initialize auth when the app starts
    initializeAuth();
  }, []);

  useEffect(() => {
    console.log('[Navigation] Current segments:', segments);
    console.log('[Auth] User state:', { loading, user: user?.email });
    
    if (loading) return;

    if (!user) {
      console.log('[Navigation] Unauthenticated user, redirecting to login');
      router.replace('/(auth)/login');
    } else if (segments[0] !== '(protected)') {
      console.log('[Navigation] Authenticated user, redirecting to home');
      router.replace('/(protected)/home');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
