import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { firestore, auth } from "../../lib/firebase";
import { Auth } from "firebase/auth";
import { User } from "../../models/firestore/user";
import { Friend } from "../../models/firestore/friend";
import { FriendRequest } from "../../models/firestore/friendRequest";
import Header from "../../components/Header";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

export default function FriendsScreen() {
  const router = useRouter();
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  console.log('[FriendsScreen] Component rendered');

  const fetchData = useCallback(() => {
    const currentUser = (auth as Auth).currentUser;
    if (!currentUser) {
      console.log('[FriendsScreen] No authenticated user');
      return;
    }
    
    console.log('[FriendsScreen] Fetching friends and requests for user:', currentUser.uid);
    setLoading(true);

    // Fetch friends
    const friendsCollectionRef = collection(
      firestore,
      "users",
      currentUser.uid,
      "friends"
    );
    const friendsUnsub = onSnapshot(friendsCollectionRef, async (snapshot) => {
      console.log('[FriendsScreen] Friends snapshot received, docs count:', snapshot.size);
      const friendPromises = snapshot.docs.map(async (friendDoc) => {
        const friendData = friendDoc.data() as Friend;
        const userSnap = await getDoc(
          doc(firestore, "users", friendData.friendId)
        );
        return userSnap.exists()
          ? ({ id: userSnap.id, ...userSnap.data() } as User)
          : null;
      });
      const friendsList = (await Promise.all(friendPromises)).filter(
        (f): f is User => f !== null
      );
      console.log('[FriendsScreen] Loaded friends:', friendsList.length);
      setFriends(friendsList);
      setLoading(false);
      setRefreshing(false);
    });

    // Fetch incoming friend requests
    const requestsQuery = query(
      collection(firestore, "friendRequests"),
      where("recipientId", "==", auth.currentUser.uid),
      where("status", "==", "pending")
    );
    const requestsUnsub = onSnapshot(requestsQuery, (snapshot) => {
      console.log('[FriendsScreen] Friend requests snapshot received, docs count:', snapshot.size);
      const requestsList = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as FriendRequest)
      );
      console.log('[FriendsScreen] Loaded requests:', requestsList.length);
      setRequests(requestsList);
    });

    return () => {
      console.log('[FriendsScreen] Cleaning up listeners');
      friendsUnsub();
      requestsUnsub();
    };
  }, []);

  useFocusEffect(fetchData);

  const handleRefresh = useCallback(() => {
    console.log('[FriendsScreen] Manual refresh triggered');
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!auth.currentUser) return;
    
    console.log('[FriendsScreen] Accepting friend request from:', request.senderId);
    try {
      const batch = writeBatch(firestore);

      // 1. Add friend to current user's friend list
      const currentUserFriendRef = doc(
        firestore,
        "users",
        auth.currentUser.uid,
        "friends",
        request.senderId
      );
      batch.set(currentUserFriendRef, {
        friendId: request.senderId,
        addedAt: new Date(),
      });

      // 2. Add current user to sender's friend list
      const senderFriendRef = doc(
        firestore,
        "users",
        request.senderId,
        "friends",
        auth.currentUser.uid
      );
      batch.set(senderFriendRef, {
        friendId: auth.currentUser.uid,
        addedAt: new Date(),
      });

      // 3. Update the friend request status to 'accepted'
      const requestRef = doc(firestore, "friendRequests", request.id);
      batch.update(requestRef, { status: "accepted" });

      await batch.commit();
      console.log('[FriendsScreen] Friend request accepted successfully');
      Alert.alert("Success", "Friend request accepted!");
    } catch (error) {
      console.error("[FriendsScreen] Error accepting friend request:", error);
      Alert.alert("Error", "Failed to accept friend request.");
    }
  };
  
  const handleDeclineRequest = async (request: FriendRequest) => {
    console.log('[FriendsScreen] Declining friend request from:', request.senderId);
    try {
        const requestRef = doc(firestore, "friendRequests", request.id);
        const batch = writeBatch(firestore);
        batch.update(requestRef, { status: "declined" });
        await batch.commit();
        console.log('[FriendsScreen] Friend request declined successfully');
        Alert.alert("Success", "Friend request declined.");
    } catch(e) {
        console.error("[FriendsScreen] Error declining friend request:", e);
        Alert.alert("Error", "Failed to decline friend request.");
    }
  };

  const handleAddFriend = () => {
    console.log('[FriendsScreen] Navigating to add friend page');
    router.push("/(protected)/add-friend");
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionHeader}>{title}</Text>
    </View>
  );

  const renderFriendRequest = (item: FriendRequest) => (
    <View style={styles.requestRow}>
      <View style={styles.requestInfo}>
        <Text style={styles.requestTitle}>Friend Request</Text>
        <Text style={styles.requestEmail}>{item.senderEmail}</Text>
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity 
          onPress={() => handleAcceptRequest(item)} 
          style={[styles.actionButton, styles.acceptButton]}
        >
          <Text style={styles.actionButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => handleDeclineRequest(item)} 
          style={[styles.actionButton, styles.declineButton]}
        >
          <Text style={styles.actionButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriend = (item: User) => (
    <View style={styles.friendRow}>
      <Image source={{ uri: item.photoURL || "" }} style={styles.avatar} />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.displayName}</Text>
        <Text style={styles.friendEmail}>{item.email}</Text>
      </View>
      <View style={styles.friendStatus}>
        <Text style={styles.friendStatusText}>✓ Friend</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: FriendRequest | User }) => {
    if ("status" in item) {
      return renderFriendRequest(item);
    } else {
      return renderFriend(item);
    }
  };

  const combinedData = [...requests, ...friends];

  // Header with add friend button
  const rightComponent = (
    <TouchableOpacity 
      onPress={handleAddFriend}
      style={styles.addButton}
      accessibilityLabel="Add friend"
      accessibilityRole="button"
    >
      <Text style={styles.addButtonText}>➕</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Friends" 
        showBackButton={true} 
        rightComponent={rightComponent}
      />
      
      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{friends.length}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{requests.length}</Text>
          <Text style={styles.statLabel}>Requests</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      ) : (
        <FlatList
          data={combinedData}
          keyExtractor={(item) => (item as any).id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#007AFF"]}
              tintColor="#007AFF"
            />
          }
          ListHeaderComponent={
            combinedData.length > 0 ? (
              <View>
                {requests.length > 0 && renderSectionHeader("Pending Requests")}
                {friends.length > 0 && renderSectionHeader("My Friends")}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptySubtext}>
                Start connecting with people by adding your first friend!
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddFriend}>
                <Text style={styles.emptyButtonText}>Add Your First Friend</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={combinedData.length === 0 ? styles.emptyList : styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
  },
  addButtonText: {
    fontSize: 20,
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#d1d5db',
    marginHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  list: {
    paddingHorizontal: 16,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeaderContainer: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  friendRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  requestRow: { 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f4f6', 
    backgroundColor: '#fffbeb',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  avatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    marginRight: 16,
    backgroundColor: '#f3f4f6',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: { 
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  friendStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#d1fae5',
  },
  friendStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },
  requestInfo: {
    marginBottom: 12,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  requestEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  buttonGroup: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: { 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  acceptButton: { 
    backgroundColor: '#22c55e' 
  },
  declineButton: { 
    backgroundColor: '#ef4444' 
  },
  actionButtonText: { 
    color: 'white', 
    fontWeight: '600',
    fontSize: 14,
  },
});
