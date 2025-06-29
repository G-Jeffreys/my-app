import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useAuth } from "../../store/useAuth";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri, useAuthRequest, ResponseType } from "expo-auth-session";
import React, { useEffect } from "react";
import { env } from "../../env";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { handleGitHubSignIn, loading, isSigningIn, error } = useAuth();

  const redirectUri = makeRedirectUri({
    scheme: 'my-app',
    path: '/login'
  });

  console.log('[OAuth] Platform:', Platform.OS);
  console.log('[OAuth] Using redirect URI:', redirectUri);
  console.log('[OAuth] GitHub Client ID present:', !!env.GITHUB_CLIENT_ID);

  // GitHub OAuth configuration - works in React Native
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: env.GITHUB_CLIENT_ID,
      scopes: ['user:email', 'read:user'],
      redirectUri,
      responseType: ResponseType.Code,
    },
    {
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
    }
  );

  console.log('[OAuth] GitHub OAuth request configured');

  useEffect(() => {
    console.log('[OAuth] Response received:', response?.type, response);
    if (response?.type === "success") {
      console.log('[OAuth] GitHub OAuth success response params:', response.params);
      const { code } = response.params;
      console.log('[OAuth] Extracted authorization code:', code ? 'Present' : 'Missing');
      
      if (code) {
        // Exchange authorization code for access token
        console.log('[OAuth] Exchanging code for access token...');
        exchangeCodeForToken(code);
      } else {
        console.error('[OAuth] No authorization code received');
        console.log('[OAuth] ⚠️  This might be due to redirect URI configuration issues');
        handleGitHubSignIn(undefined);
      }
    } else if (response?.type === "error") {
      console.error("[OAuth] GitHub Sign-In Error:", response.error);
      console.error("[OAuth] Error details:", JSON.stringify(response, null, 2));
      console.log('[OAuth] ⚠️  Check GitHub OAuth app redirect URI settings');
      console.log('[OAuth] Expected redirect URI:', redirectUri);
      handleGitHubSignIn(undefined);
    } else if (response?.type === "cancel") {
      console.log('[OAuth] User cancelled the GitHub sign-in process');
      handleGitHubSignIn(undefined);
    } else if (response) {
      console.log('[OAuth] Other response type:', response.type);
    }
  }, [response]);

  const exchangeCodeForToken = async (code: string) => {
    console.log('[OAuth] Starting token exchange with 30 second timeout...');
    
    // Create a timeout promise to handle slow responses
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Token exchange timeout after 30 seconds'));
      }, 30000);
    });
    
    try {
      console.log('[OAuth] Exchanging authorization code for access token...');
      
      const fetchPromise = fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code,
        }),
      });

      // Race between the fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      console.log('[OAuth] Token exchange request completed within timeout');
      
      const data = await response.json();
      console.log('[OAuth] Token exchange response:', data.access_token ? 'Token received' : 'No token');
      
      if (data.access_token) {
        console.log('[OAuth] Successfully obtained GitHub access token');
        handleGitHubSignIn(data.access_token);
      } else {
        console.error('[OAuth] Token exchange failed:', data);
        console.error('[OAuth] Response data:', JSON.stringify(data, null, 2));
        handleGitHubSignIn(undefined);
      }
    } catch (error: any) {
      console.error('[OAuth] Error exchanging code for token:', error);
      if (error.message?.includes('timeout')) {
        console.error('[OAuth] ⚠️  Token exchange timed out - check network connectivity');
        console.error('[OAuth] ⚠️  This may indicate GitHub API connectivity issues');
      }
      handleGitHubSignIn(undefined);
    }
  };

  const onSignInPress = () => {
    console.log('[OAuth] Initiating GitHub Sign-In...');
    console.log('[OAuth] Request object ready:', !!request);
    console.log('[OAuth] Configuration being used: GitHub OAuth with expo-auth-session');
    
    // Set a timeout to detect if OAuth flow gets stuck
    setTimeout(() => {
      if (!response) {
        console.warn('[OAuth] ⚠️  No response after 15 seconds - likely configuration issue');
        console.warn('[OAuth] Check GitHub OAuth app redirect URI settings');
      }
    }, 15000);
    
    promptAsync();
  };

  // Show loading state if auth is in progress
  if (loading || isSigningIn) {
    console.log('[Login] Showing loading state - loading:', loading, 'isSigningIn:', isSigningIn);
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1F2937" className="mb-4" />
        <Text className="text-lg font-semibold text-gray-700 mb-2">
          {isSigningIn ? 'Signing you in...' : 'Loading...'}
        </Text>
        <Text className="text-sm text-gray-500 text-center px-8">
          {isSigningIn ? 'Authenticating with GitHub' : 'Please wait'}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl mb-6">Login</Text>
      
      {error && (
        <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 mx-8">
          <Text className="text-red-700 text-sm text-center">{error}</Text>
        </View>
      )}
      
      <TouchableOpacity
        disabled={!request || loading || isSigningIn}
        onPress={onSignInPress}
        className={`px-4 py-3 rounded-lg flex-row items-center ${
          !request || loading || isSigningIn 
            ? 'bg-gray-400' 
            : 'bg-gray-800'
        }`}
      >
        <Text className="text-white font-semibold">
          {loading || isSigningIn ? 'Signing in...' : 'Sign in with GitHub'}
        </Text>
      </TouchableOpacity>
      
      <Text className="text-sm text-gray-600 mt-4 text-center px-4">
        Platform: {Platform.OS} | Using GitHub OAuth (React Native compatible)
      </Text>
    </View>
  );
}
