import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Platform } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { firestore, database } from '../../lib/firebase';
import { useAuth } from '../../store/useAuth';
import { FriendRequest } from '../../models/firestore/friendRequest';
import { Friend } from '../../models/firestore/friend';
import { User } from '../../models/firestore/user';
import { Link } from 'expo-router';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';

// A simple component to render the presence indicator
const PresenceIndicator = ({ isOnline }: { isOnline: boolean }) => (
  <View style={[styles.indicator, isOnline ? styles.online : styles.offline]} />
);

type FriendWithPresence = User & { isOnline?: boolean; isBlocked?: boolean };

const FriendsScreen = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendWithPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmColor?: 'red' | 'blue' | 'green';
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error' | 'info'; visible: boolean}>({
    message: '',
    type: 'info',
    visible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, visible: true });
  };

  const showConfirmDialog = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    confirmText: string = 'Confirm',
    confirmColor: 'red' | 'blue' | 'green' = 'red'
  ) => {
    setConfirmDialog({
      visible: true,
      title,
      message,
      onConfirm,
      confirmText,
      confirmColor
    });
  };

  // Fetch friend requests
  useEffect(() => {
    if (!user) return;
    
    if (Platform.OS === 'web') {
      // Web mock data
      setRequests([]);
      return;
    }
    
    // Mobile Firebase
    const requestsRef = (firestore as any)().collection('friendRequests');
    const q = requestsRef.where('recipientId', '==', user.uid).where('status', '==', 'pending');
    const unsubscribe = q.onSnapshot((snapshot: any) => {
      const fetchedRequests = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as FriendRequest));
      setRequests(fetchedRequests);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch friends and their presence
  useEffect(() => {
    if (!user) return;

    if (Platform.OS === 'web') {
      // Web mock data
      setFriends([]);
      setLoading(false);
      return;
    }

    // Mobile Firebase - Combined listener for friends and blocked users
    const friendsRef = (firestore as any)().collection('users').doc(user.uid).collection('friends');
    const unsubscribe = friendsRef.onSnapshot(async (snapshot: any) => {
      setLoading(true);
      const friendIds = snapshot.docs.map((doc: any) => doc.id);
      
      const blockedUsersRef = (firestore as any)().collection('users').doc(user.uid).collection('blockedUsers');
      const blockedSnapshot = await blockedUsersRef.get();
      const blockedIds = new Set(blockedSnapshot.docs.map((doc: any) => doc.id));

      if (friendIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }
      
      const usersRef = (firestore as any)().collection('users');
      const usersQuery = usersRef.where((firestore as any).FieldPath.documentId(), 'in', friendIds);
      const usersSnapshot = await usersQuery.get();
      const friendsData = usersSnapshot.docs.map((doc: any) => ({ 
        id: doc.id,
        ...doc.data(), 
        isOnline: false,
        isBlocked: blockedIds.has(doc.id),
      } as FriendWithPresence));
      
      setFriends(friendsData);
      setLoading(false);
      
      friendsData.forEach((friend: any) => {
        const statusRef = (database as any)().ref(`status/${friend.id}`);
        statusRef.on('value', (snap: any) => {
          const status = snap.val();
          setFriends(currentFriends => 
            currentFriends.map(f => f.id === friend.id ? { ...f, isOnline: status?.isOnline } : f)
          );
        });
      });
    });

    return () => {
      // Detach all presence listeners
      friends.forEach((friend: any) => {
        const statusRef = (database as any)().ref(`status/${friend.id}`);
        statusRef.off('value');
      });
      unsubscribe();
    }
  }, [user]);
  
  const handleAccept = async (request: FriendRequest) => {
    try {
      if (Platform.OS === 'web') {
        showToast('Friend request accepted! 🎉 (mock)', 'success');
        return;
      }
      
      // The cloud function handles the logic, we just update the request status
      const requestRef = (firestore as any)().collection('friendRequests').doc(request.id);
      await requestRef.update({ status: 'accepted' });
      showToast('Friend request accepted! 🎉', 'success');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      showToast('Failed to accept friend request', 'error');
    }
  };

  const handleDecline = (requestId: string) => {
    showConfirmDialog(
      'Decline Friend Request',
      'Are you sure you want to decline this friend request? This action cannot be undone.',
      async () => {
        try {
          if (Platform.OS === 'web') {
            showToast('Friend request declined (mock)', 'info');
            return;
          }
          
          const requestRef = (firestore as any)().collection('friendRequests').doc(requestId);
          await requestRef.delete();
          showToast('Friend request declined', 'success');
        } catch (error) {
          console.error('Error declining friend request:', error);
          showToast('Failed to decline friend request', 'error');
        }
        setConfirmDialog(prev => ({ ...prev, visible: false }));
      },
      'Decline',
      'red'
    );
  };

  const handleBlockToggle = (friendId: string, isCurrentlyBlocked: boolean) => {
    if (!user) return;
    
    const action = isCurrentlyBlocked ? 'unblock' : 'block';
    const title = isCurrentlyBlocked ? 'Unblock User' : 'Block User';
    const message = isCurrentlyBlocked 
      ? 'Are you sure you want to unblock this user? They will be able to contact you again.'
      : 'Are you sure you want to block this user? This will remove them from your friends list and prevent them from contacting you.';
    
    showConfirmDialog(
      title,
      message,
      async () => {
        try {
          if (Platform.OS === 'web') {
            showToast(`User ${action}ed (mock)`, 'info');
            setConfirmDialog(prev => ({ ...prev, visible: false }));
            return;
          }
          
          const blockRef = (firestore as any)().collection('users').doc(user.uid).collection('blockedUsers').doc(friendId);
          const friendRef = (firestore as any)().collection('users').doc(friendId).collection('friends').doc(user.uid);
          const myFriendRef = (firestore as any)().collection('users').doc(user.uid).collection('friends').doc(friendId);
          
          if (isCurrentlyBlocked) {
            // Unblock user
            await blockRef.delete();
            showToast('User unblocked successfully! 🎉', 'success');
          } else {
            // Block user: remove friendship and add to blocked list
            const batch = (firestore as any)().batch();
            batch.set(blockRef, { userId: friendId, blockedAt: new Date() });
            batch.delete(friendRef); // Remove them from my friends
            batch.delete(myFriendRef); // Remove me from their friends
            await batch.commit();
            showToast('User blocked and removed from friends', 'success');
          }
        } catch (error) {
          console.error("Error blocking/unblocking user:", error);
          showToast('An error occurred. Please try again.', 'error');
        }
        setConfirmDialog(prev => ({ ...prev, visible: false }));
      },
      isCurrentlyBlocked ? 'Unblock' : 'Block',
      isCurrentlyBlocked ? 'green' : 'red'
    );
  };

  return (
    <View className="flex-1 bg-white">
      <Header 
        title="Friends" 
        showHomeButton={true}
        rightComponent={
          <Link href="/(protected)/add-friend" asChild>
            <TouchableOpacity className="bg-blue-500 px-3 py-2 rounded-lg">
              <Text className="text-white font-bold text-sm">+ Add</Text>
            </TouchableOpacity>
          </Link>
        }
      />
      
      <View className="flex-1 p-4">
        <Text className="text-xl font-semibold mb-2">Friend Requests</Text>
        {requests.length === 0 && <Text className="text-gray-500 mb-4">No pending friend requests. Add friends to start chatting!</Text>}
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
        {loading && <LoadingSpinner text="Loading friends..." size="small" />}
        {!loading && friends.length === 0 && (
          <View className="text-center py-8">
            <Text className="text-gray-500 text-center">👥 You have no friends yet.</Text>
            <Text className="text-gray-400 text-center text-sm mt-2">
              Start by adding friends to begin chatting!
            </Text>
          </View>
        )}
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
        
        <ConfirmDialog
          visible={confirmDialog.visible}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
          confirmText={confirmDialog.confirmText}
          confirmColor={confirmDialog.confirmColor}
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

export default FriendsScreen; 