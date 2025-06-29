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
  KeyboardAvoidingView,
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
import ConversationSummaryBanner from '../../../components/ConversationSummaryBanner';
import ProcessingDemarcationLine from '../../../components/ProcessingDemarcationLine';

console.log('[GroupConversation] Component loaded');

export default function GroupConversationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processedMessageCount, setProcessedMessageCount] = useState(0);
  const [totalMessageCount, setTotalMessageCount] = useState(0);

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
            console.log('[GroupConversation] Conversation updated:', {
              name: conversationData.name,
              messageCount: conversationData.messageCount,
              lastProcessedMessageCount: conversationData.lastProcessedMessageCount,
              ragEnabled: conversationData.ragEnabled
            });
            setConversation(conversationData);

            // Update processed message count from conversation data
            const processedCount = conversationData.lastProcessedMessageCount || 0;
            console.log('[GroupConversation] Updating processedMessageCount:', {
              previousCount: processedMessageCount,
              newCount: processedCount
            });
            setProcessedMessageCount(processedCount);

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
          orderBy('sentAt', 'asc')
        );

        const unsubscribeMessages = onSnapshot(
          messagesQuery,
          (snapshot) => {
            const messagesData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Message[];

            console.log('[GroupConversation] Messages updated:', { 
              messageCount: messagesData.length,
              conversationId 
            });

            setMessages(messagesData);
            setTotalMessageCount(messagesData.length);
            
            // Update conversation message count if it's different
            if (conversation && messagesData.length !== conversation.messageCount) {
              console.log('[GroupConversation] Message count mismatch - updating:', {
                actualCount: messagesData.length,
                storedCount: conversation.messageCount
              });
            }
            
            setLoading(false);
          },
          (error) => {
            console.error('[GroupConversation] Error loading messages:', error);
            setLoading(false);
          }
        );

        return () => {
          console.log('[GroupConversation] Cleaning up listeners');
          conversationUnsubscribe();
          unsubscribeMessages();
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

  const renderMessageItem = ({ item, index }: { item: Message; index: number }) => {
    const messagePosition = index + 1; // 1-based position
    const shouldShowDemarcation = messagePosition === processedMessageCount + 1;
    const isOwnMessage = item.senderId === user?.uid;
    const sender = participants.find(p => p.id === item.senderId);
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showSenderName = !isOwnMessage && (!previousMessage || previousMessage.senderId !== item.senderId);

    console.log('[GroupConversation] Rendering message:', {
      messageId: item.id,
      position: messagePosition,
      processedCount: processedMessageCount,
      shouldShowDemarcation
    });

    return (
      <>
        {shouldShowDemarcation && (
          <ProcessingDemarcationLine 
            processedCount={processedMessageCount} 
            totalCount={totalMessageCount} 
          />
        )}
        <GroupMessageItem 
          message={item} 
          sender={sender}
          isOwnMessage={isOwnMessage}
          showSenderName={showSenderName}
        />
      </>
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 25 : 0}
      >
        <Header 
          title={conversation?.name || 'Group Chat'} 
          showBackButton={true}
          rightComponent={
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/(protected)/group-settings/[conversationId]',
                params: { conversationId }
              })}
              style={styles.settingsButton}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          }
        />

        {/* Conversation Summary Banner */}
        <ConversationSummaryBanner 
          conversationId={conversationId}
          totalMessages={totalMessageCount}
        />

        {/* DEBUG: RAG Status Information */}
        {__DEV__ && conversation && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>🔍 RAG Debug Info:</Text>
            <Text style={styles.debugText}>RAG Enabled: {conversation.ragEnabled ? '✅ Yes' : '❌ No'}</Text>
            <Text style={styles.debugText}>Message Count: {conversation.messageCount || 0}</Text>
            <Text style={styles.debugText}>Last Processed: {conversation.lastProcessedMessageCount || 0}</Text>
            <Text style={styles.debugText}>Total Messages: {totalMessageCount}</Text>
            <Text style={styles.debugText}>Processed Count (State): {processedMessageCount}</Text>
            <Text style={styles.debugText}>Messages Since Last Summary: {(conversation.messageCount || 0) - (conversation.lastProcessedMessageCount || 0)}</Text>
            <Text style={styles.debugText}>Should Show Demarcation: {processedMessageCount > 0 && processedMessageCount < totalMessageCount ? '✅ Yes' : '❌ No'}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading conversation...</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        <InConversationComposer
          conversationId={conversationId}
          onMessageSent={() => {
            console.log('[GroupConversation] Message sent - refreshing data');
            // Messages will update automatically via real-time listener
          }}
        />
      </KeyboardAvoidingView>
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
  settingsIcon: {
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  debugContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
}); 