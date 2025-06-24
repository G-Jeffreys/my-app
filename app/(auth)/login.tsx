import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../store/useAuth";

export default function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl mb-6">Login</Text>
      <TouchableOpacity onPress={signInWithGoogle} className="bg-green-500 px-4 py-2 rounded-lg">
        <Text className="text-white">Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}
