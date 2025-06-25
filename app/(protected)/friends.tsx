import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
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
import { User } from "../../models/firestore/user";
import { Friend } from "../../models/firestore/friend";
import { FriendRequest } from "../../models/firestore/friendRequest";
import Header from "../../components/Header";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

export default function FriendsScreen() {
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (!auth.currentUser) return;
    setLoading(true);

    // Fetch friends
    const friendsCollectionRef = collection(
      firestore,
      "users",
      auth.currentUser.uid,
      "friends"
    );
    const friendsUnsub = onSnapshot(friendsCollectionRef, async (snapshot) => {
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
      setFriends(friendsList);
      setLoading(false);
    });

    // Fetch incoming friend requests
    const requestsQuery = query(
      collection(firestore, "friendRequests"),
      where("recipientId", "==", auth.currentUser.uid),
      where("status", "==", "pending")
    );
    const requestsUnsub = onSnapshot(requestsQuery, (snapshot) => {
      const requestsList = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as FriendRequest)
      );
      setRequests(requestsList);
    });

    return () => {
      friendsUnsub();
      requestsUnsub();
    };
  }, []);

  useFocusEffect(fetchData);

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!auth.currentUser) return;
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
      Alert.alert("Success", "Friend request accepted!");
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "Failed to accept friend request.");
    }
  };
  
  const handleDeclineRequest = async (request: FriendRequest) => {
    try {
        const requestRef = doc(firestore, "friendRequests", request.id);
        const batch = writeBatch(firestore);
        batch.update(requestRef, { status: "declined" });
        await batch.commit();
        Alert.alert("Success", "Friend request declined.");
    } catch(e) {
        console.error("Error declining friend request:", e);
        Alert.alert("Error", "Failed to decline friend request.");
    }
  }

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Friends" showBackButton />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" />
      ) : (
        <FlatList
          data={requests.concat(friends as any)} // Combine for a single list
          keyExtractor={(item) => (item as any).id}
          renderItem={({ item }) => {
            if ("status" in item) { // It's a FriendRequest
              return (
                <View style={styles.requestRow}>
                  <Text>{`Request from ${item.senderEmail}`}</Text>
                  <View style={styles.buttonGroup}>
                    <TouchableOpacity onPress={() => handleAcceptRequest(item)} style={[styles.actionButton, styles.acceptButton]}>
                        <Text style={styles.actionButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeclineRequest(item)} style={[styles.actionButton, styles.declineButton]}>
                        <Text style={styles.actionButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            } else { // It's a User (friend)
              return (
                <View style={styles.friendRow}>
                  <Image source={{ uri: item.photoURL || "" }} style={styles.avatar} />
                  <Text style={styles.friendName}>{item.displayName}</Text>
                </View>
              );
            }
          }}
          ListHeaderComponent={
            <>
              {requests.length > 0 && renderSectionHeader("Friend Requests")}
              {friends.length > 0 && renderSectionHeader("My Friends")}
            </>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>You have no friends or requests yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        padding: 10,
        backgroundColor: '#f0f0f0',
    },
    friendRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    requestRow: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fffbe6' },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    friendName: { fontSize: 18 },
    buttonGroup: { flexDirection: 'row', marginTop: 10, justifyContent: 'flex-end' },
    actionButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 5, marginLeft: 10 },
    acceptButton: { backgroundColor: 'green' },
    declineButton: { backgroundColor: 'red' },
    actionButtonText: { color: 'white', fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: 'gray' },
});
