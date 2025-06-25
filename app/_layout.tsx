import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "../store/useAuth";
import { ActivityIndicator, View } from "react-native";
import { usePresence } from "../store/usePresence";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from 'react';

export default function RootLayout() {
  const { user, loading, initialize } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  usePresence(); // Initialize presence hook

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

  useEffect(() => {
    const unsubscribe = initialize();
    return () => unsubscribe();
  }, [initialize]);

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
