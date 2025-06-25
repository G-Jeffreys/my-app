import "../global.css";
import { Slot } from "expo-router";
import { useAuth } from "../store/useAuth";
import { ActivityIndicator, View } from "react-native";
import { usePresence } from "../store/usePresence";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from 'react';

export default function RootLayout() {
  const { loading, initialize } = useAuth();
  usePresence(); // Initialize presence hook

  useEffect(() => {
    console.log('[RootLayout] Initializing auth listener');
    const unsubscribe = initialize();
    return () => {
      console.log('[RootLayout] Cleaning up auth listener');
      unsubscribe();
    };
  }, [initialize]);

  if (loading) {
    console.log('[RootLayout] Loading auth state...');
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  console.log('[RootLayout] Auth loaded, rendering app');
  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
