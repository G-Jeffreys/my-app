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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firestore, auth, storage } from "../../lib/firebase";
import { User } from "../../models/firestore/user";
import Header from "../../components/Header";
import { SafeAreaView } from "react-native-safe-area-context";
import { Friend } from "../../models/firestore/friend";

export default function SelectFriendScreen() {
  const router = useRouter();
  const { uri, type } = useLocalSearchParams<{
    uri: string;
    type: "image" | "video";
  }>();
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
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
            return { id: userSnap.id, ...userSnap.data() } as User;
          }
          return null;
        });

        const friendsList = (await Promise.all(friendPromises)).filter(
          (f): f is User => f !== null
        );

        setFriends(friendsList);
      } catch (error) {
        console.error("Failed to fetch friends:", error);
        Alert.alert("Error", "Could not load your friends list.");
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, []);

  const handleSend = async (friend: User) => {
    if (!uri || !type || !auth.currentUser) {
      Alert.alert("Error", "Missing information to send message.");
      return;
    }

    setSelectedFriendId(friend.id);
    setIsSending(true);

    try {
      // 1. Upload media
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(
        storage,
        `media/${auth.currentUser.uid}/${Date.now()}`
      );
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      // 2. Create message document
      await addDoc(collection(firestore, "messages"), {
        senderId: auth.currentUser.uid,
        recipientId: friend.id,
        mediaURL: downloadURL,
        mediaType: type,
        sentAt: serverTimestamp(),
        ttlPreset: '24h',
        text: null,
        viewed: false,
      });

      Alert.alert("Success", `Message sent to ${friend.displayName}!`);
      router.replace("/(protected)/home");
    } catch (error) {
      console.error("Failed to send media:", error);
      Alert.alert("Error", "Failed to send your message. Please try again.");
    } finally {
      setIsSending(false);
      setSelectedFriendId(null);
    }
  };

  const renderFriend = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.friendRow}
      onPress={() => handleSend(item)}
      disabled={isSending}
    >
      <Image source={{ uri: item.photoURL || "" }} style={styles.avatar} />
      <Text style={styles.friendName}>{item.displayName}</Text>
      {isSending && selectedFriendId === item.id && <ActivityIndicator />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Send To..." showBackButton />
      {loading ? (
        <ActivityIndicator style={styles.centered} size="large" />
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriend}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No friends to send to.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  centered: { marginTop: 20 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  friendName: {
    fontSize: 18,
    flex: 1,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "gray",
  },
}); 