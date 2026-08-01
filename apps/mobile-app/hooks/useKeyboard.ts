import { useState, useEffect, useCallback } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

interface KeyboardState {
  isVisible: boolean;
  keyboardHeight: number;
  keyboardWillShow: boolean;
  keyboardWillHide: boolean;
}

export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    isVisible: false,
    keyboardHeight: 0,
    keyboardWillShow: false,
    keyboardWillHide: false,
  });

  const handleKeyboardWillShow = useCallback((e: KeyboardEvent) => {
    setState((prev) => ({
      ...prev,
      keyboardWillShow: true,
      keyboardWillHide: false,
      keyboardHeight: e.endCoordinates.height,
    }));
  }, []);

  const handleKeyboardDidShow = useCallback((e: KeyboardEvent) => {
    setState({
      isVisible: true,
      keyboardHeight: e.endCoordinates.height,
      keyboardWillShow: false,
      keyboardWillHide: false,
    });
  }, []);

  const handleKeyboardWillHide = useCallback(() => {
    setState((prev) => ({
      ...prev,
      keyboardWillShow: false,
      keyboardWillHide: true,
    }));
  }, []);

  const handleKeyboardDidHide = useCallback(() => {
    setState({
      isVisible: false,
      keyboardHeight: 0,
      keyboardWillShow: false,
      keyboardWillHide: false,
    });
  }, []);

  useEffect(() => {
    const willShowSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      handleKeyboardWillShow
    );
    const didShowSub = Keyboard.addListener('keyboardDidShow', handleKeyboardDidShow);
    const willHideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      handleKeyboardWillHide
    );
    const didHideSub = Keyboard.addListener('keyboardDidHide', handleKeyboardDidHide);

    return () => {
      willShowSub.remove();
      didShowSub.remove();
      willHideSub.remove();
      didHideSub.remove();
    };
  }, [handleKeyboardWillShow, handleKeyboardDidShow, handleKeyboardWillHide, handleKeyboardDidHide]);

  return state;
}

export default useKeyboard;
