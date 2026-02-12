import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook that reads ?action= from URL search params and triggers a callback.
 * Cleans up the param after triggering to avoid re-firing.
 */
export const useTransactionAction = (
  action: string,
  callback: () => void,
  enabled: boolean = true
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const handledRef = useRef(false);

  const currentAction = searchParams.get('action');

  useEffect(() => {
    if (!enabled || handledRef.current) return;
    
    if (currentAction === action) {
      handledRef.current = true;
      
      // Remove the action param
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('action');
        return next;
      }, { replace: true });
      
      // Delay to let the page finish rendering
      setTimeout(() => {
        callbackRef.current();
      }, 400);
    }
  }, [currentAction, action, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset handled flag when action changes
  useEffect(() => {
    if (currentAction !== action) {
      handledRef.current = false;
    }
  }, [currentAction, action]);
};
