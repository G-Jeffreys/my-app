import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { firestore, storage } from '../../lib/firebase';
import { useAuth } from '../../store/useAuth';
import { ANALYTICS_EVENTS, logEvent } from '../../lib/analytics';
import { Platform } from 'react-native';
import Header from '../../components/Header';

const TTL_PRESETS = ['30s', '1m', '5m', '1h', '6h', '24h'];

const PreviewScreen = () => {
  const { uri, mediaType, recipientId, recipientName, readonly } = useLocalSearchParams<{ uri: string; mediaType: 'photo' | 'video', recipientId?: string, recipientName?: string, readonly?: string }>();
  const { user } = useAuth();
  const [selectedTtl, setSelectedTtl] = useState('1h');

  useEffect(() => {
    const fetchDefaultTtl = async () => {
      if (!user) return;
      
      if (Platform.OS === 'web') {
        // Mock default TTL for web
        setSelectedTtl('1h');
      } else {
        const userRef = firestore.collection('users').doc(user.uid);
        const userSnap = await userRef.get();
        if (userSnap.exists() && userSnap.data()?.defaultTtl) {
          setSelectedTtl(userSnap.data()!.defaultTtl);
        }
      }
    };
    fetchDefaultTtl();
  }, [user]);

  const handleSend = async () => {
    if (!uri || !user || !mediaType || !recipientId) return;

    try {
      console.log(`Uploading ${mediaType}...`);
      
      let downloadURL: string;
      
      if (Platform.OS === 'web') {
        // Mock upload for web
        console.log('[Preview] Mock upload for web');
        downloadURL = `mock://uploaded-${mediaType}-${Date.now()}`;
      } else {
        // Actual upload for mobile
        const response = await fetch(uri);
        const blob = await response.blob();

        const storageRef = storage.ref(`media/${user.uid}/${Date.now()}`);
        
        await storageRef.put(blob);
        downloadURL = await storageRef.getDownloadURL();
        console.log(`${mediaType} uploaded:`, downloadURL);
      }

      if (Platform.OS === 'web') {
        // Mock Firestore operation for web
        console.log('[Preview] Mock message document created');
      } else {
        await firestore.collection('messages').add({
          senderId: user.uid,
          recipientId: recipientId,
          mediaURL: downloadURL,
          mediaType: mediaType,
          ttlPreset: selectedTtl,
          sentAt: firestore.FieldValue.serverTimestamp(),
        });
        console.log('Message document created.');
      }
      
      await logEvent(ANALYTICS_EVENTS.MEDIA_SENT, {
        mediaType,
        ttl: selectedTtl,
        recipientId,
      });

      router.replace('/(protected)/home');
    } catch (error) {
      console.error('Error sending message: ', error);
      // TODO: show an error message to the user
    }
  };

  const openFriendSelector = () => {
    router.push({ pathname: '/(protected)/select-friend', params: { uri, mediaType } });
  };

  const renderMedia = () => {
    if (Platform.OS === 'web' && uri?.startsWith('mock://')) {
      // Mock media display for web
      return (
        <View style={[styles.image, styles.mockMedia]}>
          <Text style={styles.mockMediaText}>
            {mediaType === 'photo' ? '📷' : '🎥'}
          </Text>
          <Text style={styles.mockMediaSubtext}>
            Mock {mediaType === 'photo' ? 'Photo' : 'Video'}
          </Text>
          <Text style={styles.mockMediaPath}>
            {uri}
          </Text>
        </View>
      );
    }

    if (mediaType === 'photo') {
      return <Image source={{ uri }} style={styles.image} />;
    } else {
      // For video, we'd normally use react-native-video, but let's mock it for web
      if (Platform.OS === 'web') {
        return (
          <View style={[styles.video, styles.mockMedia]}>
            <Text style={styles.mockMediaText}>🎥</Text>
            <Text style={styles.mockMediaSubtext}>Mock Video Player</Text>
          </View>
        );
      } else {
        const Video = require('react-native-video').default;
        return (
          <Video
            source={{ uri }}
            style={styles.video}
            resizeMode="contain"
            repeat={true}
          />
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
    backgroundColor: 'black',
  },
  image: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  mockMedia: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockMediaText: {
    fontSize: 48,
    marginBottom: 10,
  },
  mockMediaSubtext: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  mockMediaPath: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  sendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
  },
  selectFriendButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  selectFriendButtonText: {
    color: 'white',
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007BFF',
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#999',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
  },
  ttlContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  ttlButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  ttlButtonSelected: {
    backgroundColor: '#007BFF',
  },
  ttlButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default PreviewScreen; 