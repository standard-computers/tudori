import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CopyFromIdDialogProps<T> {
  onFetch: (id: string) => Promise<T | null>;
  onApply: (data: T) => void;
  idLabel?: string;
  disabled?: boolean;
}

export function CopyFromIdDialog<T>({
  onFetch,
  onApply,
  idLabel = 'ID',
  disabled = false,
}: CopyFromIdDialogProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyId, setCopyId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    if (!copyId.trim()) {
      toast.error(`Please enter a ${idLabel}`);
      return;
    }

    setIsLoading(true);
    try {
      const data = await onFetch(copyId.trim());
      if (data) {
        onApply(data);
        toast.success('Data copied to form');
        setIsOpen(false);
        setCopyId('');
      } else {
        toast.error(`No record found with ${idLabel}: ${copyId}`);
      }
    } catch (error) {
      toast.error('Failed to fetch record');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCopy();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          title="Copy from existing"
        >
          <Copy className="h-4 w-4" />
          <span className="sr-only">Copy from existing</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="copy-id" className="text-sm font-medium">
              Copy from {idLabel}
            </Label>
            <p className="text-xs text-muted-foreground">
              Enter the {idLabel} of an existing record to copy its data
            </p>
          </div>
          <Input
            id="copy-id"
            value={copyId}
            onChange={(e) => setCopyId(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Enter ${idLabel}...`}
            disabled={isLoading}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={handleCopy}
            disabled={isLoading || !copyId.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Data
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
