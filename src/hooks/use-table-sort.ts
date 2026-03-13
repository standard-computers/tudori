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
  values: string[];        // multiple values — each is OR'd
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

  const [filters, setFiltersState] = useState<Record<string, ColumnFilterConfig>>({});

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      if (current.direction === 'desc') return { key: '', direction: null };
      return { key, direction: 'asc' };
    });
  };

  /** Set a structured filter */
  const setFilter = (key: string, valueOrConfig: string | ColumnFilterConfig) => {
    setFiltersState((current) => {
      if (typeof valueOrConfig === 'string') {
        // Legacy: treat plain string as "contains" single value
        if (!valueOrConfig) {
          const next = { ...current };
          delete next[key];
          return next;
        }
        return {
          ...current,
          [key]: { values: [valueOrConfig], condition: 'contains' },
        };
      }
      if (!valueOrConfig.values.length) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: valueOrConfig };
    });
  };

  const clearFilter = (key: string) => {
    setFiltersState((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const clearAllFilters = () => setFiltersState({});

  /** Evaluate a single cell value against a filter config */
  const matchesFilter = (rawValue: any, config: ColumnFilterConfig): boolean => {
    const { condition, values } = config;

    // Null-check conditions
    if (condition === 'is_empty') {
      return rawValue === null || rawValue === undefined || String(rawValue).trim() === '';
    }
    if (condition === 'is_not_empty') {
      return rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '';
    }

    // If no values provided, skip filter
    if (!values.length || values.every((v) => v.trim() === '')) return true;

    const cellStr = rawValue === null || rawValue === undefined ? '' : String(rawValue).toLowerCase();
    const cellNum = parseFloat(cellStr);

    // Multi-value: each non-empty filter term is OR'd
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
          case 'gt':           return !isNaN(cellNum) && !isNaN(termNum) && cellNum > termNum;
          case 'gte':          return !isNaN(cellNum) && !isNaN(termNum) && cellNum >= termNum;
          case 'lt':           return !isNaN(cellNum) && !isNaN(termNum) && cellNum < termNum;
          case 'lte':          return !isNaN(cellNum) && !isNaN(termNum) && cellNum <= termNum;
          default:             return cellStr.includes(term);
        }
      });
  };

  const sortedAndFilteredData = useMemo(() => {
    let result = [...data];

    // Apply filters
    Object.entries(filters).forEach(([key, config]) => {
      result = result.filter((item) => {
        const itemValue = getNestedValue(item, key);
        return matchesFilter(itemValue, config);
      });
    });

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        return sortConfig.direction === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [data, sortConfig, filters]);

  return {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearFilter,
    clearAllFilters,
    sortedAndFilteredData,
  };
}

// Helper to get nested object values like "vendor.name"
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}
