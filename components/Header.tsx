import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  
  const handleBack = () => {
    console.log('[Header] Back button pressed');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(protected)/home');
    }
  };

  const handleHome = () => {
    console.log('[Header] Home button pressed');
    router.push('/(protected)/home');
  };

  return (
    <View 
      className="bg-white border-b border-gray-200 px-4 flex-row items-center justify-between"
      style={{ 
        paddingTop: insets.top + 12, // Add safe area top padding plus extra space
        paddingBottom: 12 
      }}
    >
      {/* Left side - Back/Home button */}
      <View className="flex-row items-center min-w-0 flex-1">
        {showBackButton && (
          <TouchableOpacity 
            onPress={handleBack}
            className="mr-3 p-2 rounded-lg bg-gray-100"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text className="text-gray-700 font-semibold">← Back</Text>
          </TouchableOpacity>
        )}
        {showHomeButton && (
          <TouchableOpacity 
            onPress={handleHome}
            className="mr-3 p-2 rounded-lg bg-blue-100"
            accessibilityLabel="Go to home"
            accessibilityRole="button"
          >
            <Text className="text-blue-700 font-semibold">🏠 Home</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Center - Title */}
      <View className="flex-1 mx-2">
        <Text 
          className="text-xl font-bold text-gray-900 text-center"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      </View>

      {/* Right side - Optional component */}
      <View className="flex-row items-center min-w-0 flex-1 justify-end">
        {rightComponent ? (
          <View className="flex-row items-center">
            {rightComponent}
          </View>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>
    </View>
  );
} 