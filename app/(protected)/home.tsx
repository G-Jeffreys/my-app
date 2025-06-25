import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useAuth } from "../../store/useAuth";
import { Link } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { firestore } from "../../lib/firebase";
import { Message } from "../../models/firestore/message";
import MessageItem from "../../components/MessageItem";
import { ANALYTICS_EVENTS, logEvent } from "../../lib/analytics";
import Header from "../../components/Header";

const Home = () => {
  const { signOut, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const loggedReceivedRef = useRef<Set<string>>(new Set());

  // Persistent Firestore listener – cleans up on component unmount only
  useEffect(() => {
    if (!user) {
      console.log('[Home] No user, skipping message loading');
      return;
    }

    console.log('[Home] Setting up message listener for user:', user.uid);

    const q = firestore.collection('messages').where('recipientId', '==', user.uid);

    const unsubscribe = q.onSnapshot((snapshot) => {
      console.log('[Home] Received', snapshot.docs.length, 'messages');
      const newMessages: Message[] = [];
      snapshot.forEach((doc) => {
        const message = { id: doc.id, ...doc.data() } as Message;
        newMessages.push(message);

        if (!loggedReceivedRef.current.has(message.id)) {
          loggedReceivedRef.current.add(message.id);
          logEvent(ANALYTICS_EVENTS.MEDIA_RECEIVED, {
            mediaType: message.mediaType,
            senderId: message.senderId,
          });
        }
      });
      setMessages(newMessages);
    });

    return () => {
      console.log('[Home] Cleaning up message listener on unmount');
      unsubscribe();
    };
  }, [user?.uid]);

  return (
    <View className="flex-1 bg-white">
      <Header 
        title={`Welcome, ${user?.displayName || 'User'}!`} 
        showBackButton={false}
        rightComponent={
          <TouchableOpacity onPress={signOut} className="bg-red-500 px-3 py-2 rounded-lg">
            <Text className="text-white font-bold text-sm">Logout</Text>
          </TouchableOpacity>
        }
      />
      
      <View className="flex-row justify-around items-center p-4 border-b border-gray-200">
        <Link href="/(protected)/friends" asChild>
          <TouchableOpacity className="flex-1 items-center">
            <Text className="text-blue-500 text-lg font-semibold">👥 Friends</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(protected)/camera" asChild>
          <TouchableOpacity className="flex-1 items-center">
            <Text className="text-green-500 text-lg font-semibold">📷 Camera</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(protected)/settings" asChild>
          <TouchableOpacity className="flex-1 items-center">
            <Text className="text-gray-500 text-lg font-semibold">⚙️ Settings</Text>
          </TouchableOpacity>
        </Link>
      </View>
      
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageItem message={item} />}
        ListHeaderComponent={() => (
          <View className="p-4 items-center">
            <Text className="text-xl font-semibold mb-2">Your Messages 📬</Text>
            {messages.length === 0 && (
              <Text className="text-gray-500 text-center mt-8">
                No messages yet! Take a snap with the camera and send it to friends! 📸
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
};

export default Home;
