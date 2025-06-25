import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/useAuth';
import { firestore } from '../../lib/firebase';
import { Friend } from '../../models/firestore/friend';
import { router, useLocalSearchParams } from 'expo-router';
import { User } from '../../models/firestore/user';
import Header from '../../components/Header';

const SelectFriendScreen = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<User[]>([]);
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('[SelectFriend] Component mounted, fetching friends...');
    
    const fetchFriends = async () => {
      if (!user) {
        console.log('[SelectFriend] No user available, skipping friends fetch');
        return;
      }
      
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
    router.replace({ 
      pathname: '/(protected)/preview', 
      params: { 
        uri, 
        mediaType, 
        recipientId: friend.id, 
        recipientName: friend.displayName 
      }
    });
  };

  return (
    <View style={styles.fullContainer}>
      <Header title="Select Friend" showBackButton={true} />
      <View style={styles.container}>
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={true}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.friendItem} 
              onPress={() => onSelectFriend(item)}
              activeOpacity={0.7}
            >
              <View style={styles.friendContent}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarText}>
                    {(item.displayName || item.email || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{item.displayName || item.email}</Text>
                  <Text style={styles.friendEmail}>{item.email}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No friends found. Add some friends first!</Text>
              <TouchableOpacity 
                style={styles.addFriendButton}
                onPress={() => router.push('/(protected)/add-friend')}
              >
                <Text style={styles.addFriendButtonText}>Add Friends</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContainer: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  friendItem: {
    marginHorizontal: 16,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  friendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  friendAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  addFriendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFriendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SelectFriendScreen; 