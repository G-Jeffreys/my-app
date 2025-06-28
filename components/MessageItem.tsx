import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { VideoContentFit } from "expo-video";
import { useAuth } from "../store/useAuth";
import { useCountdown } from "../hooks/useCountdown";
import { useReceiptTracking } from "../hooks/useReceiptTracking";
import { Message, FirestoreTimestamp } from "../models/firestore/message";
import PlatformVideo from "./PlatformVideo";
import SummaryLine from "./SummaryLine";

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

// Helper function to format countdown time
const formatTime = (seconds: number): string => {
  if (seconds <= 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const user = useAuth((state) => state.user);
  const [isOpened, setIsOpened] = useState(false);
  const videoRef = useRef<any>(null);

  // Use receipt tracking for proper receivedAt timestamp (for recipients only)
  const { receipt, isLoading: receiptLoading, markAsViewed, receivedAt } = useReceiptTracking(
    message.id, 
    message.conversationId
  );

  const isSender = message.senderId === user?.uid;

  // Determine the start time for TTL countdown
  const ttlStartTime = isSender ? (
    // For senders, use sentAt timestamp (they sent the message)
    message.sentAt instanceof Date ? message.sentAt : 
    new Date((message.sentAt as any).seconds * 1000)
  ) : (
    // For recipients, use receivedAt timestamp (when they received it)
    receivedAt
  );

  // Use appropriate timestamp for TTL countdown
  const { remaining, isExpired } = useCountdown(ttlStartTime, message.ttlPreset);
  
  // Check if message is marked as expired in database
  const isExpiredInDB = message.expired === true;
  
  // Message is considered expired if either client-side countdown expired OR database marked it as expired
  const messageExpired = isExpired || isExpiredInDB;

  logMessage('Component rendered', {
    messageId: message.id,
    isSender,
    hasReceiptTracking: !!receipt,
    receivedAt: receivedAt?.toISOString(),
    sentAt: message.sentAt instanceof Date ? message.sentAt.toISOString() : (message.sentAt as any)?.seconds,
    ttlStartTime: ttlStartTime?.toISOString(),
    remaining,
    isExpired,
    isExpiredInDB,
    messageExpired,
    receiptLoading
  });

  // Handle marking message as viewed when opened
  useEffect(() => {
    if (isOpened && !isSender && receipt && !receipt.viewedAt && !messageExpired) {
      logMessage('Marking message as viewed', { messageId: message.id });
      markAsViewed();
    }
  }, [isOpened, isSender, receipt, markAsViewed, message.id, messageExpired]);

  // Handle automatic closure when message expires while open
  useEffect(() => {
    if (messageExpired && isOpened && !isSender) {
      logMessage('Message expired while open - auto-closing in 3 seconds', { 
        messageId: message.id,
        remaining,
        ttl: message.ttlPreset 
      });
      
      // Auto-close after 3 seconds to give user time to see expiration notice
      const autoCloseTimer = setTimeout(() => {
        logMessage('Auto-closing expired message', { messageId: message.id });
        setIsOpened(false);
      }, 3000);

      return () => clearTimeout(autoCloseTimer);
    }
  }, [messageExpired, isOpened, isSender, message.id, remaining, message.ttlPreset]);

  // Hide expired messages immediately for better UX (server cleanup runs hourly)
  useEffect(() => {
    if (messageExpired && !isSender) {
      logMessage('Message expired - showing summary only', { 
        messageId: message.id, 
        remaining,
        ttl: message.ttlPreset,
        receivedAt: receivedAt?.toISOString(),
        isExpiredInDB
      });
    }
  }, [messageExpired, isSender, message.id, remaining, message.ttlPreset, receivedAt, isExpiredInDB]);

  const handlePress = () => {
    if (!messageExpired || isSender) {
      logMessage('Opening message', { messageId: message.id, remaining, messageExpired });
      setIsOpened(true);
    } else {
      logMessage('Cannot open expired message', { 
        messageId: message.id, 
        messageExpired, 
        isSender, 
        remaining 
      });
      // Show alert to user that message has expired
      // Note: Alert would need to be imported if used
      console.log('⏰ This message has expired and is no longer accessible');
    }
  };

  // For recipients, hide completely if expired and no summary exists
  if (messageExpired && !isSender && !message.hasSummary) {
    return null;
  }

  // Show expired message with summary for recipients
  if (messageExpired && !isSender && message.hasSummary) {
    return (
      <TouchableOpacity
        style={[
          styles.messageContainer,
          styles.expiredMessage,
          { marginBottom: 10 }
        ]}
        disabled={true} // No interaction for expired messages
      >
        <View style={styles.messageContent}>
          {/* Expired message indicator */}
          <View style={styles.expiredIndicator}>
            <Text style={styles.expiredIndicatorText}>🔒 Message Expired</Text>
            <Text style={styles.expiredIndicatorSubtext}>
              Content no longer available
            </Text>
          </View>
          
          {/* Show AI summary if available */}
          <SummaryLine messageId={message.id} />
          
          {/* Show when it expired */}
          {message.expiredAt && (
            <Text style={styles.timestampText}>
              Expired: {new Date(
                message.expiredAt instanceof Date 
                  ? message.expiredAt 
                  : (message.expiredAt as any).seconds * 1000
              ).toLocaleString()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

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
        {/* No AI summary for sender - they know what they sent */}
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
                source={{ uri: message.mediaURL || "" }}
                style={styles.media}
                contentFit="cover"
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
          
          {/* TTL Countdown */}
          <View style={[
            styles.countdown,
            messageExpired && styles.countdownExpired
          ]}>
            <Text style={[
              styles.countdownText,
              messageExpired && styles.countdownTextExpired
            ]}>
              {messageExpired ? 'EXPIRED' : formatTime(remaining)}
            </Text>
          </View>
        </>
      ) : (
        <>
          {/* Phase 2: Show AI-generated summary for recipients before they open the message */}
          <SummaryLine 
            messageId={message.id}
            style={styles.summaryLine}
          />
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
        </>
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
  },
  summaryLine: {
    marginTop: 8,
  },
  messageContainer: {
    alignSelf: "flex-end",
    marginRight: 16,
    marginVertical: 4,
    maxWidth: "80%",
  },
  messageContent: {
    padding: 8,
  },
  expiredIndicator: {
    padding: 8,
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
    marginBottom: 8,
  },
  expiredIndicatorText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  expiredIndicatorSubtext: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
    opacity: 0.9,
  },
  timestampText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  expiredMessage: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  countdown: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countdownExpired: {
    backgroundColor: "rgba(255, 107, 107, 0.9)", // Red background for expired
  },
  countdownText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  countdownTextExpired: {
    color: "white",
    fontSize: 12, // Slightly smaller for "EXPIRED" text
  },
});

export default MessageItem;