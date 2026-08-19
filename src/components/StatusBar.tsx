import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, Info, MessageSquare } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';

// Transaction code to route mapping
interface TransactionRoute {
  path: string;
  action?: string;
}

const TRANSACTION_ROUTES: Record<string, TransactionRoute> = {
  // Main list views
  'vend': { path: '/vendors' },
  'prod': { path: '/products' },
  'cust': { path: '/customers' },
  'so': { path: '/sales-orders' },
  'ord': { path: '/orders' },
  'req': { path: '/requisitions' },
  'del': { path: '/deliveries' },
  'inv': { path: '/inventory' },
  'invc': { path: '/invoices' },
  'acc': { path: '/accounts' },
  'ldgr': { path: '/ledgers' },
  'loc': { path: '/locations' },
  'gr': { path: '/goods-receipts' },
  'gi': { path: '/goods-issues' },
  'cm': { path: '/credit-memos' },
  'dm': { path: '/debit-memos' },
  'task': { path: '/tasks' },
  'rate': { path: '/rates' },
  'user': { path: '/users' },
  'emp': { path: '/employees' },
  'bom': { path: '/bill-of-materials' },
  'prod_ord': { path: '/production' },
  'team': { path: '/teams' },
  
  // System views
  'cpit': { path: '/cockpit' },
  'dash': { path: '/dashboard' },
  'uset': { path: '/user-settings' },
  'config': { path: '/configuration' },
  'set': { path: '/settings' },
  'auth': { path: '/auth' },
  
  // Sub-views with actions
  'vend/new': { path: '/vendors', action: 'new' },
  'prod/new': { path: '/products', action: 'new' },
  'cust/new': { path: '/customers', action: 'new' },
  'so/new': { path: '/sales-orders', action: 'new' },
  'ord/new': { path: '/orders', action: 'new' },
  'req/new': { path: '/requisitions', action: 'new' },
  'del/new': { path: '/deliveries', action: 'new' },
  'invc/new': { path: '/invoices', action: 'new' },
  'acc/new': { path: '/accounts', action: 'new' },
  'ldgr/new': { path: '/ledgers', action: 'new' },
  'loc/new': { path: '/locations', action: 'new' },
  'gr/new': { path: '/goods-receipts', action: 'new' },
  'gi/new': { path: '/goods-issues', action: 'new' },
  'cm/new': { path: '/credit-memos', action: 'new' },
  'dm/new': { path: '/debit-memos', action: 'new' },
  'emp/new': { path: '/employees', action: 'new' },
  'bom/new': { path: '/bill-of-materials', action: 'new' },
  'prod_ord/new': { path: '/production', action: 'new' },
  'team/new': { path: '/teams', action: 'new' },
  'task/new': { path: '/tasks', action: 'new' },
  'rate/new': { path: '/rates', action: 'new' },
  'user/new': { path: '/users', action: 'new' },
};

export function StatusBar() {
  const navigate = useNavigate();
  const { transaction, isLoading, loadingText, messages, visibleMessages, addMessage, clearMessages } = useStatusBar();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const latestMessage = visibleMessages[visibleMessages.length - 1];

  // Focus input when popover opens
  useEffect(() => {
    if (isPopoverOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isPopoverOpen]);

  // Ctrl+/ shortcut to open transaction input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsPopoverOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = () => {
    const code = inputValue.trim().toLowerCase();
    
    if (!code) {
      setIsPopoverOpen(false);
      return;
    }

    const route = TRANSACTION_ROUTES[code];
    
    if (route) {
      const target = route.action ? `${route.path}?action=${route.action}` : route.path;
      navigate(target);
      setIsPopoverOpen(false);
      setInputValue('');
    } else {
      addMessage(`Transaction code "${code}" not found`, 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    } else if (e.key === 'Escape') {
      setIsPopoverOpen(false);
      setInputValue('');
    }
  };

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
      {/* Left: Transaction name (clickable) */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <button 
              className="text-muted-foreground font-medium truncate hover:text-foreground transition-colors cursor-pointer"
              title="Click to navigate to a transaction code"
            >
              {transaction || '/'}
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 p-2 bg-card border border-border z-[100]" 
            align="start"
            sideOffset={8}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Enter transaction code:</p>
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., so, so/new, vend"
                className="h-8 text-sm font-mono"
              />
              <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                <span className="px-1.5 py-0.5 bg-muted rounded">so</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">so/new</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">vend</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">vend/new</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">prod</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">gr</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">gi</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">cpit</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
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

      {/* Right: Animated messages (clickable) */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0 max-w-[40%] overflow-hidden">
        <AnimatePresence mode="wait">
          {latestMessage && (
            <motion.button
              key={latestMessage.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMessageDialogOpen(true)}
              className={cn(
                'flex items-center gap-1.5 truncate cursor-pointer hover:opacity-80 transition-opacity',
                getMessageColor(latestMessage.type)
              )}
              title="Click to view full message"
            >
              {getMessageIcon(latestMessage.type)}
              <span className="truncate">{latestMessage.text}</span>
            </motion.button>
          )}
        </AnimatePresence>
        <button
          onClick={() => setIsMessageDialogOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="View message history"
        >
          <MessageSquare className="w-3 h-3" />
        </button>
      </div>

      {/* Message history dialog */}
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Message Log</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[60vh] overflow-y-auto px-0">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
            ) : (
              <div className="space-y-2 p-4">
                {[...messages].reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-start gap-2.5 p-2.5 rounded-md border text-sm',
                      msg.type === 'success' && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                      msg.type === 'error' && 'bg-destructive/10 border-destructive/30',
                      msg.type === 'info' && 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
                    )}
                  >
                    <span className="mt-0.5 flex-shrink-0">{getMessageIcon(msg.type)}</span>
                    <span className={cn('break-words flex-1', getMessageColor(msg.type))}>{msg.text}</span>
                  </div>
                ))}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearMessages()}
              disabled={messages.length === 0}
            >
              Clear Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}