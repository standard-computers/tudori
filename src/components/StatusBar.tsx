import { useStatusBar } from '@/contexts/StatusBarContext';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function StatusBar() {
  const { transaction, isLoading, loadingText, messages } = useStatusBar();

  const latestMessage = messages[messages.length - 1];

  const getMessageIcon = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-destructive" />;
      default:
        return <Info className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const getMessageColor = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-7 bg-card/95 backdrop-blur-sm border-t border-border z-50 flex items-center px-4 text-xs font-mono">
      {/* Left: Transaction name */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        {transaction && (
          <span className="text-muted-foreground font-medium truncate">
            {transaction}
          </span>
        )}
      </div>

      {/* Center: Loading indicator */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{loadingText}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Animated messages */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0 max-w-[40%] overflow-hidden">
        <AnimatePresence mode="wait">
          {latestMessage && (
            <motion.div
              key={latestMessage.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center gap-1.5 truncate',
                getMessageColor(latestMessage.type)
              )}
            >
              {getMessageIcon(latestMessage.type)}
              <span className="truncate">{latestMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
