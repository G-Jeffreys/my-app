import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { useAuth } from "../store/useAuth";
import { useCountdown } from "../hooks/useCountdown";
import { Message, FirestoreTimestamp } from "../models/firestore/message";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../lib/firebase";

interface MessageItemProps {
  message: Message;
}

// Helper to convert FirestoreTimestamp to a JS Date object
const toDate = (timestamp: FirestoreTimestamp): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
};

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const user = useAuth((state) => state.user);
  const [isOpened, setIsOpened] = useState(false);
  const [isViewed, setIsViewed] = useState(false);
  const videoRef = useRef<Video>(null);

  const sentAtDate = message.sentAt ? toDate(message.sentAt) : null;
  const { remaining, isExpired } = useCountdown(sentAtDate, message.ttlPreset);

  const isSender = message.senderId === user?.uid;

  // This effect handles marking the message as viewed in Firestore
  // It runs only once when the message is first opened by the recipient
  useEffect(() => {
    if (isOpened && !isSender && !isViewed) {
      setIsViewed(true); // Set local state to prevent re-writes
      const messageRef = doc(firestore, "messages", message.id);
      // We are adding a `viewedAt` field here for potential future use,
      // even though it's not in the Message model. Firestore is flexible.
      updateDoc(messageRef, { viewedAt: serverTimestamp() });
    }
  }, [isOpened, isSender, message.id, isViewed]);

  const handlePress = () => {
    if (!isExpired && !isSender) {
      setIsOpened(true);
    }
  };

  if (isSender) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Sent to a friend</Text>
      </View>
    );
  }

  if (isExpired && !isOpened) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Expired</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      {isOpened ? (
        <>
          {message.mediaType === "image" || message.mediaType === 'photo' ? (
            <Image source={{ uri: message.mediaURL || "" }} style={styles.media} />
          ) : message.mediaType === 'video' ? (
            <Video
              ref={videoRef}
              source={{ uri: message.mediaURL || "" }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
            />
          ) : (
            <View style={styles.textContainer}>
                <Text style={styles.textMessage}>{message.text}</Text>
            </View>
          )}
          <View style={styles.timer}>
            <Text style={styles.timerText}>{remaining}s</Text>
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {message.mediaType === 'text' ? 'Tap to view message' : 'Tap to view snap'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    marginVertical: 5,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
  },
  statusText: {
    fontSize: 16,
    color: "gray",
  },
  placeholder: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0e0e0",
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  media: {
    width: "100%",
    height: 400,
    borderRadius: 10,
  },
  timer: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  timerText: {
    color: "white",
    fontWeight: "bold",
  },
  textContainer: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  textMessage: {
    fontSize: 18,
  }
});

export default MessageItem;