import { useEffect, useCallback } from 'react';

export function useKeyboardShortcut(key: string, callback: () => void, enabled: boolean = true) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger if user is typing in an input, textarea, or has a button focused
    const activeElement = document.activeElement;
    const isInputFocused = activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLButtonElement ||
      activeElement instanceof HTMLSelectElement ||
      activeElement?.getAttribute('role') === 'combobox' ||
      activeElement?.getAttribute('contenteditable') === 'true';

    if (isInputFocused) return;

    // Don't trigger if a dialog is open (check for data-state="open" on dialogs)
    const openDialog = document.querySelector('[role="dialog"]');
    if (openDialog) return;

    // Check if the pressed key matches (case-insensitive)
    if (event.key.toLowerCase() === key.toLowerCase() && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      callback();
    }
  }, [key, callback]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

// New hook for Ctrl+S save shortcut - works in dialogs and forms
export function useSaveShortcut(callback: () => void, enabled: boolean = true) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check for Ctrl+S or Cmd+S (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      callback();
    }
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}