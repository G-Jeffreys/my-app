import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { firestore } from "../../lib/firebase";
import { useAuth } from "../../store/useAuth";
import { Message } from "../../models/firestore/message";
import MessageItem from "../../components/MessageItem";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../components/Header";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('[HomeScreen] Component rendered with user:', user?.email);

  useEffect(() => {
    if (!user) {
      console.log('[HomeScreen] No user found, returning early');
      return;
    }

    console.log('[HomeScreen] Setting up messages listener for user:', user.uid);

    const q = query(
      collection(firestore, "messages"),
      where("recipientId", "==", user.uid),
      orderBy("sentAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log('[HomeScreen] Messages snapshot received, docs count:', querySnapshot.size);
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      console.log('[HomeScreen] Fetched messages:', fetchedMessages.length);
      setMessages(fetchedMessages);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages: ", error);
      setLoading(false);
    });

    return () => {
      console.log('[HomeScreen] Cleaning up messages listener');
      unsubscribe();
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
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Your inbox is empty.</Text>
          <Text style={styles.emptySubtext}>Messages you receive will appear here.</Text>
          <TouchableOpacity 
            style={styles.getStartedButton}
            onPress={handleNavigateToAddFriend}
          >
            <Text style={styles.getStartedButtonText}>Add your first friend to get started!</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageItem message={item} />}
          contentContainerStyle={styles.list}
        />
      )}
      
      {/* Camera Button - Floating Action Button */}
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={handleNavigateToCamera}
        accessibilityLabel="Open camera to take photo or video"
        accessibilityRole="button"
      >
        <Text style={styles.cameraButtonText}>📷</Text>
      </TouchableOpacity>
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
  cameraButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#007AFF",
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
  cameraButtonText: {
    fontSize: 32,
  },
});
