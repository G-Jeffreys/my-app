import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { VideoContentFit } from "expo-video";
import { useAuth } from "../store/useAuth";
import { useCountdown } from "../hooks/useCountdown";
import { useReceiptTracking } from "../hooks/useReceiptTracking";
import { Message, FirestoreTimestamp } from "../models/firestore/message";
import { User } from "../models/firestore/user";
import PlatformVideo from "./PlatformVideo";
import SummaryLine from "./SummaryLine";
import FullScreenImageViewer from "./FullScreenImageViewer";

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
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
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

  // Memoize the log data to prevent object recreation on every render
  const logData = useMemo(() => ({
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
    receiptLoading,
    // Add media debugging info
    mediaType: message.mediaType,
    mediaURL: message.mediaURL,
    hasMediaURL: !!message.mediaURL,
    messageText: message.text,
    isOpened
  }), [
    message.id, isOwnMessage, showSenderName, sender?.displayName, receipt, 
    receivedAt, remaining, isExpired, isExpiredInDB, messageExpired, receiptLoading,
    message.mediaType, message.mediaURL, message.text, isOpened
  ]);

  logMessage('Rendering group message', logData);

  // Memoize the markAsViewed callback to prevent recreation
  const handleMarkAsViewed = useCallback(() => {
    if (isOpened && !isOwnMessage && receipt && !receipt.viewedAt && !messageExpired) {
      logMessage('Marking group message as viewed', { messageId: message.id });
      markAsViewed();
    }
  }, [isOpened, isOwnMessage, receipt, markAsViewed, message.id, messageExpired]);

  // Handle marking message as viewed when opened
  useEffect(() => {
    handleMarkAsViewed();
  }, [handleMarkAsViewed]);

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
      logMessage('Opening group message', { 
        messageId: message.id, 
        remaining, 
        messageExpired,
        // Add media debugging when opening message
        mediaType: message.mediaType,
        mediaURL: message.mediaURL,
        hasMediaURL: !!message.mediaURL,
        isImage: message.mediaType === "image" || message.mediaType === 'photo'
      });
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

  const handleSummaryPress = () => {
    console.log(`[GroupMessageItem] ${isSummaryExpanded ? 'Collapsing' : 'Expanding'} summary for expired message:`, message.id);
    console.log('[GroupMessageItem] Summary expansion state change:', { 
      messageId: message.id, 
      previousState: isSummaryExpanded, 
      newState: !isSummaryExpanded,
      senderName: sender?.displayName,
      willUseExpandedContainer: !isSummaryExpanded  // New state will trigger expanded container
    });
    setIsSummaryExpanded(!isSummaryExpanded);
  };

  const handleImagePress = useCallback(() => {
    if ((message.mediaType === "image" || message.mediaType === 'photo') && message.mediaURL && !messageExpired) {
      logMessage('Opening full-screen image viewer for group message', { 
        messageId: message.id, 
        mediaURL: message.mediaURL,
        isExpired: messageExpired,
        senderName: sender?.displayName
      });
      setIsFullScreenVisible(true);
    }
  }, [message.mediaType, message.mediaURL, message.id, messageExpired, sender?.displayName]);

  const handleCloseFullScreen = useCallback(() => {
    logMessage('Closing full-screen image viewer for group message', { messageId: message.id });
    setIsFullScreenVisible(false);
  }, [message.id]);

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
              {message.mediaURL ? `�� ${message.text}` : message.text}
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
    // Log container expansion state for group messages
    console.log('[GroupMessageItem] Rendering expired group message with summary expansion:', {
      messageId: message.id,
      isSummaryExpanded,
      senderName: sender?.displayName,
      willApplyExpandedContainer: isSummaryExpanded,
      willApplyExpandedContent: isSummaryExpanded
    });
    
    return (
      <View style={[
        styles.messageContainer, 
        { alignSelf: isOwnMessage ? 'flex-end' : 'flex-start' },
        // Use more screen width for expanded summaries to prevent text cutoff
        isSummaryExpanded && styles.messageContainerExpanded
      ]}>
        {/* Show sender name for group messages */}
        {showSenderName && sender && (
          <Text style={styles.senderName}>{sender.displayName || 'Unknown User'}</Text>
        )}
        
        <TouchableOpacity
          style={[
            styles.messageContent, 
            styles.expiredMessage,
            // Allow content to use full available width when expanded
            isSummaryExpanded && styles.messageContentExpanded
          ]}
          onPress={handleSummaryPress} // Enable tapping to expand/collapse summary
          activeOpacity={0.7}
        >
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
            {(message.mediaType === "image" || message.mediaType === 'photo') && message.mediaURL ? (
              <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9}>
                <Image 
                  source={{ uri: message.mediaURL }} 
                  style={styles.media} 
                  resizeMode="contain"
                  onError={(e) => {
                    console.log('[GroupMessageItem] Image load error:', e.nativeEvent.error);
                    console.log('[GroupMessageItem] Failed URL:', message.mediaURL);
                  }}
                  onLoad={() => console.log('[GroupMessageItem] Image loaded successfully:', message.mediaURL)}
                  onLoadStart={() => console.log('[GroupMessageItem] Image loading started:', message.mediaURL)}
                  onLoadEnd={() => console.log('[GroupMessageItem] Image loading finished:', message.mediaURL)}
                />
              </TouchableOpacity>
            ) : message.mediaType === 'video' && message.mediaURL ? (
              <PlatformVideo
                source={{ uri: message.mediaURL }}
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
            
            {/* TTL countdown timer - positioned outside text area to not obscure content */}
            {!message.text && (
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
            )}
            
            {/* TTL countdown for text messages - positioned below content */}
            {message.text && (
              <View style={styles.timerColumn}>
                <View style={[
                  styles.timerBottomRight,
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
              </View>
            )}
            
            {!message.text && (
              <Text style={styles.timestamp}>
                {formatTimestamp(message.sentAt)}
              </Text>
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
            <Text style={styles.timestamp}>
              {formatTimestamp(message.sentAt)}
            </Text>
          </>
        )}
      </View>
      
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
    padding: 8,
    position: 'relative',
  },
  messageContentExpanded: {
    maxWidth: '100%',
    padding: 2,
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
    minHeight: 150,
    maxHeight: 300,
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f0f0f0', // Show loading background
  },
  timer: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    // Default position - will be overridden by specific positioning styles
    top: 8,
    right: 8,
  },
  timerColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  timerBottomRight: {
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
    maxWidth: '85%', // Increased from 80% to give more space
    paddingHorizontal: 16,
  },
  messageContainerExpanded: {
    maxWidth: '100%', // Use full screen width when expanded
    paddingHorizontal: 2,  // Reduce padding significantly to maximize text space
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
});

export default GroupMessageItem; 