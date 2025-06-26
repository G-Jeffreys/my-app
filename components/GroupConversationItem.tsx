import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { useAuth } from '../store/useAuth';
import { Conversation } from '../models/firestore/conversation';
import { Message } from '../models/firestore/message';
import { User } from '../models/firestore/user';

interface GroupConversationItemProps {
  conversation: Conversation;
}

const GroupConversationItem: React.FC<GroupConversationItemProps> = ({
  conversation,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch participants
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const participantPromises = conversation.participantIds.map(async (participantId) => {
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
      } catch (error) {
        console.error('[GroupConversationItem] Error fetching participants:', error);
      }
    };

    fetchParticipants();
  }, [conversation.participantIds]);

  // Listen to latest message in this conversation
  useEffect(() => {
    if (!conversation.id) return;

    const messagesQuery = query(
      collection(firestore, 'messages'),
      where('conversationId', '==', conversation.id),
      orderBy('sentAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const latestMessage = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
          } as Message;
          setLastMessage(latestMessage);
        } else {
          setLastMessage(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('[GroupConversationItem] Error listening to messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversation.id]);

  // Calculate unread count (simplified - could be enhanced)
  useEffect(() => {
    // For now, we'll show unread count based on whether there are any messages
    // after the user's last seen timestamp (this could be enhanced with proper tracking)
    if (lastMessage && lastMessage.senderId !== user?.uid) {
      setUnreadCount(1); // Simplified: show 1 if there's a message from someone else
    } else {
      setUnreadCount(0);
    }
  }, [lastMessage, user?.uid]);

  const handlePress = () => {
    console.log('[GroupConversationItem] Opening group conversation:', conversation.id);
    router.push({
      pathname: '/(protected)/group-conversation/[conversationId]',
      params: { conversationId: conversation.id }
    });
  };

  const getConversationName = () => {
    if (conversation.name) {
      return conversation.name;
    }
    
    // Generate name from participants (excluding current user)
    const otherParticipants = participants.filter(p => p.id !== user?.uid);
    if (otherParticipants.length > 0) {
      const names = otherParticipants.map(p => p.displayName || 'Unknown').slice(0, 2);
      if (otherParticipants.length > 2) {
        return `${names.join(', ')} +${otherParticipants.length - 2}`;
      }
      return names.join(', ');
    }
    
    return `Group (${participants.length})`;
  };

  const getLastMessagePreview = () => {
    if (loading) return 'Loading...';
    if (!lastMessage) return 'No messages yet';
    
    const senderName = lastMessage.senderId === user?.uid 
      ? 'You' 
      : participants.find(p => p.id === lastMessage.senderId)?.displayName || 'Someone';
    
    if (lastMessage.mediaType === 'text') {
      const preview = lastMessage.text && lastMessage.text.length > 40 
        ? `${lastMessage.text.substring(0, 40)}...` 
        : lastMessage.text || 'Message';
      return `${senderName}: ${preview}`;
    } else if (lastMessage.mediaType === 'image') {
      return `${senderName}: 📷 Photo`;
    } else if (lastMessage.mediaType === 'video') {
      return `${senderName}: 🎥 Video`;
    }
    
    return `${senderName}: Message`;
  };

  const getTimeAgo = () => {
    if (!lastMessage?.sentAt) return '';
    
    const sentTime = lastMessage.sentAt instanceof Date 
      ? lastMessage.sentAt 
      : new Date((lastMessage.sentAt as any)?.seconds * 1000);
    
    const now = new Date();
    const diffMs = now.getTime() - sentTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return sentTime.toLocaleDateString();
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <View style={styles.content}>
        {/* Group Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.groupIcon}>👥</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        
        {/* Conversation Info */}
        <View style={styles.info}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {getConversationName()}
            </Text>
            <Text style={styles.time}>{getTimeAgo()}</Text>
          </View>
          
          <Text style={styles.preview} numberOfLines={2}>
            {getLastMessagePreview()}
          </Text>
          
          <Text style={styles.participants} numberOfLines={1}>
            {participants.length} member{participants.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginVertical: 4,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  groupIcon: {
    fontSize: 32,
    width: 48,
    height: 48,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: '#e8f5e8',
    borderRadius: 24,
    lineHeight: Platform.OS === 'ios' ? 48 : undefined,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: '#6b7280',
  },
  preview: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
    lineHeight: 20,
  },
  participants: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default GroupConversationItem; 