import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColumnDefinition } from '@/hooks/use-column-visibility';

interface ColumnToggleProps {
  columns: ColumnDefinition[];
  visibleColumns: { [key: string]: boolean };
  onToggleColumn: (key: string) => void;
  onResetToDefaults: () => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function ColumnToggle({
  columns,
  visibleColumns,
  onToggleColumn,
  onResetToDefaults,
  onShowAll,
  onHideAll,
}: ColumnToggleProps) {
  // Filter out always visible columns
  const toggleableColumns = columns.filter((col) => !col.alwaysVisible);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Columns3 className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={onShowAll}
          >
            Show All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={onHideAll}
          >
            Hide All
          </Button>
        </div>
        
        <DropdownMenuSeparator />
        
        <div className="p-2 space-y-2">
          {toggleableColumns.map((column) => (
            <label
              key={column.key}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
            >
              <Checkbox
                checked={visibleColumns[column.key] !== false}
                onCheckedChange={() => onToggleColumn(column.key)}
              />
              <span className="text-sm">{column.label}</span>
            </label>
          ))}
        </div>
        
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs w-full"
            onClick={onResetToDefaults}
          >
            Reset to Defaults
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
