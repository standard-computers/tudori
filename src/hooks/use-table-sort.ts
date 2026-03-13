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

  const [filters, setFiltersState] = useState<Record<string, ColumnFilterConfig>>({});

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
    setFiltersState((current) => {
      if (typeof valueOrConfig === 'string') {
        if (!valueOrConfig) {
          const next = { ...current };
          delete next[key];
          return next;
        }
        return { ...current, [key]: { values: [valueOrConfig], condition: 'contains' as FilterCondition } };
      }
      if (!valueOrConfig.values.filter((v) => v.trim()).length && valueOrConfig.condition !== 'is_empty' && valueOrConfig.condition !== 'is_not_empty') {
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

  /**
   * Returns a legacy-compatible string value for a filter key.
   * Used by existing callers that pass filters[key] as a string to filterValue prop.
   */
  const getFilterValue = (key: string): string => {
    const cfg = filters[key];
    if (!cfg) return '';
    if (cfg.condition === 'is_empty') return '__is_empty__';
    if (cfg.condition === 'is_not_empty') return '__is_not_empty__';
    return cfg.values[0] ?? '';
  };

  /** Evaluate a single cell value against a filter config */
  const matchesFilter = (rawValue: any, config: ColumnFilterConfig): boolean => {
    const { condition, values } = config;

    if (condition === 'is_empty') {
      return rawValue === null || rawValue === undefined || String(rawValue).trim() === '';
    }
    if (condition === 'is_not_empty') {
      return rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '';
    }

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

    Object.entries(filters).forEach(([key, config]) => {
      result = result.filter((item) => {
        const itemValue = getNestedValue(item, key);
        return matchesFilter(itemValue, config);
      });
    });

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
    getFilterValue,
    sortedAndFilteredData,
  };
}

// Helper to get nested object values like "vendor.name"
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}
