import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useAuth } from "../../store/useAuth";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri, ResponseType } from "expo-auth-session";
import React, { useEffect } from "react";
import { env } from "../../env";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const handleGoogleSignIn = useAuth((state) => state.handleGoogleSignIn);
  const authLoading = useAuth((state) => state.loading);

  const redirectUri = makeRedirectUri({
    scheme: 'my-app',
    path: '/login'
  });

  console.log('[OAuth] Using redirect URI:', redirectUri);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: env.GOOGLE_IOS_CLIENT_ID,
    androidClientId: env.GOOGLE_ANDROID_CLIENT_ID,
    webClientId: env.EXPO_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: ResponseType.IdToken,
  });

  useEffect(() => {
    console.log('[OAuth] Response received:', response?.type, response);
    if (response?.type === "success") {
      console.log('[OAuth] Success response params:', response.params);
      const { id_token } = response.params;
      console.log('[OAuth] Extracted id_token:', id_token ? 'Present' : 'Missing');
      handleGoogleSignIn(id_token);
    } else if (response?.type === "error") {
      console.error("[OAuth] Google Sign-In Error:", response.error);
      handleGoogleSignIn(undefined);
    } else if (response) {
      console.log('[OAuth] Other response type:', response.type);
    }
  }, [response]);

  const onSignInPress = () => {
    promptAsync();
  };

  return (
    <View className="flex-1 items-center justify-center bg-white">
      {authLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <Text className="text-xl mb-6">Login</Text>
          <TouchableOpacity
            disabled={!request}
            onPress={onSignInPress}
            className="bg-blue-500 px-4 py-3 rounded-lg flex-row items-center"
          >
            <Text className="text-white font-semibold">Sign in with Google</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
