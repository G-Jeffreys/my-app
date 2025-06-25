import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from '../../components/Header';

export default function CameraScreen() {
  const router = useRouter();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [isRecording, setIsRecording] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useMicrophonePermissions();

  useEffect(() => {
    if (!cameraPermission || !microphonePermission) {
      // Still loading
      return;
    }
    if (!cameraPermission.granted || !microphonePermission.granted) {
      Alert.alert(
        "Permissions required",
        "You need to grant camera and microphone permissions to use this feature.",
        [
          {
            text: "Request Again",
            onPress: async () => {
              await requestCameraPermission();
              await requestMicrophonePermission();
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => router.back(),
          },
        ]
      );
    }
  }, [cameraPermission, microphonePermission]);

  if (!cameraPermission || !microphonePermission) {
    return <ActivityIndicator />;
  }

  if (!cameraPermission.granted || !microphonePermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera and microphone permissions are required.
        </Text>
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  const handleRecord = async () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      const recordingPromise = cameraRef.current?.recordAsync({
        maxDuration: 10,
      });
      if (recordingPromise) {
        try {
          const video = await recordingPromise;
          if (video) {
            router.push({
              pathname: "/(protected)/preview",
              params: { uri: video.uri, type: "video" },
            });
          }
        } catch (e) {
          console.error("Recording failed:", e);
        } finally {
          setIsRecording(false);
        }
      }
    }
  };

  const handleTakePhoto = async () => {
    if (isRecording) return;
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (photo) {
        router.push({
          pathname: "/(protected)/preview",
          params: { uri: photo.uri, type: "image" },
        });
      }
    } catch (e) {
      console.error("Failed to take photo", e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Camera" showHomeButton={true} />
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        videoQuality={"720p"}
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <Text style={styles.text}>Flip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.captureButton,
              isRecording && styles.captureButtonRecording,
            ]}
            onPress={handleRecord}
            onLongPress={handleRecord}
            onPressOut={handleTakePhoto}
          />
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  permissionText: {
    textAlign: "center",
    fontSize: 18,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "transparent",
    margin: 64,
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  button: {
    alignSelf: "flex-end",
    alignItems: "center",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "white",
    borderWidth: 5,
    borderColor: "#ccc",
  },
  captureButtonRecording: {
    backgroundColor: "red",
    borderColor: "white",
  },
}); 