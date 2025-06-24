import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useFocusEffect, router } from 'expo-router';

export default function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isActive, setIsActive] = useState(false);
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      return () => {
        setIsActive(false);
      };
    }, [])
  );

  const onTakePicture = async () => {
    if (camera.current && !isRecording) {
      try {
        const photo = await camera.current.takePhoto();
        console.log('Photo taken:', photo.path);
        router.push({
          pathname: '/(protected)/preview',
          params: { uri: 'file://' + photo.path, mediaType: 'photo' },
        });
      } catch (e) {
        console.error('Failed to take photo', e);
      }
    }
  };

  const onStartRecording = async () => {
    if (camera.current) {
      setIsRecording(true);
      camera.current.startRecording({
        onRecordingFinished: (video) => {
          console.log('Video recorded:', video.path);
          setIsRecording(false);
          router.push({
            pathname: '/(protected)/preview',
            params: { uri: 'file://' + video.path, mediaType: 'video' },
          });
        },
        onRecordingError: (error) => {
          console.error('Video recording error:', error);
          setIsRecording(false);
        },
      });
      setTimeout(onStopRecording, 10000); // Stop recording after 10 seconds
    }
  };

  const onStopRecording = async () => {
    if (camera.current && isRecording) {
      await camera.current.stopRecording();
    }
  };

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>Camera permission is required to use this feature.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  if (hasPermission === undefined) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text>No camera device found.</Text>
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
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={isRecording ? styles.captureButtonRecording : styles.captureButton} 
          onPress={onTakePicture}
          onLongPress={onStartRecording}
          onPressOut={onStopRecording}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
}); 