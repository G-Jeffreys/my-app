import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/useAuth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Friend } from '../../models/firestore/friend';
import { router, useLocalSearchParams } from 'expo-router';
import { User } from '../../models/firestore/user';

export default function SelectFriendScreen() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<User[]>([]);
  const params = useLocalSearchParams();

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user) return;
      const db = getFirestore();
      const friendsCollectionRef = collection(db, 'users', user.uid, 'friends');
      const friendsSnapshot = await getDocs(friendsCollectionRef);
      
      const friendPromises = friendsSnapshot.docs.map(async (friendDoc) => {
        const friendData = friendDoc.data() as Friend;
        const userDocRef = doc(db, 'users', friendData.friendId);
        const userSnapshot = await getDoc(userDocRef);

        if (userSnapshot.exists()) {
          return { id: userSnapshot.id, ...userSnapshot.data() } as User;
        }
        return null;
      });

      const friendsData = (await Promise.all(friendPromises)).filter(f => f !== null) as User[];
      setFriends(friendsData);
    };

    fetchFriends();
  }, [user]);

  const onSelectFriend = (friend: User) => {
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
      />
    </View>
  );
}

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
}); 