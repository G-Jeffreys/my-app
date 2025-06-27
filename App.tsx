import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text } from 'react-native';
import { Slot } from 'expo-router';
import '../global.css';

// Initialize Firebase on app startup
import { firebaseApp } from './lib/firebase';
import { useAuth } from './store/useAuth';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const authUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    console.log('[App] Starting app initialization...');
    
    // Wait a moment for Firebase to initialize
    const initTimer = setTimeout(() => {
      try {
        console.log('[App] Checking Firebase initialization...');
        console.log('[App] Firebase app instance:', firebaseApp);
        
        if (firebaseApp) {
          console.log('[App] Firebase initialized successfully');
          
          // Initialize auth listener now that Firebase is ready
          console.log('[App] Initializing auth listener...');
          const unsubscribe = useAuth.getState().initialize();
          authUnsubscribeRef.current = unsubscribe;
          
          setIsInitialized(true);
        } else {
          console.log('[App] Firebase app instance not found, but continuing...');
          setIsInitialized(true);
        }
      } catch (error: any) {
        console.error('[App] Firebase initialization error:', error);
        setInitError(error?.message || 'Firebase initialization failed');
        // Still allow app to continue with fallback services
        setIsInitialized(true);
      }
    }, 1000);

    // Cleanup function
    return () => {
      clearTimeout(initTimer);
      if (authUnsubscribeRef.current) {
        console.log('[App] Cleaning up auth listener');
        authUnsubscribeRef.current();
        authUnsubscribeRef.current = null;
      }
    };
  }, []);

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#ffffff' 
      }}>
        <Text style={{ fontSize: 18, marginBottom: 10 }}>Initializing SnapConnect...</Text>
        <Text style={{ fontSize: 14, color: '#666' }}>Setting up Firebase services</Text>
      </View>
    );
  }

  console.log('[App] App initialization complete, rendering main app');

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
      {/* Show error overlay if Firebase failed but app continues */}
      {initError && Platform.OS !== 'web' && (
        <View style={{
          position: 'absolute',
          top: 50,
          left: 10,
          right: 10,
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          padding: 10,
          borderRadius: 5,
          zIndex: 1000
        }}>
          <Text style={{ color: 'red', fontSize: 12 }}>
            Firebase Warning: {initError}
          </Text>
          <Text style={{ color: 'red', fontSize: 10, marginTop: 5 }}>
            App running with fallback services
          </Text>
        </View>
      )}
    </>
  );
}
