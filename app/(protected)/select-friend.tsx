import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/useAuth';
import { firestore } from '../../lib/firebase';
import { Friend } from '../../models/firestore/friend';
import { router, useLocalSearchParams } from 'expo-router';
import { User } from '../../models/firestore/user';

const SelectFriendScreen = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<User[]>([]);
  const params = useLocalSearchParams();

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user) return;
      
      console.log('[SelectFriend] Fetching friends for user:', user.uid);
      
      try {
        // Use unified Firebase API - get all friends as a query
        const friendsCollectionRef = firestore.collection('users').doc(user.uid).collection('friends');
        
        // Since we need to get all documents, we can use onSnapshot with immediate callback
        // or use a query to get all documents
        return new Promise<void>((resolve) => {
          const unsubscribe = friendsCollectionRef.onSnapshot(async (friendsSnapshot) => {
            console.log('[SelectFriend] Found friends documents:', friendsSnapshot.docs.length);
            
            const friendPromises = friendsSnapshot.docs.map(async (friendDoc: any) => {
              const friendData = friendDoc.data() as Friend;
              console.log('[SelectFriend] Processing friend:', friendData);
              
              const userDocRef = firestore.collection('users').doc(friendData.friendId);
              const userSnapshot = await userDocRef.get();

              if (userSnapshot.exists()) {
                const userData = userSnapshot.data();
                console.log('[SelectFriend] Friend user data:', userData);
                return { id: userSnapshot.id, ...userData } as User;
              }
              return null;
            });

            const friendsData = (await Promise.all(friendPromises)).filter((f: any) => f !== null) as User[];
            console.log('[SelectFriend] Final friends list:', friendsData);
            setFriends(friendsData);
            unsubscribe(); // Clean up the listener after first load
            resolve();
          });
        });
      } catch (error) {
        console.error('[SelectFriend] Error fetching friends:', error);
      }
    };

    fetchFriends();
  }, [user]);

  const onSelectFriend = (friend: User) => {
    console.log('[SelectFriend] Selected friend:', friend);
    const { uri, mediaType } = params;
    router.replace({ pathname: '/(protected)/preview', params: { uri, mediaType, recipientId: friend.id, recipientName: friend.displayName }});
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.friendItem} onPress={() => onSelectFriend(item)}>
            <Text style={styles.friendName}>{item.displayName || item.email}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No friends found. Add some friends first!</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  friendItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  friendName: {
    fontSize: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default SelectFriendScreen; 