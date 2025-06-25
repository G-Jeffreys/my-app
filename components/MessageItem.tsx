import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { ResizeMode } from "expo-av";
import { useAuth } from "../store/useAuth";
import { useCountdown } from "../hooks/useCountdown";
import { useReceiptTracking } from "../hooks/useReceiptTracking";
import { Message, FirestoreTimestamp } from "../models/firestore/message";
import PlatformVideo from "./PlatformVideo";

interface MessageItemProps {
  message: Message;
}

// Console log function for debugging message behavior
const logMessage = (message: string, data?: any) => {
  console.log(`[MessageItem] ${message}`, data ? data : '');
};

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
  const videoRef = useRef<any>(null);

  // Use receipt tracking for proper receivedAt timestamp
  const { receipt, isLoading: receiptLoading, markAsViewed, receivedAt } = useReceiptTracking(
    message.id, 
    message.conversationId
  );

  // Use receivedAt for TTL countdown instead of sentAt
  const { remaining, isExpired } = useCountdown(receivedAt, message.ttlPreset);

  const isSender = message.senderId === user?.uid;

  logMessage('Component rendered', {
    messageId: message.id,
    isSender,
    hasReceiptTracking: !!receipt,
    receivedAt: receivedAt?.toISOString(),
    remaining,
    isExpired,
    receiptLoading
  });

  // Handle marking message as viewed when opened
  useEffect(() => {
    if (isOpened && !isSender && receipt && !receipt.viewedAt) {
      logMessage('Marking message as viewed', { messageId: message.id });
      markAsViewed();
    }
  }, [isOpened, isSender, receipt, markAsViewed, message.id]);

  const handlePress = () => {
    if (!isExpired && !isSender) {
      logMessage('Opening message', { messageId: message.id, remaining });
      setIsOpened(true);
    } else {
      logMessage('Cannot open message', { 
        messageId: message.id, 
        isExpired, 
        isSender, 
        remaining 
      });
    }
  };

  // Show loading state while receipt is being created/loaded
  if (receiptLoading && !isSender) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Loading message...</Text>
      </View>
    );
  }

  // Sender view - show delivery status
  if (isSender) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>
          {message.conversationId ? 'Sent to group' : 'Sent to friend'}
        </Text>
        {message.text && (
          <Text style={styles.previewText} numberOfLines={2}>
            {message.mediaURL ? `📎 ${message.text}` : message.text}
          </Text>
        )}
      </View>
    );
  }

  // Recipient view - expired message
  if (isExpired && !isOpened) {
    return (
      <View style={styles.container}>
        <View style={styles.expiredContainer}>
          <Text style={styles.expiredText}>⏰ Expired</Text>
          <Text style={styles.expiredSubtext}>
            {message.mediaType === 'text' ? 'Text message' : 'Media'} expired unopened
          </Text>
        </View>
      </View>
    );
  }

  // Recipient view - active message
  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      {isOpened ? (
        <>
          {/* Render content based on media type */}
          {message.mediaType === "image" || message.mediaType === 'photo' ? (
            <Image source={{ uri: message.mediaURL || "" }} style={styles.media} />
          ) : message.mediaType === 'video' ? (
            <PlatformVideo
              ref={videoRef}
              source={{ uri: message.mediaURL || "" }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
            />
          ) : null}
          
          {/* Render text content */}
          {message.text && (
            <View style={styles.textContainer}>
              <Text style={styles.textMessage}>{message.text}</Text>
            </View>
          )}
          
          {/* TTL countdown timer */}
          <View style={styles.timer}>
            <Text style={styles.timerText}>{remaining}s</Text>
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {message.mediaType === 'text' ? 
              '💬 Tap to view message' : 
              '📸 Tap to view snap'
            }
          </Text>
          {message.text && message.mediaURL && (
            <Text style={styles.placeholderSubtext}>Contains media + text</Text>
          )}
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
    fontWeight: "500",
  },
  previewText: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    fontStyle: "italic",
  },
  expiredContainer: {
    alignItems: "center",
    padding: 20,
  },
  expiredText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ff6b6b",
  },
  expiredSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  placeholder: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  placeholderSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  media: {
    width: "100%",
    height: 400,
    borderRadius: 10,
    marginBottom: 8,
  },
  timer: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  textContainer: {
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    marginTop: 8,
  },
  textMessage: {
    fontSize: 16,
    lineHeight: 22,
    color: "#333",
  }
});

export default MessageItem;