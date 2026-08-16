import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export interface PostProgressStep {
  label: string;
  detail?: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message?: string;
}

interface PostProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  steps: PostProgressStep[];
  isComplete: boolean;
}

const PostProgressDialog = ({
  open,
  onOpenChange,
  title = 'Posting Physical Inventory',
  description,
  steps,
  isComplete,
}: PostProgressDialogProps) => {
  const total = steps.length;
  const done = steps.filter((s) => s.status === 'success' || s.status === 'error' || s.status === 'skipped').length;
  const successCount = steps.filter((s) => s.status === 'success').length;
  const errorCount = steps.filter((s) => s.status === 'error').length;
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || (isComplete ? 'Posting complete' : 'Posting adjustments to inventory')}
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
              <span>{successCount} done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-destructive" />
              <span>{errorCount} failed</span>
            </div>
            {!isComplete && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
          </div>

          {steps.length > 0 && (
            <ScrollArea className="h-56 border rounded-md">
              <div className="p-2 space-y-1 text-xs">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded ${
                      step.status === 'error' ? 'bg-destructive/10 text-destructive' : ''
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {step.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : step.status === 'error' ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : step.status === 'running' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      ) : (
                        <span className="block w-3.5 h-3.5 rounded-full border border-muted-foreground/40" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{step.label}</span>
                        {step.detail && <span className="text-muted-foreground font-mono truncate">{step.detail}</span>}
                      </div>
                      {(step.message || step.status === 'skipped') && (
                        <div className="text-muted-foreground font-mono">
                          {step.message || 'Skipped'}
                        </div>
                      )}
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

export default PostProgressDialog;
