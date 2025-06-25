import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { TTL_PRESET_OPTIONS, TTL_PRESET_DISPLAY, TtlPreset } from '../config/messaging';

interface TtlSelectorProps {
  selectedTtl: TtlPreset;
  onTtlChange: (ttl: TtlPreset) => void;
  style?: any;
  compact?: boolean; // For inline use vs. full settings screen
}

// Console log function for debugging TTL selection
const logTtlSelection = (message: string, data?: any) => {
  console.log(`[TtlSelector] ${message}`, data ? data : '');
};

const TtlSelector: React.FC<TtlSelectorProps> = ({ 
  selectedTtl, 
  onTtlChange, 
  style,
  compact = false 
}) => {
  
  const handleTtlSelect = (ttl: TtlPreset) => {
    logTtlSelection('TTL selected', { from: selectedTtl, to: ttl });
    onTtlChange(ttl);
  };

  if (compact) {
    // Compact horizontal carousel for message composition
    return (
      <View style={[styles.compactContainer, style]}>
        <Text style={styles.compactLabel}>Expires in:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
        >
          {TTL_PRESET_OPTIONS.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[
                styles.carouselOption,
                selectedTtl === preset && styles.carouselOptionSelected
              ]}
              onPress={() => handleTtlSelect(preset)}
            >
              <Text 
                style={[
                  styles.carouselOptionText,
                  selectedTtl === preset && styles.carouselOptionTextSelected
                ]}
              >
                {TTL_PRESET_DISPLAY[preset]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Full settings screen version
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Message Expiration Time</Text>
      <Text style={styles.subtitle}>
        Choose how long messages stay visible after being received
      </Text>
      
      <View style={styles.optionsContainer}>
        {TTL_PRESET_OPTIONS.map((preset) => (
          <TouchableOpacity
            key={preset}
            style={[
              styles.option,
              selectedTtl === preset && styles.optionSelected
            ]}
            onPress={() => handleTtlSelect(preset)}
          >
            <View style={styles.optionContent}>
              <Text 
                style={[
                  styles.optionText,
                  selectedTtl === preset && styles.optionTextSelected
                ]}
              >
                {TTL_PRESET_DISPLAY[preset]}
              </Text>
              
              {selectedTtl === preset && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </View>
            
            {/* Show additional info for selected option */}
            {selectedTtl === preset && (
              <Text style={styles.selectedInfo}>
                Default for new messages
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 How it works</Text>
        <Text style={styles.infoText}>
          • Messages start expiring when received (not when opened){'\n'}
          • Both sender and recipient see the same countdown{'\n'}
          • You can override this default for individual messages
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  option: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  optionTextSelected: {
    color: '#2196f3',
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    backgroundColor: '#2196f3',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedInfo: {
    fontSize: 12,
    color: '#2196f3',
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#e65100',
    lineHeight: 18,
  },
  
  // Compact styles
  compactContainer: {
    marginVertical: 12,
  },
  compactLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  carouselContent: {
    paddingHorizontal: 4,
  },
  carouselOption: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  carouselOptionSelected: {
    backgroundColor: '#2196f3',
    borderColor: '#1976d2',
  },
  carouselOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  carouselOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
});

export default TtlSelector; 