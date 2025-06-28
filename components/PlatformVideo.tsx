import React from "react";
import { useVideoPlayer, VideoView, VideoSource } from "expo-video";
import { Platform } from "react-native";

// This component acts as a wrapper around the video player.
// It uses the standard HTML5 <video> tag on web for better compatibility,
// especially with blob URLs from MediaRecorder.
// On native platforms (iOS, Android), it uses the standard Expo AV Video component.

interface PlatformVideoProps {
  source: VideoSource;
  style?: any;
  contentFit?: 'contain' | 'cover' | 'fill';
  nativeControls?: boolean;
  shouldPlay?: boolean;
  isLooping?: boolean;
}

export default function PlatformVideo({
  source,
  style,
  contentFit = 'contain',
  nativeControls = true,
  shouldPlay = false,
  isLooping = false,
}: PlatformVideoProps) {
  console.log('[PlatformVideo] Rendering video with source:', source);
  console.log('[PlatformVideo] Platform:', Platform.OS);
  console.log('[PlatformVideo] Video style:', style);
  console.log('[PlatformVideo] Content fit:', contentFit);
  console.log('[PlatformVideo] Native controls:', nativeControls);
  console.log('[PlatformVideo] Should play:', shouldPlay);
  console.log('[PlatformVideo] Is looping:', isLooping);

  // Create video player using the hook
  const player = useVideoPlayer(source, (player) => {
    player.loop = isLooping;
    if (shouldPlay) {
      player.play();
    }
  });

  if (Platform.OS === 'web') {
    // On web, use HTML5 video element for better compatibility
    console.log('[PlatformVideo] Using HTML5 video for web platform');
    
    // Extract URI from VideoSource
    let uri: string | undefined;
    if (typeof source === 'string') {
      uri = source;
    } else if (typeof source === 'object' && source !== null && 'uri' in source) {
      uri = source.uri;
    }
    
    return (
      <video
        src={uri}
        style={{
          width: '100%',
          height: '100%',
          objectFit: contentFit === 'contain' ? 'contain' : contentFit === 'cover' ? 'cover' : 'fill',
          ...style,
        }}
        controls={nativeControls}
        autoPlay={shouldPlay}
        loop={isLooping}
        playsInline
      />
    );
  }

  // On native, use expo-video VideoView component
  console.log('[PlatformVideo] Using expo-video VideoView for native platform');
  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={nativeControls}
    />
  );
} 