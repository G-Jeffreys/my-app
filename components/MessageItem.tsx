import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useCountdown } from '../hooks/useCountdown';
import { Message } from '../models/firestore/message';
import { Receipt } from '../models/firestore/receipt';
import { useAuth } from '../store/useAuth';

interface MessageItemProps {
  message: Message;
}

export default function MessageItem({ message }: MessageItemProps) {
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sender, setSender] = useState<any>(null); // Using any for simplicity for now

  useEffect(() => {
    if (!user) return;
    const receiptRef = doc(db, 'messages', message.id, 'receipts', user.uid);
    getDoc(receiptRef).then(snap => {
      if (snap.exists()) {
        setReceipt(snap.data() as Receipt);
      }
    });

    const senderRef = doc(db, 'users', message.senderId);
    getDoc(senderRef).then(snap => {
      if (snap.exists()) {
        setSender(snap.data());
      }
    });
  }, [message.id, message.senderId, user]);

  const receivedAt = receipt?.receivedAt ? receipt.receivedAt.toDate() : null;
  const { remaining, isExpired } = useCountdown(receivedAt, message.ttlPreset);
  
  const isOpened = receipt?.viewedAt !== null;

  if (isExpired && !isOpened) {
    return (
      <View style={styles.container}>
        <Text style={styles.missedText}>Missed Snap from {sender?.displayName || 'a friend'}</Text>
      </View>
    );
  }

  // Placeholder for opened or available messages
  return (
    <TouchableOpacity style={styles.container}>
      <View style={styles.thumbnail}>
        {/* We can use an icon based on mediaType */}
        <Image source={{ uri: message.mediaURL || undefined }} style={styles.image} />
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
    ...StyleSheet.absoluteFillObject,
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
  },
  missedText: {
    fontSize: 16,
    color: 'gray',
  },
}); 