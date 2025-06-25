import { Video, ResizeMode } from "expo-av";
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
} from "firebase/firestore";
import { firestore, storage, auth } from "../../lib/firebase";
import Header from "../../components/Header";

export default function PreviewScreen() {
  const router = useRouter();
  const { uri, type } = useLocalSearchParams<{
    uri: string;
    type: "image" | "video";
  }>();
  const [isUploading, setIsUploading] = useState(false);

  if (!uri) {
    router.back();
    Alert.alert("Error", "No media was provided.");
    return null;
  }

  const handleSend = async (recipientId: string) => {
    if (!auth.currentUser) return;
    setIsUploading(true);

    try {
      // 1. Upload the media file to Firebase Storage
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(
        storage,
        `media/${auth.currentUser.uid}/${Date.now()}`
      );
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      // 2. Create a new message document in Firestore
      await addDoc(collection(firestore, "messages"), {
        senderId: auth.currentUser.uid,
        recipientId: recipientId, // This needs to be updated for group chat later
        mediaUrl: downloadURL,
        mediaType: type,
        createdAt: serverTimestamp(),
        viewed: false,
      });

      setIsUploading(false);
      router.replace("/(protected)/home");
    } catch (error) {
      console.error("Failed to send media:", error);
      Alert.alert("Error", "Failed to send your message. Please try again.");
      setIsUploading(false);
    }
  };

  const navigateToSelectFriend = () => {
    router.push({
      pathname: "/(protected)/select-friend",
      params: { uri, type },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Preview" showBackButton={true} />
      {type === "image" ? (
        <Image source={{ uri }} style={styles.media} resizeMode="contain" />
      ) : (
        <Video
          source={{ uri }}
          style={styles.media}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping
        />
      )}

      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Sending...</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.button}
          disabled={isUploading}
        >
          <Text style={styles.buttonText}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={navigateToSelectFriend}
          style={[styles.button, styles.sendButton]}
          disabled={isUploading}
        >
          <Text style={styles.buttonText}>Send to...</Text>
        </TouchableOpacity>
      </View>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
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
});
