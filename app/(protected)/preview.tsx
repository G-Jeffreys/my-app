import { useVideoPlayer, VideoView, VideoSource } from "expo-video";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Auth } from "firebase/auth";
import { firestore, storage, auth } from "../../lib/firebase";
import { useAuth } from "../../store/useAuth";
import Header from "../../components/Header";
import PlatformVideo from "../../components/PlatformVideo";
import TtlSelector from "../../components/TtlSelector";
import FullScreenImageViewer from "../../components/FullScreenImageViewer";
import { DEFAULT_TTL_PRESET, TtlPreset } from "../../config/messaging";

export default function PreviewScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { uri, type, conversationId } = useLocalSearchParams<{
    uri: string;
    type: "image" | "video";
    conversationId?: string;
  }>();
  const [isUploading, setIsUploading] = useState(false);
  const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
  // TTL state management - initialize with user's default or system default
  const [selectedTtl, setSelectedTtl] = useState<TtlPreset>(
    user?.defaultTtl || DEFAULT_TTL_PRESET
  );

  console.log('[PreviewScreen] Component rendered', {
    hasUri: !!uri,
    mediaType: type,
    selectedTtl,
    userDefaultTtl: user?.defaultTtl,
    conversationId: conversationId
  });

  if (!uri) {
    router.back();
    Alert.alert("Error", "No media was provided.");
    return null;
  }

  const handleSend = async (recipientId: string) => {
    if (!auth.currentUser) return;
    setIsUploading(true);

    console.log('[PreviewScreen] Sending media message', {
      recipientId,
      mediaType: type,
      selectedTtl,
      userId: auth.currentUser.uid
    });

    try {
      // 1. Upload the media file to Firebase Storage FIRST
      console.log('[PreviewScreen] Starting media upload...');
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const storageRef = ref(storage, `messages/${filename}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      console.log('[PreviewScreen] Media uploaded successfully', { downloadURL, path: `messages/${filename}` });

      // 2. Create message document with complete data (including mediaURL)
      console.log('[PreviewScreen] Creating message document with media URL...');
      const messageRef = await addDoc(collection(firestore, "messages"), {
        senderId: auth.currentUser.uid,
        recipientId: recipientId,
        mediaURL: downloadURL, // ✅ Now has the actual URL when Firebase Function triggers
        mediaType: type,
        sentAt: serverTimestamp(),
        ttlPreset: selectedTtl,
        text: null,
        viewed: false,
      });
      const messageId = messageRef.id;
      console.log('[PreviewScreen] Message document created with media URL:', { messageId, downloadURL });

      console.log('[PreviewScreen] Message sent successfully with TTL:', selectedTtl);
      setIsUploading(false);
      router.replace("/(protected)/home");
    } catch (error) {
      console.error("[PreviewScreen] Failed to send media:", error);
      Alert.alert("Error", "Failed to send your message. Please try again.");
      setIsUploading(false);
    }
  };

  const navigateToSelectFriend = () => {
    console.log('[PreviewScreen] Navigating to select friend', {
      hasUri: !!uri,
      mediaType: type,
      selectedTtl
    });
    router.push({
      pathname: "/(protected)/select-friend",
      params: { uri, type, selectedTtl },
    });
  };

  const handleSendToGroup = async () => {
    if (!auth.currentUser || !conversationId) return;
    setIsUploading(true);

    console.log('[PreviewScreen] Sending media to group', {
      conversationId,
      mediaType: type,
      selectedTtl,
      userId: auth.currentUser.uid
    });

    try {
      // 1. Upload the media file to Firebase Storage FIRST
      console.log('[PreviewScreen] Starting media upload...');
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const storageRef = ref(storage, `messages/${filename}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      console.log('[PreviewScreen] Media uploaded successfully', { downloadURL, path: `messages/${filename}` });

      // 2. Create group message document with complete data (including mediaURL)
      console.log('[PreviewScreen] Creating group message document with media URL...');
      const messageData = {
        senderId: auth.currentUser.uid,
        conversationId: conversationId,
        mediaURL: downloadURL, // ✅ Now has the actual URL when Firebase Function triggers
        mediaType: type,
        sentAt: serverTimestamp(),
        ttlPreset: selectedTtl,
        text: null,
        
        // Phase 2 default lifecycle & LLM flags
        hasSummary: false,
        summaryGenerated: false,
        ephemeralOnly: false,
        delivered: true,
        blocked: false,
      };

      const messageRef = await addDoc(collection(firestore, 'messages'), messageData);
      const messageId = messageRef.id;
      console.log('[PreviewScreen] Group message created with media URL:', { messageId, downloadURL });

      // Note: Receipts are now created automatically by recipients when they load the message
      // This is handled by the useReceiptTracking hook to comply with new security rules

      console.log('[PreviewScreen] Group message sent successfully with TTL:', selectedTtl);
      setIsUploading(false);
      // Navigate back to the group conversation instead of home
      router.replace({
        pathname: '/(protected)/group-conversation/[conversationId]',
        params: { conversationId }
      });
    } catch (error) {
      console.error("[PreviewScreen] Failed to send group media:", error);
      Alert.alert("Error", "Failed to send your message to the group. Please try again.");
      setIsUploading(false);
    }
  };

  // Note: Group receipts are now created automatically by recipients when they load messages
  // This is handled by the useReceiptTracking hook to comply with new security rules

  const handleTtlChange = (newTtl: TtlPreset) => {
    console.log('[PreviewScreen] TTL changed', { from: selectedTtl, to: newTtl });
    setSelectedTtl(newTtl);
  };

  const handleImagePress = () => {
    if (type === "image" && uri) {
      console.log('[PreviewScreen] Opening full-screen image viewer');
      setIsFullScreenVisible(true);
    }
  };

  const handleCloseFullScreen = () => {
    console.log('[PreviewScreen] Closing full-screen image viewer');
    setIsFullScreenVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Preview" showBackButton={true} />
      
      {/* Media Preview */}
      {type === "image" ? (
        <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9} style={styles.media}>
          <Image source={{ uri }} style={styles.media} resizeMode="contain" />
        </TouchableOpacity>
      ) : (
        <PlatformVideo
          source={{ uri: uri } as VideoSource}
          style={styles.fullVideo}
          contentFit="contain"
          nativeControls={true}
        />
      )}

      {/* TTL Selector Overlay */}
      <View style={styles.ttlContainer}>
        <TtlSelector
          selectedTtl={selectedTtl}
          onTtlChange={handleTtlChange}
          compact={true}
          style={styles.ttlSelector}
        />
      </View>

      {/* Loading Overlay */}
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Sending...</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.button}
          disabled={isUploading}
        >
          <Text style={styles.buttonText}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={conversationId ? handleSendToGroup : navigateToSelectFriend}
          style={[styles.button, styles.sendButton]}
          disabled={isUploading}
        >
          <Text style={styles.buttonText}>
            {conversationId ? 'Send to Group' : 'Send to...'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full-screen image viewer */}
      <FullScreenImageViewer
        visible={isFullScreenVisible}
        imageUri={uri || ''}
        onClose={handleCloseFullScreen}
        isExpired={false}
        remaining={0}
        showTTL={false}
        messageId="preview"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  media: {
    flex: 1,
  },
  ttlContainer: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  ttlSelector: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    padding: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  loadingText: {
    color: "white",
    marginTop: 10,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  sendButton: {
    backgroundColor: "#007AFF",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  fullVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});
