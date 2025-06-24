import { View, Text, TextInput, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { firestore } from '../../lib/firebase';
import { useAuth } from '../../store/useAuth';
import { User } from '../../models/firestore/user';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';

const AddFriend = () => {
  const { user } = useAuth();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error' | 'info'; visible: boolean}>({
    message: '',
    type: 'info',
    visible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, visible: true });
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      showToast('Please enter an email to search.', 'error');
      return;
    }
    setLoading(true);
    try {
      console.log('[AddFriend] Searching for users with email:', searchEmail);
      
      // Use unified Firebase API
      const usersRef = firestore.collection('users');
      const q = usersRef.where('email', '==', searchEmail.toLowerCase());
      const querySnapshot = await q.get();
      
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.id !== user?.uid) {
          users.push({ id: doc.id, ...userData } as User);
        }
      });
      
      console.log('[AddFriend] Found users:', users);
      setSearchResults(users);
      
      if (users.length === 0) {
        showToast('No user found with that email.', 'info');
      } else {
        showToast(`Found ${users.length} user${users.length > 1 ? 's' : ''}!`, 'success');
      }
    } catch (error) {
      console.error('[AddFriend] Error searching for users:', error);
      showToast('An error occurred while searching for users.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (recipientId: string) => {
    if (!user) return;
    try {
      console.log('[AddFriend] Sending friend request to:', recipientId);
      
      // Use unified Firebase API
      const requestsRef = firestore.collection('friendRequests');
      await requestsRef.add({
        senderId: user.uid,
        recipientId,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      
      console.log('[AddFriend] Friend request sent successfully');
      showToast('Friend request sent successfully! 🎉', 'success');
    } catch (error) {
      console.error('[AddFriend] Error sending friend request:', error);
      showToast('Could not send friend request. Please try again.', 'error');
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Header title="Add Friend" showBackButton={true} />
      
      <View className="flex-1 p-4">
      <TextInput
        className="border border-gray-300 p-3 rounded-lg mb-4"
        placeholder="Search by email"
        value={searchEmail}
        onChangeText={setSearchEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
              <TouchableOpacity 
          onPress={handleSearch} 
          disabled={loading} 
          className={`${loading ? 'bg-gray-400' : 'bg-blue-500'} p-3 rounded-lg items-center`}
        >
          <Text className="text-white font-bold">{loading ? 'Searching...' : 'Search'}</Text>
        </TouchableOpacity>

        {loading && <LoadingSpinner text="Searching for users..." overlay={false} />}
        
        {!loading && searchResults.length === 0 && searchEmail.trim() !== '' && (
          <View className="p-4 mt-4 bg-gray-50 rounded-lg">
            <Text className="text-center text-gray-500">🔍 No users found with that email.</Text>
            <Text className="text-center text-gray-400 text-sm mt-1">
              Make sure they've signed up for the app!
            </Text>
          </View>
        )}

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
        
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
        />
      </View>
    </View>
  );
};

export default AddFriend; 