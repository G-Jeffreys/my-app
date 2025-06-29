import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

interface ProcessingDemarcationLineProps {
  processedCount: number;
  totalCount: number;
}

const ProcessingDemarcationLine: React.FC<ProcessingDemarcationLineProps> = ({
  processedCount,
  totalCount,
}) => {
  const unprocessedCount = totalCount - processedCount;

  // Don't show if all messages are processed or if there are no messages
  if (processedCount === 0 || unprocessedCount <= 0) {
    return null;
  }

  console.log('[ProcessingDemarcationLine] Rendering demarcation line:', {
    processedCount,
    unprocessedCount,
    totalCount
  });

  return (
    <View style={styles.container}>
      {/* Red line */}
      <View style={styles.line} />
      
      {/* Explanatory text */}
      <View style={styles.textContainer}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unprocessedCount} message{unprocessedCount === 1 ? '' : 's'} pending AI processing
          </Text>
        </View>
        <Text style={styles.helperText}>
          Messages above this line are included in conversation summary
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  line: {
    height: 2,
    backgroundColor: '#ff4444',
    borderRadius: 1,
    marginBottom: 8,
  },
  textContainer: {
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  helperText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ProcessingDemarcationLine; 