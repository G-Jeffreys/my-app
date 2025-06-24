import "../global.css";
import { Stack } from "expo-router";
import { useAuth } from "../store/useAuth";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(protected)/home" />
    </Stack>
  );
}
