import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../store/useAuth';
import Header from '../../components/Header';
import TtlSelector from '../../components/TtlSelector';
import { DEFAULT_TTL_PRESET, TtlPreset, MESSAGE_LIMITS } from '../../config/messaging';

export default function ComposeTextScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [selectedTtl, setSelectedTtl] = useState<TtlPreset>(user?.defaultTtl || DEFAULT_TTL_PRESET);

  const isValidMessage = text.trim().length > 0;
  const isOverLimit = text.length > MESSAGE_LIMITS.MAX_TEXT_LENGTH;
  const characterCount = text.length;
  const remainingChars = MESSAGE_LIMITS.MAX_TEXT_LENGTH - characterCount;

  console.log('[ComposeTextScreen] Rendering with:', { 
    hasText: !!text.trim(),
    selectedTtl,
    isValidMessage,
    textLength: text.length
  });

  const navigateToSelectFriend = () => {
    if (!isValidMessage) {
      Alert.alert('Error', 'Please enter a message first');
      return;
    }

    if (isOverLimit) {
      Alert.alert('Error', `Message is too long (${characterCount}/${MESSAGE_LIMITS.MAX_TEXT_LENGTH} characters)`);
      return;
    }

    console.log('[ComposeTextScreen] Navigating to select friend', {
      text: text.trim(),
      selectedTtl,
      textLength: text.length
    });

    router.push({
      pathname: "/(protected)/select-friend",
      params: { 
        text: text.trim(), 
        selectedTtl,
        type: 'text' // Indicate this is a text message
      },
    });
  };

  const handleTtlChange = (newTtl: TtlPreset) => {
    console.log('[ComposeTextScreen] TTL changed', { from: selectedTtl, to: newTtl });
    setSelectedTtl(newTtl);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Compose Message" 
        showBackButton 
      />
      
      <View style={styles.content}>
        {/* Message Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Your Message</Text>
          <TextInput
            style={[
              styles.textInput,
              isOverLimit && styles.textInputError
            ]}
            value={text}
            onChangeText={setText}
            placeholder="Type your message..."
            multiline
            maxLength={MESSAGE_LIMITS.MAX_TEXT_LENGTH + 100} // Allow typing beyond limit to show error
            textAlignVertical="top"
            autoFocus
          />
          
          {/* Character counter */}
          <View style={styles.characterCounter}>
            <Text style={[
              styles.characterCountText,
              isOverLimit && styles.characterCountError
            ]}>
              {remainingChars < 50 ? `${remainingChars} left` : ''}
              {isOverLimit && ` (${Math.abs(remainingChars)} over limit)`}
            </Text>
          </View>
        </View>

        {/* TTL Selector */}
        <View style={styles.ttlContainer}>
          <TtlSelector
            selectedTtl={selectedTtl}
            onTtlChange={handleTtlChange}
            compact={true}
          />
        </View>

        {/* Send to Button */}
        <TouchableOpacity
          style={[
            styles.sendToButton,
            (!isValidMessage || isOverLimit) && styles.sendToButtonDisabled
          ]}
          onPress={navigateToSelectFriend}
          disabled={!isValidMessage || isOverLimit}
        >
          <Text style={styles.sendToButtonText}>
            Send to...
          </Text>
        </TouchableOpacity>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            💡 Message will expire {selectedTtl} after being received
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    maxHeight: 300,
    backgroundColor: '#fafafa',
  },
  textInputError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  characterCounter: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: '#666',
  },
  characterCountError: {
    color: '#f44336',
    fontWeight: '600',
  },
  ttlContainer: {
    marginBottom: 32,
  },
  sendToButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  sendToButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendToButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
}); 