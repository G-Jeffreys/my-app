import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { useAuth } from '../../store/useAuth';
import { Friend } from '../../models/firestore/friend';
import { User } from '../../models/firestore/user';
import { GROUP_CHAT_LIMITS } from '../../config/messaging';
import Header from '../../components/Header';

interface FriendOption {
  id: string;
  name: string;
  photoURL?: string;
  selected: boolean;
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  console.log('[CreateGroupScreen] Rendering for user:', user?.uid);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    console.log('[CreateGroupScreen] Fetching friends for user:', user.uid);
    setLoading(true);

    try {
      // Get user's friends
      const friendsCollectionRef = collection(firestore, "users", user.uid, "friends");
      const friendsSnapshot = await getDocs(friendsCollectionRef);
      
      console.log('[CreateGroupScreen] Found', friendsSnapshot.docs.length, 'friend documents');

      const friendPromises = friendsSnapshot.docs.map(async (friendDoc) => {
        const friendData = friendDoc.data() as Friend;
        const userDocRef = doc(firestore, "users", friendData.friendId);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          return {
            id: userSnap.id,
            name: userData.displayName || 'Unknown User',
            photoURL: userData.photoURL,
            selected: false,
          } as FriendOption;
        }
        return null;
      });

      const friendsList = (await Promise.all(friendPromises)).filter(
        (f): f is FriendOption => f !== null
      );

      console.log('[CreateGroupScreen] Processed friends:', friendsList.length);
      setFriends(friendsList);

    } catch (error) {
      console.error('[CreateGroupScreen] Error fetching friends:', error);
      Alert.alert('Error', 'Failed to load your friends. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    console.log('[CreateGroupScreen] Toggling selection for friend:', friendId);
    
    setFriends(prevFriends => 
      prevFriends.map(friend => 
        friend.id === friendId 
          ? { ...friend, selected: !friend.selected }
          : friend
      )
    );
  };

  const selectedFriends = friends.filter(f => f.selected);
  const isValidGroup = selectedFriends.length >= GROUP_CHAT_LIMITS.MIN_PARTICIPANTS && 
                      selectedFriends.length <= GROUP_CHAT_LIMITS.MAX_PARTICIPANTS - 1; // -1 because creator is included
  const isValidName = groupName.trim().length > 0 && groupName.length <= GROUP_CHAT_LIMITS.MAX_NAME_LENGTH;

  console.log('[CreateGroupScreen] Validation state:', {
    selectedCount: selectedFriends.length,
    isValidGroup,
    isValidName,
    groupNameLength: groupName.length
  });

  const handleCreateGroup = async () => {
    if (!user || !isValidGroup || !isValidName) {
      console.log('[CreateGroupScreen] Invalid group creation attempt');
      return;
    }

    console.log('[CreateGroupScreen] Creating group with:', {
      name: groupName.trim(),
      participants: selectedFriends.length + 1, // +1 for creator
      selectedFriendIds: selectedFriends.map(f => f.id)
    });

    setCreating(true);

    try {
      // Create participant IDs array (creator + selected friends)
      const participantIds = [user.uid, ...selectedFriends.map(f => f.id)];
      
      // Create conversation document
      const conversationData = {
        participantIds,
        name: groupName.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        lastMessageAt: null,
        lastMessageText: null,
        messageCount: 0,
        ragEnabled: false, // Future-proofing for RAG
      };

      const conversationRef = await addDoc(collection(firestore, 'conversations'), conversationData);
      
      console.log('[CreateGroupScreen] ✅ Group created successfully:', {
        conversationId: conversationRef.id,
        participantCount: participantIds.length
      });

      Alert.alert(
        'Success!', 
        `Group "${groupName.trim()}" created with ${participantIds.length} members.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to the new group chat
              router.replace({
                pathname: '/(protected)/compose-text',
                params: { conversationId: conversationRef.id }
              });
            }
          }
        ]
      );

    } catch (error) {
      console.error('[CreateGroupScreen] ❌ Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderFriend = ({ item }: { item: FriendOption }) => (
    <TouchableOpacity
      style={[
        styles.friendRow,
        item.selected && styles.friendRowSelected
      ]}
      onPress={() => toggleFriendSelection(item.id)}
      disabled={creating}
    >
      <View style={styles.friendInfo}>
        <View style={[
          styles.avatar,
          item.selected && styles.avatarSelected
        ]}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.friendDetails}>
          <Text style={[
            styles.friendName,
            item.selected && styles.friendNameSelected
          ]}>
            {item.name}
          </Text>
        </View>
      </View>
      
      <View style={[
        styles.checkbox,
        item.selected && styles.checkboxSelected
      ]}>
        {item.selected && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Create Group" showBackButton />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Loading your friends...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Create Group" showBackButton />
      
      <View style={styles.content}>
        {/* Group Name Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Name</Text>
          <TextInput
            style={[
              styles.nameInput,
              !isValidName && groupName.length > 0 && styles.nameInputError
            ]}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter group name..."
            maxLength={GROUP_CHAT_LIMITS.MAX_NAME_LENGTH}
            editable={!creating}
          />
          <Text style={styles.characterCount}>
            {groupName.length}/{GROUP_CHAT_LIMITS.MAX_NAME_LENGTH}
          </Text>
        </View>

        {/* Friend Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Select Friends ({selectedFriends.length}/{GROUP_CHAT_LIMITS.MAX_PARTICIPANTS - 1})
          </Text>
          <Text style={styles.sectionSubtitle}>
            Choose {GROUP_CHAT_LIMITS.MIN_PARTICIPANTS}-{GROUP_CHAT_LIMITS.MAX_PARTICIPANTS - 1} friends to add to your group
          </Text>
          
          {friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No friends available</Text>
              <Text style={styles.emptySubtext}>
                Add some friends first to create a group chat
              </Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.id}
              style={styles.friendsList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Create Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.createButton,
              (!isValidGroup || !isValidName || creating) && styles.createButtonDisabled
            ]}
            onPress={handleCreateGroup}
            disabled={!isValidGroup || !isValidName || creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>
                Create Group
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Validation Messages */}
          {selectedFriends.length > 0 && !isValidGroup && (
            <Text style={styles.validationText}>
              {selectedFriends.length < GROUP_CHAT_LIMITS.MIN_PARTICIPANTS 
                ? `Select at least ${GROUP_CHAT_LIMITS.MIN_PARTICIPANTS} friends`
                : `Maximum ${GROUP_CHAT_LIMITS.MAX_PARTICIPANTS - 1} friends allowed`
              }
            </Text>
          )}
          
          {groupName.length > 0 && !isValidName && (
            <Text style={styles.validationText}>
              Group name is required and must be under {GROUP_CHAT_LIMITS.MAX_NAME_LENGTH} characters
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  nameInputError: {
    borderColor: '#f44336',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  friendsList: {
    maxHeight: 300,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  friendRowSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSelected: {
    backgroundColor: '#2196f3',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  friendNameSelected: {
    color: '#2196f3',
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  createButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  validationText: {
    fontSize: 12,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
}); 