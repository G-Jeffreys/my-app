import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { useAuth } from '../../store/useAuth';
import { Conversation } from '../../models/firestore/conversation';
import { User } from '../../models/firestore/user';
import Header from '../../components/Header';

interface GroupInfo extends Conversation {
  participantNames: string[];
  lastMessagePreview?: string;
  unreadCount?: number;
}

export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('[GroupsScreen] Rendering for user:', user?.uid);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    console.log('[GroupsScreen] Setting up groups listener for user:', user.uid);

    // Set up real-time listener for user's conversations
    const conversationsQuery = query(
      collection(firestore, 'conversations'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      conversationsQuery,
      async (snapshot) => {
        console.log('[GroupsScreen] Conversations updated:', snapshot.docs.length);
        
        try {
          const groupPromises = snapshot.docs.map(async (conversationDoc) => {
            const conversationData = conversationDoc.data() as Conversation;
            const groupInfo: GroupInfo = {
              ...conversationData,
              id: conversationDoc.id,
              participantNames: [],
            };

            // Fetch participant names
            const namePromises = conversationData.participantIds.map(async (participantId) => {
              try {
                const userDoc = await getDoc(doc(firestore, 'users', participantId));
                if (userDoc.exists()) {
                  const userData = userDoc.data() as User;
                  return userData.displayName || 'Unknown User';
                }
                return 'Unknown User';
              } catch (error) {
                console.error('[GroupsScreen] Error fetching participant name:', error);
                return 'Unknown User';
              }
            });

            groupInfo.participantNames = await Promise.all(namePromises);

            // Add preview text formatting
            if (conversationData.lastMessageText) {
              groupInfo.lastMessagePreview = conversationData.lastMessageText.length > 50
                ? conversationData.lastMessageText.substring(0, 50) + '...'
                : conversationData.lastMessageText;
            }

            console.log('[GroupsScreen] Processed group:', {
              id: groupInfo.id,
              name: groupInfo.name,
              participantCount: groupInfo.participantIds.length,
              participantNames: groupInfo.participantNames
            });

            return groupInfo;
          });

          const groupsList = await Promise.all(groupPromises);
          
          // Sort by last message time (most recent first)
          groupsList.sort((a, b) => {
            if (!a.lastMessageAt && !b.lastMessageAt) return 0;
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            
            // Handle both Firestore timestamp and Date objects
            const aTime = a.lastMessageAt instanceof Date 
              ? a.lastMessageAt.getTime() 
              : (a.lastMessageAt as any).seconds * 1000;
            const bTime = b.lastMessageAt instanceof Date 
              ? b.lastMessageAt.getTime() 
              : (b.lastMessageAt as any).seconds * 1000;
              
            return bTime - aTime;
          });

          console.log('[GroupsScreen] Final groups list:', groupsList.length);
          setGroups(groupsList);
          
        } catch (error) {
          console.error('[GroupsScreen] Error processing groups:', error);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('[GroupsScreen] Error listening to conversations:', error);
        setLoading(false);
      }
    );

    return () => {
      console.log('[GroupsScreen] Cleaning up conversations listener');
      unsubscribe();
    };
  }, [user]);

  const handleGroupPress = (group: GroupInfo) => {
    console.log('[GroupsScreen] Opening group chat:', group.id);
    
    router.push({
      pathname: '/(protected)/compose-text',
      params: { conversationId: group.id }
    });
  };

  const handleGroupLongPress = (group: GroupInfo) => {
    console.log('[GroupsScreen] Long press on group:', group.id);
    
    Alert.alert(
      group.name || 'Group Chat',
      'What would you like to do?',
      [
        {
          text: 'View Details',
          onPress: () => showGroupDetails(group),
        },
        {
          text: 'Send Message',
          onPress: () => handleGroupPress(group),
        },
        ...(group.createdBy === user?.uid ? [{
          text: 'Delete Group',
          style: 'destructive' as const,
          onPress: () => confirmDeleteGroup(group),
        }] : []),
        {
          text: 'Cancel',
          style: 'cancel' as const,
        },
      ]
    );
  };

  const showGroupDetails = (group: GroupInfo) => {
    const participantsList = group.participantNames.join(', ');
    const createdDate = group.createdAt 
      ? (group.createdAt instanceof Date 
          ? group.createdAt.toLocaleDateString()
          : new Date((group.createdAt as any).seconds * 1000).toLocaleDateString())
      : 'Unknown';

    Alert.alert(
      group.name || 'Group Chat',
      `Participants: ${participantsList}\n\nCreated: ${createdDate}\nMessages: ${group.messageCount || 0}`,
      [{ text: 'OK' }]
    );
  };

  const confirmDeleteGroup = (group: GroupInfo) => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteGroup(group),
        },
      ]
    );
  };

  const deleteGroup = async (group: GroupInfo) => {
    try {
      console.log('[GroupsScreen] Deleting group:', group.id);
      
      // Delete the conversation document
      await deleteDoc(doc(firestore, 'conversations', group.id));
      
      console.log('[GroupsScreen] ✅ Group deleted successfully');
      
      // Note: Messages and receipts will be cleaned up by Cloud Functions
      Alert.alert('Success', 'Group deleted successfully');
      
    } catch (error) {
      console.error('[GroupsScreen] ❌ Error deleting group:', error);
      Alert.alert('Error', 'Failed to delete group. Please try again.');
    }
  };

  const navigateToCreateGroup = () => {
    console.log('[GroupsScreen] Navigating to create group');
    router.push('/(protected)/create-group');
  };

  const formatLastMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    // Handle both Firestore timestamp and Date objects
    const date = timestamp instanceof Date 
      ? timestamp 
      : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderGroup = ({ item }: { item: GroupInfo }) => (
    <TouchableOpacity
      style={styles.groupRow}
      onPress={() => handleGroupPress(item)}
      onLongPress={() => handleGroupLongPress(item)}
      delayLongPress={500}
    >
      <View style={styles.groupInfo}>
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>👥</Text>
        </View>
        
        <View style={styles.groupDetails}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupName} numberOfLines={1}>
              {item.name || `Group (${item.participantIds.length})`}
            </Text>
            {item.lastMessageAt && (
              <Text style={styles.timeText}>
                {formatLastMessageTime(item.lastMessageAt)}
              </Text>
            )}
          </View>
          
          <Text style={styles.participantsText} numberOfLines={1}>
            {item.participantNames.join(', ')}
          </Text>
          
          {item.lastMessagePreview && (
            <Text style={styles.lastMessageText} numberOfLines={1}>
              {item.lastMessagePreview}
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.groupMeta}>
        <Text style={styles.memberCount}>
          {item.participantIds.length} members
        </Text>
        {item.createdBy === user?.uid && (
          <Text style={styles.ownerBadge}>Owner</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Groups" showBackButton />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Loading your groups...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Groups" showBackButton />
      
      <View style={styles.content}>
        {/* Create Group Button */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={navigateToCreateGroup}
        >
          <Text style={styles.createButtonText}>+ Create New Group</Text>
        </TouchableOpacity>

        {/* Groups List */}
        {groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No groups yet</Text>
            <Text style={styles.emptySubtext}>
              Create a group to start chatting with multiple friends at once
            </Text>
            <TouchableOpacity
              style={styles.emptyCreateButton}
              onPress={navigateToCreateGroup}
            >
              <Text style={styles.emptyCreateButtonText}>Create Your First Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={groups}
            renderItem={renderGroup}
            keyExtractor={(item) => item.id}
            style={styles.groupsList}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
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
  createButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  groupsList: {
    flex: 1,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupAvatarText: {
    fontSize: 20,
  },
  groupDetails: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  participantsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  lastMessageText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  groupMeta: {
    alignItems: 'flex-end',
  },
  memberCount: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  ownerBadge: {
    fontSize: 10,
    color: '#2196f3',
    fontWeight: '600',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 81, // Align with content
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyCreateButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyCreateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 