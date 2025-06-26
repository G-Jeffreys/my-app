import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { ResizeMode } from "expo-av";
import { useAuth } from "../store/useAuth";
import { useCountdown } from "../hooks/useCountdown";
import { useReceiptTracking } from "../hooks/useReceiptTracking";
import { Message, FirestoreTimestamp } from "../models/firestore/message";
import { User } from "../models/firestore/user";
import PlatformVideo from "./PlatformVideo";

interface GroupMessageItemProps {
  message: Message;
  sender?: User;
  isOwnMessage: boolean;
  showSenderName: boolean;
}

const logMessage = (message: string, data?: any) => {
  console.log(`[GroupMessageItem] ${message}`, data ? data : '');
};

const GroupMessageItem: React.FC<GroupMessageItemProps> = ({ 
  message, 
  sender, 
  isOwnMessage, 
  showSenderName 
}) => {
  const { user } = useAuth();
  const [isOpened, setIsOpened] = useState(false);
  const videoRef = useRef<any>(null);

  // Use receipt tracking for proper receivedAt timestamp
  const { receipt, isLoading: receiptLoading, markAsViewed, receivedAt } = useReceiptTracking(
    message.id, 
    message.conversationId
  );

  // Use receivedAt for TTL countdown instead of sentAt
  const { remaining, isExpired } = useCountdown(receivedAt, message.ttlPreset);

  logMessage('Rendering group message', {
    messageId: message.id,
    isOwnMessage,
    showSenderName,
    senderName: sender?.displayName,
    hasReceiptTracking: !!receipt,
    receivedAt: receivedAt?.toISOString(),
    remaining,
    isExpired,
    receiptLoading
  });

  // Handle marking message as viewed when opened
  useEffect(() => {
    if (isOpened && !isOwnMessage && receipt && !receipt.viewedAt) {
      logMessage('Marking group message as viewed', { messageId: message.id });
      markAsViewed();
    }
  }, [isOpened, isOwnMessage, receipt, markAsViewed, message.id]);

  // Hide expired messages immediately for better UX (server cleanup runs hourly)
  useEffect(() => {
    if (isExpired && !isOwnMessage) {
      logMessage('Group message expired - hiding from UI', { 
        messageId: message.id, 
        remaining,
        ttl: message.ttlPreset,
        receivedAt: receivedAt?.toISOString()
      });
    }
  }, [isExpired, isOwnMessage, message.id, remaining, message.ttlPreset, receivedAt]);

  const handlePress = () => {
    if (!isExpired && !isOwnMessage) {
      logMessage('Opening group message', { messageId: message.id, remaining });
      setIsOpened(true);
    } else {
      logMessage('Cannot open group message', { 
        messageId: message.id, 
        isExpired, 
        isOwnMessage, 
        remaining 
      });
    }
  };

  const formatTimestamp = (timestamp: FirestoreTimestamp) => {
    if (!timestamp) return 'Unknown time';
    
    const date = timestamp instanceof Date 
      ? timestamp 
      : new Date((timestamp as any)?.seconds * 1000);
    
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Show loading state while receipt is being created/loaded
  if (receiptLoading && !isOwnMessage) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading message...</Text>
      </View>
    );
  }

  // Sender view - show delivery status
  if (isOwnMessage) {
    return (
      <View style={[styles.container, styles.ownMessage]}>
        {showSenderName && (
          <Text style={styles.senderName}>You</Text>
        )}
        <View style={styles.messageContent}>
          <Text style={styles.statusText}>
            {message.conversationId ? 'Sent to group' : 'Sent to friend'}
          </Text>
          {message.text && (
            <Text style={styles.previewText} numberOfLines={2}>
              {message.mediaURL ? `📎 ${message.text}` : message.text}
            </Text>
          )}
          <Text style={styles.timestamp}>
            {formatTimestamp(message.sentAt)}
          </Text>
        </View>
      </View>
    );
  }

  // Recipient view - expired message
  if (isExpired && !isOpened) {
    return (
      <View style={[styles.container, styles.receivedMessage]}>
        {showSenderName && (
          <Text style={styles.senderName}>
            {sender?.displayName || 'Unknown User'}
          </Text>
        )}
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
    <TouchableOpacity 
      style={[styles.container, styles.receivedMessage]} 
      onPress={handlePress}
    >
      {showSenderName && (
        <Text style={styles.senderName}>
          {sender?.displayName || 'Unknown User'}
        </Text>
      )}
      
      <View style={styles.messageContent}>
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
            
            <Text style={styles.timestamp}>
              {formatTimestamp(message.sentAt)}
            </Text>
          </>
        ) : (
          <>
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
            <Text style={styles.timestamp}>
              {formatTimestamp(message.sentAt)}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginVertical: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  receivedMessage: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginHorizontal: 8,
  },
  messageContent: {
    maxWidth: '80%',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 10,
    position: 'relative',
  },
  statusText: {
    fontSize: 14,
    color: "gray",
    fontWeight: "500",
  },
  previewText: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
    fontStyle: "italic",
  },
  expiredContainer: {
    alignItems: "center",
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 12,
  },
  expiredText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ff6b6b",
  },
  expiredSubtext: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  placeholder: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  placeholderSubtext: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  media: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  timer: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  textContainer: {
    marginBottom: 8,
  },
  textMessage: {
    fontSize: 15,
    lineHeight: 20,
    color: "#333",
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
});

export default GroupMessageItem; 