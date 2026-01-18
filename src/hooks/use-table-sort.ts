import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

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
  
  const [filters, setFilters] = useState<Record<string, string>>({});

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      if (current.direction === 'desc') {
        return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const setFilter = (key: string, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearFilter = (key: string) => {
    setFilters((current) => {
      const newFilters = { ...current };
      delete newFilters[key];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const sortedAndFilteredData = useMemo(() => {
    let result = [...data];

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter((item) => {
          const itemValue = getNestedValue(item, key);
          if (itemValue === null || itemValue === undefined) {
            return value.toLowerCase() === '-' || value === '';
          }
          return String(itemValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        // Compare values
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const aString = String(aValue).toLowerCase();
        const bString = String(bValue).toLowerCase();
        
        if (sortConfig.direction === 'asc') {
          return aString.localeCompare(bString);
        }
        return bString.localeCompare(aString);
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
