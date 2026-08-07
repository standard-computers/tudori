import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

export interface MoveProgressItem {
  label: string;
  detail?: string;
  from?: string;
  to?: string;
  status: 'pending' | 'moving' | 'success' | 'error';
  message?: string;
}

interface MoveProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetBin: string;
  items: MoveProgressItem[];
  isComplete: boolean;
}

const MoveProgressDialog = ({ open, onOpenChange, targetBin, items, isComplete }: MoveProgressDialogProps) => {
  const total = items.length;
  const done = items.filter(i => i.status === 'success' || i.status === 'error').length;
  const successCount = items.filter(i => i.status === 'success').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={isComplete ? onOpenChange : undefined}>
      <DialogContent
        draggable={false}
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => !isComplete && e.preventDefault()}
        onEscapeKeyDown={(e) => !isComplete && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Moving Items</DialogTitle>
          <DialogDescription>
            {isComplete ? 'Move complete' : 'Moving selected inventory'} to bin {targetBin}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{isComplete ? 'Complete' : 'Processing...'}</span>
              <span className="font-mono text-muted-foreground">{done} / {total}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{successCount} moved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-destructive" />
              <span>{errorCount} failed</span>
            </div>
            {!isComplete && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
          </div>

          {items.length > 0 && (
            <ScrollArea className="h-56 border rounded-md">
              <div className="p-2 space-y-1 text-xs">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded ${
                      item.status === 'error' ? 'bg-destructive/10 text-destructive' : ''
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {item.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : item.status === 'error' ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : item.status === 'moving' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      ) : (
                        <span className="block w-3.5 h-3.5 rounded-full border border-muted-foreground/40" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="truncate">{item.label}</span>
                        {item.detail && <span className="text-muted-foreground truncate">{item.detail}</span>}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground font-mono">
                        <span>{item.from || 'Unbinned'}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>{item.to}</span>
                        {item.message && <span className="ml-2">— {item.message}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {isComplete && (
          <DialogFooter className="px-6 pb-6">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MoveProgressDialog;
