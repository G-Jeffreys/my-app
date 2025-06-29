import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { VideoContentFit } from "expo-video";
import { useAuth } from "../store/useAuth";
import { useCountdown } from "../hooks/useCountdown";
import { useReceiptTracking } from "../hooks/useReceiptTracking";
import { Message, FirestoreTimestamp } from "../models/firestore/message";
import PlatformVideo from "./PlatformVideo";
import SummaryLine from "./SummaryLine";
import FullScreenImageViewer from "./FullScreenImageViewer";

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
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
  const videoRef = useRef<any>(null);

  // Use receipt tracking for proper receivedAt timestamp (for recipients only)
  const { receipt, isLoading: receiptLoading, markAsViewed, receivedAt } = useReceiptTracking(
    message.id, 
    message.conversationId
  );

  const isSender = message.senderId === user?.uid;

  // Memoize TTL start time calculation to prevent unnecessary recalculations
  const ttlStartTime = useMemo(() => {
    if (isSender) {
      // For senders, use sentAt timestamp (they sent the message)
      return message.sentAt instanceof Date ? message.sentAt : 
        new Date((message.sentAt as any).seconds * 1000);
    } else {
      // For recipients, use receivedAt timestamp (when they received it)
      return receivedAt;
    }
  }, [isSender, message.sentAt, receivedAt]);

  // Use appropriate timestamp for TTL countdown
  const { remaining, isExpired } = useCountdown(ttlStartTime, message.ttlPreset);
  
  // Check if message is marked as expired in database
  const isExpiredInDB = message.expired === true;
  
  // Message is considered expired if either client-side countdown expired OR database marked it as expired
  const messageExpired = isExpired || isExpiredInDB;

  // Memoize the log data to prevent object recreation on every render
  const logData = useMemo(() => ({
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
  }), [message.id, isSender, receipt, receivedAt, message.sentAt, ttlStartTime, remaining, isExpired, isExpiredInDB, messageExpired, receiptLoading]);

  logMessage('Component rendered', logData);

  // Memoize the markAsViewed callback to prevent recreation
  const handleMarkAsViewed = useCallback(() => {
    if (isOpened && !isSender && receipt && !receipt.viewedAt && !messageExpired) {
      logMessage('Marking message as viewed', { messageId: message.id });
      markAsViewed();
    }
  }, [isOpened, isSender, receipt, markAsViewed, message.id, messageExpired]);

  // Handle marking message as viewed when opened
  useEffect(() => {
    handleMarkAsViewed();
  }, [handleMarkAsViewed]);

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

  // Log message expiration status once per change - prevent excessive logging
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
  }, [messageExpired, message.id]); // Only depend on messageExpired and messageId

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

  const handleSummaryPress = () => {
    console.log(`[MessageItem] ${isSummaryExpanded ? 'Collapsing' : 'Expanding'} summary for expired message:`, message.id);
    console.log('[MessageItem] Summary expansion state change:', { 
      messageId: message.id, 
      previousState: isSummaryExpanded, 
      newState: !isSummaryExpanded,
      willUseExpandedContainer: !isSummaryExpanded  // New state will trigger expanded container
    });
    setIsSummaryExpanded(!isSummaryExpanded);
  };

  const handleImagePress = useCallback(() => {
    if ((message.mediaType === "image" || message.mediaType === 'photo') && message.mediaURL && !messageExpired) {
      logMessage('Opening full-screen image viewer', { 
        messageId: message.id, 
        mediaURL: message.mediaURL,
        isExpired: messageExpired 
      });
      setIsFullScreenVisible(true);
    }
  }, [message.mediaType, message.mediaURL, message.id, messageExpired]);

  const handleCloseFullScreen = useCallback(() => {
    logMessage('Closing full-screen image viewer', { messageId: message.id });
    setIsFullScreenVisible(false);
  }, [message.id]);

  // For recipients, hide completely if expired and no summary exists
  if (messageExpired && !isSender && !message.hasSummary) {
    return null;
  }

  // Show expired message with summary for recipients
  if (messageExpired && !isSender && message.hasSummary) {
    // Log container expansion state
    console.log('[MessageItem] Rendering expired message with summary expansion:', {
      messageId: message.id,
      isSummaryExpanded,
      willApplyExpandedContainer: isSummaryExpanded,
      willApplyExpandedContent: isSummaryExpanded
    });
    
    return (
      <TouchableOpacity
        style={[
          styles.messageContainer,
          styles.expiredMessage,
          // Use more screen width for expanded summaries to prevent text cutoff
          isSummaryExpanded && styles.messageContainerExpanded,
          { marginBottom: 10 }
        ]}
        onPress={handleSummaryPress} // Enable tapping to expand/collapse summary
        activeOpacity={0.7}
      >
        <View style={[
          styles.messageContent,
          // Apply expanded styling when summary is expanded
          isSummaryExpanded && styles.messageContentExpanded
        ]}>
          {/* Expired message indicator */}
          <View style={styles.expiredIndicator}>
            <Text style={styles.expiredIndicatorText}>🔒 Message Expired</Text>
            <Text style={styles.expiredIndicatorSubtext}>
              Content no longer available
            </Text>
          </View>
          
          {/* Expandable AI summary */}
          <View style={styles.summarySection}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryHeaderText}>
                🤖 AI Summary
              </Text>
              <Text style={styles.expandIndicator}>
                {isSummaryExpanded ? '▼ Tap to collapse' : '▶ Tap to expand'}
              </Text>
            </View>
            
            <View style={[
              styles.summaryContent,
              isSummaryExpanded && styles.summaryContentExpanded
            ]}>
                             <SummaryLine 
                 messageId={message.id}
                 isExpanded={isSummaryExpanded}
               />
            </View>
          </View>
          
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
          {(message.mediaType === "image" || message.mediaType === 'photo') && message.mediaURL ? (
            <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9}>
              <Image 
                source={{ uri: message.mediaURL }} 
                style={styles.media} 
                resizeMode="contain"
                onError={(e) => console.log('[MessageItem] Image load error:', e.nativeEvent.error)}
              />
            </TouchableOpacity>
          ) : message.mediaType === 'video' && message.mediaURL ? (
            <PlatformVideo
              source={{ uri: message.mediaURL }}
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
          
          {/* TTL Countdown - positioned outside text area to not obscure content */}
          {!message.text && (
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
          )}
          
          {/* TTL countdown for text messages - positioned below content */}
          {message.text && (
            <View style={styles.countdownColumn}>
              <View style={[
                styles.countdownBottomRight,
                messageExpired && styles.countdownExpired
              ]}>
                <Text style={[
                  styles.countdownText,
                  messageExpired && styles.countdownTextExpired
                ]}>
                  {messageExpired ? 'EXPIRED' : formatTime(remaining)}
                </Text>
              </View>
            </View>
          )}
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
      
      {/* Full-screen image viewer */}
      <FullScreenImageViewer
        visible={isFullScreenVisible}
        imageUri={message.mediaURL || ''}
        onClose={handleCloseFullScreen}
        isExpired={messageExpired}
        remaining={remaining}
        showTTL={true}
        messageId={message.id}
      />
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
    minHeight: 200,
    maxHeight: 400,
    aspectRatio: 1,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f0f0f0', // Show loading background
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
    maxWidth: "85%",
  },
  messageContainerExpanded: {
    maxWidth: "100%",
    marginRight: 2,
  },
  messageContent: {
    padding: 8,
  },
  messageContentExpanded: {
    padding: 2,
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
  summarySection: {
    marginVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
    flex: 1, // Let header text expand
  },
  expandIndicator: {
    fontSize: 9,
    color: '#666',
    fontStyle: 'italic',
    maxWidth: '30%',
  },
  summaryContent: {
    // Normal collapsed state - limit height and enable scrolling if needed
    maxHeight: 60, // About 3 lines of text
    width: '100%', // Ensure full width is used for text wrapping
  },
  summaryContentExpanded: {
    // Expanded state - allow much more height with scrolling
    maxHeight: 200, // Allow much more vertical space
    minHeight: 60,  // Ensure minimum height for readability
    width: '100%',  // Ensure full width is used for text wrapping
  },
  countdown: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    top: 15,
    right: 15,
  },
  countdownColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  countdownBottomRight: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countdownExpired: {
    backgroundColor: "rgba(255, 107, 107, 0.9)",
  },
  countdownText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  countdownTextExpired: {
    color: "white",
    fontSize: 12,
  },
});

export default MessageItem;