import { View, Text, TouchableOpacity, FlatList, Alert, RefreshControl } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Link } from 'expo-router';
import { useAuth } from '../../store/useAuth';
import { firestore } from '../../lib/firebase';
import { Friend } from '../../models/firestore/friend';
import { FriendRequest } from '../../models/firestore/friendRequest';
import { User } from '../../models/firestore/user';
import Header from '../../components/Header';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';

interface FriendWithUserData extends Friend {
  userData?: User;
}

interface FriendRequestWithUserData extends FriendRequest {
  senderData?: User;
}

const FriendsScreen = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithUserData[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestWithUserData[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestWithUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'incoming' | 'outgoing'>('friends');
  const [toast, setToast] = useState<{message: string; type: 'success' | 'error' | 'info'; visible: boolean}>({
    message: '',
    type: 'info',
    visible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, visible: true });
  };

  const fetchFriends = async () => {
    if (!user) return;
    
    console.log('[Friends] Fetching friends for user:', user.uid);
    
    try {
      // Get friends list using the same pattern as select-friend
      const friendsRef = firestore.collection('users').doc(user.uid).collection('friends');
      
      return new Promise<void>((resolve) => {
        const unsubscribe = friendsRef.onSnapshot(async (friendsSnapshot: any) => {
          console.log('[Friends] Found friends:', friendsSnapshot.docs.length);
          
          const friendsPromises = friendsSnapshot.docs.map(async (friendDoc: any) => {
            const friendData = friendDoc.data() as Friend;
            
            // Get user data for each friend
            const userRef = firestore.collection('users').doc(friendData.friendId);
            const userSnapshot = await userRef.get();
            
            return {
              ...friendData,
              userData: userSnapshot.exists() ? userSnapshot.data() as User : undefined
            } as FriendWithUserData;
          });
          
          const friendsWithData = await Promise.all(friendsPromises);
          setFriends(friendsWithData.filter((f: any) => f.userData));
          unsubscribe(); // Clean up the listener after first load
          resolve();
        });
      });
      
    } catch (error) {
      console.error('[Friends] Error fetching friends:', error);
      showToast('Error loading friends list', 'error');
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;
    
    console.log('[Friends] Fetching friend requests for user:', user.uid);
    
    try {
      // Get incoming requests
      const incomingQuery = firestore.collection('friendRequests')
        .where('recipientId', '==', user.uid)
        .where('status', '==', 'pending');
      
      return new Promise<void>((resolve) => {
        const unsubscribe = incomingQuery.onSnapshot(async (incomingSnapshot: any) => {
          console.log('[Friends] Found incoming requests:', incomingSnapshot.docs.length);
          
          const incomingPromises = incomingSnapshot.docs.map(async (requestDoc: any) => {
            const requestData = { id: requestDoc.id, ...requestDoc.data() } as FriendRequest;
            
            const senderRef = firestore.collection('users').doc(requestData.senderId);
            const senderSnapshot = await senderRef.get();
            
            return {
              ...requestData,
              senderData: senderSnapshot.exists() ? senderSnapshot.data() as User : undefined
            } as FriendRequestWithUserData;
          });
          
          const incomingWithData = await Promise.all(incomingPromises);
          setIncomingRequests(incomingWithData.filter((r: any) => r.senderData));
          
          // Now get outgoing requests
          const outgoingQuery = firestore.collection('friendRequests')
            .where('senderId', '==', user.uid)
            .where('status', '==', 'pending');
          
          const unsubscribe2 = outgoingQuery.onSnapshot(async (outgoingSnapshot: any) => {
            console.log('[Friends] Found outgoing requests:', outgoingSnapshot.docs.length);
            
            const outgoingPromises = outgoingSnapshot.docs.map(async (requestDoc: any) => {
              const requestData = { id: requestDoc.id, ...requestDoc.data() } as FriendRequest;
              
              const recipientRef = firestore.collection('users').doc(requestData.recipientId);
              const recipientSnapshot = await recipientRef.get();
              
              return {
                ...requestData,
                senderData: recipientSnapshot.exists() ? recipientSnapshot.data() as User : undefined
              } as FriendRequestWithUserData;
            });
            
            const outgoingWithData = await Promise.all(outgoingPromises);
            setOutgoingRequests(outgoingWithData.filter((r: any) => r.senderData));
            
            unsubscribe2();
            unsubscribe();
            resolve();
          });
        });
      });
      
    } catch (error) {
      console.error('[Friends] Error fetching friend requests:', error);
      showToast('Error loading friend requests', 'error');
    }
  };

  const cleanupAcceptedRequests = async () => {
    if (!user) return;
    
    console.log('[Friends] Checking for stuck accepted requests...');
    
    try {
      // Find any requests with status 'accepted' that haven't been processed
      const acceptedQuery = firestore.collection('friendRequests')
        .where('status', '==', 'accepted');
      
      const acceptedSnapshot = await acceptedQuery.get();
      console.log('[Friends] Found accepted requests to process:', acceptedSnapshot.docs.length);
      
      for (const requestDoc of acceptedSnapshot.docs) {
        const requestData = requestDoc.data();
        const requestId = requestDoc.id;
        
        // Only process requests involving current user
        if (requestData.senderId === user.uid || requestData.recipientId === user.uid) {
          console.log('[Friends] Processing stuck request:', requestId);
          
          try {
            // Create friendship documents
            const senderFriendRef = firestore.collection('users').doc(requestData.senderId).collection('friends').doc(requestData.recipientId);
            const recipientFriendRef = firestore.collection('users').doc(requestData.recipientId).collection('friends').doc(requestData.senderId);
            
            await senderFriendRef.set({
              friendId: requestData.recipientId,
              addedAt: firestore.FieldValue.serverTimestamp(),
            });
            
            await recipientFriendRef.set({
              friendId: requestData.senderId,
              addedAt: firestore.FieldValue.serverTimestamp(),
            });
            
            // Delete the processed request
            const requestRef = firestore.collection('friendRequests').doc(requestId);
            await requestRef.delete();
            
            console.log('[Friends] ✅ Processed stuck request:', requestId);
          } catch (error) {
            console.error('[Friends] Error processing stuck request:', requestId, error);
          }
        }
      }
    } catch (error) {
      console.error('[Friends] Error during cleanup:', error);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      // First cleanup any stuck accepted requests
      await cleanupAcceptedRequests();
      
      // Then load normal data
      await Promise.all([fetchFriends(), fetchFriendRequests()]);
    } catch (error) {
      console.error('[Friends] Error refreshing data:', error);
    }
    setRefreshing(false);
  };

  const handleAcceptRequest = async (request: FriendRequestWithUserData) => {
    if (!user) return;
    
    console.log('[Friends] Accepting friend request:', request.id);
    console.log('[Friends] Request details:', { senderId: request.senderId, recipientId: request.recipientId });
    
    try {
      // Update request status to accepted
      const requestRef = firestore.collection('friendRequests').doc(request.id);
      await requestRef.update({ 
        status: 'accepted',
        acceptedAt: firestore.FieldValue.serverTimestamp()
      });
      
      console.log('[Friends] Friend request status updated to accepted');
      
      // FALLBACK: Manually create friendship if Cloud Function isn't working
      // This ensures the UI works even if the backend function fails
      console.log('[Friends] Creating friendship fallback...');
      
      const batch = firestore.collection('friendRequests').doc('temp'); // We need a reference for batching
      
      try {
        // Create friend document for current user (recipient)
        const myFriendRef = firestore.collection('users').doc(user.uid).collection('friends').doc(request.senderId);
        await myFriendRef.set({
          friendId: request.senderId,
          addedAt: firestore.FieldValue.serverTimestamp(),
        });
        console.log('[Friends] Created friendship document for current user');
        
        // Create friend document for sender
        const theirFriendRef = firestore.collection('users').doc(request.senderId).collection('friends').doc(user.uid);
        await theirFriendRef.set({
          friendId: user.uid,
          addedAt: firestore.FieldValue.serverTimestamp(),
        });
        console.log('[Friends] Created friendship document for sender');
        
        // Delete the processed request
        await requestRef.delete();
        console.log('[Friends] Deleted processed friend request');
        
        console.log('[Friends] ✅ Friendship created successfully via fallback mechanism');
        
      } catch (fallbackError) {
        console.error('[Friends] ⚠️ Fallback friendship creation failed:', fallbackError);
        // Don't throw - the Cloud Function might still process it
      }
      
      showToast(`You are now friends with ${request.senderData?.displayName || 'this user'}! 🎉`, 'success');
      
      // Refresh data to show updated lists
      console.log('[Friends] Refreshing data to show updated friendship...');
      await refreshData();
      
    } catch (error: any) {
      console.error('[Friends] Error accepting friend request:', error);
      console.error('[Friends] Error details:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'No error code'
      });
      showToast('Error accepting friend request', 'error');
    }
  };

  const handleDeclineRequest = async (request: FriendRequestWithUserData) => {
    console.log('[Friends] Declining friend request:', request.id);
    
    try {
      // Update request status to declined
      const requestRef = firestore.collection('friendRequests').doc(request.id);
      await requestRef.update({ status: 'declined' });
      
      console.log('[Friends] Friend request declined successfully');
      showToast('Friend request declined', 'info');
      
      // Refresh data to show updated lists
      await refreshData();
      
    } catch (error) {
      console.error('[Friends] Error declining friend request:', error);
      showToast('Error declining friend request', 'error');
    }
  };

  const handleCancelRequest = async (request: FriendRequestWithUserData) => {
    console.log('[Friends] Canceling friend request:', request.id);
    
    try {
      // Delete the request
      const requestRef = firestore.collection('friendRequests').doc(request.id);
      await requestRef.delete();
      
      console.log('[Friends] Friend request canceled successfully');
      showToast('Friend request canceled', 'info');
      
      // Refresh data to show updated lists
      await refreshData();
      
    } catch (error) {
      console.error('[Friends] Error canceling friend request:', error);
      showToast('Error canceling friend request', 'error');
    }
  };

  const handleRemoveFriend = async (friend: FriendWithUserData) => {
    if (!user || !friend.userData) return;
    
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.userData.displayName || 'this user'} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Friends] Removing friend:', friend.friendId);
              
              // Remove from both users' friends collections
              const myFriendsRef = firestore.collection('users').doc(user.uid).collection('friends').doc(friend.friendId);
              const theirFriendsRef = firestore.collection('users').doc(friend.friendId).collection('friends').doc(user.uid);
              
              await Promise.all([
                myFriendsRef.delete(),
                theirFriendsRef.delete()
              ]);
              
              console.log('[Friends] Friend removed successfully');
              showToast(`Removed ${friend.userData?.displayName || 'friend'} from your friends`, 'info');
              
              // Refresh data
              await refreshData();
              
            } catch (error) {
              console.error('[Friends] Error removing friend:', error);
              showToast('Error removing friend', 'error');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // First cleanup any stuck accepted requests
        await cleanupAcceptedRequests();
        
        // Then load normal data
        await Promise.all([fetchFriends(), fetchFriendRequests()]);
      } catch (error) {
        console.error('[Friends] Error loading initial data:', error);
      }
      setLoading(false);
    };
    
    loadData();
  }, [user]);

  const renderFriend = ({ item }: { item: FriendWithUserData }) => (
    <View className="flex-row items-center justify-between p-4 bg-gray-50 rounded-lg mb-2">
      <View className="flex-1">
        <Text className="text-lg font-semibold">{item.userData?.displayName || 'Unknown User'}</Text>
        <Text className="text-gray-600 text-sm">{item.userData?.email}</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveFriend(item)}
        className="bg-red-500 px-3 py-2 rounded-lg"
      >
        <Text className="text-white font-semibold text-sm">Remove</Text>
      </TouchableOpacity>
    </View>
  );

  const renderIncomingRequest = ({ item }: { item: FriendRequestWithUserData }) => (
    <View className="flex-row items-center justify-between p-4 bg-blue-50 rounded-lg mb-2">
      <View className="flex-1">
        <Text className="text-lg font-semibold">{item.senderData?.displayName || 'Unknown User'}</Text>
        <Text className="text-gray-600 text-sm">{item.senderData?.email}</Text>
        <Text className="text-blue-600 text-xs mt-1">Wants to be your friend</Text>
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => handleAcceptRequest(item)}
          className="bg-green-500 px-3 py-2 rounded-lg"
        >
          <Text className="text-white font-semibold text-sm">Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeclineRequest(item)}
          className="bg-gray-500 px-3 py-2 rounded-lg"
        >
          <Text className="text-white font-semibold text-sm">Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOutgoingRequest = ({ item }: { item: FriendRequestWithUserData }) => (
    <View className="flex-row items-center justify-between p-4 bg-yellow-50 rounded-lg mb-2">
      <View className="flex-1">
        <Text className="text-lg font-semibold">{item.senderData?.displayName || 'Unknown User'}</Text>
        <Text className="text-gray-600 text-sm">{item.senderData?.email}</Text>
        <Text className="text-yellow-600 text-xs mt-1">Request pending</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleCancelRequest(item)}
        className="bg-red-500 px-3 py-2 rounded-lg"
      >
        <Text className="text-white font-semibold text-sm">Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Header title="Friends" showHomeButton={true} />
        <LoadingSpinner text="Loading friends..." overlay={false} />
      </View>
    );
  }

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
      
      {/* Tab Navigation */}
      <View className="flex-row border-b border-gray-200">
        <TouchableOpacity
          className={`flex-1 py-3 ${activeTab === 'friends' ? 'border-b-2 border-blue-500' : ''}`}
          onPress={() => setActiveTab('friends')}
        >
          <Text className={`text-center font-semibold ${activeTab === 'friends' ? 'text-blue-500' : 'text-gray-600'}`}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 ${activeTab === 'incoming' ? 'border-b-2 border-blue-500' : ''}`}
          onPress={() => setActiveTab('incoming')}
        >
          <Text className={`text-center font-semibold ${activeTab === 'incoming' ? 'text-blue-500' : 'text-gray-600'}`}>
            Requests ({incomingRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 ${activeTab === 'outgoing' ? 'border-b-2 border-blue-500' : ''}`}
          onPress={() => setActiveTab('outgoing')}
        >
          <Text className={`text-center font-semibold ${activeTab === 'outgoing' ? 'text-blue-500' : 'text-gray-600'}`}>
            Sent ({outgoingRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1 p-4">
        {activeTab === 'friends' && (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.friendId}
            renderItem={renderFriend}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} />}
            ListEmptyComponent={() => (
              <View className="flex-1 justify-center items-center py-8">
                <Text className="text-xl font-semibold mb-2">👥 No Friends Yet</Text>
                <Text className="text-gray-500 text-center mb-4">
                  Start adding friends to send them snaps!
                </Text>
                <Link href="/(protected)/add-friend" asChild>
                  <TouchableOpacity className="bg-blue-500 px-6 py-3 rounded-lg">
                    <Text className="text-white font-semibold">Add Your First Friend</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            )}
          />
        )}

        {activeTab === 'incoming' && (
          <FlatList
            data={incomingRequests}
            keyExtractor={(item) => item.id}
            renderItem={renderIncomingRequest}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} />}
            ListEmptyComponent={() => (
              <View className="flex-1 justify-center items-center py-8">
                <Text className="text-xl font-semibold mb-2">📨 No Incoming Requests</Text>
                <Text className="text-gray-500 text-center">
                  When someone sends you a friend request, it will appear here.
                </Text>
              </View>
            )}
          />
        )}

        {activeTab === 'outgoing' && (
          <FlatList
            data={outgoingRequests}
            keyExtractor={(item) => item.id}
            renderItem={renderOutgoingRequest}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} />}
            ListEmptyComponent={() => (
              <View className="flex-1 justify-center items-center py-8">
                <Text className="text-xl font-semibold mb-2">📤 No Outgoing Requests</Text>
                <Text className="text-gray-500 text-center">
                  Friend requests you send will appear here while pending.
                </Text>
              </View>
            )}
          />
        )}
      </View>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

export default FriendsScreen; 