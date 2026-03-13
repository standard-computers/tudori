import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export type FilterCondition =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export interface ColumnFilterConfig {
  values: string[];
  condition: FilterCondition;
}

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/** Legacy single-string filter shape kept for any external consumers */
export interface ColumnFilter {
  key: string;
  value: string;
}

export function useTableSort<T extends Record<string, any>>(
  data: T[],
  defaultSortKey?: string,
  defaultSortDirection: SortDirection = 'asc'
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultSortKey || '',
    direction: defaultSortKey ? defaultSortDirection : null,
  });

  // Internal advanced filter state
  const [filterConfigs, setFilterConfigs] = useState<Record<string, ColumnFilterConfig>>({});

  // Legacy string filter state — kept so existing callers that read filters[key] as string still work
  const [legacyFilters, setLegacyFilters] = useState<Record<string, string>>({});

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      if (current.direction === 'desc') return { key: '', direction: null };
      return { key, direction: 'asc' };
    });
  };

  /**
   * Legacy-compatible setFilter.
   * Accepts a plain string (treated as "contains" single-value) or a full ColumnFilterConfig.
   */
  const setFilter = (key: string, valueOrConfig: string | ColumnFilterConfig) => {
    if (typeof valueOrConfig === 'string') {
      // Legacy string path
      setLegacyFilters((prev) => {
        if (!valueOrConfig) { const n = { ...prev }; delete n[key]; return n; }
        return { ...prev, [key]: valueOrConfig };
      });
      setFilterConfigs((prev) => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      // Advanced config path
      setFilterConfigs((prev) => {
        const hasValues = valueOrConfig.values.filter((v) => v.trim()).length > 0;
        const isPresenceCheck = valueOrConfig.condition === 'is_empty' || valueOrConfig.condition === 'is_not_empty';
        if (!hasValues && !isPresenceCheck) {
          const n = { ...prev }; delete n[key]; return n;
        }
        return { ...prev, [key]: valueOrConfig };
      });
      setLegacyFilters((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const clearFilter = (key: string) => {
    setLegacyFilters((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setFilterConfigs((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const clearAllFilters = () => {
    setLegacyFilters({});
    setFilterConfigs({});
  };

  /** Get the ColumnFilterConfig for a key (if set via advanced path) */
  const getFilterConfig = (key: string): ColumnFilterConfig | undefined => filterConfigs[key];

  /** Evaluate a single cell value against a filter config */
  const matchesAdvancedFilter = (rawValue: any, config: ColumnFilterConfig): boolean => {
    const { condition, values } = config;

    if (condition === 'is_empty')
      return rawValue === null || rawValue === undefined || String(rawValue).trim() === '';
    if (condition === 'is_not_empty')
      return rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '';

    if (!values.length || values.every((v) => v.trim() === '')) return true;

    const cellStr = rawValue === null || rawValue === undefined ? '' : String(rawValue).toLowerCase();
    const cellNum = parseFloat(cellStr);

    return values
      .filter((v) => v.trim() !== '')
      .some((v) => {
        const term = v.toLowerCase().trim();
        const termNum = parseFloat(term);
        switch (condition) {
          case 'contains':     return cellStr.includes(term);
          case 'not_contains': return !cellStr.includes(term);
          case 'equals':       return cellStr === term;
          case 'not_equals':   return cellStr !== term;
          case 'starts_with':  return cellStr.startsWith(term);
          case 'ends_with':    return cellStr.endsWith(term);
          case 'gt':  return !isNaN(cellNum) && !isNaN(termNum) && cellNum > termNum;
          case 'gte': return !isNaN(cellNum) && !isNaN(termNum) && cellNum >= termNum;
          case 'lt':  return !isNaN(cellNum) && !isNaN(termNum) && cellNum < termNum;
          case 'lte': return !isNaN(cellNum) && !isNaN(termNum) && cellNum <= termNum;
          default:    return cellStr.includes(term);
        }
      });
  };

  const sortedAndFilteredData = useMemo(() => {
    let result = [...data];

    // Apply legacy string filters
    Object.entries(legacyFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter((item) => {
          const itemValue = getNestedValue(item, key);
          if (itemValue === null || itemValue === undefined)
            return value.toLowerCase() === '-' || value === '';
          return String(itemValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    // Apply advanced filter configs
    Object.entries(filterConfigs).forEach(([key, config]) => {
      result = result.filter((item) => matchesAdvancedFilter(getNestedValue(item, key), config));
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);
        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
        if (typeof aValue === 'number' && typeof bValue === 'number')
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [data, sortConfig, legacyFilters, filterConfigs]);

  return {
    sortConfig,
    /** Legacy string filters — used by existing callers reading filters[key] as string */
    filters: legacyFilters,
    /** Advanced filter configs — used by new SortableTableHead advanced UI */
    filterConfigs,
    handleSort,
    setFilter,
    clearFilter,
    clearAllFilters,
    getFilterConfig,
    sortedAndFilteredData,
  };
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}
