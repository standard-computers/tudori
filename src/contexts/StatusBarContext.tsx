import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

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

  const addMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `msg-${++messageIdRef.current}`;
    const newMessage: StatusMessage = {
      id,
      text,
      type,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev.slice(-4), newMessage]); // Keep last 5 messages
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Auto-remove messages after 5 seconds
  useEffect(() => {
    if (messages.length === 0) return;
    
    const timer = setTimeout(() => {
      const now = Date.now();
      setMessages(prev => prev.filter(msg => now - msg.timestamp < 5000));
    }, 5000);

    return () => clearTimeout(timer);
  }, [messages]);

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
