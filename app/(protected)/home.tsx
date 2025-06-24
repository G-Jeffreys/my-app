import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../store/useAuth";

export default function Home() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl">Welcome 👋</Text>
      <TouchableOpacity onPress={signOut} className="mt-6 bg-red-500 px-4 py-2 rounded-lg">
        <Text className="text-white">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
