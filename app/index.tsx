import { Link, useRouter } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../store/useAuth";
import { useEffect } from "react";

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[Landing] Auth state:', { user: user?.email, loading });
    if (!loading) {
      if (user) {
        console.log('[Landing] User is authenticated, redirecting to home');
        router.replace('/(protected)/home');
      } else {
        console.log('[Landing] User is not authenticated, showing landing page');
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-3xl font-bold mb-4">My App</Text>
      <Link href="/(auth)/login" asChild>
        <TouchableOpacity className="bg-blue-500 px-6 py-3 rounded-lg">
          <Text className="text-white font-bold text-lg">Get Started</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
