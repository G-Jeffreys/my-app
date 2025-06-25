import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

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
  const containerClass = overlay 
    ? "absolute inset-0 bg-black bg-opacity-50 flex-1 justify-center items-center z-50"
    : "flex-1 justify-center items-center p-8";

  return (
    <View className={containerClass}>
      <ActivityIndicator size={size} color="#007BFF" />
      <Text className="text-gray-700 mt-4 text-center text-lg">{text}</Text>
    </View>
  );
} 