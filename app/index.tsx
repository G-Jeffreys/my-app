import { Link } from "expo-router";
import { View, Text } from "react-native";

export default function Landing() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-3xl font-bold mb-4">My App</Text>
      <Link href="/(auth)/login" className="bg-blue-500 px-4 py-2 rounded-lg text-white">
        Get Started
      </Link>
    </View>
  );
}
