import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../store/useAuth';
import Video from 'react-native-video';
import { db } from '../../config/firebase';

const TTL_PRESETS = ['30s', '1m', '5m', '1h', '6h', '24h'];

export default function PreviewScreen() {
  const { uri, mediaType, recipientId, recipientName } = useLocalSearchParams<{ uri: string; mediaType: 'photo' | 'video', recipientId?: string, recipientName?: string }>();
  const { user } = useAuth();
  const [selectedTtl, setSelectedTtl] = useState('1h');

  useEffect(() => {
    const fetchDefaultTtl = async () => {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().defaultTtl) {
        setSelectedTtl(userSnap.data().defaultTtl);
      }
    };
    fetchDefaultTtl();
  }, [user]);

  const handleSend = async () => {
    if (!uri || !user || !mediaType || !recipientId) return;

    try {
      console.log(`Uploading ${mediaType}...`);
      const response = await fetch(uri);
      const blob = await response.blob();

      const storage = getStorage();
      const storageRef = ref(storage, `media/${user.uid}/${Date.now()}`);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      console.log(`${mediaType} uploaded:`, downloadURL);

      const db = getFirestore();
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        recipientId: recipientId,
        mediaURL: downloadURL,
        mediaType: mediaType,
        ttlPreset: selectedTtl,
        sentAt: serverTimestamp(),
      });

      console.log('Message document created.');
      router.replace('/(protected)/home');
    } catch (error) {
      console.error('Error sending message: ', error);
      // TODO: show an error message to the user
    }
  };

  const openFriendSelector = () => {
    router.push({ pathname: '/(protected)/select-friend', params: { uri, mediaType } });
  };

  if (!uri) {
    return (
      <View style={styles.container}>
        <Text>No image to display.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {mediaType === 'photo' ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <Video
          source={{ uri }}
          style={styles.video}
          resizeMode="contain"
          repeat={true}
        />
      )}
      
      <View style={styles.bottomContainer}>
        <View style={styles.ttlContainer}>
          {TTL_PRESETS.map((ttl) => (
            <TouchableOpacity
              key={ttl}
              style={[styles.ttlButton, selectedTtl === ttl && styles.ttlButtonSelected]}
              onPress={() => setSelectedTtl(ttl)}
            >
              <Text style={styles.ttlButtonText}>{ttl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sendContainer}>
          <TouchableOpacity style={styles.selectFriendButton} onPress={openFriendSelector}>
            <Text style={styles.selectFriendButtonText}>{recipientName ? `To: ${recipientName}` : 'Select Friend'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sendButton, !recipientId && styles.sendButtonDisabled]} onPress={handleSend} disabled={!recipientId}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
}); 