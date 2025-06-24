import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';
import { Link } from 'expo-router';
import Header from '../../components/Header';

const FriendsScreen = () => {
  return (
    <View className="flex-1 bg-white">
      <Header 
        title="Friends" 
        showHomeButton={true}
        rightComponent={
          <Link href="/(protected)/add-friend" asChild>
            <TouchableOpacity className="bg-blue-500 px-3 py-2 rounded-lg">
              <Text className="text-white font-bold text-sm">+ Add</Text>
            </TouchableOpacity>
          </Link>
        }
      />
      
      <View className="flex-1 p-4 justify-center items-center">
        <Text className="text-xl font-semibold mb-4">Friends Feature</Text>
        <Text className="text-gray-500 text-center mb-6">
          Friends functionality is being updated to use the unified Firebase API.
        </Text>
        <Text className="text-gray-400 text-center text-sm">
          Core Firebase initialization has been fixed. 
          The friends screen will be fully restored once all Firebase patterns are unified.
        </Text>
      </View>
    </View>
  );
};

export default FriendsScreen; 