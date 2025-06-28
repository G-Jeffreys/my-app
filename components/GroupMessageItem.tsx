import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { VideoContentFit } from "expo-video";
import { useAuth } from "../store/useAuth";
import { useCountdown } from "../hooks/useCountdown";
import { useReceiptTracking } from "../hooks/useReceiptTracking";
import { Message, FirestoreTimestamp } from "../models/firestore/message";
import { User } from "../models/firestore/user";
import PlatformVideo from "./PlatformVideo";
import SummaryLine from "./SummaryLine";

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
  
  // Check if message is marked as expired in database
  const isExpiredInDB = message.expired === true;
  
  // Message is considered expired if either client-side countdown expired OR database marked it as expired
  const messageExpired = isExpired || isExpiredInDB;

  logMessage('Rendering group message', {
    messageId: message.id,
    isOwnMessage,
    showSenderName,
    senderName: sender?.displayName,
    hasReceiptTracking: !!receipt,
    receivedAt: receivedAt?.toISOString(),
    remaining,
    isExpired,
    isExpiredInDB,
    messageExpired,
    receiptLoading
  });

  // Handle marking message as viewed when opened
  useEffect(() => {
    if (isOpened && !isOwnMessage && receipt && !receipt.viewedAt && !messageExpired) {
      logMessage('Marking group message as viewed', { messageId: message.id });
      markAsViewed();
    }
  }, [isOpened, isOwnMessage, receipt, markAsViewed, message.id, messageExpired]);

  // Handle automatic closure when message expires while open
  useEffect(() => {
    if (messageExpired && isOpened && !isOwnMessage) {
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
  }, [messageExpired, isOpened, isOwnMessage, message.id, remaining, message.ttlPreset]);

  // Show expired messages with summaries for recipients
  useEffect(() => {
    if (messageExpired && !isOwnMessage) {
      logMessage('Group message expired - showing summary only', { 
        messageId: message.id, 
        remaining,
        ttl: message.ttlPreset,
        receivedAt: receivedAt?.toISOString(),
        isExpiredInDB
      });
    }
  }, [messageExpired, isOwnMessage, message.id, remaining, message.ttlPreset, receivedAt, isExpiredInDB]);

  const handlePress = () => {
    if (!messageExpired || isOwnMessage) {
      logMessage('Opening group message', { messageId: message.id, remaining, messageExpired });
      setIsOpened(true);
    } else {
      logMessage('Cannot open expired group message', { 
        messageId: message.id, 
        messageExpired, 
        isOwnMessage, 
        remaining 
      });
      console.log('⏰ This message has expired and is no longer accessible');
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
          {/* No AI summary for sender - they know what they sent */}
          <Text style={styles.timestamp}>
            {formatTimestamp(message.sentAt)}
          </Text>
        </View>
      </View>
    );
  }

  // For recipients, hide completely if expired and no summary exists
  if (messageExpired && !isOwnMessage && !message.hasSummary) {
    return null;
  }

  // Show expired message with summary for recipients
  if (messageExpired && !isOwnMessage && message.hasSummary) {
    return (
      <View style={[styles.messageContainer, { alignSelf: isOwnMessage ? 'flex-end' : 'flex-start' }]}>
        {/* Show sender name for group messages */}
        {showSenderName && sender && (
          <Text style={styles.senderName}>{sender.displayName || 'Unknown User'}</Text>
        )}
        
        <TouchableOpacity
          style={[styles.messageContent, styles.expiredMessage]}
          disabled={true} // No interaction for expired messages
        >
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
        </TouchableOpacity>
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
                source={{ uri: message.mediaURL || "" }}
                style={styles.media}
                contentFit="cover"
                shouldPlay={false}
              />
            ) : null}
            
            {/* Render text content */}
            {message.text && (
              <View style={styles.textContainer}>
                <Text style={styles.textMessage}>{message.text}</Text>
              </View>
            )}
            
            {/* TTL countdown timer */}
            <View style={[
              styles.timer,
              messageExpired && styles.timerExpired
            ]}>
              <Text style={[
                styles.timerText,
                messageExpired && styles.timerTextExpired
              ]}>
                {messageExpired ? 'EXPIRED' : `${remaining}s`}
              </Text>
            </View>
            
            <Text style={styles.timestamp}>
              {formatTimestamp(message.sentAt)}
            </Text>
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
  timerExpired: {
    backgroundColor: "rgba(255, 107, 107, 0.9)", // Red background for expired
  },
  timerText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  timerTextExpired: {
    color: "white",
    fontSize: 10, // Slightly smaller for "EXPIRED" text
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
  summaryLine: {
    marginVertical: 6,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
    paddingHorizontal: 16,
  },
  expiredMessage: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderStyle: 'dashed',
    opacity: 0.8,
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
});

export default GroupMessageItem; 