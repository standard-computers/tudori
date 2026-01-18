import { useCallback } from 'react';
import { useStatusBar } from '@/contexts/StatusBarContext';

/**
 * Hook that provides toast-like functionality via the status bar
 * Use this instead of sonner's toast for status bar integration
 */
export function useStatusMessage() {
  const { addMessage, startLoading, stopLoading } = useStatusBar();

  const success = useCallback((message: string) => {
    addMessage(message, 'success');
  }, [addMessage]);

  const error = useCallback((message: string) => {
    addMessage(message, 'error');
  }, [addMessage]);

  const info = useCallback((message: string) => {
    addMessage(message, 'info');
  }, [addMessage]);

  const loading = useCallback((message: string) => {
    startLoading(message);
  }, [startLoading]);

  const done = useCallback(() => {
    stopLoading();
  }, [stopLoading]);

  return {
    success,
    error,
    info,
    loading,
    done,
  };
}
