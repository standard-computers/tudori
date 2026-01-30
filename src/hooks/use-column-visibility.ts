import { useState, useCallback, useEffect } from 'react';

export interface ColumnDefinition {
  key: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean; // For columns that can't be hidden (like actions)
}

export interface ColumnVisibilityState {
  [key: string]: boolean;
}

const STORAGE_PREFIX = 'column_visibility_';

export function useColumnVisibility(
  storageKey: string,
  columns: ColumnDefinition[]
) {
  // Initialize state from localStorage or defaults
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibilityState>(() => {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Invalid JSON, use defaults
      }
    }
    
    // Build default visibility state
    const defaults: ColumnVisibilityState = {};
    columns.forEach((col) => {
      defaults[col.key] = col.defaultVisible !== false;
    });
    return defaults;
  });

  // Persist to localStorage whenever visibility changes
  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_PREFIX}${storageKey}`,
      JSON.stringify(visibleColumns)
    );
  }, [storageKey, visibleColumns]);

  const isColumnVisible = useCallback(
    (key: string) => {
      const column = columns.find((c) => c.key === key);
      // Always visible columns are always shown
      if (column?.alwaysVisible) return true;
      return visibleColumns[key] !== false;
    },
    [columns, visibleColumns]
  );

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const setColumnVisible = useCallback((key: string, visible: boolean) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: visible,
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults: ColumnVisibilityState = {};
    columns.forEach((col) => {
      defaults[col.key] = col.defaultVisible !== false;
    });
    setVisibleColumns(defaults);
  }, [columns]);

  const showAll = useCallback(() => {
    const all: ColumnVisibilityState = {};
    columns.forEach((col) => {
      all[col.key] = true;
    });
    setVisibleColumns(all);
  }, [columns]);

  const hideAll = useCallback(() => {
    const none: ColumnVisibilityState = {};
    columns.forEach((col) => {
      // Keep always visible columns visible
      none[col.key] = col.alwaysVisible || false;
    });
    setVisibleColumns(none);
  }, [columns]);

  // Get toggleable columns (exclude always visible)
  const toggleableColumns = columns.filter((col) => !col.alwaysVisible);

  return {
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    setColumnVisible,
    resetToDefaults,
    showAll,
    hideAll,
    toggleableColumns,
  };
}
