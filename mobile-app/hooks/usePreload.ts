import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook to manage video preloading for smooth transitions
 * Preloads next and previous videos to ensure instant playback
 * Note: expo-video ~3.0 handles preloading internally via the player
 */
export function usePreload(videoUrls: string[], currentIndex: number) {
  const preloadCacheRef = useRef<Set<string>>(new Set());

  // Get URLs to preload (current, next, previous)
  const getUrlsToPreload = useCallback((index: number): string[] => {
    const urls: string[] = [];
    
    // Current video
    if (videoUrls[index]) {
      urls.push(videoUrls[index]);
    }
    
    // Next video
    if (index + 1 < videoUrls.length && videoUrls[index + 1]) {
      urls.push(videoUrls[index + 1]);
    }
    
    // Previous video
    if (index - 1 >= 0 && videoUrls[index - 1]) {
      urls.push(videoUrls[index - 1]);
    }
    
    return urls;
  }, [videoUrls]);

  // Mark URLs as preloaded
  const preloadVideos = useCallback((urls: string[]) => {
    urls.forEach((url) => {
      if (url) {
        preloadCacheRef.current.add(url);
      }
    });
  }, []);

  // Check if URL is preloaded
  const isPreloaded = useCallback((url: string) => {
    return preloadCacheRef.current.has(url);
  }, []);

  // Update preload on index change
  useEffect(() => {
    const urlsToPreload = getUrlsToPreload(currentIndex);
    preloadVideos(urlsToPreload);
  }, [currentIndex, getUrlsToPreload, preloadVideos]);

  return {
    preloadVideos,
    isPreloaded,
    getUrlsToPreload,
    urlsToPreload: getUrlsToPreload(currentIndex),
  };
}

/**
 * Simplified preload hook for image-based content
 * Returns URLs that should be preloaded
 */
export function useImagePreload(imageUrls: string[], currentIndex: number) {
  const getUrlsToPreload = useCallback((index: number): string[] => {
    const urls: string[] = [];
    
    if (imageUrls[index]) urls.push(imageUrls[index]);
    if (index + 1 < imageUrls.length && imageUrls[index + 1]) urls.push(imageUrls[index + 1]);
    if (index - 1 >= 0 && imageUrls[index - 1]) urls.push(imageUrls[index - 1]);
    
    return urls;
  }, [imageUrls]);

  return {
    urlsToPreload: getUrlsToPreload(currentIndex),
    getUrlsToPreload,
  };
}