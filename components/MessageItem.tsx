import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { firestore, timestampToDate } from '../lib/firebase';
import { useCountdown } from '../hooks/useCountdown';
import { Message } from '../models/firestore/message';
import { Receipt } from '../models/firestore/receipt';
import { useAuth } from '../store/useAuth';
import { ANALYTICS_EVENTS, logEvent } from '../lib/analytics';
import { router } from 'expo-router';

interface MessageItemProps {
  message: Message;
}

export default function MessageItem({ message }: MessageItemProps) {
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sender, setSender] = useState<any>(null); // Using any for simplicity for now
  const [expiredEventLogged, setExpiredEventLogged] = useState(false);

  useEffect(() => {
    if (!user) {
      console.log('[MessageItem] No user, skipping receipt setup');
      return;
    }

    console.log('[MessageItem] Setting up receipt listener for message:', message.id);

    try {
      // Use unified Firebase API
      const receiptRef = firestore.collection('messages').doc(message.id).collection('receipts').doc(user.uid);
      const unsub = receiptRef.onSnapshot((snap) => {
        console.log('[MessageItem] Receipt snapshot received');
        if (snap.exists()) {
          const receiptData = snap.data() as Receipt;
          setReceipt(receiptData);
          if (!receiptData.receivedAt) {
            receiptRef.set({ receivedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
          }
        } else {
          receiptRef.set({ receivedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      });

      // Get sender data
      const senderRef = firestore.collection('users').doc(message.senderId);
      senderRef.get().then((snap) => {
        console.log('[MessageItem] Sender data received');
        if (snap.exists()) {
          setSender(snap.data());
        }
      });

      return () => {
        console.log('[MessageItem] Cleaning up receipt listener');
        unsub();
      };
    } catch (error) {
      console.error('[MessageItem] Error setting up receipt listener:', error);
    }
  }, [message.id, message.senderId, user]);

  const receivedAt = receipt?.receivedAt ? timestampToDate(receipt.receivedAt) : null;
  const { remaining, isExpired } = useCountdown(receivedAt, message.ttlPreset);
  
  const isOpened = receipt?.viewedAt;

  useEffect(() => {
    if (isExpired && !isOpened && !expiredEventLogged) {
      logEvent(ANALYTICS_EVENTS.MEDIA_EXPIRED_UNOPENED, {
        mediaType: message.mediaType,
        senderId: message.senderId,
        ttl: message.ttlPreset,
      });
      setExpiredEventLogged(true);
    }
  }, [isExpired, isOpened, expiredEventLogged, message]);

  const handleOpenMessage = () => {
    if (!user || isOpened) return;
    
    console.log('[MessageItem] Opening message:', message.id);

    try {
      // Use unified Firebase API
      const receiptRef = firestore.collection('messages').doc(message.id).collection('receipts').doc(user.uid);
      receiptRef.set({ viewedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error('[MessageItem] Error updating receipt:', error);
    }

    logEvent(ANALYTICS_EVENTS.MEDIA_OPENED, {
      mediaType: message.mediaType,
      senderId: message.senderId,
      ttl: message.ttlPreset,
    });

    // Navigate to a viewer screen (we can reuse preview for now)
    router.push({
      pathname: '/(protected)/preview',
      params: { uri: message.mediaURL, mediaType: message.mediaType, readonly: 'true' },
    });
  };

  if (isExpired && !isOpened) {
    return (
      <View style={styles.container}>
        <Text style={styles.missedText}>Missed Snap from {sender?.displayName || 'a friend'}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handleOpenMessage}>
      <View style={styles.thumbnail}>
        {(!message.mediaURL || message.mediaURL.startsWith('mock://')) ? (
          <View style={[styles.image, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}> 
            <Text>🖼️</Text>
          </View>
        ) : (
          <Image 
            source={{ uri: message.mediaURL }} 
            style={styles.image} 
            onError={(e) => console.error('[MessageItem] Thumbnail load error:', e.nativeEvent.error)}
          />
        )}
        {isOpened ? (
          <Text>Opened</Text>
        ) : (
          <View style={styles.timerOverlay}>
            <Text style={styles.timerText}>{remaining}s</Text>
          </View>
        )}
      </View>
      <Text style={styles.senderName}>{sender?.displayName || 'Loading...'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  timerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  timerText: {
    color: 'white',
    fontWeight: 'bold',
  },
  senderName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  missedText: {
    fontSize: 16,
    color: '#999',
  },
}); 