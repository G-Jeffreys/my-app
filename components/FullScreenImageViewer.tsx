import React, { useEffect, useCallback } from 'react';
import { 
  Modal, 
  View, 
  Image, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Platform,
  BackHandler,
  StatusBar,
  Dimensions 
} from 'react-native';

interface FullScreenImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  isExpired?: boolean;
  remaining?: number;
  ttlFormatted?: string;
  showTTL?: boolean;
  messageId?: string;
}

// Helper function to format time remaining
const formatTime = (seconds: number): string => {
  if (seconds <= 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

const FullScreenImageViewer: React.FC<FullScreenImageViewerProps> = ({
  visible,
  imageUri,
  onClose,
  isExpired = false,
  remaining = 0,
  ttlFormatted,
  showTTL = true,
  messageId
}) => {
  
  // Log when component renders for debugging
  console.log('[FullScreenImageViewer] Rendered', {
    visible,
    hasImageUri: !!imageUri,
    isExpired,
    remaining,
    showTTL,
    messageId
  });

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android' && visible) {
      console.log('[FullScreenImageViewer] Setting up Android back handler');
      
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        console.log('[FullScreenImageViewer] Android back button pressed');
        if (visible) {
          onClose();
          return true; // Prevent default behavior
        }
        return false; // Allow default behavior
      });

      return () => {
        console.log('[FullScreenImageViewer] Cleaning up Android back handler');
        backHandler.remove();
      };
    }
  }, [visible, onClose]);

  // Auto-close when message expires
  useEffect(() => {
    if (visible && isExpired) {
      console.log('[FullScreenImageViewer] Message expired - auto-closing viewer', { messageId });
      onClose();
    }
  }, [visible, isExpired, onClose, messageId]);

  // Handle escape key on web
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      console.log('[FullScreenImageViewer] Setting up web escape key handler');
      
      const handleKeyPress = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          console.log('[FullScreenImageViewer] Escape key pressed');
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyPress);
      return () => {
        console.log('[FullScreenImageViewer] Cleaning up web escape key handler');
        document.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [visible, onClose]);

  const handleModalClose = useCallback(() => {
    console.log('[FullScreenImageViewer] Modal close requested');
    onClose();
  }, [onClose]);

  const handleBackgroundPress = useCallback(() => {
    console.log('[FullScreenImageViewer] Background tapped - closing');
    onClose();
  }, [onClose]);

  const handleImageError = useCallback((error: any) => {
    console.error('[FullScreenImageViewer] Image load error:', error);
    console.log('[FullScreenImageViewer] Failed to load image URI:', imageUri);
  }, [imageUri]);

  const handleImageLoad = useCallback(() => {
    console.log('[FullScreenImageViewer] Image loaded successfully:', imageUri);
  }, [imageUri]);

  if (!visible || !imageUri) {
    return null;
  }

  const screenDimensions = Dimensions.get('window');
  console.log('[FullScreenImageViewer] Screen dimensions:', screenDimensions);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleModalClose}
      statusBarTranslucent={true}
    >
      {/* Change status bar style for full-screen viewing */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="rgba(0, 0, 0, 0.9)" 
        translucent={true}
      />
      
      {/* Full-screen container */}
      <View style={styles.container}>
        {/* Background overlay - tappable to close */}
        <TouchableOpacity 
          style={styles.backgroundOverlay}
          activeOpacity={1}
          onPress={handleBackgroundPress}
        >
          {/* Close button */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleModalClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* TTL Counter */}
          {showTTL && !isExpired && (
            <View style={styles.ttlContainer}>
              <Text style={styles.ttlText}>
                {ttlFormatted || formatTime(remaining)}
              </Text>
            </View>
          )}

          {/* Expired indicator */}
          {isExpired && (
            <View style={styles.expiredContainer}>
              <Text style={styles.expiredText}>EXPIRED</Text>
            </View>
          )}

          {/* Main image container - prevent closing when touching image */}
          <TouchableOpacity 
            style={styles.imageContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()} // Prevent event bubbling
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onError={handleImageError}
              onLoad={handleImageLoad}
              onLoadStart={() => console.log('[FullScreenImageViewer] Image loading started')}
              onLoadEnd={() => console.log('[FullScreenImageViewer] Image loading finished')}
            />
          </TouchableOpacity>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              Tap outside image to close • {Platform.OS === 'web' ? 'Press Esc' : 'Press back button'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  backgroundOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 44 : 24, // Account for status bar
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  ttlContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 10,
  },
  ttlText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  expiredContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 10,
  },
  expiredText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    // Allow the container to take full available space
  },
  image: {
    flex: 1,
    width: '100%',
    // Use aspectRatio to maintain image proportions while fitting container
    maxWidth: '100%',
    maxHeight: '100%',
    // Removed static Dimensions calculations that can cause display issues
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default FullScreenImageViewer; 