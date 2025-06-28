import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firestore, auth, storage } from "../../lib/firebase";
import { User } from "../../models/firestore/user";
import { Conversation } from "../../models/firestore/conversation";
import Header from "../../components/Header";
import { SafeAreaView } from "react-native-safe-area-context";
import { Friend } from "../../models/firestore/friend";
import { DEFAULT_TTL_PRESET, TtlPreset, isValidTtlPreset } from '../../config/messaging';
import { useAuth } from '../../store/useAuth';

// Console log function for debugging message sending
const logSending = (message: string, data?: any) => {
  console.log(`[SelectFriend] ${message}`, data ? data : '');
};

interface RecipientOption {
  id: string;
  name: string;
  type: 'friend'; // Phase 3: Only friends supported in individual message flow
  photoURL?: string;
  // participantCount removed - not needed for individual friends
}

export default function SelectFriendScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { uri, type, selectedTtl, text } = useLocalSearchParams<{
    uri?: string;
    type?: "image" | "video" | "text";
    selectedTtl: string;
    text?: string;
  }>();
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);

  // Validate and set TTL with proper fallback
  const ttlToUse = selectedTtl && isValidTtlPreset(selectedTtl) 
    ? selectedTtl as TtlPreset 
    : (user?.defaultTtl || DEFAULT_TTL_PRESET);

  // Determine message type
  const isTextMessage = type === 'text' || (text && !uri);
  const isMediaMessage = !!uri && type && ['image', 'video'].includes(type);

  console.log('[SelectFriendScreen] Component rendered', {
    hasUri: !!uri,
    hasText: !!text,
    mediaType: type,
    selectedTtl,
    ttlToUse,
    hasTtlParam: !!selectedTtl,
    isValidTtl: selectedTtl ? isValidTtlPreset(selectedTtl) : false,
    userDefaultTtl: user?.defaultTtl,
    isTextMessage,
    isMediaMessage,
    messageContent: isTextMessage ? text?.substring(0, 50) + '...' : 'media'
  });

  useEffect(() => {
    // Validate required parameters
    if (!isTextMessage && !isMediaMessage) {
      console.error('[SelectFriendScreen] Missing required params:', { uri, type, text, selectedTtl });
      Alert.alert('Error', 'Missing message content. Please go back and try again.');
      router.back();
      return;
    }

    if (isTextMessage && (!text || text.trim().length === 0)) {
      console.error('[SelectFriendScreen] Empty text message');
      Alert.alert('Error', 'Text message cannot be empty. Please go back and add content.');
      router.back();
      return;
    }

    console.log('[SelectFriendScreen] Validation passed', { 
      isTextMessage, 
      isMediaMessage,
      hasValidContent: isTextMessage ? !!text?.trim() : !!uri
    });

    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      console.log('[SelectFriendScreen] Fetching recipients...');
      if (!auth.currentUser) return;
      setLoading(true);
      
      try {
        logSending('Fetching friends and groups for user:', auth.currentUser.uid);
        
        // 1. Fetch individual friends
        const friendsCollectionRef = collection(
          firestore,
          "users",
          auth.currentUser.uid,
          "friends"
        );
        const friendsSnapshot = await getDocs(friendsCollectionRef);
        const friendPromises = friendsSnapshot.docs.map(async (friendDoc) => {
          const friendData = friendDoc.data() as Friend;
          const userDocRef = doc(firestore, "users", friendData.friendId);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            return {
              id: userSnap.id,
              name: userData.displayName || 'Unknown',
              type: 'friend' as const,
              photoURL: userData.photoURL,
            } as RecipientOption;
          }
          return null;
        });

        const friendsList = (await Promise.all(friendPromises)).filter(
          (f): f is RecipientOption => f !== null
        );

        logSending('Found friends:', friendsList.length);

        // Phase 3: Groups are now handled exclusively through the Groups screen
        // Individual message flow only supports direct friend-to-friend messaging
        logSending('Groups excluded from individual messaging flow (Phase 3)');

        // 2. Use only friends for individual messaging
        const allRecipients = friendsList;

        setRecipients(allRecipients);
        logSending('Total recipients available:', allRecipients.length);

      } catch (error) {
        console.error("Failed to fetch recipients:", error);
        Alert.alert("Error", "Could not load your friends and groups.");
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch recipients:", error);
      Alert.alert("Error", "Failed to load recipients. Please try again later.");
    }
  };

  const handleSend = async (recipient: RecipientOption) => {
    if (!auth.currentUser || (!isTextMessage && (!uri || !type)) || (isTextMessage && !text?.trim())) {
      Alert.alert("Error", "Missing information to send message.");
      return;
    }

    setSelectedRecipientId(recipient.id);
    setIsSending(true);

    logSending('Sending message', {
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientType: recipient.type,
      messageType: isTextMessage ? 'text' : type,
      hasUri: !!uri,
      hasText: !!text,
      selectedTtl,
      ttlToUse,
      willUseTtl: ttlToUse
    });

    try {
      let downloadURL = null;

      // Step 1: Upload media if this is a media message
      if (isMediaMessage && uri) {
        console.log('[SelectFriendScreen] Uploading media file...');
        const response = await fetch(uri);
        const blob = await response.blob();
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const storageRef = ref(storage, `messages/${filename}`);
        await uploadBytes(storageRef, blob);
        downloadURL = await getDownloadURL(storageRef);
        console.log('[SelectFriendScreen] Media upload completed:', { downloadURL });
      }

      // Step 2: Create message document
      console.log('[SelectFriendScreen] Creating message with TTL:', {
        ttlToUse,
        selectedTtl,
        messageWillHaveTtl: ttlToUse,
        messageType: isTextMessage ? 'text' : 'media'
      });
      
      const messageData = {
        senderId: auth.currentUser.uid,
        sentAt: serverTimestamp(),
        ttlPreset: ttlToUse,
        
        // Add message content based on type
        ...(isTextMessage ? { 
          text: text?.trim(), 
          mediaURL: null,
          mediaType: "text" 
        } : { 
          text: null,
          mediaURL: downloadURL,
          mediaType: type 
        }),
        
        // Phase 3: Only individual friend messaging supported in this flow
        recipientId: recipient.id, // recipient.type is always 'friend' now
        
        // Phase 2 default lifecycle & LLM flags
        hasSummary: false,
        summaryGenerated: false,
        ephemeralOnly: false,
        delivered: true, // Default to delivered, AI pipeline may change this if content is blocked
        blocked: false,
      };

      const messageRef = await addDoc(collection(firestore, 'messages'), messageData);
      console.log('[SelectFriendScreen] Message created successfully:', { 
        messageId: messageRef.id,
        messageType: isTextMessage ? 'text' : 'media',
        content: isTextMessage ? text?.substring(0, 50) + '...' : 'media file'
      });

      // 3. Create receipt for individual friend (Phase 3: group handling removed)
      await createIndividualReceipt(messageRef.id, recipient.id);

      // Success! Navigate back immediately with console feedback
      console.log(`✅ Message sent successfully to ${recipient.name}`, {
        messageType: isTextMessage ? 'text' : type,
        recipient: recipient.name,
        recipientType: recipient.type,
        ttl: ttlToUse,
        messageId: messageRef.id
      });
      
      // Navigate back to home immediately
      router.replace("/(protected)/home");
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert(
        "Error",
        `Failed to send ${isTextMessage ? 'text message' : type}. Please try again.`
      );
    } finally {
      setIsSending(false);
    }
  };

  // Phase 3: Group receipt creation removed - handled by group conversation components

  // Helper function to create receipt for individual messages
  const createIndividualReceipt = async (messageId: string, recipientId: string) => {
    try {
      logSending('📧 Creating individual receipt', { messageId, recipientId });
      
      const receiptId = `${messageId}_${recipientId}`;
      const receiptData = {
        messageId,
        userId: recipientId,
        receivedAt: serverTimestamp(),
        viewedAt: null,
      };
      
      await setDoc(doc(firestore, 'receipts', receiptId), receiptData);
      logSending('✅ Individual receipt created', { receiptId });
      
    } catch (error) {
      logSending('❌ Error creating individual receipt', error);
      // Don't throw - message was sent successfully, receipt creation is secondary
    }
  };

  const renderRecipient = ({ item }: { item: RecipientOption }) => (
    <TouchableOpacity
      style={styles.recipientRow}
      onPress={() => handleSend(item)}
      disabled={isSending}
    >
      <View style={styles.recipientInfo}>
        {/* Phase 3: Only friends are shown, so always render friend avatar */}
        <Image source={{ uri: item.photoURL || "" }} style={styles.avatar} />
        
        <View style={styles.recipientDetails}>
          <Text style={styles.recipientName}>{item.name}</Text>
          <Text style={styles.recipientType}>Friend</Text>
        </View>
      </View>
      
      {isSending && selectedRecipientId === item.id && (
        <ActivityIndicator color="#2196f3" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Select Recipient" showBackButton />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={`Send ${isTextMessage ? 'Message' : type === 'image' ? 'Photo' : 'Video'}`} 
        showBackButton 
      />
      
      {/* Message Preview */}
      <View style={styles.messagePreview}>
        {isTextMessage ? (
          <View style={styles.textPreview}>
            <Text style={styles.previewLabel}>Your Message:</Text>
            <Text style={styles.textContent} numberOfLines={3}>
              {text}
            </Text>
          </View>
        ) : (
          <View style={styles.mediaPreview}>
            <Text style={styles.previewLabel}>Your {type}:</Text>
            {type === "image" ? (
              <Image source={{ uri }} style={styles.previewImage} />
            ) : (
              <View style={styles.videoPreview}>
                <Text style={styles.videoText}>📹 Video Ready</Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.ttlInfo}>Expires: {ttlToUse}</Text>
      </View>
      
      <FlatList
        data={recipients}
        renderItem={renderRecipient}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No friends to send to.</Text>
            <Text style={styles.emptySubtext}>Add friends to start messaging! Use Groups screen for group conversations.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "white" 
  },
  centered: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: '#fff',
  },
  recipientInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  // Phase 3: Group avatar styles removed - only individual friends supported
  recipientDetails: {
    flex: 1,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  recipientType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 81, // Align with text content
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  messagePreview: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  textPreview: {
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textContent: {
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mediaPreview: {
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  videoPreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  videoText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  ttlInfo: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
}); 