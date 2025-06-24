import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  rightComponent?: React.ReactNode;
}

export default function Header({ 
  title, 
  showBackButton = true, 
  showHomeButton = false,
  rightComponent 
}: HeaderProps) {
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(protected)/home');
    }
  };

  const handleHome = () => {
    router.push('/(protected)/home');
  };

  return (
    <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
      {/* Left side - Back/Home button */}
      <View className="flex-row items-center">
        {showBackButton && (
          <TouchableOpacity 
            onPress={handleBack}
            className="mr-3 p-2 rounded-lg bg-gray-100"
          >
            <Text className="text-gray-700 font-semibold">← Back</Text>
          </TouchableOpacity>
        )}
        {showHomeButton && (
          <TouchableOpacity 
            onPress={handleHome}
            className="mr-3 p-2 rounded-lg bg-blue-100"
          >
            <Text className="text-blue-700 font-semibold">🏠 Home</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Center - Title */}
      <View className="flex-1">
        <Text className="text-xl font-bold text-gray-900 text-center">{title}</Text>
      </View>

      {/* Right side - Optional component */}
      <View>
        {rightComponent || <View style={{ width: 60 }} />}
      </View>
    </View>
  );
} 