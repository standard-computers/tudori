import { useState, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, X, Plus } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SortDirection, FilterCondition, ColumnFilterConfig } from '@/hooks/use-table-sort';

const CONDITIONS: { value: FilterCondition; label: string }[] = [
  { value: 'contains',     label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals',       label: 'Equals' },
  { value: 'not_equals',   label: 'Not equals' },
  { value: 'starts_with',  label: 'Starts with' },
  { value: 'ends_with',    label: 'Ends with' },
  { value: 'is_empty',     label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'gt',           label: '>' },
  { value: 'gte',          label: '>=' },
  { value: 'lt',           label: '<' },
  { value: 'lte',          label: '<=' },
];

const NO_VALUE_CONDITIONS: FilterCondition[] = ['is_empty', 'is_not_empty'];

interface SortableTableHeadProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  currentSortDirection: SortDirection;
  onSort: (key: string) => void;
  // Legacy string filter API (still supported)
  filterValue?: string;
  onFilter?: (value: string) => void;
  // Advanced filter API
  filterConfig?: ColumnFilterConfig;
  onFilterConfig?: (key: string, config: ColumnFilterConfig | null) => void;
  filterKey?: string;
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
  filterConfig,
  onFilterConfig,
  filterKey,
  className,
  filterable = true,
}: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey;

  // Local state for the advanced popover
  const [condition, setCondition] = useState<FilterCondition>('contains');
  const [values, setValues] = useState<string[]>(['']);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state when external filterConfig changes
  useEffect(() => {
    if (filterConfig) {
      setCondition(filterConfig.condition);
      setValues(filterConfig.values.length ? filterConfig.values : ['']);
    } else {
      setCondition('contains');
      setValues(['']);
    }
  }, [filterConfig]);

  // Focus first input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Determine if any filter is active (legacy or advanced)
  const hasLegacyFilter = filterValue && filterValue.length > 0;
  const hasAdvancedFilter = !!filterConfig;
  const hasFilter = hasLegacyFilter || hasAdvancedFilter;

  // Which mode are we in? Advanced if onFilterConfig is provided
  const isAdvanced = !!onFilterConfig;

  const getSortIcon = () => {
    if (!isActive || !currentSortDirection)
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />;
    if (currentSortDirection === 'asc')
      return <ArrowUp className="w-3.5 h-3.5 text-primary" />;
    return <ArrowDown className="w-3.5 h-3.5 text-primary" />;
  };

  const handleApply = () => {
    if (!onFilterConfig || !filterKey) return;
    const noValue = NO_VALUE_CONDITIONS.includes(condition);
    const filteredValues = noValue ? [] : values.filter((v) => v.trim() !== '');
    if (!noValue && filteredValues.length === 0) {
      onFilterConfig(filterKey, null);
    } else {
      onFilterConfig(filterKey, { condition, values: filteredValues });
    }
    setOpen(false);
  };

  const handleClear = () => {
    if (isAdvanced && onFilterConfig && filterKey) {
      onFilterConfig(filterKey, null);
      setCondition('contains');
      setValues(['']);
    } else if (onFilter) {
      onFilter('');
    }
    setOpen(false);
  };

  const addValue = () => setValues((prev) => [...prev, '']);
  const removeValue = (i: number) => setValues((prev) => prev.filter((_, idx) => idx !== i));
  const updateValue = (i: number, v: string) =>
    setValues((prev) => prev.map((val, idx) => (idx === i ? v : val)));

  const noValueCondition = NO_VALUE_CONDITIONS.includes(condition);

  // Build summary badge text for active advanced filter
  const advancedSummary = () => {
    if (!filterConfig) return '';
    const label = CONDITIONS.find((c) => c.value === filterConfig.condition)?.label ?? filterConfig.condition;
    if (noValueCondition) return label;
    const vals = filterConfig.values.slice(0, 2).join(', ');
    const extra = filterConfig.values.length > 2 ? ` +${filterConfig.values.length - 2}` : '';
    return `${label}: ${vals}${extra}`;
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

        {filterable && (onFilter || onFilterConfig) && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
                  hasFilter && 'opacity-100 text-primary'
                )}
              >
                <Filter className="w-3 h-3" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-72 p-3" align="start">
              {isAdvanced ? (
                /* ---- Advanced filter UI ---- */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Filter: {label}</span>
                    {hasAdvancedFilter && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground" onClick={handleClear}>
                        Clear
                      </Button>
                    )}
                  </div>

                  {/* Condition selector */}
                  <Select value={condition} onValueChange={(v) => setCondition(v as FilterCondition)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-sm">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value inputs */}
                  {!noValueCondition && (
                    <div className="space-y-1.5">
                      {values.map((v, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <Input
                            ref={i === 0 ? inputRef : undefined}
                            value={v}
                            onChange={(e) => updateValue(i, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleApply();
                            }}
                            placeholder={`Value ${values.length > 1 ? i + 1 : ''}`}
                            className="h-8 text-sm flex-1"
                          />
                          {values.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeValue(i)}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs w-full gap-1 text-muted-foreground"
                        onClick={addValue}
                      >
                        <Plus className="w-3 h-3" />
                        Add value (OR)
                      </Button>
                    </div>
                  )}

                  <Button size="sm" className="w-full h-8 text-sm" onClick={handleApply}>
                    Apply
                  </Button>
                </div>
              ) : (
                /* ---- Legacy simple filter UI ---- */
                <div className="flex items-center gap-1">
                  <Input
                    ref={inputRef}
                    placeholder={`Filter ${label.toLowerCase()}...`}
                    value={filterValue}
                    onChange={(e) => onFilter?.(e.target.value)}
                    className="h-8 text-sm"
                  />
                  {hasLegacyFilter && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onFilter?.('')}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Show active advanced filter as small badge */}
        {hasAdvancedFilter && (
          <Badge
            variant="secondary"
            className="text-[10px] h-4 px-1 cursor-pointer max-w-[80px] truncate"
            title={advancedSummary()}
            onClick={handleClear}
          >
            {advancedSummary()} <X className="w-2.5 h-2.5 ml-0.5 inline" />
          </Badge>
        )}
      </div>
    </TableHead>
  );
}
