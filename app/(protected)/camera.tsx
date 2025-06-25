import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from '../../components/Header';

export default function CameraScreen() {
  const router = useRouter();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(10);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'requesting'>('checking');
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  
  // Refs for different camera types
  const cameraRef = useRef<CameraView>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  console.log('[CameraScreen] Component rendered');
  console.log('[CameraScreen] Platform:', Platform.OS);

  // Web permission handling
  const checkWebPermissions = async () => {
    if (Platform.OS !== 'web') return true;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facing === 'front' ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: true 
      });
      console.log('[CameraScreen] Web permissions granted, stream available');
      
      // Set up video element if available
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebStream(stream);
      }
      
      return true;
    } catch (error) {
      console.error('[CameraScreen] Web permissions denied:', error);
      return false;
    }
  };

  // Setup web video stream
  const setupWebVideo = async () => {
    if (Platform.OS !== 'web' || !videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facing === 'front' ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: true 
      });
      
      videoRef.current.srcObject = stream;
      setWebStream(stream);
      console.log('[CameraScreen] Web video stream setup complete');
    } catch (error) {
      console.error('[CameraScreen] Error setting up web video:', error);
      setPermissionStatus('denied');
    }
  };

  // Mobile permission handling
  useEffect(() => {
    console.log('[CameraScreen] Effect triggered - checking permissions');
    
    if (Platform.OS === 'web') {
      // For web, we'll check permissions when user interacts
      checkWebPermissions().then(granted => {
        setPermissionStatus(granted ? 'granted' : 'denied');
      });
      return;
    }

    if (!cameraPermission || !microphonePermission) {
      console.log('[CameraScreen] Permissions still loading...');
      setPermissionStatus('checking');
      return;
    }

    const cameraGranted = cameraPermission.granted;
    const micGranted = microphonePermission.granted;
    
    console.log('[CameraScreen] Camera granted:', cameraGranted);
    console.log('[CameraScreen] Microphone granted:', micGranted);

    if (cameraGranted && micGranted) {
      console.log('[CameraScreen] All permissions granted');
      setPermissionStatus('granted');
    } else {
      console.log('[CameraScreen] Some permissions missing');
      setPermissionStatus('denied');
      
      if (!cameraGranted || !micGranted) {
        handleRequestPermissions();
      }
    }
  }, [cameraPermission, microphonePermission]);

  const handleRequestPermissions = async () => {
    console.log('[CameraScreen] Requesting permissions...');
    setPermissionStatus('requesting');
    
    try {
      if (Platform.OS === 'web') {
        const granted = await checkWebPermissions();
        setPermissionStatus(granted ? 'granted' : 'denied');
        
        if (!granted) {
          Alert.alert(
            "Camera Access Required",
            "Please allow camera and microphone access in your browser to use this feature. Look for the camera/microphone icon in your address bar or browser settings.",
            [
              {
                text: "Try Again",
                onPress: handleRequestPermissions,
              },
              {
                text: "Go Back",
                style: "cancel",
                onPress: () => router.back(),
              },
            ]
          );
        }
      } else {
        const cameraResult = await requestCameraPermission();
        const micResult = await requestMicrophonePermission();
        
        console.log('[CameraScreen] Camera permission result:', cameraResult);
        console.log('[CameraScreen] Microphone permission result:', micResult);
        
        if (cameraResult.granted && micResult.granted) {
          console.log('[CameraScreen] All permissions granted after request');
          setPermissionStatus('granted');
        } else {
          console.log('[CameraScreen] Some permissions still denied');
          setPermissionStatus('denied');
          
          Alert.alert(
            "Permissions Required",
            "Camera and microphone access are required to take photos and videos. Please enable them in your device settings.",
            [
              {
                text: "Try Again",
                onPress: handleRequestPermissions,
              },
              {
                text: "Go Back",
                style: "cancel",
                onPress: () => router.back(),
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('[CameraScreen] Error requesting permissions:', error);
      setPermissionStatus('denied');
      Alert.alert(
        "Permission Error", 
        "There was an error requesting camera permissions. Please try again or check your browser/device settings."
      );
    }
  };

  const toggleCameraFacing = async () => {
    console.log('[CameraScreen] Toggling camera facing');
    const newFacing = facing === "back" ? "front" : "back";
    setFacing(newFacing);
    
    if (Platform.OS === 'web' && webStream) {
      // Stop current stream
      webStream.getTracks().forEach(track => track.stop());
      setWebStream(null);
      
      // Setup new stream with new facing mode
      setTimeout(() => setupWebVideo(), 100);
    }
  };

  // Setup web video when component mounts or facing changes
  useEffect(() => {
    if (Platform.OS === 'web' && permissionStatus === 'granted' && !webStream) {
      setupWebVideo();
    }
  }, [facing, permissionStatus, webStream]);

  // Web video recording functions
  const startWebRecording = useCallback(async () => {
    if (Platform.OS !== 'web' || !webStream) {
      console.error('[CameraScreen] Web stream not available');
      Alert.alert('Recording Error', 'Camera stream not available. Please refresh and try again.');
      return;
    }

    try {
      recordedChunksRef.current = [];
      
      console.log('[CameraScreen] Starting MediaRecorder with stream:', webStream);
      
      const mediaRecorder = new MediaRecorder(webStream, {
        mimeType: 'video/webm'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        console.log('[CameraScreen] Recording data available, size:', event.data.size);
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[CameraScreen] Recording stopped, chunks:', recordedChunksRef.current.length);
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm'
        });
        
        // Create a data URL from the blob
        const url = URL.createObjectURL(blob);
        
        console.log('[CameraScreen] Web recording completed, blob size:', blob.size);
        
        // Navigate to preview with the blob URL
        router.push({
          pathname: "/(protected)/preview",
          params: { uri: url, type: "video" },
        });
      };

      mediaRecorder.onerror = (event) => {
        console.error('[CameraScreen] MediaRecorder error:', event);
        Alert.alert('Recording Error', 'Failed to record video. Please try again.');
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTimeLeft(10);

      console.log('[CameraScreen] MediaRecorder started');

      // Start countdown timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTimeLeft(prev => {
          if (prev <= 1) {
            stopWebRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (error) {
      console.error('[CameraScreen] Error starting web recording:', error);
      Alert.alert("Recording Error", "Failed to start recording. Please try again.");
      setIsRecording(false);
    }
  }, [webStream, router]);

  const stopWebRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording]);

  // Mobile video recording functions
  const startMobileRecording = async () => {
    if (Platform.OS === 'web' || !cameraRef.current) return;
    
    setIsRecording(true);
    setRecordingTimeLeft(10);
    
    try {
      const recordingPromise = cameraRef.current.recordAsync({
        maxDuration: 10,
      });
      
      // Start countdown timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTimeLeft(prev => {
          if (prev <= 1) {
            stopMobileRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      if (recordingPromise) {
        const video = await recordingPromise;
        console.log('[CameraScreen] Mobile recording completed:', video?.uri);
        if (video) {
          router.push({
            pathname: "/(protected)/preview",
            params: { uri: video.uri, type: "video" },
          });
        }
      }
    } catch (e) {
      console.error("[CameraScreen] Mobile recording failed:", e);
      Alert.alert("Recording Error", "Failed to record video. Please try again.");
    } finally {
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const stopMobileRecording = () => {
    if (Platform.OS === 'web' || !cameraRef.current) return;
    
    try {
      cameraRef.current.stopRecording();
    } catch (error) {
      console.error('[CameraScreen] Error stopping mobile recording:', error);
    }
  };

  const takeWebPhoto = useCallback(async () => {
    if (Platform.OS !== 'web' || !videoRef.current || !canvasRef.current) {
      console.error('[CameraScreen] Video or canvas ref not available');
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('[CameraScreen] Canvas context not available');
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to data URL
      const imageSrc = canvas.toDataURL('image/jpeg', 0.8);
      
      if (imageSrc) {
        console.log('[CameraScreen] Web photo taken, data URL length:', imageSrc.length);
        router.push({
          pathname: "/(protected)/preview",
          params: { uri: imageSrc, type: "image" },
        });
      } else {
        console.error('[CameraScreen] Failed to capture screenshot');
        Alert.alert("Photo Error", "Failed to capture photo. Please try again.");
      }
    } catch (error) {
      console.error('[CameraScreen] Error taking web photo:', error);
      Alert.alert("Photo Error", "Failed to take photo. Please try again.");
    }
  }, [router]);

  const takeMobilePhoto = async () => {
    if (Platform.OS === 'web' || !cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync();
      console.log('[CameraScreen] Mobile photo taken:', photo?.uri);
      if (photo) {
        router.push({
          pathname: "/(protected)/preview",
          params: { uri: photo.uri, type: "image" },
        });
      }
    } catch (e) {
      console.error("[CameraScreen] Failed to take mobile photo:", e);
      Alert.alert("Photo Error", "Failed to take photo. Please try again.");
    }
  };

  // Unified recording handlers
  const handleTakePhoto = async () => {
    if (isRecording) {
      console.log('[CameraScreen] Cannot take photo while recording');
      return;
    }
    
    console.log('[CameraScreen] Taking photo');
    
    if (Platform.OS === 'web') {
      await takeWebPhoto();
    } else {
      await takeMobilePhoto();
    }
  };

  const handlePhotoButtonLongPress = () => {
    console.log('[CameraScreen] Photo button long pressed - attempting video recording');
    if (Platform.OS === 'web') {
      startWebRecording();
    } else {
      startMobileRecording();
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (webStream) {
        webStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webStream]);

  console.log('[CameraScreen] Rendering with permission status:', permissionStatus);
  console.log('[CameraScreen] Is recording:', isRecording);

  // Loading state
  if (permissionStatus === 'checking') {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Camera" showHomeButton={true} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.statusText}>Checking camera permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Requesting permissions state
  if (permissionStatus === 'requesting') {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Camera" showHomeButton={true} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.statusText}>Requesting camera access...</Text>
          <Text style={styles.statusSubtext}>
            {Platform.OS === 'web' 
              ? "Please allow camera access in your browser"
              : "Please grant camera and microphone permissions"
            }
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Permissions denied state
  if (permissionStatus === 'denied') {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Camera" showHomeButton={true} />
        <View style={styles.centered}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            {Platform.OS === 'web'
              ? "Please allow camera and microphone access in your browser to take photos and videos."
              : "Camera and microphone permissions are required to take photos and videos."
            }
          </Text>
          <TouchableOpacity style={styles.requestButton} onPress={handleRequestPermissions}>
            <Text style={styles.requestButtonText}>Grant Permissions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Camera interface - Platform specific rendering
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Camera" showHomeButton={true} />
      {Platform.OS === 'web' ? (
        // Web implementation with native HTML5 video
        <View style={styles.camera}>
          <video
            ref={(ref) => { videoRef.current = ref; }}
            autoPlay
            playsInline
            muted
            style={styles.webVideo}
            onLoadedMetadata={() => {
              console.log('[CameraScreen] Video metadata loaded');
            }}
            onError={(error) => {
              console.error('[CameraScreen] Video error:', error);
            }}
          />
          
          {/* Hidden canvas for photo capture */}
          <canvas
            ref={(ref) => { canvasRef.current = ref; }}
            style={{ display: 'none' }}
          />
          
          {/* Web controls overlay */}
          <View style={styles.webControlsBar}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleCameraFacing}>
              <Text style={styles.controlText}>🔄 Flip</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.photoButton} 
              onPress={handleTakePhoto}
              onLongPress={handlePhotoButtonLongPress}
              disabled={isRecording}
            >
              <Text style={styles.controlText}>📷 Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
              ]}
              onPress={isRecording ? stopWebRecording : startWebRecording}
            >
              <Text style={styles.controlText}>
                {isRecording ? `⏹️ Stop (${recordingTimeLeft}s)` : '🔴 Record'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording... {recordingTimeLeft}s left</Text>
            </View>
          )}
        </View>
      ) : (
        // Mobile implementation with expo-camera
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          videoQuality={"720p"}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.topControls}>
              <TouchableOpacity style={styles.controlButton} onPress={toggleCameraFacing}>
                <Text style={styles.controlText}>🔄 Flip</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.bottomControls}>
              <TouchableOpacity 
                style={styles.photoButton} 
                onPress={handleTakePhoto}
                onLongPress={handlePhotoButtonLongPress}
                disabled={isRecording}
              >
                <Text style={styles.controlText}>📷</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  isRecording && styles.recordButtonActive,
                ]}
                onPress={isRecording ? stopMobileRecording : startMobileRecording}
              >
                <View style={[
                  styles.recordButtonInner,
                  isRecording && styles.recordButtonInnerActive,
                ]} />
                {isRecording && (
                  <Text style={styles.recordingLabel}>Recording... {recordingTimeLeft}s</Text>
                )}
              </TouchableOpacity>
              
              <View style={styles.placeholder} />
            </View>
            
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Recording... {recordingTimeLeft}s left</Text>
              </View>
            )}
          </View>
        </CameraView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  statusText: {
    fontSize: 18,
    color: "#333",
    marginTop: 16,
    textAlign: "center",
  },
  statusSubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  requestButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  camera: {
    flex: 1,
  },
  webVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as any,
  },
  webcamPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  webControlsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  controlText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  photoButton: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  recordButtonActive: {
    backgroundColor: "rgba(220, 38, 38, 0.9)",
  },
  recordButtonInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#dc2626",
  },
  recordButtonInnerActive: {
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  placeholder: {
    width: 60,
    height: 60,
  },
  recordingIndicator: {
    position: "absolute",
    top: 80,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220, 38, 38, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  recordingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  recordingLabel: {
    position: "absolute",
    bottom: -30,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  bottomControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
}); 