import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { useAuth } from '../../../store/useAuth';
import { Conversation } from '../../../models/firestore/conversation';
import { User } from '../../../models/firestore/user';
import { Friend } from '../../../models/firestore/friend';
import Header from '../../../components/Header';

console.log('[AddGroupMember] Component loaded');

interface FriendOption {
  id: string;
  displayName: string;
  photoURL?: string;
}

export default function AddGroupMemberScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [availableFriends, setAvailableFriends] = useState<FriendOption[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  console.log('[AddGroupMember] Rendering for conversation:', conversationId);

  useEffect(() => {
    if (!user || !conversationId) {
      console.log('[AddGroupMember] Missing user or conversationId');
      setLoading(false);
      return;
    }

    loadData();
  }, [user, conversationId]);

  const loadData = async () => {
    try {
      console.log('[AddGroupMember] Loading data');
      setLoading(true);

      // 1. Load conversation
      const conversationRef = doc(firestore, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        Alert.alert('Error', 'Group not found');
        router.back();
        return;
      }

      const conversationData = { id: conversationSnap.id, ...conversationSnap.data() } as Conversation;
      setConversation(conversationData);

      // 2. Load user's friends who are not already in the group
      await loadAvailableFriends(conversationData.participantIds);

      console.log('[AddGroupMember] Data loaded successfully');
    } catch (error) {
      console.error('[AddGroupMember] Error loading data:', error);
      Alert.alert('Error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFriends = async (currentParticipants: string[]) => {
    try {
      if (!user) return;

      console.log('[AddGroupMember] Loading available friends');
      
      // Get user's friends from the friends subcollection
      const friendsQuery = query(
        collection(firestore, 'users', user.uid, 'friends')
      );
      
      const friendsSnapshot = await getDocs(friendsQuery);
      console.log('[AddGroupMember] Found', friendsSnapshot.size, 'friend documents');

      if (friendsSnapshot.empty) {
        setAvailableFriends([]);
        return;
      }

      // Get friend user details for friends not already in group
      const friendPromises = friendsSnapshot.docs.map(async (friendDoc) => {
        const friendData = friendDoc.data() as Friend;
        
        // Skip if friend is already in the group
        if (currentParticipants.includes(friendData.friendId)) {
          return null;
        }

        // Get the friend's user details
        const userDoc = await getDoc(doc(firestore, 'users', friendData.friendId));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          return {
            id: userDoc.id,
            displayName: userData.displayName || 'Unknown User',
            photoURL: userData.photoURL,
          } as FriendOption;
        }
        return null;
      });

      const friendsList = (await Promise.all(friendPromises)).filter(
        (f): f is FriendOption => f !== null
      );

      console.log('[AddGroupMember] Available friends:', friendsList.length);
      setAvailableFriends(friendsList);
      
    } catch (error) {
      console.error('[AddGroupMember] Error loading friends:', error);
      setAvailableFriends([]);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const handleAddMembers = async () => {
    if (!conversation || !user || selectedFriends.length === 0) {
      Alert.alert('Error', 'Please select at least one friend to add');
      return;
    }

    // Only group creator can add members
    if (conversation.createdBy !== user.uid) {
      Alert.alert('Error', 'Only the group creator can add members');
      return;
    }

    try {
      console.log('[AddGroupMember] Adding members:', selectedFriends);
      setAdding(true);

      // Add new members to the conversation
      await updateDoc(doc(firestore, 'conversations', conversationId), {
        participantIds: arrayUnion(...selectedFriends),
      });

      const selectedFriendNames = availableFriends
        .filter(f => selectedFriends.includes(f.id))
        .map(f => f.displayName)
        .join(', ');

      Alert.alert(
        'Success', 
        `Added ${selectedFriendNames} to the group!`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          }
        ]
      );
      
    } catch (error) {
      console.error('[AddGroupMember] Error adding members:', error);
      Alert.alert('Error', 'Failed to add members');
    } finally {
      setAdding(false);
    }
  };

  const renderFriend = ({ item }: { item: FriendOption }) => {
    const isSelected = selectedFriends.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => toggleFriendSelection(item.id)}
      >
        <View style={styles.friendInfo}>
          <View style={styles.friendAvatar}>
            <Text style={styles.friendAvatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.friendName}>{item.displayName}</Text>
        </View>
        
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Add Members" showBackButton />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Add Members" showBackButton />
      
      <View style={styles.content}>
        {availableFriends.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No friends available to add</Text>
            <Text style={styles.emptySubtext}>
              All your friends are already in this group, or you haven't added any friends yet.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.headerText}>
                Select friends to add to the group
              </Text>
              {selectedFriends.length > 0 && (
                <Text style={styles.selectedCount}>
                  {selectedFriends.length} selected
                </Text>
              )}
            </View>

            <FlatList
              data={availableFriends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.id}
              style={styles.friendsList}
            />

            {selectedFriends.length > 0 && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddMembers}
                disabled={adding}
              >
                <Text style={styles.addButtonText}>
                  {adding ? 'Adding...' : `Add ${selectedFriends.length} Member${selectedFriends.length > 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    marginBottom: 20,
  },
  headerText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
  },
  selectedCount: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '600',
  },
  friendsList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  friendItemSelected: {
    borderColor: '#2196f3',
    backgroundColor: '#e3f2fd',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    borderColor: '#2196f3',
    backgroundColor: '#2196f3',
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#2196f3',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 