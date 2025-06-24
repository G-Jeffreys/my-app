import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { firestore, storage } from '../../lib/firebase';
import { useAuth } from '../../store/useAuth';
import { ANALYTICS_EVENTS, logEvent } from '../../lib/analytics';
import Header from '../../components/Header';

const TTL_PRESETS = ['30s', '1m', '5m', '1h', '6h', '24h'];

const PreviewScreen = () => {
  const { uri, mediaType, recipientId, recipientName, readonly } = useLocalSearchParams<{ uri: string; mediaType: 'photo' | 'video', recipientId?: string, recipientName?: string, readonly?: string }>();
  const { user } = useAuth();
  const [selectedTtl, setSelectedTtl] = useState('1h');

  useEffect(() => {
    const fetchDefaultTtl = async () => {
      if (!user) return;
      
      console.log('[Preview] Fetching default TTL for user:', user.uid);
      
      try {
        // Use unified Firebase API
        const userRef = firestore.collection('users').doc(user.uid);
        const userSnap = await userRef.get();
        if (userSnap.exists() && userSnap.data()?.defaultTtl) {
          setSelectedTtl(userSnap.data()!.defaultTtl);
          console.log('[Preview] Using saved default TTL:', userSnap.data()!.defaultTtl);
        }
      } catch (error) {
        console.error('[Preview] Error fetching default TTL:', error);
      }
    };
    fetchDefaultTtl();
  }, [user]);

  const handleSend = async () => {
    if (!uri || !user || !mediaType || !recipientId) return;

    try {
      console.log(`[Preview] Uploading ${mediaType}...`);
      
      // Use unified Firebase API for upload
      const response = await fetch(uri);
      const blob = await response.blob();

      const storageRef = storage.ref(`media/${user.uid}/${Date.now()}`);
      
      await storageRef.put(blob);
      const downloadURL = await storageRef.getDownloadURL();
      console.log(`[Preview] ${mediaType} uploaded:`, downloadURL);

      // Create message document using unified API
      await firestore.collection('messages').add({
        senderId: user.uid,
        recipientId: recipientId,
        mediaURL: downloadURL,
        mediaType: mediaType,
        ttlPreset: selectedTtl,
        sentAt: firestore.FieldValue.serverTimestamp(),
      });
      console.log('[Preview] Message document created.');
      
      await logEvent(ANALYTICS_EVENTS.MEDIA_SENT, {
        mediaType,
        ttl: selectedTtl,
        recipientId,
      });

      router.replace('/(protected)/home');
    } catch (error) {
      console.error('[Preview] Error sending message: ', error);
      // TODO: show an error message to the user
    }
  };

  const openFriendSelector = () => {
    router.push({ pathname: '/(protected)/select-friend', params: { uri, mediaType } });
  };

  const renderMedia = () => {
    if (mediaType === 'photo') {
      return <Image source={{ uri }} style={styles.image} />;
    } else {
      // For video, we'd normally use react-native-video
      // For now, show a placeholder
      return (
        <View style={[styles.video, styles.mockMedia]}>
          <Text style={styles.mockMediaText}>🎥</Text>
          <Text style={styles.mockMediaSubtext}>Video Preview</Text>
        </View>
      );
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
              <Text style={styles.ttlButtonText}>{ttl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sendContainer}>
          <TouchableOpacity style={styles.selectFriendButton} onPress={openFriendSelector}>
            <Text style={styles.selectFriendButtonText}>{recipientName ? `To: ${recipientName}` : 'Select Friend'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sendButton, !recipientId && styles.sendButtonDisabled]} onPress={handleSend} disabled={!recipientId || readonly === 'true'}>
            <Text style={styles.sendButtonText}>Send</Text>
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
  video: {
    width: '100%',
    aspectRatio: 1,
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