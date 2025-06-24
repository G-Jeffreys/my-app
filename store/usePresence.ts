import { useEffect } from 'react';
import { Platform } from 'react-native';
import { database } from '../lib/firebase';
import { useAuth } from './useAuth';

export const usePresence = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      console.log('[Presence] No user, skipping presence setup');
      return;
    }

    console.log('[Presence] Setting up presence for user:', user.uid);

    if (Platform.OS === 'web') {
      // For web, we'll use our mock database
      console.log('[Presence] Using mock presence for web');
      // Mock presence doesn't need real functionality for development
      return;
    }

    // For mobile, use actual Firebase Realtime Database
    try {
      const myStatusRef = database.ref('status/' + user.uid);

      // We'll create a reference to the special '.info/connected' path in 
      // Realtime Database. This path returns true when connected and false when not.
      const connectedRef = database.ref('.info/connected');

      const unsubscribe = connectedRef.on('value', (snap: any) => {
        if (snap.val() === true) {
          console.log('[Presence] Connected to Firebase, setting online status');
          // We're connected (or reconnected)! Set our status.
          myStatusRef.set({
            isOnline: true,
            last_changed: database.ServerValue.TIMESTAMP,
          });

          // When this client disconnects, set their status to offline.
          myStatusRef.onDisconnect().set({
            isOnline: false,
            last_changed: database.ServerValue.TIMESTAMP,
          });
        } else {
          console.log('[Presence] Disconnected from Firebase');
        }
      });

      return () => {
        console.log('[Presence] Cleaning up presence listeners');
        connectedRef.off('value', unsubscribe);
      };
    } catch (error) {
      console.error('[Presence] Error setting up presence:', error);
    }
  }, [user]);
}; 