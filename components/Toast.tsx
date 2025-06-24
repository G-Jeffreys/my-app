import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ 
  message, 
  type, 
  visible, 
  onDismiss, 
  duration = 3000 
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
    if (visible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!isVisible) return null;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-600';
      case 'error':
        return 'bg-red-500 border-red-600';
      case 'info':
        return 'bg-blue-500 border-blue-600';
      default:
        return 'bg-gray-500 border-gray-600';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      default:
        return '📌';
    }
  };

  return (
    <View className="absolute top-16 left-4 right-4 z-50">
      <TouchableOpacity 
        onPress={onDismiss}
        className={`${getToastStyles()} p-4 rounded-lg border-l-4 shadow-lg flex-row items-center`}
      >
        <Text className="text-2xl mr-3">{getIcon()}</Text>
        <Text className="text-white font-semibold flex-1">{message}</Text>
        <Text className="text-white opacity-75 ml-2">✕</Text>
      </TouchableOpacity>
    </View>
  );
} 