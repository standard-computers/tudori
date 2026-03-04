import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { registerStatusBarHandler, unregisterStatusBarHandler } from '@/lib/toast';

interface StatusMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

interface StatusBarContextValue {
  transaction: string;
  setTransaction: (transaction: string) => void;
  isLoading: boolean;
  loadingText: string;
  startLoading: (text?: string) => void;
  stopLoading: () => void;
  messages: StatusMessage[];
  visibleMessages: StatusMessage[];
  addMessage: (text: string, type?: 'success' | 'error' | 'info') => void;
  clearMessages: () => void;
}

const StatusBarContext = createContext<StatusBarContextValue | null>(null);

export function StatusBarProvider({ children }: { children: React.ReactNode }) {
  const [transaction, setTransaction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const messageIdRef = useRef(0);

  const startLoading = useCallback((text = 'Loading...') => {
    setIsLoading(true);
    setLoadingText(text);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingText('');
  }, []);

  // visibleMessages: only recent ones shown in status bar (last message always kept)
  const [visibleMessages, setVisibleMessages] = useState<StatusMessage[]>([]);

  const addMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `msg-${++messageIdRef.current}`;
    const newMessage: StatusMessage = {
      id,
      text,
      type,
      timestamp: Date.now(),
    };
    // Keep all messages for session history
    setMessages(prev => [...prev, newMessage]);
    // Visible in status bar (auto-fades)
    setVisibleMessages(prev => [...prev, newMessage]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setVisibleMessages([]);
  }, []);

  // Register global toast bridge
  useEffect(() => {
    registerStatusBarHandler(addMessage);
    return () => unregisterStatusBarHandler();
  }, [addMessage]);

  // Auto-remove from status bar after 5 seconds, but keep the last one visible
  useEffect(() => {
    if (visibleMessages.length === 0) return;

    const timer = setTimeout(() => {
      const now = Date.now();
      setVisibleMessages(prev => {
        const filtered = prev.filter(msg => now - msg.timestamp < 5000);
        if (filtered.length === 0 && prev.length > 0) {
          return [prev[prev.length - 1]];
        }
        return filtered;
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [visibleMessages]);

  return (
    <StatusBarContext.Provider
      value={{
        transaction,
        setTransaction,
        isLoading,
        loadingText,
        startLoading,
        stopLoading,
        messages,
        visibleMessages,
        addMessage,
        clearMessages,
      }}
    >
      {children}
    </StatusBarContext.Provider>
  );
}

export function useStatusBar() {
  const context = useContext(StatusBarContext);
  if (!context) {
    throw new Error('useStatusBar must be used within a StatusBarProvider');
  }
  return context;
}

// Hook to set transaction on mount
export function useTransaction(transaction: string) {
  const { setTransaction } = useStatusBar();
  
  useEffect(() => {
    setTransaction(transaction);
    return () => setTransaction('');
  }, [transaction, setTransaction]);
}
