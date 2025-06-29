import { Link, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useAuth } from "../store/useAuth";
import { useEffect } from "react";

export default function Landing() {
  const { user, loading, isSigningIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[Landing] Auth state:', { 
      user: user?.email, 
      loading, 
      isSigningIn 
    });
    
    if (!loading && !isSigningIn) {
      if (user) {
        console.log('[Landing] User is authenticated, redirecting to home');
        router.replace('/(protected)/home');
      } else {
        console.log('[Landing] User is not authenticated, showing landing page');
      }
    }
  }, [user, loading, isSigningIn]);

  // Show loading state during initial auth check or active sign-in process
  if (loading || isSigningIn) {
    console.log('[Landing] Showing loading state - loading:', loading, 'isSigningIn:', isSigningIn);
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" className="mb-4" />
        <Text className="text-lg font-semibold text-gray-700 mb-2">
          {isSigningIn ? 'Signing you in...' : 'Loading...'}
        </Text>
        <Text className="text-sm text-gray-500 text-center px-8">
          {isSigningIn ? 'Please wait while we authenticate your account' : 'Getting things ready'}
        </Text>
      </View>
    );
  }

  console.log('[Landing] Showing landing page - user can interact');
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-3xl font-bold mb-4">SnapConnect</Text>
      <Link href="/(auth)/login" asChild>
        <TouchableOpacity className="bg-blue-500 px-6 py-3 rounded-lg">
          <Text className="text-white font-bold text-lg">Get Started</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
