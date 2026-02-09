import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Loader2, Database } from 'lucide-react';

export interface QueryField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'number';
}

interface AppLoadQueryDialogProps {
  open: boolean;
  onClose: () => void;
  onQuery: (filters: Record<string, string>) => void;
  onLoadAll: () => void;
  fields: QueryField[];
  title: string;
  loading?: boolean;
}

export function AppLoadQueryDialog({
  open,
  onClose,
  onQuery,
  onLoadAll,
  fields,
  title,
  loading = false,
}: AppLoadQueryDialogProps) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v.trim() !== '')
    );
    onQuery(activeFilters);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const hasFilters = Object.values(filters).some(v => v.trim() !== '');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" draggable={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Enter search criteria to load records, or load all data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-3">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={`query-${field.key}`} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`query-${field.key}`}
                  type={field.type || 'text'}
                  placeholder={field.placeholder || `Search by ${field.label.toLowerCase()}...`}
                  value={filters[field.key] || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className="h-9"
                />
              </div>
            ))}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onLoadAll}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Load All
            </Button>
            <Button type="submit" disabled={loading || !hasFilters}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
