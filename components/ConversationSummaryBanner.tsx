import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { ConversationSummary } from '../models/firestore/summary';

interface ConversationSummaryBannerProps {
  conversationId: string;
  totalMessages?: number;
}

const ConversationSummaryBanner: React.FC<ConversationSummaryBannerProps> = ({
  conversationId,
  totalMessages = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [latestSummary, setLatestSummary] = useState<ConversationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  console.log('[ConversationSummaryBanner] Initializing for conversation:', { 
    conversationId, 
    totalMessages 
  });

  useEffect(() => {
    if (!conversationId) {
      console.log('[ConversationSummaryBanner] No conversationId provided');
      setIsLoading(false);
      return;
    }

    console.log('[ConversationSummaryBanner] Setting up real-time listener for summaries');

    // Listen for the latest conversation summary
    const summariesQuery = query(
      collection(firestore, 'conversationSummaries'),
      where('conversationId', '==', conversationId),
      orderBy('batchNumber', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      summariesQuery,
      (snapshot) => {
        console.log('[ConversationSummaryBanner] Summary snapshot received:', {
          conversationId,
          docCount: snapshot.docs.length
        });

        if (snapshot.docs.length > 0) {
          const summaryData = snapshot.docs[0].data() as ConversationSummary;
          console.log('[ConversationSummaryBanner] Latest summary loaded:', {
            summaryId: summaryData.id,
            batchNumber: summaryData.batchNumber,
            messagesIncluded: summaryData.messagesIncluded
          });
          setLatestSummary(summaryData);
        } else {
          console.log('[ConversationSummaryBanner] No conversation summaries found');
          setLatestSummary(null);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('[ConversationSummaryBanner] Error loading conversation summary:', error);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('[ConversationSummaryBanner] Cleaning up summary listener');
      unsubscribe();
    };
  }, [conversationId]);

  // Don't render if no summary exists
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Loading conversation summary...</Text>
      </View>
    );
  }

  if (!latestSummary) {
    console.log('[ConversationSummaryBanner] No summary to display');
    return null;
  }

  const handleToggleExpanded = () => {
    console.log('[ConversationSummaryBanner] Toggling summary expansion:', { 
      wasExpanded: isExpanded,
      summaryId: latestSummary.id 
    });
    setIsExpanded(!isExpanded);
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Recently';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getProgressInfo = () => {
    if (!latestSummary) return '';
    const processedCount = latestSummary.messagesIncluded;
    const unprocessedCount = Math.max(0, totalMessages - processedCount);
    return `${processedCount} processed • ${unprocessedCount} pending`;
  };

  return (
    <View style={styles.container}>
      {/* Header with toggle */}
      <TouchableOpacity 
        style={styles.header} 
        onPress={handleToggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Text style={styles.icon}>📋</Text>
            <Text style={styles.title}>Conversation Summary</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Batch #{latestSummary.batchNumber}</Text>
            </View>
          </View>
          <Text style={styles.toggleIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </View>
        
        {!isExpanded && (
          <Text style={styles.preview} numberOfLines={1}>
            {latestSummary.summaryText}
          </Text>
        )}
      </TouchableOpacity>

      {/* Expanded content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          <Text style={styles.summaryText}>{latestSummary.summaryText}</Text>
          
          <View style={styles.metadata}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Progress:</Text>
              <Text style={styles.metadataValue}>{getProgressInfo()}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Generated:</Text>
              <Text style={styles.metadataValue}>{formatTimestamp(latestSummary.generatedAt)}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Confidence:</Text>
              <Text style={styles.metadataValue}>{Math.round(latestSummary.confidence * 100)}%</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    margin: 12,
    marginBottom: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    margin: 12,
    marginBottom: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  header: {
    padding: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  toggleIcon: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  preview: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },  
  expandedContent: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 16,
  },
  metadata: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metadataLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
});

export default ConversationSummaryBanner; 