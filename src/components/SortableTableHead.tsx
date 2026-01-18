import { ArrowUp, ArrowDown, ArrowUpDown, Filter, X } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SortDirection } from '@/hooks/use-table-sort';

interface SortableTableHeadProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  currentSortDirection: SortDirection;
  onSort: (key: string) => void;
  filterValue?: string;
  onFilter?: (value: string) => void;
  className?: string;
  filterable?: boolean;
}

export function SortableTableHead({
  label,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  filterValue = '',
  onFilter,
  className,
  filterable = true,
}: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey;
  const hasFilter = filterValue && filterValue.length > 0;

  const getSortIcon = () => {
    if (!isActive || !currentSortDirection) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />;
    }
    if (currentSortDirection === 'asc') {
      return <ArrowUp className="w-3.5 h-3.5 text-primary" />;
    }
    return <ArrowDown className="w-3.5 h-3.5 text-primary" />;
  };

  return (
    <TableHead className={cn('group', className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn(
            'flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded',
            isActive && currentSortDirection ? 'text-foreground font-medium' : 'text-muted-foreground'
          )}
        >
          {label}
          {getSortIcon()}
        </button>
        
        {filterable && onFilter && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity',
                  hasFilter && 'opacity-100 text-primary'
                )}
              >
                <Filter className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="flex items-center gap-1">
                <Input
                  placeholder={`Filter ${label.toLowerCase()}...`}
                  value={filterValue}
                  onChange={(e) => onFilter(e.target.value)}
                  className="h-8 text-sm"
                />
                {hasFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => onFilter('')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TableHead>
  );
}
