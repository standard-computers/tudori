// Global status bar message bridge
// This allows toast calls to route messages to the status bar
// without requiring React context access

type StatusMessageHandler = (text: string, type: 'success' | 'error' | 'info') => void;

let statusBarHandler: StatusMessageHandler | null = null;

export function registerStatusBarHandler(handler: StatusMessageHandler) {
  statusBarHandler = handler;
}

export function unregisterStatusBarHandler() {
  statusBarHandler = null;
}

// Drop-in replacement for sonner's toast that routes to the status bar
export const toast = {
  success: (message: string) => {
    if (statusBarHandler) statusBarHandler(message, 'success');
  },
  error: (message: string) => {
    if (statusBarHandler) statusBarHandler(message, 'error');
  },
  info: (message: string) => {
    if (statusBarHandler) statusBarHandler(message, 'info');
  },
  message: (message: string) => {
    if (statusBarHandler) statusBarHandler(message, 'info');
  },
  warning: (message: string) => {
    if (statusBarHandler) statusBarHandler(message, 'error');
  },
};
