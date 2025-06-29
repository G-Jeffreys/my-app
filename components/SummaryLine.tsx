import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { Summary } from '../models/firestore/summary';

interface SummaryLineProps {
  messageId: string;
  onPress?: () => void;
  style?: any;
  isExpanded?: boolean;
}

/**
 * SummaryLine Component - Displays AI-generated message summaries
 * 
 * States:
 * 1. Shimmer: While AI is processing the message
 * 2. Summary: Shows the generated summary text (≤30 tokens)
 * 3. Fallback: "Message sent" if summary generation fails
 * 
 * Features:
 * - Real-time Firestore listener for summary updates
 * - Shimmer animation during processing
 * - Graceful fallback handling
 * - Tailwind v4 styling
 */
const SummaryLine: React.FC<SummaryLineProps> = ({ 
  messageId, 
  onPress, 
  style,
  isExpanded = false
}) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('[SummaryLine] Rendering for messageId:', messageId);
  console.log('[SummaryLine] isExpanded prop received:', isExpanded);

  useEffect(() => {
    console.log('[SummaryLine] Setting up Firestore listener for messageId:', messageId);
    
    // Listen to summary document updates in real-time
    const summaryRef = doc(firestore, 'summaries', messageId);
    const unsubscribe = onSnapshot(
      summaryRef,
      (doc) => {
        console.log('[SummaryLine] Summary document updated:', {
          messageId,
          exists: doc.exists(),
          data: doc.data()
        });

        if (doc.exists()) {
          const summaryData = { id: doc.id, ...doc.data() } as Summary;
          setSummary(summaryData);
          setIsLoading(false);
          setError(null);
          
          console.log('[SummaryLine] ✅ Summary loaded:', {
            messageId,
            summaryText: summaryData.summaryText,
            model: summaryData.model,
            processingTime: summaryData.processingTimeMs
          });
        } else {
          // Document doesn't exist yet - keep loading state
          console.log('[SummaryLine] Summary document does not exist yet, keeping loading state');
          setIsLoading(true);
          setSummary(null);
        }
      },
      (error) => {
        console.error('[SummaryLine] Error listening to summary:', error);
        setError('Failed to load summary');
        setIsLoading(false);
        setSummary(null);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('[SummaryLine] Cleaning up Firestore listener for messageId:', messageId);
      unsubscribe();
    };
  }, [messageId]);

  // Timeout fallback: if AI does not respond within 10 s, stop the shimmer
  useEffect(() => {
    if (!isLoading) return; // only when loading

    const timer = setTimeout(() => {
      // if still loading and no summary, switch to fallback
      if (isLoading && !summary) {
        console.warn('[SummaryLine] ⏱️ AI summary timeout fallback triggered', { messageId });
        setIsLoading(false);
      }
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [isLoading, summary, messageId]);

  // Shimmer loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.shimmerContainer, style]}>
        <View style={[styles.shimmerBar, styles.shimmerAnimation]} />
        <View style={[styles.shimmerBar, styles.shimmerBarShort, styles.shimmerAnimation]} />
        <Text style={styles.shimmerText}>✨ AI is summarizing...</Text>
      </View>
    );
  }

  // Error fallback state
  if (error || !summary) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.fallbackContainer, style]}
        onPress={onPress}
        disabled={!onPress}
      >
        <Text style={styles.fallbackText}>📝 Message sent</Text>
      </TouchableOpacity>
    );
  }

  // Success state - show actual summary
  const hasContext = summary.contextUsed && summary.contextUsed.length > 0;
  const confidenceLevel = summary.confidence || 0.7;
  const contextCount = summary.contextUsed?.length || 0;
  
  // Log summary rendering details
  console.log('[SummaryLine] Rendering summary:', { 
    messageId, 
    isExpanded, 
    textLength: summary.summaryText?.length,
    numberOfLines: isExpanded ? 'unlimited' : 2
  });
  
  return (
    <TouchableOpacity 
      style={[styles.container, styles.summaryContainer, style]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.summaryContent}>
        <Text style={styles.summaryIcon}>
          {hasContext ? '🧠' : '🤖'}
        </Text>
        <View style={styles.summaryTextContainer}>
          <Text 
            style={[
              styles.summaryText,
              !isExpanded && styles.summaryTextTruncated
            ]} 
            numberOfLines={isExpanded ? undefined : 2}
            ellipsizeMode="tail"
          >
            {summary.summaryText}
          </Text>
          
          {/* RAG Context Indicator */}
          {hasContext && (
            <View style={styles.contextIndicator}>
              <Text style={styles.contextText}>
                💡 Enhanced with {contextCount} message{contextCount > 1 ? 's' : ''} context
              </Text>
              <View style={[
                styles.confidenceBadge,
                confidenceLevel > 0.8 ? styles.highConfidence : styles.normalConfidence
              ]}>
                <Text style={styles.confidenceText}>
                  {Math.round(confidenceLevel * 100)}%
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginVertical: 2,
    borderRadius: 8,
    // Ensure container takes full available width
    width: '100%',
    maxWidth: '100%',
  },
  
  // Shimmer loading state
  shimmerContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  shimmerBar: {
    height: 12,
    backgroundColor: '#e9ecef',
    borderRadius: 6,
    marginBottom: 6,
  },
  shimmerBarShort: {
    width: '60%',
  },
  shimmerAnimation: {
    opacity: 0.6,
    // Note: For full shimmer effect, you'd typically use react-native-shimmer-placeholder
    // or implement a proper shimmer animation with Animated API
  },
  shimmerText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  
  // Summary display state
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e3f2fd',
    // Allow vertical expansion when content is large
    flexShrink: 0,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Ensure the container takes full width and allocates space properly
    width: '100%',
  },
  summaryIcon: {
    fontSize: 12, // Made smaller to save space
    marginRight: 4, // Reduced margin
    marginTop: 1,
    width: 16, // Fixed width to prevent expansion
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1a1a1a',
    fontWeight: '500',
    // Remove all flex constraints that might be causing issues
    width: '100%', // Use explicit width instead of flex
  },
  summaryTextContainer: {
    // Remove all flex constraints and use explicit width calculation
    width: '90%', // Use most of available space, leaving room for icon
  },
  summaryTextTruncated: {
    opacity: 0.8,
  },
  
  // RAG Context indicators
  contextIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e3f2fd',
  },
  contextText: {
    flex: 1,
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '500',
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  highConfidence: {
    backgroundColor: '#e8f5e8',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  normalConfidence: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  
  // Fallback state
  fallbackContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  fallbackText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SummaryLine; 