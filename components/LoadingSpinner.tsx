import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface LoadingSpinnerProps {
  text?: string;
  size?: 'small' | 'large';
  overlay?: boolean;
}

export default function LoadingSpinner({ 
  text = 'Loading...', 
  size = 'large',
  overlay = false 
}: LoadingSpinnerProps) {
  console.log('[LoadingSpinner] Rendering with text:', text);

  const containerStyle = overlay 
    ? [styles.container, styles.overlay]
    : [styles.container, styles.normal];

  return (
    <View style={containerStyle}>
      <ActivityIndicator size={size} color="#3b82f6" />
      <Text style={styles.text}>{text}</Text>
      
      {/* Subtle pulse animation indicators */}
      <View style={styles.pulseContainer}>
        <View style={[styles.pulseIndicator, styles.pulse1]} />
        <View style={[styles.pulseIndicator, styles.pulse2]} />
        <View style={[styles.pulseIndicator, styles.pulse3]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  normal: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 50,
  },
  text: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
  pulseContainer: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    opacity: 0.3,
  },
  pulse1: {
    // First indicator pulses fastest
  },
  pulse2: {
    // Second indicator pulses medium
  },
  pulse3: {
    // Third indicator pulses slowest
  },
}); 