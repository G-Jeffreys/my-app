import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useAuth } from '../../store/useAuth';
import { firestore } from '../../lib/firebase';
import { ANALYTICS_EVENTS, logEvent } from '../../lib/analytics';
import Header from '../../components/Header';

const TTL_PRESETS = ['30s', '1m', '5m', '1h', '6h', '24h'];

// Retry function with exponential backoff
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      console.log(`[Settings] Attempt ${attempt} failed:`, error?.code || error?.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Check if it's a retryable error
      if (error?.code === 'firestore/unavailable' || 
          error?.code === 'firestore/deadline-exceeded' ||
          error?.message?.includes('network')) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[Settings] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Non-retryable error, throw immediately
        throw error;
      }
    }
  }
};

const SettingsScreen = () => {
  const { user } = useAuth();
  const [defaultTtl, setDefaultTtl] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserSettings = async () => {
      if (!user) {
        console.log('[Settings] No user available, skipping settings fetch');
        return;
      }
      
      console.log('[Settings] Fetching user settings for user:', user.uid);
      console.log('[Settings] User object:', { uid: user.uid, email: user.email, displayName: user.displayName });
      
      try {
        setFirestoreError(null);
        
        // Validate firestore instance
        if (!firestore) {
          console.error('[Settings] Firestore instance is null or undefined');
          setFirestoreError('Firestore not available');
          return;
        }
        
        console.log('[Settings] Firestore instance is available, creating user reference');
        
        const fetchOperation = async () => {
          // Use unified Firebase API
          const userRef = firestore.collection('users').doc(user.uid);
          console.log('[Settings] User reference created, fetching document');
          
          const userSnap = await userRef.get();
          console.log('[Settings] Document fetch complete, exists:', userSnap.exists());
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log('[Settings] User data:', userData);
            
            if (userData?.defaultTtl) {
              const ttl = userData.defaultTtl;
              console.log('[Settings] Found saved default TTL:', ttl);
              setDefaultTtl(ttl);
            } else {
              console.log('[Settings] No saved TTL found in user data, using default 1h');
              setDefaultTtl('1h');
            }
          } else {
            console.log('[Settings] User document does not exist, using default 1h');
            setDefaultTtl('1h');
          }
        };
        
        await retryWithBackoff(fetchOperation);
        
      } catch (error: any) {
        console.error('[Settings] Error fetching user settings:', error);
        console.error('[Settings] Error details:', {
          message: error?.message || 'Unknown error',
          code: error?.code || 'No error code',
          stack: error?.stack || 'No stack trace'
        });
        
        if (error?.code === 'firestore/unavailable') {
          setFirestoreError('Firestore service is not enabled. Please enable Cloud Firestore in Firebase Console.');
        } else {
          setFirestoreError('Unable to load settings');
        }
        
        setDefaultTtl('1h'); // Fallback to default
      }
    };
    fetchUserSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) {
      console.error('[Settings] No user available for saving settings');
      Alert.alert('Error', 'No user is logged in. Please log in and try again.');
      return;
    }
    
    console.log('[Settings] Starting save process...');
    console.log('[Settings] User:', { uid: user.uid, email: user.email, displayName: user.displayName });
    console.log('[Settings] Saving default TTL:', defaultTtl);
    
    // Validate TTL value
    if (!TTL_PRESETS.includes(defaultTtl)) {
      console.error('[Settings] Invalid TTL value:', defaultTtl);
      Alert.alert('Error', 'Invalid TTL value selected. Please select a valid option.');
      return;
    }
    
    setLoading(true);
    setFirestoreError(null);
    
    try {
      // Validate firestore instance
      if (!firestore) {
        throw new Error('Firestore instance is not available');
      }
      
      console.log('[Settings] Firestore instance validated, creating user reference');
      
      const saveOperation = async () => {
        // Use unified Firebase API
        const userRef = firestore.collection('users').doc(user.uid);
        console.log('[Settings] User reference created for:', user.uid);
        
        // Check if user document exists first
        console.log('[Settings] Checking if user document exists...');
        const userSnap = await userRef.get();
        console.log('[Settings] Document exists check complete, exists:', userSnap.exists());
        
        if (userSnap.exists()) {
          console.log('[Settings] Document exists, updating with defaultTtl...');
          
          // Update existing document
          await userRef.update({ 
            defaultTtl,
            updatedAt: firestore.FieldValue.serverTimestamp()
          });
          console.log('[Settings] ✅ Successfully updated existing user document with TTL:', defaultTtl);
        } else {
          console.log('[Settings] Document does not exist, creating new document...');
          
          // Create new document with user data
          const newUserData = {
            id: user.uid,
            email: user.email,
            displayName: user.displayName,
            defaultTtl,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp()
          };
          
          console.log('[Settings] Creating document with data:', newUserData);
          await userRef.set(newUserData);
          console.log('[Settings] ✅ Successfully created new user document with TTL:', defaultTtl);
        }
      };
      
      await retryWithBackoff(saveOperation);
      
      console.log('[Settings] 🎉 Save operation completed successfully!');
      Alert.alert('Success', `Default TTL saved as ${defaultTtl}! 🎉`);
      
      // Log analytics event
      try {
        await logEvent(ANALYTICS_EVENTS.TTL_SELECTED, { 
          ttl: defaultTtl, 
          screen: 'settings',
          action: 'save_default'
        });
        console.log('[Settings] Analytics event logged successfully');
      } catch (analyticsError) {
        console.warn('[Settings] Failed to log analytics event:', analyticsError);
      }
      
    } catch (error: any) {
      console.error('[Settings] ❌ Error saving settings:', error);
      console.error('[Settings] Error details:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'No error code',
        stack: error?.stack || 'No stack trace',
        name: error?.name || 'Unknown error type'
      });
      
      // Provide more specific error messages
      let errorMessage = 'Could not save settings. Please try again.';
      
      if (error?.code === 'firestore/unavailable') {
        errorMessage = '🚨 FIRESTORE NOT ENABLED: Please enable Cloud Firestore in Firebase Console first, then try again.';
        setFirestoreError('Firestore service is not enabled');
      } else if (error?.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check your authentication and try again.';
      } else if (error?.code === 'unavailable') {
        errorMessage = 'Service unavailable. Please check your internet connection and try again.';
      } else if (error?.message?.includes('offline')) {
        errorMessage = 'You appear to be offline. Please check your internet connection and try again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Header title="Settings" showBackButton={true} />
      
      <View style={styles.container}>
        {firestoreError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {firestoreError}</Text>
            <Text style={styles.errorInstructions}>
              Please enable Cloud Firestore in Firebase Console
            </Text>
          </View>
        )}
        
        <Text style={styles.label}>Default Snap TTL</Text>
        <View style={styles.ttlContainer}>
          {TTL_PRESETS.map((ttl) => (
            <TouchableOpacity
              key={ttl}
              style={[styles.ttlButton, defaultTtl === ttl && styles.ttlButtonSelected]}
              onPress={() => {
                console.log('[Settings] TTL button pressed:', ttl);
                setDefaultTtl(ttl);
                logEvent(ANALYTICS_EVENTS.TTL_SELECTED, { ttl, screen: 'settings' });
              }}
            >
              <Text style={styles.ttlButtonText}>{ttl}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={loading || !!firestoreError} 
          style={[
            styles.saveButton, 
            (loading || !!firestoreError) && styles.saveButtonDisabled
          ]}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : firestoreError ? 'Enable Firestore First' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#d32f2f',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  errorInstructions: {
    color: '#666',
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
  },
  ttlContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 30,
  },
  ttlButton: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    margin: 5,
  },
  ttlButtonSelected: {
    backgroundColor: '#007BFF',
  },
  ttlButtonText: {
    color: 'black',
  },
  saveButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SettingsScreen; 