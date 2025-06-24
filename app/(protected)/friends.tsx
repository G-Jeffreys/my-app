import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { ref as rtdbRef, onValue, off } from 'firebase/database';
import { db, rtdb } from '../../config/firebase';
import { useAuth } from '../../store/useAuth';
import { FriendRequest } from '../../models/firestore/friendRequest';
import { Friend } from '../../models/firestore/friend';
import { User } from '../../models/firestore/user';
import { Link } from 'expo-router';

// A simple component to render the presence indicator
const PresenceIndicator = ({ isOnline }: { isOnline: boolean }) => (
  <View style={[styles.indicator, isOnline ? styles.online : styles.offline]} />
);

type FriendWithPresence = User & { isOnline?: boolean; isBlocked?: boolean };

export default function FriendsScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendWithPresence[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch friend requests
  useEffect(() => {
    if (!user) return;
    const requestsRef = collection(db, 'friendRequests');
    const q = query(requestsRef, where('recipientId', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
      setRequests(fetchedRequests);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch friends and their presence
  useEffect(() => {
    if (!user) return;

    // Combined listener for friends and blocked users
    const friendsRef = collection(db, 'users', user.uid, 'friends');
    const unsubscribe = onSnapshot(friendsRef, async (snapshot) => {
      setLoading(true);
      const friendIds = snapshot.docs.map(doc => doc.id);
      
      const blockedUsersRef = collection(db, 'users', user.uid, 'blockedUsers');
      const blockedSnapshot = await getDocs(blockedUsersRef);
      const blockedIds = new Set(blockedSnapshot.docs.map(doc => doc.id));

      if (friendIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }
      
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('id', 'in', friendIds));
      const usersSnapshot = await getDocs(usersQuery);
      const friendsData = usersSnapshot.docs.map(doc => ({ 
        ...doc.data(), 
        isOnline: false,
        isBlocked: blockedIds.has(doc.id),
      } as FriendWithPresence));
      
      setFriends(friendsData);
      setLoading(false);
      
      friendsData.forEach(friend => {
        const statusRef = rtdbRef(rtdb, `status/${friend.id}`);
        onValue(statusRef, (snap) => {
          const status = snap.val();
          setFriends(currentFriends => 
            currentFriends.map(f => f.id === friend.id ? { ...f, isOnline: status?.isOnline } : f)
          );
        });
      });
    });

    return () => {
      // Detach all presence listeners
      friends.forEach(friend => {
        const statusRef = rtdbRef(rtdb, `status/${friend.id}`);
        off(statusRef);
      });
      unsubscribe();
    }
  }, [user]);
  
  const handleAccept = async (request: FriendRequest) => {
    // The cloud function handles the logic, we just update the request status
    const requestRef = doc(db, 'friendRequests', request.id);
    await updateDoc(requestRef, { status: 'accepted' });
  };

  const handleDecline = async (requestId: string) => {
    const requestRef = doc(db, 'friendRequests', requestId);
    await deleteDoc(requestRef);
  };

  const handleBlockToggle = async (friendId: string, isCurrentlyBlocked: boolean) => {
    if (!user) return;
    const blockRef = doc(db, 'users', user.uid, 'blockedUsers', friendId);
    const friendRef = doc(db, 'users', friendId, 'friends', user.uid);
    const myFriendRef = doc(db, 'users', user.uid, 'friends', friendId);
    
    try {
      if (isCurrentlyBlocked) {
        // Unblock user
        await deleteDoc(blockRef);
        Alert.alert('User Unblocked', 'You can now interact with this user again.');
      } else {
        // Block user: remove friendship and add to blocked list
        const batch = writeBatch(db);
        batch.set(blockRef, { userId: friendId, blockedAt: new Date() });
        batch.delete(friendRef); // Remove them from my friends
        batch.delete(myFriendRef); // Remove me from their friends
        await batch.commit();
        Alert.alert('User Blocked', 'This user has been blocked and removed from your friends.');
      }
    } catch (error) {
      console.error("Error blocking/unblocking user:", error);
      Alert.alert("Error", "An error occurred.");
    }
  };

  return (
    <View className="flex-1 p-4 bg-white">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold">Friends</Text>
        <Link href="/(protected)/add-friend" asChild>
          <TouchableOpacity className="bg-blue-500 px-3 py-2 rounded-lg">
            <Text className="text-white font-bold">Add Friend</Text>
          </TouchableOpacity>
        </Link>
      </View>
      
      <Text className="text-xl font-semibold mb-2">Friend Requests</Text>
      {requests.length === 0 && <Text className="text-gray-500 mb-4">No new requests.</Text>}
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between p-3 mb-2 border border-gray-200 rounded-lg">
            <Text>Request from a user</Text>
            <View className="flex-row">
              <TouchableOpacity onPress={() => handleAccept(item)} className="bg-green-500 px-3 py-1 rounded-lg mr-2">
                <Text className="text-white">Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDecline(item.id)} className="bg-red-500 px-3 py-1 rounded-lg">
                <Text className="text-white">Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Text className="text-xl font-semibold mt-6 mb-2">My Friends</Text>
      {loading && <Text>Loading friends...</Text>}
      {!loading && friends.length === 0 && <Text className="text-gray-500">You have no friends yet.</Text>}
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between p-3 mb-2 border border-gray-200 rounded-lg">
            <View className="flex-row items-center">
              <PresenceIndicator isOnline={!item.isBlocked && (item.isOnline || false)} />
              <Text className={`font-semibold ml-3 ${item.isBlocked ? 'text-gray-400' : ''}`}>{item.displayName}</Text>
              {item.isBlocked && <Text className="text-xs text-red-500 ml-2">(Blocked)</Text>}
            </View>
            <TouchableOpacity onPress={() => handleBlockToggle(item.id, item.isBlocked || false)} className={`${item.isBlocked ? 'bg-gray-500' : 'bg-red-500'} px-3 py-1 rounded-lg`}>
              <Text className="text-white">{item.isBlocked ? 'Unblock' : 'Block'}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  online: {
    backgroundColor: 'green',
  },
  offline: {
    backgroundColor: 'gray',
  },
}); 