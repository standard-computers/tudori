import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook that reads ?action= from URL search params and triggers a callback.
 * Cleans up the param after triggering to avoid re-firing.
 * 
 * @param action - The action to listen for (e.g., 'new')
 * @param callback - Function to call when the action is detected
 * @param enabled - Whether the hook is active (default: true)
 */
export const useTransactionAction = (
  action: string,
  callback: () => void,
  enabled: boolean = true
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    
    const currentAction = searchParams.get('action');
    if (currentAction === action) {
      // Remove the action param first to prevent re-firing
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
      
      // Small delay to let the page finish loading/rendering
      const timer = setTimeout(() => {
        callbackRef.current();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, action, enabled, setSearchParams]);
};
