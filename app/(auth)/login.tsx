import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "../../store/useAuth";
import { useRouter } from "expo-router";
import { useEffect } from "react";

const Login = () => {
  const { signInWithGoogle, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[Login] Auth state:', { user: user?.email, loading });
    if (!loading && user) {
      console.log('[Login] User is authenticated, redirecting to home');
      router.replace('/(protected)/home');
    }
  }, [user, loading]);

  const handleGoogleSignIn = async () => {
    try {
      console.log('[Login] Attempting Google sign in');
      await signInWithGoogle();
    } catch (error) {
      console.error('[Login] Google sign in error:', error);
      Alert.alert(
        'Login Error',
        'Failed to sign in with Google. Please try again.'
      );
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl mb-6">Login</Text>
      <TouchableOpacity 
        onPress={handleGoogleSignIn} 
        className="bg-green-500 px-6 py-3 rounded-lg"
      >
        <Text className="text-white font-bold text-lg">Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Login;
