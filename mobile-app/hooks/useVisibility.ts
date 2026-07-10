import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to track visibility state for video playback
 * Used to pause/resume videos when they go off-screen
 */
export function useVisibility(initialVisible: boolean = false) {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const lastVisibleRef = useRef(initialVisible);

  const setVisible = useCallback((visible: boolean) => {
    if (lastVisibleRef.current !== visible) {
      lastVisibleRef.current = visible;
      setIsVisible(visible);
    }
  }, []);

  return {
    isVisible,
    setVisible,
    lastVisible: lastVisibleRef.current,
  };
}

/**
 * Hook to manage visibility based on viewability config
 * Integrates with FlashList/FlatList onViewableItemsChanged
 */
export function useViewabilityTracking() {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleIndicesRef = useRef<Set<number>>(new Set([0]));

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null; isViewable: boolean }> }) => {
      const newVisible = new Set<number>();
      let newActiveIndex = activeIndex;

      viewableItems.forEach((item) => {
        if (item.index !== null && item.isViewable) {
          newVisible.add(item.index);
        }
      });

      // Determine the most visible item as active
      const sortedVisible = Array.from(newVisible).sort((a, b) => a - b);
      if (sortedVisible.length > 0) {
        // Prefer the first visible item as active
        newActiveIndex = sortedVisible[0];
      }

      visibleIndicesRef.current = newVisible;
      setActiveIndex(newActiveIndex);
    },
    [activeIndex]
  );

  const isIndexVisible = useCallback(
    (index: number) => visibleIndicesRef.current.has(index),
    []
  );

  const isIndexActive = useCallback(
    (index: number) => index === activeIndex,
    [activeIndex]
  );

  return {
    activeIndex,
    setActiveIndex,
    onViewableItemsChanged,
    isIndexVisible,
    isIndexActive,
    visibleIndices: visibleIndicesRef.current,
  };
}