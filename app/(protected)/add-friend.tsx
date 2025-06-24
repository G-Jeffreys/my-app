import { View, Text, TextInput, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../store/useAuth';
import { User } from '../../models/firestore/user';

export default function AddFriend() {
  const { user } = useAuth();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      Alert.alert('Error', 'Please enter an email to search.');
      return;
    }
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', searchEmail.toLowerCase()));
      const querySnapshot = await getDocs(q);
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().id !== user?.uid) { // Exclude self from search results
          users.push({ id: doc.id, ...doc.data() } as User);
        }
      });
      setSearchResults(users);
      if (users.length === 0) {
        Alert.alert('No Results', 'No user found with that email.');
      }
    } catch (error) {
      console.error('Error searching for users:', error);
      Alert.alert('Search Error', 'An error occurred while searching for users.');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (recipientId: string) => {
    if (!user) return;
    try {
      // TODO: Check if a request already exists or if they are already friends.
      const requestsRef = collection(db, 'friendRequests');
      await addDoc(requestsRef, {
        senderId: user.uid,
        recipientId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      Alert.alert('Success', 'Friend request sent!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Could not send friend request.');
    }
  };

  return (
    <View className="flex-1 p-4 bg-white">
      <Text className="text-2xl font-bold mb-4">Add a Friend</Text>
      <TextInput
        className="border border-gray-300 p-3 rounded-lg mb-4"
        placeholder="Search by email"
        value={searchEmail}
        onChangeText={setSearchEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity onPress={handleSearch} disabled={loading} className="bg-blue-500 p-3 rounded-lg items-center">
        <Text className="text-white font-bold">{loading ? 'Searching...' : 'Search'}</Text>
      </TouchableOpacity>

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between p-4 mt-4 border border-gray-200 rounded-lg">
            <Text className="font-semibold">{item.displayName}</Text>
            <TouchableOpacity onPress={() => sendFriendRequest(item.id)} className="bg-green-500 px-4 py-2 rounded-lg">
              <Text className="text-white">Add</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
} 