import { StyleSheet, Text, View, Button, TouchableOpacity, Alert } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { Platform } from 'react-native';
import Header from '../../components/Header';

// Import vision camera components at the top level for mobile
let Camera: any = null;
let useCameraDevice: any = null;
let useCameraPermission: any = null;

// Only load react-native-vision-camera on mobile platforms
if (Platform.OS !== 'web') {
  try {
    const VisionCamera = require('react-native-vision-camera');
    Camera = VisionCamera.Camera;
    useCameraDevice = VisionCamera.useCameraDevice;
    useCameraPermission = VisionCamera.useCameraPermission;
    console.log('[Camera] VisionCamera modules loaded successfully');
  } catch (error) {
    console.error('[Camera] Failed to load VisionCamera modules:', error);
  }
}

const CameraScreen = () => {
  const [isActive, setIsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | undefined>(undefined);
  const [useMockCamera, setUseMockCamera] = useState(false);

  // Vision Camera hooks - always call but handle safely
  let cameraPermission: any = null;
  try {
    // Always call the hook if it exists, but handle the result based on platform
    if (Platform.OS !== 'web' && useCameraPermission) {
      cameraPermission = useCameraPermission();
    }
  } catch (error) {
    console.error('[Camera] Error calling useCameraPermission hook:', error);
    cameraPermission = null;
  }
  
  useEffect(() => {
    console.log('[Camera] Initializing camera permissions...');
    
    if (Platform.OS === 'web') {
      // For web, we'll simulate having permission
      console.log('[Camera] Web platform detected, simulating camera permission');
      setHasPermission(true);
    } else {
      // For mobile, use the actual VisionCamera
      const initializeCamera = async () => {
        try {
          console.log('[Camera] Checking camera permissions on mobile...');
          
          if (!cameraPermission) {
            console.error('[Camera] Camera permission hook not available');
            setHasPermission(false);
            return;
          }
          
          console.log('[Camera] Current permission status:', cameraPermission.hasPermission);
          setHasPermission(cameraPermission.hasPermission);
          
          if (!cameraPermission.hasPermission) {
            console.log('[Camera] Requesting camera permission...');
            const granted = await cameraPermission.requestPermission();
            console.log('[Camera] Permission request result:', granted);
            setHasPermission(granted);
          }
        } catch (error) {
          console.error('[Camera] Error initializing camera:', error);
          setHasPermission(false);
        }
      };
      
      initializeCamera();
    }
  }, [cameraPermission]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Camera] Screen focused, activating camera');
      setIsActive(true);
      return () => {
        console.log('[Camera] Screen unfocused, deactivating camera');
        setIsActive(false);
      };
    }, [])
  );

  const onTakePicture = async () => {
    if (isRecording) {
      console.log('[Camera] Cannot take photo while recording');
      return;
    }
    
    try {
      if (Platform.OS === 'web' || useMockCamera) {
        // Mock photo capture for web or when camera fails
        console.log('[Camera] Mock photo taken');
        const mockPhotoPath = 'mock://photo.jpg';
        router.push({
          pathname: '/(protected)/preview',
          params: { uri: mockPhotoPath, mediaType: 'photo' },
        });
      } else {
        // For mobile, the actual photo taking will be handled by MobileCameraView
        console.log('[Camera] Photo capture triggered - will be handled by mobile camera');
      }
    } catch (e) {
      console.error('[Camera] Failed to take photo:', e);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const onStartRecording = async () => {
    console.log('[Camera] Recording start triggered');
    
    if (Platform.OS === 'web' || useMockCamera) {
      // Mock video recording for web or when camera fails
      console.log('[Camera] Mock video recording started');
      setIsRecording(true);
      
      // Simulate 3 seconds of recording
      setTimeout(() => {
        console.log('[Camera] Mock video recording finished');
        setIsRecording(false);
        const mockVideoPath = 'mock://video.mp4';
        router.push({
          pathname: '/(protected)/preview',
          params: { uri: mockVideoPath, mediaType: 'video' },
        });
      }, 3000);
    } else {
      // For mobile, the actual video recording will be handled by MobileCameraView
      console.log('[Camera] Video recording triggered - will be handled by mobile camera');
      setIsRecording(true);
    }
  };

  const onStopRecording = async () => {
    if ((Platform.OS !== 'web' && !useMockCamera) && isRecording) {
      console.log('[Camera] Stopping video recording...');
      setIsRecording(false);
      // The actual stop logic will be handled by MobileCameraView
    }
  };

  const handleCameraError = () => {
    console.log('[Camera] Switching to mock camera mode due to camera error');
    setUseMockCamera(true);
  };

  if (hasPermission === false) {
    return (
      <View style={styles.fullContainer}>
        <Header title="Camera" showHomeButton={true} />
        <View style={styles.container}>
          <Text style={styles.permissionText}>Camera permission is required to use this feature.</Text>
          <Button 
            title="Grant Permission" 
            onPress={() => {
              if (Platform.OS === 'web') {
                setHasPermission(true);
              } else {
                const initializeCamera = async () => {
                  try {
                    if (cameraPermission) {
                      const granted = await cameraPermission.requestPermission();
                      console.log('[Camera] Permission re-request result:', granted);
                      setHasPermission(granted);
                    }
                  } catch (error) {
                    console.error('[Camera] Error requesting permission:', error);
                    setHasPermission(false);
                  }
                };
                initializeCamera();
              }
            }} 
          />
        </View>
      </View>
    );
  }

  if (hasPermission === undefined) {
    return (
      <View style={styles.fullContainer}>
        <Header title="Camera" showHomeButton={true} />
        <View style={styles.container}>
          <Text style={styles.loadingText}>Requesting camera permission...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <Header title="Camera" showHomeButton={true} />
      <View style={styles.container}>
        {Platform.OS === 'web' || useMockCamera ? (
          // Mock camera view for web or when real camera fails
          <View style={[StyleSheet.absoluteFill, styles.mockCamera]}>
            <Text style={styles.mockCameraText}>
              {useMockCamera ? '📱 Emulator Camera Mode' : '📷 Mock Camera'}
            </Text>
            <Text style={styles.mockCameraSubtext}>
              {useMockCamera 
                ? 'Camera hardware not available in emulator. Using mock mode.'
                : 'Camera preview not available on web'
              }
            </Text>
            {isRecording && (
              <Text style={[styles.mockCameraSubtext, { color: 'red', marginTop: 20 }]}>
                🔴 Recording... ({useMockCamera ? 'Mock' : 'Simulated'})
              </Text>
            )}
            
            {/* Mock camera controls */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.captureButton} 
                onPress={onTakePicture}
                disabled={isRecording}
              >
                <Text style={styles.buttonText}>📷</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.captureButton, { marginTop: 10 }]} 
                onPress={isRecording ? onStopRecording : onStartRecording}
              >
                <Text style={styles.buttonText}>{isRecording ? '⏹️' : '🎥'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Real mobile camera
          <MobileCameraView 
            isActive={isActive}
            isRecording={isRecording}
            onTakePicture={onTakePicture}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
            setIsRecording={setIsRecording}
            onCameraError={handleCameraError}
          />
        )}
      </View>
    </View>
  );
};

// Separate component for mobile camera to isolate VisionCamera usage
const MobileCameraView = ({ 
  isActive, 
  isRecording, 
  onTakePicture, 
  onStartRecording, 
  onStopRecording, 
  setIsRecording, 
  onCameraError
}: {
  isActive: boolean;
  isRecording: boolean;
  onTakePicture: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  setIsRecording: (recording: boolean) => void;
  onCameraError: () => void;
}) => {
  const camera = useRef<any>(null);
  const [device, setDevice] = useState<any>(null);
  const [cameraFormat, setCameraFormat] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Use the useCameraDevice hook - try both back and front
  const backDevice = useCameraDevice ? useCameraDevice('back') : null;
  const frontDevice = useCameraDevice ? useCameraDevice('front') : null;

  useEffect(() => {
    console.log('[MobileCameraView] Initializing camera device...');
    console.log('[MobileCameraView] Back device available:', !!backDevice);
    console.log('[MobileCameraView] Front device available:', !!frontDevice);
    
    // Prefer back camera, but use front as fallback
    const selectedDevice = backDevice || frontDevice;
    
    if (selectedDevice) {
      console.log('[MobileCameraView] Selected device:', selectedDevice.id);
      console.log('[MobileCameraView] Device position:', selectedDevice.position);
      console.log('[MobileCameraView] Available formats:', selectedDevice.formats?.length || 0);
      
      // For Android emulators, we'll use the simplest possible configuration
      // Don't set any format - let the camera use its default
      console.log('[MobileCameraView] Using default camera format for better emulator compatibility');
      
      setDevice(selectedDevice);
      setCameraFormat(null); // Use default format
      setCameraError(null);
    } else {
      console.log('[MobileCameraView] No camera devices found');
      setCameraError('No camera devices available');
    }
  }, [backDevice, frontDevice]);

  // Handle actual photo taking for mobile
  const handleTakePhoto = async () => {
    console.log('[MobileCameraView] Taking photo...');
    
    if (!camera.current) {
      console.error('[MobileCameraView] Camera ref not available');
      Alert.alert('Error', 'Camera not ready');
      return;
    }
    
    if (!device) {
      console.error('[MobileCameraView] No camera device available');
      Alert.alert('Error', 'No camera device available');
      return;
    }
    
    try {
      console.log('[MobileCameraView] Attempting photo capture...');
      
      // Create a timeout promise to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Photo capture timeout - switching to mock mode'));
        }, 5000); // 5 second timeout
      });
      
      // Use the most basic photo capture settings for emulator compatibility
      const photoPromise = camera.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
        enableAutoRedEyeReduction: false,
        enableShutterSound: false,
        // Remove any format-specific settings that might cause issues
      });
      
      console.log('[MobileCameraView] Waiting for photo capture or timeout...');
      const photo = await Promise.race([photoPromise, timeoutPromise]);
      
      console.log('[MobileCameraView] Photo taken successfully:', photo.path);
      
      router.push({
        pathname: '/(protected)/preview',
        params: { uri: 'file://' + photo.path, mediaType: 'photo' },
      });
    } catch (error: any) {
      console.error('[MobileCameraView] Failed to take photo:', error);
      
      // If it's a timeout or camera hardware issue, switch to mock mode
      if (error.message?.includes('timeout') || 
          error.message?.includes('session/invalid-output-configuration') ||
          error.message?.includes('Template ID') ||
          error.code?.includes('session/invalid-output-configuration')) {
        console.log('[MobileCameraView] Camera hardware issue detected, switching to mock mode');
        onCameraError();
      } else {
        Alert.alert('Error', `Failed to take photo: ${error.message || error}`);
      }
    }
  };

  // Handle actual video recording for mobile
  const handleStartRecording = async () => {
    console.log('[MobileCameraView] Starting video recording...');
    
    if (!camera.current) {
      console.error('[MobileCameraView] Camera ref not available');
      Alert.alert('Error', 'Camera not ready');
      return;
    }
    
    if (!device) {
      console.error('[MobileCameraView] No camera device available');
      Alert.alert('Error', 'No camera device available');
      return;
    }
    
    try {
      console.log('[MobileCameraView] Attempting video recording...');
      
      // Create a timeout for video recording start
      const startTimeout = setTimeout(() => {
        console.error('[MobileCameraView] Video recording start timeout');
        setIsRecording(false);
        onCameraError();
      }, 3000); // 3 second timeout for starting
      
      camera.current.startRecording({
        flash: 'off',
        // Use minimal settings for emulator compatibility
        onRecordingFinished: (video: any) => {
          clearTimeout(startTimeout);
          console.log('[MobileCameraView] Video recorded successfully:', video.path);
          setIsRecording(false);
          router.push({
            pathname: '/(protected)/preview',
            params: { uri: 'file://' + video.path, mediaType: 'video' },
          });
        },
        onRecordingError: (error: any) => {
          clearTimeout(startTimeout);
          console.error('[MobileCameraView] Video recording error:', error);
          setIsRecording(false);
          
          // If it's a camera hardware issue, switch to mock mode
          if (error.message?.includes('session/invalid-output-configuration') || 
              error.message?.includes('Template ID') ||
              error.message?.includes('camera') ||
              error.code?.includes('session/invalid-output-configuration')) {
            console.log('[MobileCameraView] Video recording hardware issue, switching to mock mode');
            onCameraError();
          } else {
            Alert.alert('Error', `Video recording failed: ${error.message || error}`);
          }
        },
      });
      
      // Clear timeout if recording starts successfully
      setTimeout(() => {
        clearTimeout(startTimeout);
        console.log('[MobileCameraView] Video recording started successfully');
      }, 500);
      
      console.log('[MobileCameraView] Video recording initiated');
      
      // Auto-stop after 10 seconds for safety
      setTimeout(() => {
        if (isRecording) {
          console.log('[MobileCameraView] Auto-stopping video recording after 10 seconds');
          handleStopRecording();
        }
      }, 10000);
      
    } catch (error: any) {
      console.error('[MobileCameraView] Failed to start video recording:', error);
      setIsRecording(false);
      
      // If it's a camera hardware issue, switch to mock mode
      if (error.message?.includes('session/invalid-output-configuration') || 
          error.message?.includes('Template ID') ||
          error.code?.includes('session/invalid-output-configuration')) {
        console.log('[MobileCameraView] Video recording hardware issue, switching to mock mode');
        onCameraError();
      } else {
        Alert.alert('Error', `Failed to start video recording: ${error.message || error}`);
      }
    }
  };

  const handleStopRecording = async () => {
    if (camera.current && isRecording) {
      try {
        console.log('[MobileCameraView] Stopping video recording...');
        await camera.current.stopRecording();
        console.log('[MobileCameraView] Video recording stopped');
      } catch (error: any) {
        console.error('[MobileCameraView] Error stopping video recording:', error);
        setIsRecording(false);
      }
    }
  };

  const onCameraInitialized = () => {
    console.log('[MobileCameraView] Camera initialized successfully');
  };

  const onCameraErrorHandler = (error: any) => {
    console.error('[MobileCameraView] Camera error:', error);
    
    // Check for specific emulator-related errors
    if (error.message?.includes('session/invalid-output-configuration') ||
        error.message?.includes('Template ID') ||
        error.code?.includes('session/invalid-output-configuration')) {
      console.log('[MobileCameraView] Detected emulator camera configuration issue, switching to mock mode');
      onCameraError();
    } else {
      setCameraError(error.message || 'Camera error occurred');
    }
  };

  if (cameraError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera Error: {cameraError}</Text>
        <TouchableOpacity style={styles.button} onPress={() => setCameraError(null)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        photo={true}
        video={true}
        audio={false} // Disable audio for better emulator compatibility
        // Don't set format - use default for better compatibility
        // format={cameraFormat}
        onInitialized={onCameraInitialized}
        onError={onCameraErrorHandler}
      />
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.captureButton, isRecording && styles.recordingButton]} 
          onPress={isRecording ? handleStopRecording : handleTakePhoto}
        >
          <Text style={styles.captureButtonText}>
            {isRecording ? 'Stop' : 'Take Photo'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.videoButton} 
          onPress={isRecording ? handleStopRecording : handleStartRecording}
        >
          <Text style={styles.videoButtonText}>
            {isRecording ? 'Stop Video' : 'Record Video'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockCamera: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockCameraText: {
    fontSize: 24,
    marginBottom: 10,
  },
  mockCameraSubtext: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff0000',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    borderWidth: 5,
    borderColor: 'gray',
  },
  captureButtonRecording: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'red',
    borderWidth: 5,
    borderColor: 'white',
  },
  mobileOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'column',
    gap: 15,
  },
  mobileControlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  photoButton: {
    backgroundColor: 'rgba(0, 123, 255, 0.8)',
  },
  videoButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  stopButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
  },
  mobileButtonText: {
    fontSize: 24,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'white',
    marginRight: 8,
  },
  recordingText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: 'rgba(0, 123, 255, 0.8)',
    padding: 15,
    borderRadius: 5,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
  },
  captureButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  videoButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default CameraScreen; 