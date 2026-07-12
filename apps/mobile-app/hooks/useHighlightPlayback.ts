import { useState, useCallback, useRef, useEffect } from 'react';

type PlaybackState = 'playing' | 'paused' | 'buffering' | 'idle';

interface PlaybackOptions {
  autoPlay?: boolean;
  loop?: boolean;
  initialMuted?: boolean;
}

/**
 * Hook to manage video playback state and controls
 * Handles play/pause, buffering, looping, and visibility-based playback
 * Note: This hook provides playback state management, actual video control
 * is handled by expo-video's useVideoPlayer in the component
 */
export function useHighlightPlayback(
  isActive: boolean,
  options: PlaybackOptions = {}
) {
  const { autoPlay = true, loop = true, initialMuted = false } = options;
  const [playbackState, setPlaybackState] = useState<PlaybackState>(isActive && autoPlay ? 'playing' : 'idle');
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isPlaying, setIsPlaying] = useState(isActive && autoPlay);
  const lastStateRef = useRef<PlaybackState>('idle');

  // Handle visibility changes - pause when off-screen, resume when visible
  useEffect(() => {
    if (isActive && autoPlay) {
      setIsPlaying(true);
      setPlaybackState('playing');
    } else if (!isActive) {
      setIsPlaying(false);
      setPlaybackState('paused');
    }
  }, [isActive, autoPlay]);

  // Play video
  const play = useCallback(() => {
    setIsPlaying(true);
    setPlaybackState('playing');
    lastStateRef.current = 'playing';
  }, []);

  // Pause video
  const pause = useCallback(() => {
    setIsPlaying(false);
    setPlaybackState('paused');
    lastStateRef.current = 'paused';
  }, []);

  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Replay from beginning
  const replay = useCallback(() => {
    play();
  }, [play]);

  // Set buffering state
  const setBuffering = useCallback((buffering: boolean) => {
    if (buffering) {
      setPlaybackState('buffering');
    } else {
      setPlaybackState(isPlaying ? 'playing' : 'paused');
    }
  }, [isPlaying]);

  return {
    playbackState,
    isPlaying,
    isPaused: !isPlaying,
    isBuffering: playbackState === 'buffering',
    isMuted,
    play,
    pause,
    togglePlayback,
    toggleMute,
    replay,
    setBuffering,
    loop,
  };
}

/**
 * Simplified playback hook for non-video content (images with simulated playback)
 * Used as placeholder until video URLs are available
 */
export function useSimulatedPlayback(isActive: boolean) {
  const [isPlaying, setIsPlaying] = useState(isActive);

  useEffect(() => {
    setIsPlaying(isActive);
  }, [isActive]);

  const togglePlayback = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  return {
    isPlaying,
    isPaused: !isPlaying,
    togglePlayback,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
  };
}