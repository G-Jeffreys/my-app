import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { database } from '../lib/firebase';
import { useAuth } from './useAuth';

export const usePresence = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      console.log('[Presence] No user, skipping presence setup');
      return;
    }

    console.log('[Presence] Presence temporarily disabled - to enable, create Firebase Realtime Database');
    return; // Temporarily disable presence functionality

    // UNCOMMENT BELOW WHEN FIREBASE REALTIME DATABASE IS CREATED
    /*
    console.log('[Presence] Setting up presence for user:', user.uid);

    if (Platform.OS === 'web') {
      // For web, we'll use our mock database
      console.log('[Presence] Using mock presence for web');
      // Mock presence doesn't need real functionality for development
      return;
    }

    // Check if database is properly initialized
    if (!database) {
      console.error('[Presence] Firebase database not initialized');
      return;
    }

    // For mobile, use actual Firebase Realtime Database with v9+ API
    try {
      console.log('[Presence] Setting up Firebase Realtime Database presence...');
      
      // Create references using the new v9+ API
      const myStatusRef = ref(database, `status/${user.uid}`);
      const connectedRef = ref(database, '.info/connected');

      console.log('[Presence] Database references created successfully');

      // Listen for connection status changes
      const unsubscribe = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          console.log('[Presence] Connected to Firebase, setting online status');
          
          // Set online status
          set(myStatusRef, {
            isOnline: true,
            last_changed: serverTimestamp(),
            email: user.email,
          }).then(() => {
            console.log('[Presence] Online status set successfully');
          }).catch((error) => {
            console.error('[Presence] Error setting online status:', error);
          });

          // Set up offline status for when this client disconnects
          onDisconnect(myStatusRef).set({
            isOnline: false,
            last_changed: serverTimestamp(),
            email: user.email,
          }).then(() => {
            console.log('[Presence] Offline disconnect handler set successfully');
          }).catch((error) => {
            console.error('[Presence] Error setting disconnect handler:', error);
          });
        } else {
          console.log('[Presence] Disconnected from Firebase');
        }
      }, (error) => {
        console.error('[Presence] Error listening to connection status:', error);
      });

      return () => {
        console.log('[Presence] Cleaning up presence listeners');
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } catch (error) {
      console.error('[Presence] Error setting up presence:', error);
      console.error('[Presence] Error details:', JSON.stringify(error, null, 2));
    }
    */
  }, [user]);
}; 