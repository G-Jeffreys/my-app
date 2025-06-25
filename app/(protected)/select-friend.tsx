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

// Console log function for debugging message sending
const logSending = (message: string, data?: any) => {
  console.log(`[SelectFriend] ${message}`, data ? data : '');
};

interface RecipientOption {
  id: string;
  name: string;
  type: 'friend' | 'group';
  photoURL?: string;
  participantCount?: number;
}

export default function SelectFriendScreen() {
  const router = useRouter();
  const { uri, type } = useLocalSearchParams<{
    uri: string;
    type: "image" | "video";
  }>();
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecipientsAndGroups = async () => {
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

        // 2. Fetch group conversations
        const conversationsSnapshot = await getDocs(
          collection(firestore, "conversations")
        );
        
        const groupsList: RecipientOption[] = [];
        for (const conversationDoc of conversationsSnapshot.docs) {
          const conversationData = conversationDoc.data() as Conversation;
          
          // Only include conversations where current user is a participant
          if (conversationData.participantIds?.includes(auth.currentUser.uid)) {
            groupsList.push({
              id: conversationDoc.id,
              name: conversationData.name || `Group (${conversationData.participantIds.length})`,
              type: 'group',
              participantCount: conversationData.participantIds.length,
            });
          }
        }

        logSending('Found groups:', groupsList.length);

        // 3. Combine and sort (friends first, then groups)
        const allRecipients = [
          ...friendsList,
          ...groupsList
        ];

        setRecipients(allRecipients);
        logSending('Total recipients available:', allRecipients.length);

      } catch (error) {
        console.error("Failed to fetch recipients:", error);
        Alert.alert("Error", "Could not load your friends and groups.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecipientsAndGroups();
  }, []);

  const handleSend = async (recipient: RecipientOption) => {
    if (!uri || !type || !auth.currentUser) {
      Alert.alert("Error", "Missing information to send message.");
      return;
    }

    setSelectedRecipientId(recipient.id);
    setIsSending(true);

    logSending('Sending media message', {
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientType: recipient.type,
      mediaType: type,
      hasUri: !!uri
    });

    try {
      // 1. Upload media
      logSending('Uploading media to Firebase Storage...');
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(
        storage,
        `media/${auth.currentUser.uid}/${Date.now()}`
      );
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      logSending('✅ Media uploaded successfully', { downloadURL });

      // 2. Create message document
      const messageData = {
        senderId: auth.currentUser.uid,
        mediaURL: downloadURL,
        mediaType: type,
        sentAt: serverTimestamp(),
        ttlPreset: '24h', // TODO: Use user's default TTL
        text: null,
        
        // Add recipient info based on type
        ...(recipient.type === 'friend' ? { recipientId: recipient.id } : {}),
        ...(recipient.type === 'group' ? { conversationId: recipient.id } : {}),
        
        // Future-proofing flags
        hasSummary: false,
        summaryGenerated: false,
        ephemeralOnly: false,
      };

      const messageRef = await addDoc(collection(firestore, "messages"), messageData);
      logSending('✅ Message document created', { messageId: messageRef.id });

      // 3. Create receipts based on recipient type
      if (recipient.type === 'friend') {
        await createIndividualReceipt(messageRef.id, recipient.id);
      } else if (recipient.type === 'group') {
        await createGroupReceipts(messageRef.id, recipient.id, auth.currentUser.uid);
      }

      Alert.alert("Success", `Message sent to ${recipient.name}!`);
      router.replace("/(protected)/home");
      
    } catch (error) {
      console.error("Failed to send media:", error);
      logSending('❌ Error sending message', error);
      Alert.alert("Error", "Failed to send your message. Please try again.");
    } finally {
      setIsSending(false);
      setSelectedRecipientId(null);
    }
  };

  // Helper function to create receipts for group messages
  const createGroupReceipts = async (messageId: string, conversationId: string, senderId: string) => {
    try {
      logSending('📧 Creating group receipts', { messageId, conversationId });
      
      // Get conversation participants
      const conversationRef = doc(firestore, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        throw new Error('Conversation not found');
      }
      
      const conversationData = conversationSnap.data();
      const participantIds = conversationData.participantIds || [];
      
      logSending('📧 Found participants', { count: participantIds.length, participantIds });
      
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
      logSending('✅ Group receipts created', { count: receiptPromises.length });
      
    } catch (error) {
      logSending('❌ Error creating group receipts', error);
      // Don't throw - message was sent successfully, receipt creation is secondary
    }
  };

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
        {item.type === 'friend' ? (
          <Image source={{ uri: item.photoURL || "" }} style={styles.avatar} />
        ) : (
          <View style={styles.groupAvatar}>
            <Text style={styles.groupAvatarText}>👥</Text>
          </View>
        )}
        
        <View style={styles.recipientDetails}>
          <Text style={styles.recipientName}>{item.name}</Text>
          <Text style={styles.recipientType}>
            {item.type === 'friend' ? 'Friend' : `Group • ${item.participantCount} members`}
          </Text>
        </View>
      </View>
      
      {isSending && selectedRecipientId === item.id && (
        <ActivityIndicator color="#2196f3" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Send To..." showBackButton />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Loading recipients...</Text>
        </View>
      ) : (
        <FlatList
          data={recipients}
          renderItem={renderRecipient}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No friends or groups to send to.</Text>
              <Text style={styles.emptySubtext}>Add friends or create a group to get started!</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupAvatarText: {
    fontSize: 20,
  },
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
}); 