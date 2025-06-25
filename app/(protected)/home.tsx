import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { firestore, auth } from "../../lib/firebase";
import { Message } from "../../models/firestore/message";
import MessageItem from "../../components/MessageItem";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../../components/Header";

export default function HomeScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(firestore, "messages"),
      where("recipientId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(fetchedMessages);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching messages: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Inbox" />
      {loading ? (
        <View style={styles.centered}>
          <Text>Loading messages...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Your inbox is empty.</Text>
          <Text style={styles.emptySubtext}>Messages you receive will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageItem message={item} />}
          contentContainerStyle={styles.list}
        />
      )}
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={() => router.push("/(protected)/camera")}
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    color: "gray",
    marginTop: 8,
  },
  list: {
    padding: 10,
  },
  cameraButton: {
    position: "absolute",
    bottom: 40,
    right: 30,
    backgroundColor: "#007AFF",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cameraButtonText: {
    fontSize: 28,
  },
});
