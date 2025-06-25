import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { firestore, storage } from '../../lib/firebase';
import { useAuth } from '../../store/useAuth';
import { ANALYTICS_EVENTS, logEvent } from '../../lib/analytics';
import Header from '../../components/Header';

// Import Video component for mobile platforms
let Video: any = null;
if (Platform.OS !== 'web') {
  try {
    const VideoModule = require('react-native-video');
    Video = VideoModule.default || VideoModule;
    console.log('[Preview] Video module loaded successfully');
  } catch (error) {
    console.error('[Preview] Failed to load Video module:', error);
  }
}

const TTL_PRESETS = ['30s', '1m', '5m', '1h', '6h', '24h'];

console.log('🔥 BUNDLE VERSION', Date.now());

const PreviewScreen = () => {
  const { uri, mediaType, recipientId, recipientName, readonly } = useLocalSearchParams<{ uri: string; mediaType: 'photo' | 'video' | 'image', recipientId?: string, recipientName?: string, readonly?: string }>();
  const { user } = useAuth();
  const [selectedTtl, setSelectedTtl] = useState('1h');
  const [videoError, setVideoError] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Track image loading failures so we can show a fallback instead of a blank screen
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const fetchDefaultTtl = async () => {
      if (!user) {
        console.log('[Preview] No user available, skipping default TTL fetch');
        return;
      }
      
      console.log('[Preview] Fetching default TTL for user:', user.uid);
      
      try {
        // Validate firestore instance
        if (!firestore) {
          console.error('[Preview] Firestore instance is null or undefined');
          return;
        }
        
        // Use unified Firebase API
        const userRef = firestore.collection('users').doc(user.uid);
        console.log('[Preview] Created user reference, fetching document...');
        
        const userSnap = await userRef.get();
        console.log('[Preview] Document fetch complete, exists:', userSnap.exists());
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('[Preview] User data found:', userData);
          
          if (userData?.defaultTtl) {
            setSelectedTtl(userData.defaultTtl);
            console.log('[Preview] ✅ Using saved default TTL:', userData.defaultTtl);
          } else {
            console.log('[Preview] No defaultTtl field found in user data, using default 1h');
          }
        } else {
          console.log('[Preview] User document does not exist, using default 1h');
        }
      } catch (error: any) {
        console.error('[Preview] Error fetching default TTL:', error);
        console.error('[Preview] Error details:', {
          message: error?.message || 'Unknown error',
          code: error?.code || 'No error code'
        });
      }
    };
    fetchDefaultTtl();
  }, [user]);

  const handleSend = async () => {
    console.log('[Preview] Send button pressed');
    console.log('[Preview] Current state:', { uri, user: !!user, mediaType, recipientId, recipientName });
    
    if (!uri || !user || !mediaType || !recipientId) {
      console.error('[Preview] Missing required data for sending:', {
        hasUri: !!uri,
        hasUser: !!user,
        hasMediaType: !!mediaType,
        hasRecipientId: !!recipientId
      });
      Alert.alert('Error', 'Missing required information to send message');
      return;
    }

    setIsSending(true);

    try {
      console.log(`[Preview] Starting to upload ${mediaType}...`);
      
      // Handle mock URIs differently
      if (uri.startsWith('mock://')) {
        console.log('[Preview] Detected mock URI, creating mock message...');
        
        // For mock media, create a message without actual file upload
        await firestore.collection('messages').add({
          senderId: user.uid,
          recipientId: recipientId,
          mediaURL: uri, // Keep the mock URI for testing
          mediaType: mediaType,
          ttlPreset: selectedTtl,
          sentAt: firestore.FieldValue.serverTimestamp(),
        });
        
        console.log('[Preview] Mock message document created successfully');
        
        await logEvent(ANALYTICS_EVENTS.MEDIA_SENT, {
          mediaType: `mock_${mediaType}`,
          ttl: selectedTtl,
          recipientId,
        });
        
        Alert.alert('Success', 'Mock message sent successfully!');
        router.replace('/(protected)/home');
        return;
      }
      
      // Handle real file upload
      console.log('[Preview] Uploading real media file...');
      
      // Validate Firebase storage
      if (!storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      console.log('[Preview] Storage instance confirmed, testing storage bucket access...');
      
      // Log current user for debugging
      console.log('[Preview] Current user ID:', user.uid);
      console.log('[Preview] User auth state:', {
        uid: user.uid,
        email: user.email || 'no email'
      });
      
      // Fetch the file and create blob
      console.log('[Preview] Fetching file from URI:', uri);
      const response = await fetch(uri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('[Preview] File blob created, size:', blob.size, 'type:', blob.type);
      
      if (blob.size === 0) {
        throw new Error('File is empty or could not be read');
      }

      // Create storage reference with proper file extension
      const fileName = `${Date.now()}_${mediaType}.${mediaType === 'photo' ? 'jpg' : 'mp4'}`;
      const filePath = `media/${user.uid}/${fileName}`;
      
      console.log('[Preview] Creating storage reference for path:', filePath);
      console.log('[Preview] User authenticated:', !!user.uid);
      console.log('[Preview] Storage bucket info available');
      
      // Test if we can create a reference to the bucket root first
      try {
        const rootRef = storage.ref();
        console.log('[Preview] Root storage reference created successfully');
        
        // Test access to user's media folder
        const userMediaRef = storage.ref(`media/${user.uid}`);
        console.log('[Preview] User media folder reference created successfully');
        
        // Try to get the actual bucket name being used
        console.log('[Preview] Testing storage bucket access...');
        console.log('[Preview] Storage reference details:', {
          rootRef: typeof rootRef,
          userMediaRef: typeof userMediaRef,
          hasGetDownloadURL: typeof rootRef.getDownloadURL,
          hasPut: typeof rootRef.put
        });
      } catch (rootError) {
        console.error('[Preview] Failed to create storage references:', rootError);
        throw new Error('Storage bucket not accessible');
      }
      
      const storageRef = storage.ref(filePath);
      console.log('[Preview] Storage reference created for path:', filePath);
      
      // Upload file with metadata
      console.log('[Preview] Starting file upload...');
      console.log('[Preview] Upload metadata:', {
        contentType: blob.type,
        size: blob.size,
        customMetadata: {
          uploadedBy: user.uid,
          mediaType: mediaType,
          originalFileName: fileName
        }
      });
      
      let downloadURL: string | undefined;
      
      try {
        // Upload the file
        console.log('[Preview] Uploading file...');
        console.log('[Preview] File details:', {
          size: blob.size,
          type: blob.type,
          path: filePath,
          userUid: user.uid
        });
        
        const uploadSnapshot = await storageRef.put(blob);
        
        console.log('[Preview] Upload completed successfully');
        console.log('[Preview] Upload metadata:', uploadSnapshot.metadata);

        // Prefer the snapshot's ref (if available). Some RN-Firebase versions
        // omit this property, in which case fall back to the original storageRef.
        if ((uploadSnapshot as any)?.ref?.getDownloadURL) {
          downloadURL = await (uploadSnapshot as any).ref.getDownloadURL();
          console.log('[Preview] Download URL obtained via snapshot.ref:', downloadURL);
        } else {
          console.warn('[Preview] uploadSnapshot.ref undefined – falling back to storageRef.getDownloadURL()');
          downloadURL = await storageRef.getDownloadURL();
          console.log('[Preview] Download URL obtained via storageRef:', downloadURL);
        }
        
        // Firebase Storage already returns properly encoded URLs
        // The URL normalization code was causing double-encoding issues
        console.log('[Preview] Using download URL as-is from Firebase Storage:', downloadURL);
        
      } catch (uploadError: any) {
        console.error('[Preview] Upload failed with error:', uploadError);
        console.error('[Preview] Upload error details:', {
          code: uploadError.code,
          message: uploadError.message,
          name: uploadError.name,
          stack: uploadError.stack
        });
        
        // Enhanced error handling
        if (uploadError.code === 'storage/object-not-found') {
          console.error('[Preview] Storage object not found - checking storage setup...');
          console.error('[Preview] Verify: 1) Storage bucket exists, 2) Storage rules allow upload, 3) User is authenticated');
          
          // Try to verify storage bucket exists
          try {
            const bucketRef = storage.ref();
            console.log('[Preview] Storage bucket reference:', bucketRef);
          } catch (bucketError) {
            console.error('[Preview] Storage bucket verification failed:', bucketError);
          }
        } else if (uploadError.code === 'storage/unauthorized') {
          console.error('[Preview] Storage unauthorized - check storage rules and user authentication');
        } else if (uploadError.code === 'storage/canceled') {
          console.error('[Preview] Upload was canceled');
        } else if (uploadError.code === 'storage/unknown') {
          console.error('[Preview] Unknown storage error - check Firebase configuration');
        }
        
        throw uploadError;
      }

      // Validate Firestore
      if (!firestore) {
        throw new Error('Firestore is not initialized');
      }

      // Create message document using unified API
      console.log('[Preview] Creating message document...');
      const messageDoc = await firestore.collection('messages').add({
        senderId: user.uid,
        recipientId: recipientId,
        mediaURL: downloadURL,
        mediaType: mediaType,
        ttlPreset: selectedTtl,
        sentAt: firestore.FieldValue.serverTimestamp(),
      });
      console.log('[Preview] Message document created with ID:', messageDoc.id);
      
      // Log analytics
      await logEvent(ANALYTICS_EVENTS.MEDIA_SENT, {
        mediaType,
        ttl: selectedTtl,
        recipientId,
      });
      
      console.log('[Preview] Message sent successfully, navigating to home');
      Alert.alert('Success', 'Message sent successfully!');
      router.replace('/(protected)/home');
      
    } catch (error: any) {
      console.error('[Preview] Error sending message:', error);
      console.error('[Preview] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Show user-friendly error message
      let errorMessage = 'Failed to send message. ';
      if (error.message?.includes('storage')) {
        errorMessage += 'Storage upload failed.';
      } else if (error.message?.includes('firestore') || error.message?.includes('permission')) {
        errorMessage += 'Database error.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage += 'Network error.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      Alert.alert('Send Failed', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const openFriendSelector = () => {
    router.push({ pathname: '/(protected)/select-friend', params: { uri, mediaType } });
  };

  const renderMedia = () => {
    console.log('[Preview] Rendering media:', { mediaType, uri, platform: Platform.OS, readonly });
    console.log('[Preview] Image error state:', imgError);
    console.log('[Preview] Video error state:', videoError);

    // Handle static images / photos ---------------------------------------
    if (mediaType === 'photo' || mediaType === 'image') {
      if (imgError || !uri || uri.startsWith('mock://')) {
        return (
          <View style={[styles.image, styles.mockMedia]}> 
            <Text style={styles.mockMediaText}>🖼️</Text>
            <Text style={styles.mockMediaSubtext}>Image Preview</Text>
            {imgError && (
              <Text style={styles.errorText}>Failed to load image</Text>
            )}
          </View>
        );
      }

      return (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          onError={(e) => {
            console.error('[Preview] Image load error:', e.nativeEvent.error);
            setImgError(true);
          }}
        />
      );

    // Handle videos --------------------------------------------------------
    } else {
      // Handle video based on platform and source
      if (Platform.OS === 'web' || uri?.startsWith('mock://') || !Video || videoError) {
        // Mock video for web or fallback
        return (
          <View style={[styles.video, styles.mockMedia]}>
            <Text style={styles.mockMediaText}>🎥</Text>
            <Text style={styles.mockMediaSubtext}>Video Preview</Text>
            {videoError && (
              <Text style={styles.errorText}>Video playback not available</Text>
            )}
          </View>
        );
      } else {
        // Real video playback for mobile
        return (
          <View style={styles.videoContainer}>
            <Video
              source={{ uri }}
              style={styles.video}
              controls={true}
              resizeMode="cover"
              paused={false}
              repeat={false}
              muted={false}
              onError={(error: any) => {
                console.error('[Preview] Video playback error:', error);
                setVideoError(true);
              }}
              onLoad={() => {
                console.log('[Preview] Video loaded successfully');
                setVideoError(false);
              }}
            />
          </View>
        );
      }
    }
  };

  if (readonly === 'true') {
    return (
      <View style={styles.fullContainer}>
        <Header title="View Message" showBackButton={true} />
        <View style={styles.container}>
          {renderMedia()}
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={styles.fullContainer}>
        <Header title="Preview" showBackButton={true} />
        <View style={styles.container}>
          <Text>No media to display.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <Header title="Send Message" showBackButton={true} />
      <View style={styles.container}>
        {renderMedia()}
        
        <View style={styles.bottomContainer}>
          <View style={styles.ttlContainer}>
            {TTL_PRESETS.map((ttl) => (
              <TouchableOpacity
                key={ttl}
                style={[styles.ttlButton, selectedTtl === ttl && styles.ttlButtonSelected]}
                onPress={() => {
                  setSelectedTtl(ttl);
                  logEvent(ANALYTICS_EVENTS.TTL_SELECTED, { ttl, screen: 'preview' });
                }}
              >
                <Text style={[styles.ttlButtonText, selectedTtl === ttl && styles.ttlButtonTextSelected]}>{ttl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sendContainer}>
            <TouchableOpacity style={styles.selectFriendButton} onPress={openFriendSelector}>
              <Text style={styles.selectFriendButtonText}>{recipientName ? `To: ${recipientName}` : 'Select Friend'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.sendButton, 
                (!recipientId || isSending) && styles.sendButtonDisabled
              ]} 
              onPress={handleSend} 
              disabled={!recipientId || readonly === 'true' || isSending}
            >
              <Text style={styles.sendButtonText}>
                {isSending ? 'Sending...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#000',
  },
  mockMedia: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  mockMediaText: {
    fontSize: 60,
  },
  mockMediaSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#ff0000',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomContainer: {
    marginTop: 20,
  },
  ttlContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  ttlButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
  },
  ttlButtonSelected: {
    backgroundColor: '#007AFF',
  },
  ttlButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ttlButtonTextSelected: {
    color: 'white',
  },
  sendContainer: {
    gap: 12,
  },
  selectFriendButton: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectFriendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PreviewScreen; 