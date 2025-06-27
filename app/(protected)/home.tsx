import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { collection, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { firestore } from "../../lib/firebase";
import { useAuth } from "../../store/useAuth";
import { Message } from "../../models/firestore/message";
import { Conversation } from "../../models/firestore/conversation";
import MessageItem from "../../components/MessageItem";
import GroupConversationItem from "../../components/GroupConversationItem";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../components/Header";

// Combined item type for the unified feed
type FeedItem = {
  id: string;
  type: 'message' | 'conversation';
  data: Message | Conversation;
  timestamp: Date;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('[HomeScreen] Component rendered with user:', user?.email);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    console.log('[HomeScreen] Setting up messages listener for user:', user.uid);

    // Enhanced query to fetch both individual messages and group conversations
    const fetchFeedData = async () => {
      try {
        console.log('[HomeScreen] Setting up unified feed listeners');

        const unsubscribes: (() => void)[] = [];
        const allFeedItems = new Map<string, FeedItem>();

        const updateFeed = () => {
          const sortedItems = Array.from(allFeedItems.values()).sort((a, b) => {
            return b.timestamp.getTime() - a.timestamp.getTime(); // Descending order (newest first)
          });
          
          console.log('[HomeScreen] Feed updated:', sortedItems.length, 'items');
          setFeedItems(sortedItems);
          setLoading(false);
        };

        // 1. Listen to conversations where user is a participant
        const conversationsQuery = query(
          collection(firestore, "conversations"),
          where("participantIds", "array-contains", user.uid),
          orderBy("lastMessageAt", "desc")
        );

        const conversationsUnsubscribe = onSnapshot(
          conversationsQuery,
          (snapshot) => {
            console.log('[HomeScreen] Conversations updated:', snapshot.size);
            
            // Remove old conversations
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                allFeedItems.delete(`conversation-${change.doc.id}`);
              }
            });

            // Add/update conversations
            snapshot.forEach((doc) => {
              const conversationData = { id: doc.id, ...doc.data() } as Conversation;
              const timestamp = conversationData.lastMessageAt 
                ? (conversationData.lastMessageAt instanceof Date 
                   ? conversationData.lastMessageAt 
                   : new Date((conversationData.lastMessageAt as any)?.seconds * 1000))
                : conversationData.createdAt instanceof Date 
                  ? conversationData.createdAt 
                  : new Date((conversationData.createdAt as any)?.seconds * 1000);

              allFeedItems.set(`conversation-${doc.id}`, {
                id: `conversation-${doc.id}`,
                type: 'conversation',
                data: conversationData,
                timestamp,
              });
            });

            updateFeed();
          },
          (error) => {
            console.error('[HomeScreen] Error in conversations query:', error);
            // Don't set loading to false here, still try individual messages
          }
        );
        unsubscribes.push(conversationsUnsubscribe);

        // 2. Listen to individual messages where user is recipient
        const individualMessagesQuery = query(
          collection(firestore, "messages"),
          where("recipientId", "==", user.uid),
          orderBy("sentAt", "desc")
        );

        const individualMessagesUnsubscribe = onSnapshot(
          individualMessagesQuery,
          (snapshot) => {
            console.log('[HomeScreen] Individual messages updated:', snapshot.size);
            
            // Remove old individual messages
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                allFeedItems.delete(`message-${change.doc.id}`);
              }
            });

            // Add/update individual messages (filter out group messages and blocked content)
            snapshot.forEach((doc) => {
              const messageData = { id: doc.id, ...doc.data() } as Message;
              
              // Skip messages that have a conversationId (these are group messages)
              if (messageData.conversationId) {
                return;
              }
              
              // Only show messages where user is sender or recipient
              if (messageData.senderId !== user.uid && messageData.recipientId !== user.uid) {
                return;
              }
              
              // Phase 2: Skip blocked messages or messages that haven't been delivered yet
              // For backward compatibility, treat messages without these flags as delivered
              if (messageData.blocked === true || messageData.delivered === false) {
                console.log('[HomeScreen] Filtering out blocked/undelivered message:', doc.id);
                return;
              }
              
              const timestamp = messageData.sentAt instanceof Date 
                ? messageData.sentAt 
                : new Date((messageData.sentAt as any)?.seconds * 1000);

              allFeedItems.set(`message-${doc.id}`, {
                id: `message-${doc.id}`,
                type: 'message',
                data: messageData,
                timestamp,
              });
            });

            updateFeed();
          },
          (error) => {
            console.error('[HomeScreen] Error in individual messages query:', error);
            setLoading(false);
          }
        );
        unsubscribes.push(individualMessagesUnsubscribe);

        // 3. Listen to individual messages where user is sender (to show sent messages)
        const sentMessagesQuery = query(
          collection(firestore, "messages"),
          where("senderId", "==", user.uid),
          orderBy("sentAt", "desc")
        );

        const sentMessagesUnsubscribe = onSnapshot(
          sentMessagesQuery,
          (snapshot) => {
            console.log('[HomeScreen] Sent messages updated:', snapshot.size);
            
            // Remove old sent messages
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                allFeedItems.delete(`message-${change.doc.id}`);
              }
            });

            // Add/update sent messages (filter out group messages and blocked content)
            snapshot.forEach((doc) => {
              const messageData = { id: doc.id, ...doc.data() } as Message;
              
              // Skip messages that have a conversationId (these are group messages)
              if (messageData.conversationId) {
                return;
              }
              
              // Phase 2: Skip blocked messages or messages that haven't been delivered yet
              // For backward compatibility, treat messages without these flags as delivered
              if (messageData.blocked === true || messageData.delivered === false) {
                console.log('[HomeScreen] Filtering out blocked/undelivered sent message:', doc.id);
                return;
              }
              
              const timestamp = messageData.sentAt instanceof Date 
                ? messageData.sentAt 
                : new Date((messageData.sentAt as any)?.seconds * 1000);

              allFeedItems.set(`message-${doc.id}`, {
                id: `message-${doc.id}`,
                type: 'message',
                data: messageData,
                timestamp,
              });
            });

            updateFeed();
          },
          (error) => {
            console.error('[HomeScreen] Error in sent messages query:', error);
            setLoading(false);
          }
        );
        unsubscribes.push(sentMessagesUnsubscribe);

        // Initial update to show loading state is complete
        updateFeed();

        return () => {
          console.log('[HomeScreen] Cleaning up', unsubscribes.length, 'feed listeners');
          unsubscribes.forEach(unsub => unsub());
        };

      } catch (error) {
        console.error('[HomeScreen] Error setting up feed listeners:', error);
        setLoading(false);
        return () => {}; // Return empty cleanup function
      }
    };

    const cleanupPromise = fetchFeedData();
    
    return () => {
      cleanupPromise.then((cleanup: () => void) => cleanup()).catch(console.error);
    };
  }, [user]);

  const handleNavigateToFriends = () => {
    console.log('[HomeScreen] Navigating to friends page');
    router.push("/(protected)/friends");
  };

  const handleNavigateToSettings = () => {
    console.log('[HomeScreen] Navigating to settings page');
    router.push("/(protected)/settings");
  };

  const handleNavigateToAddFriend = () => {
    console.log('[HomeScreen] Navigating to add friend page');
    router.push("/(protected)/add-friend");
  };

  const handleNavigateToCamera = () => {
    console.log('[HomeScreen] Navigating to camera page');
    router.push("/(protected)/camera");
  };

  const handleNavigateToTextCompose = () => {
    console.log('[HomeScreen] Navigating to text compose page');
    router.push("/(protected)/compose-text");
  };

  // Navigation buttons for the header
  const rightComponent = (
    <View style={styles.headerActions}>
      <TouchableOpacity 
        onPress={handleNavigateToFriends}
        style={styles.headerButton}
        accessibilityLabel="View friends"
        accessibilityRole="button"
      >
        <Text style={styles.headerButtonText}>👥</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={handleNavigateToSettings}
        style={styles.headerButton}
        accessibilityLabel="Open settings"
        accessibilityRole="button"
      >
        <Text style={styles.headerButtonText}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Inbox" 
        showBackButton={false} 
        rightComponent={rightComponent} 
      />
      
      {/* Quick Action Bar */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.quickActionButton, styles.friendsButton]}
          onPress={handleNavigateToFriends}
        >
          <Text style={styles.quickActionIcon}>👥</Text>
          <Text style={styles.quickActionText}>Friends</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickActionButton, styles.groupsButton]}
          onPress={() => router.push('/(protected)/groups')}
        >
          <Text style={styles.quickActionIcon}>💬</Text>
          <Text style={styles.quickActionText}>Groups</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickActionButton, styles.addFriendButton]}
          onPress={handleNavigateToAddFriend}
        >
          <Text style={styles.quickActionIcon}>➕</Text>
          <Text style={styles.quickActionText}>Add Friend</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickActionButton, styles.settingsButton]}
          onPress={handleNavigateToSettings}
        >
          <Text style={styles.quickActionIcon}>⚙️</Text>
          <Text style={styles.quickActionText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : feedItems.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Your inbox is empty.</Text>
          <Text style={styles.emptySubtext}>Messages and conversations will appear here.</Text>
          <TouchableOpacity 
            style={styles.getStartedButton}
            onPress={handleNavigateToAddFriend}
          >
            <Text style={styles.getStartedButtonText}>Add your first friend to get started!</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (item.type === 'conversation') {
              return <GroupConversationItem conversation={item.data as Conversation} />;
            } else {
              return <MessageItem message={item.data as Message} />;
            }
          }}
          contentContainerStyle={styles.list}
        />
      )}
      
      {/* Floating Action Buttons */}
      <View style={styles.floatingButtons}>
        {/* Text Message Button */}
        <TouchableOpacity
          style={[styles.floatingButton, styles.messageButton]}
          onPress={handleNavigateToTextCompose}
          accessibilityLabel="Compose text message"
          accessibilityRole="button"
        >
          <Text style={styles.floatingButtonText}>💬</Text>
        </TouchableOpacity>
        
        {/* Camera Button */}
        <TouchableOpacity
          style={[styles.floatingButton, styles.cameraButton]}
          onPress={handleNavigateToCamera}
          accessibilityLabel="Open camera to take photo or video"
          accessibilityRole="button"
        >
          <Text style={styles.floatingButtonText}>📷</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  headerButtonText: {
    fontSize: 20,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    justifyContent: 'space-around',
  },
  quickActionButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    minWidth: 80,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  friendsButton: {
    backgroundColor: '#e3f2fd',
  },
  groupsButton: {
    backgroundColor: '#e8f5e8',
  },
  addFriendButton: {
    backgroundColor: '#f3e5f5',
  },
  settingsButton: {
    backgroundColor: '#fff3e0',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: 'center',
    marginBottom: 24,
  },
  getStartedButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  getStartedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  floatingButtons: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 40,
  },
  floatingButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  messageButton: {
    backgroundColor: "#34d399",
  },
  cameraButton: {
    backgroundColor: "#007AFF",
  },
  floatingButtonText: {
    fontSize: 32,
  },
});
