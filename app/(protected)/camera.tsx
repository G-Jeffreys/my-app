import { StyleSheet, Text, View, Button, TouchableOpacity, Alert } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { Platform } from 'react-native';
import Header from '../../components/Header';

const CameraScreen = () => {
  const [isActive, setIsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // For web, we'll simulate having permission
      setHasPermission(true);
    } else {
      // For mobile, use the actual VisionCamera
      const initializeCamera = async () => {
        try {
          const { useCameraPermission } = require('react-native-vision-camera');
          const { hasPermission: actualPermission, requestPermission } = useCameraPermission();
          setHasPermission(actualPermission);
          
          if (!actualPermission) {
            const granted = await requestPermission();
            setHasPermission(granted);
          }
        } catch (error) {
          console.error('[Camera] Error initializing camera:', error);
          setHasPermission(false);
        }
      };
      
      initializeCamera();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      return () => {
        setIsActive(false);
      };
    }, [])
  );

  const onTakePicture = async () => {
    if (isRecording) return;
    
    try {
      if (Platform.OS === 'web') {
        // Mock photo capture for web
        console.log('[Camera] Mock photo taken');
        const mockPhotoPath = 'mock://photo.jpg';
        router.push({
          pathname: '/(protected)/preview',
          params: { uri: mockPhotoPath, mediaType: 'photo' },
        });
      } else {
        // Actual camera functionality for mobile
        console.log('[Camera] Taking actual photo...');
        // Camera logic will be handled in the render section
      }
    } catch (e) {
      console.error('Failed to take photo', e);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const onStartRecording = async () => {
    if (Platform.OS === 'web') {
      // Mock video recording for web
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
      // Actual video recording for mobile
      console.log('[Camera] Starting actual video recording...');
      setIsRecording(true);
      // Video logic will be handled in the render section
    }
  };

  const onStopRecording = async () => {
    if (Platform.OS !== 'web' && isRecording) {
      console.log('[Camera] Stopping video recording...');
      setIsRecording(false);
      // Stop logic will be handled in the render section
    }
  };

  if (hasPermission === false) {
    return (
      <View style={styles.fullContainer}>
        <Header title="Camera" showHomeButton={true} />
        <View style={styles.container}>
          <Text>Camera permission is required to use this feature.</Text>
        <Button 
          title="Grant Permission" 
          onPress={() => {
            if (Platform.OS === 'web') {
              setHasPermission(true);
            } else {
              const initializeCamera = async () => {
                try {
                  const { useCameraPermission } = require('react-native-vision-camera');
                  const { requestPermission } = useCameraPermission();
                  const granted = await requestPermission();
                  setHasPermission(granted);
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
          <Text>Requesting camera permission...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <Header title="Camera" showHomeButton={true} />
      <View style={styles.container}>
      {Platform.OS === 'web' ? (
        // Mock camera view for web
        <View style={[StyleSheet.absoluteFill, styles.mockCamera]}>
          <Text style={styles.mockCameraText}>
            📷 Mock Camera View
          </Text>
          <Text style={styles.mockCameraSubtext}>
            {isRecording ? '🔴 Recording...' : 'Tap to take photo, hold to record video'}
          </Text>
        </View>
      ) : (
        // Actual camera for mobile - only load VisionCamera components here
        <MobileCameraView 
          isActive={isActive}
          isRecording={isRecording}
          onTakePicture={onTakePicture}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
        />
      )}
      
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={isRecording ? styles.captureButtonRecording : styles.captureButton} 
            onPress={onTakePicture}
            onLongPress={onStartRecording}
            onPressOut={onStopRecording}
          />
        </View>
      </View>
    </View>
  );
};

// Separate component for mobile camera to isolate VisionCamera imports
const MobileCameraView = ({ isActive, isRecording, onTakePicture, onStartRecording, onStopRecording }: {
  isActive: boolean;
  isRecording: boolean;
  onTakePicture: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}) => {
  const camera = useRef<any>(null);
  const [device, setDevice] = useState<any>(null);

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const { useCameraDevice } = require('react-native-vision-camera');
        const backDevice = useCameraDevice('back');
        setDevice(backDevice);
      } catch (error) {
        console.error('[Camera] Error getting camera device:', error);
      }
    };
    
    initializeCamera();
  }, []);

  // Handle actual photo taking for mobile
  const handleTakePhoto = async () => {
    if (camera.current && device) {
      try {
        const photo = await camera.current.takePhoto();
        console.log('Photo taken:', photo.path);
        router.push({
          pathname: '/(protected)/preview',
          params: { uri: 'file://' + photo.path, mediaType: 'photo' },
        });
      } catch (error) {
        console.error('Failed to take photo:', error);
      }
    }
  };

  // Handle actual video recording for mobile
  const handleStartRecording = async () => {
    if (camera.current && device) {
      try {
        camera.current.startRecording({
          onRecordingFinished: (video: any) => {
            console.log('Video recorded:', video.path);
            router.push({
              pathname: '/(protected)/preview',
              params: { uri: 'file://' + video.path, mediaType: 'video' },
            });
          },
          onRecordingError: (error: any) => {
            console.error('Video recording error:', error);
          },
        });
        
        // Auto-stop after 10 seconds
        setTimeout(() => {
          if (camera.current) {
            camera.current.stopRecording();
          }
        }, 10000);
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  };

  // Handle stopping video recording for mobile
  const handleStopRecording = async () => {
    if (camera.current) {
      try {
        await camera.current.stopRecording();
      } catch (error) {
        console.error('Failed to stop recording:', error);
      }
    }
  };

  if (!device) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.container]}>
        <Text>No camera device found.</Text>
      </View>
    );
  }

  try {
    const { Camera } = require('react-native-vision-camera');
    
    return (
      <>
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          photo={true}
          video={true}
        />
        {/* Mobile-specific camera controls */}
        <View style={styles.mobileButtonContainer}>
          <TouchableOpacity 
            style={isRecording ? styles.captureButtonRecording : styles.captureButton} 
            onPress={handleTakePhoto}
            onLongPress={handleStartRecording}
            onPressOut={handleStopRecording}
          />
        </View>
      </>
    );
  } catch (error) {
    console.error('[Camera] Error loading Camera component:', error);
    return (
      <View style={[StyleSheet.absoluteFill, styles.container]}>
        <Text>Error loading camera</Text>
      </View>
    );
  }
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
  mobileButtonContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
});

export default CameraScreen; 