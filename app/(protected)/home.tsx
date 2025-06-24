import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../store/useAuth";
import { Link } from "expo-router";
import { useEffect } from "react";
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

export default function Home() {
  const { signOut, user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "messages"), where("recipientId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const message = change.doc.data();
          const messageId = change.doc.id;
          
          console.log("New message received: ", messageId);

          const receiptRef = doc(db, "messages", messageId, "receipts", user.uid);
          
          const receiptSnap = await getDoc(receiptRef);

          if (!receiptSnap.exists()) {
            await setDoc(receiptRef, {
              userId: user.uid,
              receivedAt: serverTimestamp(),
              viewedAt: null,
            });
            console.log("Receipt created for message: ", messageId);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold mb-2">Welcome 👋</Text>
      <Text className="text-lg text-gray-600 mb-8">{user?.displayName || user?.email}</Text>

      <Link href="/(protected)/friends" asChild>
        <TouchableOpacity className="bg-blue-500 px-6 py-3 rounded-lg mb-4">
          <Text className="text-white text-lg font-semibold">Friends</Text>
        </TouchableOpacity>
      </Link>

      <Link href="/(protected)/camera" asChild>
        <TouchableOpacity className="bg-green-500 px-6 py-3 rounded-lg mb-4">
          <Text className="text-white text-lg font-semibold">Camera</Text>
        </TouchableOpacity>
      </Link>
      
      <TouchableOpacity onPress={signOut} className="mt-6 bg-red-500 px-4 py-2 rounded-lg">
        <Text className="text-white">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
