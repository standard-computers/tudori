import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

// Transaction code to route mapping
const TRANSACTION_ROUTES: Record<string, string> = {
  // Main list views
  'vend': '/vendors',
  'prod': '/products',
  'cust': '/customers',
  'so': '/sales-orders',
  'ord': '/orders',
  'req': '/requisitions',
  'del': '/deliveries',
  'inv': '/inventory',
  'acc': '/accounts',
  'ldgr': '/ledgers',
  'loc': '/locations',
  'gr': '/goods-receipts',
  'gi': '/goods-issues',
  'cm': '/credit-memos',
  'dm': '/debit-memos',
  'task': '/tasks',
  'rate': '/rates',
  'user': '/users',
  
  // System views
  'cpit': '/cockpit',
  'dash': '/dashboard',
  'uset': '/user-settings',
  'config': '/configuration',
  'set': '/settings',
  'auth': '/auth',
  
  // Sub-views (these will navigate to base and won't trigger actions)
  'vend/new': '/vendors',
  'vend/edit': '/vendors',
  'prod/new': '/products',
  'prod/edit': '/products',
  'cust/new': '/customers',
  'cust/edit': '/customers',
  'so/new': '/sales-orders',
  'so/view': '/sales-orders',
  'ord/new': '/orders',
  'ord/view': '/orders',
  'req/new': '/requisitions',
  'req/view': '/requisitions',
  'req/run': '/requisitions',
  'del/new': '/deliveries',
  'del/edit': '/deliveries',
  'inv/new': '/invoices',
  'inv/view': '/invoices',
  'acc/new': '/accounts',
  'acc/edit': '/accounts',
  'acc/view': '/accounts',
  'ldgr/new': '/ledgers',
  'ldgr/edit': '/ledgers',
  'ldgr/view': '/ledgers',
  'loc/new': '/locations',
  'loc/edit': '/locations',
  'gr/new': '/goods-receipts',
  'gr/edit': '/goods-receipts',
  'gi/new': '/goods-issues',
  'gi/edit': '/goods-issues',
  'cm/new': '/credit-memos',
  'cm/view': '/credit-memos',
  'dm/new': '/debit-memos',
  'dm/view': '/debit-memos',
  
  // Config tabs
  'config/ids': '/configuration',
  'config/controls': '/configuration',
  
  // Settings tabs
  'set/company': '/settings',
  'set/team': '/settings',
};

export function StatusBar() {
  const navigate = useNavigate();
  const { transaction, isLoading, loadingText, messages, addMessage } = useStatusBar();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const latestMessage = messages[messages.length - 1];

  // Focus input when popover opens
  useEffect(() => {
    if (isPopoverOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isPopoverOpen]);

  const handleNavigate = () => {
    const code = inputValue.trim().toLowerCase();
    
    if (!code) {
      setIsPopoverOpen(false);
      return;
    }

    const route = TRANSACTION_ROUTES[code];
    
    if (route) {
      navigate(route);
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
                placeholder="e.g., vend, so, gr"
                className="h-8 text-sm font-mono"
              />
              <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                <span className="px-1.5 py-0.5 bg-muted rounded">vend</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">prod</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">so</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">ord</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">gr</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">gi</span>
                <span className="px-1.5 py-0.5 bg-muted rounded">inv</span>
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