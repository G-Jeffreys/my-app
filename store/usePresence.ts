import { useEffect } from 'react';
import { ref, onValue, off, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { useAuth } from './useAuth';
import { rtdb } from '../config/firebase'; // We need to export rtdb from firebase config

export const usePresence = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }

    const myStatusRef = ref(rtdb, 'status/' + user.uid);

    // We'll create a reference to the special '.info/connected' path in 
    // Realtime Database. This path returns true when connected and false when not.
    const connectedRef = ref(rtdb, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // We're connected (or reconnected)! Set our status.
        set(myStatusRef, {
          isOnline: true,
          last_changed: serverTimestamp(),
        });

        // When this client disconnects, set their status to offline.
        onDisconnect(myStatusRef).set({
          isOnline: false,
          last_changed: serverTimestamp(),
        });
      }
    });

    return () => {
      off(connectedRef, 'value', unsubscribe);
    };
  }, [user]);
}; 