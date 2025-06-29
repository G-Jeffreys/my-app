import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { useAuth } from '../store/useAuth';
import TtlSelector from './TtlSelector';
import { DEFAULT_TTL_PRESET, TtlPreset, MESSAGE_LIMITS } from '../config/messaging';
import { useRouter } from 'expo-router';

interface TextMessageComposerProps {
  recipientId?: string; // For individual messages
  conversationId?: string; // For group messages
  onSent?: () => void; // Callback when message is sent
  mediaURL?: string; // Optional media to attach
  mediaType?: 'photo' | 'video'; // Type of attached media
  style?: any;
}

// Console log function for debugging text message sending
const logTextMessage = (message: string, data?: any) => {
  console.log(`[TextMessage] ${message}`, data ? data : '');
};

const TextMessageComposer: React.FC<TextMessageComposerProps> = ({
  recipientId,
  conversationId,
  onSent,
  mediaURL,
  mediaType,
  style
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [selectedTtl, setSelectedTtl] = useState<TtlPreset>(user?.defaultTtl || DEFAULT_TTL_PRESET);
  const [isSending, setIsSending] = useState(false);
  
  const isValidMessage = text.trim().length > 0 || mediaURL;
  const isOverLimit = text.length > MESSAGE_LIMITS.MAX_TEXT_LENGTH;
  const characterCount = text.length;
  const remainingChars = MESSAGE_LIMITS.MAX_TEXT_LENGTH - characterCount;

  const handleSend = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to send messages');
      return;
    }

    if (!isValidMessage) {
      Alert.alert('Error', 'Message cannot be empty');
      return;
    }

    if (isOverLimit) {
      Alert.alert('Error', `Message is too long (${characterCount}/${MESSAGE_LIMITS.MAX_TEXT_LENGTH} characters)`);
      return;
    }

    if (!recipientId && !conversationId) {
      Alert.alert('Error', 'No recipient selected');
      return;
    }

    logTextMessage('Sending text message', {
      hasText: !!text.trim(),
      hasMedia: !!mediaURL,
      ttl: selectedTtl,
      recipientId,
      conversationId,
      textLength: text.length,
      messageType: conversationId ? 'group' : 'individual'
    });

    setIsSending(true);

    try {
      // Create message document
      const messageData = {
        senderId: user.uid,
        text: text.trim() || null,
        mediaURL: mediaURL || null,
        mediaType: mediaURL ? mediaType || 'photo' : 'text',
        ttlPreset: selectedTtl,
        sentAt: serverTimestamp(),
        
        // Add recipient info
        ...(recipientId ? { recipientId } : {}),
        ...(conversationId ? { conversationId } : {}),
        
        // Phase 2 default lifecycle & LLM flags
        hasSummary: false,
        summaryGenerated: false,
        ephemeralOnly: false,
        delivered: true, // Default to delivered, AI pipeline may change this if content is blocked
        blocked: false,   // Will remain false; backend sets true if moderation fails
      };

      const messageRef = await addDoc(collection(firestore, 'messages'), messageData);
      
      logTextMessage('✅ Message document created', { 
        messageId: messageRef.id,
        hasMedia: !!mediaURL,
        isGroup: !!conversationId
      });

      // For group messages, receipts are now created automatically by recipients
      // This is handled by the useReceiptTracking hook to comply with new security rules
      if (recipientId) {
        // For individual messages, create receipt for the recipient
        await createIndividualReceipt(messageRef.id, recipientId);
      }

      // Reset form
      setText('');
      
      // Call success callback
      if (onSent) {
        onSent();
      } else {
        // Navigate back to home if no callback provided
        router.replace('/(protected)/home');
      }

      Alert.alert('Success', conversationId ? 'Message sent to group!' : 'Message sent!');

    } catch (error) {
      logTextMessage('❌ Error sending message', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Note: Group receipts are now created automatically by recipients when they load messages
  // This is handled by the useReceiptTracking hook to comply with new security rules

  // Helper function to create receipt for individual messages
  const createIndividualReceipt = async (messageId: string, recipientId: string) => {
    try {
      logTextMessage('📧 Creating individual receipt', { messageId, recipientId });
      
      const receiptId = `${messageId}_${recipientId}`;
      const receiptData = {
        messageId,
        userId: recipientId,
        receivedAt: serverTimestamp(),
        viewedAt: null,
      };
      
      await setDoc(doc(firestore, 'receipts', receiptId), receiptData);
      logTextMessage('✅ Individual receipt created', { receiptId });
      
    } catch (error) {
      logTextMessage('❌ Error creating individual receipt', error);
      // Don't throw - message was sent successfully, receipt creation is secondary
    }
  };

  const navigateToSelectFriend = () => {
    if (text.trim() || mediaURL) {
      // TODO: Pass text and media to friend selection
      logTextMessage('Navigating to friend selection with content');
      router.push('/(protected)/select-friend');
    } else {
      Alert.alert('Error', 'Please enter a message first');
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.textInput,
            isOverLimit && styles.textInputError
          ]}
          value={text}
          onChangeText={setText}
          placeholder={mediaURL ? "Add a caption..." : "Type your message..."}
          multiline
          maxLength={MESSAGE_LIMITS.MAX_TEXT_LENGTH + 100} // Allow typing beyond limit to show error
          textAlignVertical="top"
        />
        
        {/* Character counter */}
        <View style={styles.characterCounter}>
          <Text style={[
            styles.characterCountText,
            isOverLimit && styles.characterCountError
          ]}>
            {remainingChars < 50 ? `${remainingChars} left` : ''}
            {isOverLimit && ` (${Math.abs(remainingChars)} over limit)`}
          </Text>
        </View>
      </View>

      {/* TTL Selector */}
      <TtlSelector
        selectedTtl={selectedTtl}
        onTtlChange={setSelectedTtl}
        compact={true}
      />

      {/* Media Preview */}
      {mediaURL && (
        <View style={styles.mediaPreview}>
          <Text style={styles.mediaPreviewText}>
            📎 {mediaType === 'video' ? 'Video' : 'Photo'} attached
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {recipientId || conversationId ? (
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!isValidMessage || isOverLimit || isSending) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!isValidMessage || isOverLimit || isSending}
          >
            <Text style={styles.sendButtonText}>
              {isSending ? 'Sending...' : 'Send Message'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.selectFriendButton,
              (!isValidMessage || isOverLimit) && styles.selectFriendButtonDisabled
            ]}
            onPress={navigateToSelectFriend}
            disabled={!isValidMessage || isOverLimit}
          >
            <Text style={styles.selectFriendButtonText}>
              Choose Recipient
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Help Text */}
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          💡 Message will expire {selectedTtl} after being received
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    maxHeight: 200,
    backgroundColor: '#fafafa',
  },
  textInputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  characterCounter: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  characterCountText: {
    fontSize: 12,
    color: '#666',
  },
  characterCountError: {
    color: '#f44336',
    fontWeight: '600',
  },
  mediaPreview: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  mediaPreviewText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  actionButtons: {
    marginTop: 16,
  },
  sendButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectFriendButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectFriendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  selectFriendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default TextMessageComposer; 