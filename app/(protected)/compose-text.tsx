import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import TextMessageComposer from '../../components/TextMessageComposer';
import { useLocalSearchParams } from 'expo-router';

export default function ComposeTextScreen() {
  const { recipientId, conversationId } = useLocalSearchParams<{
    recipientId?: string;
    conversationId?: string;
  }>();

  console.log('[ComposeTextScreen] Rendering with params:', { recipientId, conversationId });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <Header 
        title={conversationId ? "Send to Group" : "Send Message"} 
        showBackButton 
      />
      
      <TextMessageComposer
        recipientId={recipientId}
        conversationId={conversationId}
      />
    </SafeAreaView>
  );
} 