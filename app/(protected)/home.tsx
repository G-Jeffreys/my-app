import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useAuth } from "../../store/useAuth";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import { Message } from "../../models/firestore/message";
import MessageItem from "../../components/MessageItem";

export default function Home() {
  const { signOut, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "messages"), where("recipientId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages: Message[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row justify-around items-center p-4 border-b border-gray-200">
        <Link href="/(protected)/friends" asChild>
          <TouchableOpacity>
            <Text className="text-blue-500 text-lg">Friends</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(protected)/camera" asChild>
          <TouchableOpacity>
            <Text className="text-green-500 text-lg">Camera</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(protected)/settings" asChild>
          <TouchableOpacity>
            <Text className="text-gray-500 text-lg">Settings</Text>
          </TouchableOpacity>
        </Link>
      </View>
      
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageItem message={item} />}
        ListHeaderComponent={() => (
          <View className="p-4 items-center">
            <Text className="text-2xl font-bold mb-2">Welcome 👋</Text>
            <Text className="text-lg text-gray-600 mb-8">{user?.displayName || user?.email}</Text>
          </View>
        )}
      />

      <TouchableOpacity onPress={signOut} className="m-4 bg-red-500 p-3 rounded-lg items-center">
        <Text className="text-white font-bold">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
