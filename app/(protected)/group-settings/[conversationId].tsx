import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  updateDoc,
  deleteDoc,
  arrayRemove,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { useAuth } from '../../../store/useAuth';
import { Conversation } from '../../../models/firestore/conversation';
import { User } from '../../../models/firestore/user';
import { Friend } from '../../../models/firestore/friend';
import Header from '../../../components/Header';

console.log('[GroupSettings] Component loaded');

export default function GroupSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [availableFriends, setAvailableFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [editingName, setEditingName] = useState(false);

  console.log('[GroupSettings] Rendering for conversation:', conversationId);

  useEffect(() => {
    if (!user || !conversationId) {
      console.log('[GroupSettings] Missing user or conversationId');
      setLoading(false);
      return;
    }

    loadConversationData();
  }, [user, conversationId]);

  const loadConversationData = async () => {
    try {
      console.log('[GroupSettings] Loading conversation data');
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
      setGroupName(conversationData.name || '');

      // 2. Load participants
      const participantPromises = conversationData.participantIds.map(async (participantId) => {
        const userDoc = await getDoc(doc(firestore, 'users', participantId));
        if (userDoc.exists()) {
          return { id: userDoc.id, ...userDoc.data() } as User;
        }
        return null;
      });

      const participantsList = (await Promise.all(participantPromises)).filter(
        (p): p is User => p !== null
      );
      setParticipants(participantsList);

      // 3. Load available friends (not already in group)
      await loadAvailableFriends(conversationData.participantIds);

      console.log('[GroupSettings] Data loaded successfully');
    } catch (error) {
      console.error('[GroupSettings] Error loading data:', error);
      Alert.alert('Error', 'Failed to load group settings');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFriends = async (currentParticipants: string[]) => {
    try {
      if (!user) return;

      console.log('[GroupSettings] Loading available friends');
      
      // Query the current user's friends subcollection
      const friendsQuery = query(collection(firestore, 'users', user.uid, 'friends'));

      const friendsSnapshot = await getDocs(friendsQuery);
      console.log('[GroupSettings] Found', friendsSnapshot.size, 'friend documents');

      if (friendsSnapshot.empty) {
        setAvailableFriends([]);
        return;
      }

      // Build list of friend user docs who are NOT already in the conversation
      const friendPromises = friendsSnapshot.docs.map(async (friendDoc) => {
        const friendData = friendDoc.data() as Friend;

        // Skip if already a participant
        if (currentParticipants.includes(friendData.friendId)) {
          return null;
        }

        const friendUserDoc = await getDoc(doc(firestore, 'users', friendData.friendId));
        if (friendUserDoc.exists()) {
          return { id: friendUserDoc.id, ...friendUserDoc.data() } as User;
        }
        return null;
      });

      const friendsList = (await Promise.all(friendPromises)).filter(
        (u): u is User => u !== null
      );

      console.log('[GroupSettings] Available friends:', friendsList.length);
      setAvailableFriends(friendsList);
      
    } catch (error) {
      console.error('[GroupSettings] Error loading friends:', error);
      setAvailableFriends([]);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!conversation || !user || !groupName.trim()) {
      Alert.alert('Error', 'Please enter a valid group name');
      return;
    }

    try {
      console.log('[GroupSettings] Updating group name to:', groupName.trim());
      setUpdating(true);

      await updateDoc(doc(firestore, 'conversations', conversationId), {
        name: groupName.trim(),
      });

      setConversation({ ...conversation, name: groupName.trim() });
      setEditingName(false);
      Alert.alert('Success', 'Group name updated!');
      
    } catch (error) {
      console.error('[GroupSettings] Error updating group name:', error);
      Alert.alert('Error', 'Failed to update group name');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveMember = async (memberToRemove: User) => {
    if (!conversation || !user) return;

    // Don't allow removing yourself - use leave group instead
    if (memberToRemove.id === user.uid) {
      Alert.alert('Error', 'Use "Leave Group" to remove yourself');
      return;
    }

    // Only group creator can remove members
    if (conversation.createdBy !== user.uid) {
      Alert.alert('Error', 'Only the group creator can remove members');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberToRemove.displayName || 'this member'} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => performRemoveMember(memberToRemove),
        },
      ]
    );
  };

  const performRemoveMember = async (memberToRemove: User) => {
    try {
      console.log('[GroupSettings] Removing member:', memberToRemove.displayName);
      setUpdating(true);

      await updateDoc(doc(firestore, 'conversations', conversationId), {
        participantIds: arrayRemove(memberToRemove.id),
      });

      // Update local state
      setParticipants(prev => prev.filter(p => p.id !== memberToRemove.id));
      setConversation(prev => prev ? {
        ...prev,
        participantIds: prev.participantIds.filter(id => id !== memberToRemove.id)
      } : null);

      Alert.alert('Success', `${memberToRemove.displayName || 'Member'} has been removed from the group`);
      
    } catch (error) {
      console.error('[GroupSettings] Error removing member:', error);
      Alert.alert('Error', 'Failed to remove member');
    } finally {
      setUpdating(false);
    }
  };

  const handleLeaveGroup = () => {
    if (!conversation || !user) return;

    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group? You won\'t be able to see new messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: performLeaveGroup,
        },
      ]
    );
  };

  const performLeaveGroup = async () => {
    try {
      if (!conversation || !user) return;
      
      console.log('[GroupSettings] User leaving group');
      setUpdating(true);

      // If this is the last member or the creator is leaving, delete the conversation
      if (conversation.participantIds.length <= 1 || conversation.createdBy === user.uid) {
        await deleteDoc(doc(firestore, 'conversations', conversationId));
        Alert.alert('Group Deleted', 'The group has been deleted since you were the last member or the creator.');
      } else {
        // Just remove the user from participants
        await updateDoc(doc(firestore, 'conversations', conversationId), {
          participantIds: arrayRemove(user.uid),
        });
        Alert.alert('Left Group', 'You have left the group successfully.');
      }

      // Navigate back to groups screen
      router.replace('/(protected)/groups');
      
    } catch (error) {
      console.error('[GroupSettings] Error leaving group:', error);
      Alert.alert('Error', 'Failed to leave group');
    } finally {
      setUpdating(false);
    }
  };

  const handleEnableRAG = async () => {
    if (!conversation || !user) return;

    try {
      console.log('[GroupSettings] Enabling RAG for conversation:', conversationId);
      setUpdating(true);

      await updateDoc(doc(firestore, 'conversations', conversationId), {
        ragEnabled: true,
      });

      setConversation({ ...conversation, ragEnabled: true });
      Alert.alert('Success', 'RAG (AI conversation summaries) has been enabled for this group!');
      
    } catch (error) {
      console.error('[GroupSettings] Error enabling RAG:', error);
      Alert.alert('Error', 'Failed to enable RAG');
    } finally {
      setUpdating(false);
    }
  };

  const renderParticipant = ({ item }: { item: User }) => {
    const isCreator = conversation?.createdBy === item.id;
    const isCurrentUser = item.id === user?.uid;
    const canRemove = conversation?.createdBy === user?.uid && !isCurrentUser;

    return (
      <View style={styles.participantItem}>
        <View style={styles.participantInfo}>
          <View style={styles.participantAvatar}>
            <Text style={styles.participantAvatarText}>
              {(item.displayName || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.participantDetails}>
            <Text style={styles.participantName}>
              {item.displayName || 'Unknown User'}
              {isCurrentUser && ' (You)'}
            </Text>
            <Text style={styles.participantRole}>
              {isCreator ? 'Group Creator' : 'Member'}
            </Text>
          </View>
        </View>
        
        {canRemove && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveMember(item)}
            disabled={updating}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Group Settings" showBackButton />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Group Settings" showBackButton />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Group Settings" showBackButton />
      
      <View style={styles.content}>
        {/* Group Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Name</Text>
          {editingName ? (
            <View style={styles.nameEditContainer}>
              <TextInput
                style={styles.nameInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Enter group name"
                maxLength={50}
                autoFocus
              />
              <View style={styles.nameEditButtons}>
                <TouchableOpacity
                  style={[styles.nameButton, styles.cancelButton]}
                  onPress={() => {
                    setGroupName(conversation.name || '');
                    setEditingName(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nameButton, styles.saveButton]}
                  onPress={handleUpdateGroupName}
                  disabled={updating}
                >
                  <Text style={styles.saveButtonText}>
                    {updating ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameDisplayContainer}
              onPress={() => setEditingName(true)}
            >
              <Text style={styles.nameDisplay}>
                {conversation.name || `Group (${participants.length})`}
              </Text>
              <Text style={styles.nameEditHint}>Tap to edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Members ({participants.length})
          </Text>
          <FlatList
            data={participants}
            renderItem={renderParticipant}
            keyExtractor={(item) => item.id}
            style={styles.participantsList}
            scrollEnabled={false}
          />
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push({
              pathname: '/(protected)/add-group-member/[conversationId]',
              params: { conversationId }
            })}
          >
            <Text style={styles.actionButtonText}>➕ Add Members</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.leaveButton]}
            onPress={handleLeaveGroup}
            disabled={updating}
          >
            <Text style={[styles.actionButtonText, styles.leaveButtonText]}>
              🚪 Leave Group
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Group Actions</Text>
        
        {/* RAG Controls */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧠 RAG Controls (Debug)</Text>
            <View style={styles.ragControlsContainer}>
              <Text style={styles.ragStatusText}>
                RAG Status: {conversation?.ragEnabled ? '✅ Enabled' : '❌ Disabled'}
              </Text>
              {!conversation?.ragEnabled && (
                <TouchableOpacity 
                  style={styles.enableRagButton}
                  onPress={handleEnableRAG}
                >
                  <Text style={styles.enableRagButtonText}>Enable RAG</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.ragInfoText}>
                Message Count: {conversation?.messageCount || 0}
              </Text>
              <Text style={styles.ragInfoText}>
                Last Processed: {conversation?.lastProcessedMessageCount || 0}
              </Text>
            </View>
          </View>
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
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  nameEditContainer: {
    gap: 12,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  nameEditButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  nameButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#2196f3',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  nameDisplayContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  nameDisplay: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  nameEditHint: {
    fontSize: 12,
    color: '#666',
  },
  participantsList: {
    maxHeight: 300,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantAvatarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  participantRole: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f44336',
    borderRadius: 6,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#2196f3',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    backgroundColor: '#f44336',
  },
  leaveButtonText: {
    color: 'white',
  },
  ragControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ragStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  enableRagButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#2196f3',
    borderRadius: 8,
    alignItems: 'center',
  },
  enableRagButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  ragInfoText: {
    fontSize: 12,
    color: '#666',
  },
}); 