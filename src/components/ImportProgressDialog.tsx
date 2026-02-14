import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ImportResult {
  row: number;
  status: 'success' | 'error';
  message: string;
}

interface ImportProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  totalRows: number;
  processedRows: number;
  results: ImportResult[];
  isComplete: boolean;
}

export const ImportProgressDialog = ({
  open,
  onOpenChange,
  title,
  totalRows,
  processedRows,
  results,
  isComplete,
}: ImportProgressDialogProps) => {
  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const progress = totalRows > 0 ? (processedRows / totalRows) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={isComplete ? onOpenChange : undefined}>
      <DialogContent draggable={false} className="sm:max-w-md" onPointerDownOutside={(e) => !isComplete && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isComplete ? 'Complete' : 'Processing...'}
              </span>
              <span className="font-mono text-muted-foreground">
                {processedRows} / {totalRows}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{successCount} succeeded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-destructive" />
              <span>{errorCount} failed</span>
            </div>
            {!isComplete && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {results.length > 0 && (
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1 text-xs font-mono">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-2 py-1 rounded ${
                      r.status === 'error' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {r.status === 'success' ? (
                      <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    )}
                    <span>Row {r.row}: {r.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {isComplete && (
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
