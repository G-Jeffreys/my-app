import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useAuth } from "../../store/useAuth";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { firestore } from "../../lib/firebase";
import { Message } from "../../models/firestore/message";
import MessageItem from "../../components/MessageItem";
import { ANALYTICS_EVENTS, logEvent } from "../../lib/analytics";
import Header from "../../components/Header";

const Home = () => {
  const { signOut, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loggedReceived, setLoggedReceived] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      console.log('[Home] No user, skipping message loading');
      return;
    }

    console.log('[Home] Setting up message listener for user:', user.uid);

    if (Platform.OS === 'web') {
      // For web, use mock messages
      console.log('[Home] Using mock messages for web');
      const mockMessages: Message[] = [
        {
          id: 'mock-1',
          senderId: 'mock-sender',
          recipientId: user.uid,
          mediaType: 'image',
          mediaURL: 'mock://photo.jpg',
          ttlPreset: '30s',
          sentAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
          text: null
        }
      ];
      setMessages(mockMessages);
      return;
    }

    // For mobile, use actual Firestore
    try {
      const q = firestore.collection("messages").where("recipientId", "==", user.uid);
      
      const unsubscribe = q.onSnapshot((snapshot: any) => {
        console.log('[Home] Received', snapshot.docs.length, 'messages');
        const newMessages: Message[] = [];
        snapshot.forEach((doc: any) => {
          const message = { id: doc.id, ...doc.data() } as Message;
          newMessages.push(message);
          if (!loggedReceived.includes(message.id)) {
            logEvent(ANALYTICS_EVENTS.MEDIA_RECEIVED, {
              mediaType: message.mediaType,
              senderId: message.senderId,
            });
            setLoggedReceived(prev => [...prev, message.id]);
          }
        });
        setMessages(newMessages);
      });

      return () => {
        console.log('[Home] Cleaning up message listener');
        unsubscribe();
      };
    } catch (error) {
      console.error('[Home] Error setting up message listener:', error);
    }
  }, [user]);

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
            {Platform.OS === 'web' && (
              <Text className="text-sm text-blue-500 mb-4">
                🌐 Running in web mode with mock data
              </Text>
            )}
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
