import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { useAuth } from '../../../store/useAuth';
import { Message } from '../../../models/firestore/message';
import { Conversation } from '../../../models/firestore/conversation';
import { User } from '../../../models/firestore/user';
import Header from '../../../components/Header';
import GroupMessageItem from '../../../components/GroupMessageItem';
import InConversationComposer from '../../../components/InConversationComposer';

console.log('[GroupConversation] Component loaded');

export default function GroupConversationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('[GroupConversation] Rendering for conversation:', conversationId);

  useEffect(() => {
    if (!user || !conversationId) {
      console.log('[GroupConversation] Missing user or conversationId');
      setLoading(false);
      return;
    }

    console.log('[GroupConversation] Setting up listeners for:', conversationId);

    const setupConversationListeners = async () => {
      try {
        // 1. Listen to conversation metadata
        const conversationRef = doc(firestore, 'conversations', conversationId);
        const conversationUnsubscribe = onSnapshot(conversationRef, async (doc) => {
          if (doc.exists()) {
            const conversationData = { id: doc.id, ...doc.data() } as Conversation;
            console.log('[GroupConversation] Conversation updated:', conversationData.name);
            setConversation(conversationData);

            // Fetch participant details
            await fetchParticipants(conversationData.participantIds);
          } else {
            console.log('[GroupConversation] Conversation not found');
            router.back();
          }
        });

        // 2. Listen to messages in this conversation
        const messagesQuery = query(
          collection(firestore, 'messages'),
          where('conversationId', '==', conversationId),
          orderBy('sentAt', 'asc') // Ascending for chat-like view
        );

        const messagesUnsubscribe = onSnapshot(
          messagesQuery, 
          (snapshot) => {
            // Phase 2: Filter out blocked or undelivered messages
            const messagesList = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }) as Message)
              .filter(message => {
                // For backward compatibility, treat messages without these flags as delivered
                if (message.blocked === true || message.delivered === false) {
                  console.log('[GroupConversation] Filtering out blocked/undelivered message:', message.id);
                  return false;
                }
                return true;
              });
            
            console.log('[GroupConversation] Messages updated:', messagesList.length);
            setMessages(messagesList);
            setLoading(false);
          },
          (error) => {
            console.error('[GroupConversation] Messages query error:', error);
            // Set loading to false even if there's an error so UI doesn't get stuck
            setLoading(false);
            setMessages([]); // Show empty state
          }
        );

        return () => {
          console.log('[GroupConversation] Cleaning up listeners');
          conversationUnsubscribe();
          messagesUnsubscribe();
        };

      } catch (error) {
        console.error('[GroupConversation] Error setting up listeners:', error);
        setLoading(false);
      }
    };

    const cleanup = setupConversationListeners();
    
    return () => {
      cleanup.then(fn => fn && fn()).catch(console.error);
    };
  }, [user, conversationId, router]);

  const fetchParticipants = async (participantIds: string[]) => {
    try {
      const participantPromises = participantIds.map(async (participantId) => {
        const userDoc = await getDoc(doc(firestore, 'users', participantId));
        if (userDoc.exists()) {
          return { id: userDoc.id, ...userDoc.data() } as User;
        }
        return null;
      });

      const participantsList = (await Promise.all(participantPromises)).filter(
        (p): p is User => p !== null
      );
      
      console.log('[GroupConversation] Participants loaded:', participantsList.length);
      setParticipants(participantsList);
    } catch (error) {
      console.error('[GroupConversation] Error fetching participants:', error);
    }
  };

  const handleMessageSent = (newMessage: Message) => {
    console.log('[GroupConversation] New message sent:', newMessage.id);
    // Messages will be updated via the real-time listener
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const sender = participants.find(p => p.id === item.senderId);
    const isOwnMessage = item.senderId === user?.uid;
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showSenderName = !isOwnMessage && (!previousMessage || previousMessage.senderId !== item.senderId);

    return (
      <GroupMessageItem
        message={item}
        sender={sender}
        isOwnMessage={isOwnMessage}
        showSenderName={showSenderName}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Loading..." showBackButton />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Group Not Found" showBackButton />
        <View style={styles.centered}>
          <Text style={styles.errorText}>This conversation could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rightComponent = (
    <TouchableOpacity 
      onPress={() => router.push({
        pathname: '/(protected)/group-settings/[conversationId]',
        params: { conversationId }
      })}
      style={styles.settingsButton}
      accessibilityLabel="Group settings"
      accessibilityRole="button"
    >
      <Text style={styles.settingsButtonText}>⚙️</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={conversation.name || `Group (${participants.length})`}
        showBackButton 
        rightComponent={rightComponent}
      />
      
      <View style={styles.content}>
        {/* Participants Info */}
        <View style={styles.participantsBar}>
          <Text style={styles.participantsText}>
            {participants.map(p => p.displayName || 'Unknown').join(', ')}
          </Text>
        </View>

        {/* Messages List */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Send the first message to get the conversation started!</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* In-Conversation Composer */}
        <InConversationComposer
          conversationId={conversationId!}
          onMessageSent={handleMessageSent}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    maxWidth: Platform.OS === 'web' ? 800 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
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
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  participantsBar: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  participantsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  settingsButton: {
    padding: 8,
    marginRight: 8,
  },
  settingsButtonText: {
    fontSize: 20,
  },
}); 