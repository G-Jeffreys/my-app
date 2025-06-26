import React, { forwardRef } from "react";
import { Platform, StyleSheet } from "react-native";
import { Video, VideoProps, ResizeMode } from "expo-av";

// This component acts as a wrapper around the video player.
// It uses the standard HTML5 <video> tag on web for better compatibility,
// especially with blob URLs from MediaRecorder.
// On native platforms (iOS, Android), it uses the standard Expo AV Video component.

const mapResizeModeToObjectFit = (resizeMode?: ResizeMode) => {
  switch (resizeMode) {
    case ResizeMode.CONTAIN:
      return "contain";
    case ResizeMode.COVER:
      return "cover";
    case ResizeMode.STRETCH:
      return "fill";
    default:
      return "contain";
  }
};

const PlatformVideo = forwardRef<Video, VideoProps>((props, ref) => {
  if (Platform.OS === "web") {
    // Extract props
    const { source, style, resizeMode, isMuted, shouldPlay, isLooping } = props;

    // The source URI can be a string (for remote files) or an object with a URI.
    const uri = typeof source === "string" ? source : (source as any)?.uri;

    return (
      <video
        ref={ref as any}
        src={uri}
        muted={isMuted}
        autoPlay={shouldPlay}
        loop={isLooping}
        playsInline // Important for iOS Safari to not go fullscreen
        style={{
          ...StyleSheet.flatten(style),
          objectFit: mapResizeModeToObjectFit(resizeMode),
        } as React.CSSProperties}
      />
    );
  }

  // On native, use the standard expo-av Video component
  return <Video {...props} ref={ref} />;
});

export default PlatformVideo; 