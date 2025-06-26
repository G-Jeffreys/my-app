import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  setDoc 
} from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { useAuth } from '../store/useAuth';
import { Message } from '../models/firestore/message';
import { TtlPreset, DEFAULT_TTL_PRESET, MESSAGE_LIMITS } from '../config/messaging';
import TtlSelector from './TtlSelector';

interface InConversationComposerProps {
  conversationId: string;
  onMessageSent?: (message: Message) => void;
}

const InConversationComposer: React.FC<InConversationComposerProps> = ({
  conversationId,
  onMessageSent,
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const [text, setText] = useState('');
  const [ttl, setTtl] = useState<TtlPreset>(DEFAULT_TTL_PRESET);
  const [isLoading, setIsLoading] = useState(false);

  console.log('[InConversationComposer] Rendering for conversation:', conversationId);

  const handleSendText = async () => {
    if (!user || !text.trim()) {
      console.log('[InConversationComposer] Cannot send - missing user or text');
      return;
    }

    if (text.length > MESSAGE_LIMITS.MAX_TEXT_LENGTH) {
      Alert.alert('Error', `Message too long (max ${MESSAGE_LIMITS.MAX_TEXT_LENGTH} characters)`);
      return;
    }

    setIsLoading(true);
    console.log('[InConversationComposer] Sending text message:', {
      conversationId,
      textLength: text.length,
      ttl
    });

    try {
      // Create message document
      const messageData = {
        senderId: user.uid,
        text: text.trim(),
        mediaURL: null,
        mediaType: 'text' as const,
        ttlPreset: ttl,
        conversationId, // Group conversation ID
        sentAt: serverTimestamp(),
        
        // Future-proofing flags
        hasSummary: false,
        summaryGenerated: false,
        ephemeralOnly: false,
      };

      const messageRef = await addDoc(collection(firestore, 'messages'), messageData);
      
      console.log('[InConversationComposer] Text message sent successfully:', messageRef.id);

      // Create receipts for all group participants
      await createGroupReceipts(messageRef.id, conversationId, user.uid);
      
      const newMessage = { 
        id: messageRef.id, 
        ...messageData,
        sentAt: messageData.sentAt as any // serverTimestamp() will be resolved server-side
      } as Message;
      
      setText(''); // Clear input
      onMessageSent?.(newMessage);
      
      Alert.alert('Success', 'Message sent to group!');
    } catch (error) {
      console.error('[InConversationComposer] Error sending text message:', error);
      Alert.alert(
        'Error',
        'Failed to send message. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to create receipts for group messages
  const createGroupReceipts = async (messageId: string, conversationId: string, senderId: string) => {
    try {
      console.log('[InConversationComposer] Creating group receipts for:', { messageId, conversationId });
      
      // Get conversation participants
      const conversationRef = doc(firestore, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        throw new Error('Conversation not found');
      }
      
      const conversationData = conversationSnap.data();
      const participantIds = conversationData.participantIds || [];
      
      console.log('[InConversationComposer] Found participants:', { count: participantIds.length });
      
      // Create receipts for all participants except sender
      const receiptPromises = participantIds
        .filter((participantId: string) => participantId !== senderId)
        .map(async (participantId: string) => {
          const receiptId = `${messageId}_${participantId}`;
          const receiptData = {
            messageId,
            userId: participantId,
            conversationId,
            receivedAt: serverTimestamp(),
            viewedAt: null,
          };
          
          return setDoc(doc(firestore, 'receipts', receiptId), receiptData);
        });
      
      await Promise.all(receiptPromises);
      console.log('[InConversationComposer] Group receipts created:', { count: receiptPromises.length });
      
    } catch (error) {
      console.error('[InConversationComposer] Error creating group receipts:', error);
      // Don't throw - message was sent successfully, receipt creation is secondary
    }
  };

  const handleSendPhoto = () => {
    console.log('[InConversationComposer] Opening camera for group message');
    // Navigate to camera with conversation context
    router.push({
      pathname: '/camera',
      params: { conversationId }
    });
  };

  return (
    <View style={styles.container}>
      {/* TTL Selector */}
      <View style={styles.ttlContainer}>
        <Text style={styles.ttlLabel}>Message expires in:</Text>
        <TtlSelector selectedTtl={ttl} onTtlChange={setTtl} />
      </View>

      {/* Text Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message to the group..."
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          editable={!isLoading}
          returnKeyType="send"
          onSubmitEditing={handleSendText}
        />
        
        <View style={styles.buttonsContainer}>
          {/* Camera Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.cameraButton]}
            onPress={handleSendPhoto}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>📷</Text>
          </TouchableOpacity>

          {/* Send Text Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.sendButton,
              (!text.trim() || isLoading) && styles.disabledButton
            ]}
            onPress={handleSendText}
            disabled={!text.trim() || isLoading}
          >
            <Text style={[
              styles.buttonText,
              (!text.trim() || isLoading) && styles.disabledText
            ]}>
              {isLoading ? '⏳' : '💬'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Character Counter */}
      <View style={styles.footer}>
        <Text style={styles.characterCount}>{text.length}/500</Text>
        <Text style={styles.hint}>
          Messages will expire after {ttl}s for all group members
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: Platform.OS === 'web' ? 800 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  ttlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  ttlLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f9f9f9',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cameraButton: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  sendButton: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
  },
  disabledText: {
    color: '#999',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
  },
  hint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'right',
  },
});

export default InConversationComposer; 