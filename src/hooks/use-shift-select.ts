import { useRef, useCallback } from 'react';

/**
 * Hook that enables shift+click multi-select in tables.
 * 
 * Usage:
 *   const { handleRowSelect } = useShiftSelect(orderedIds, selectedIds, setSelectedIds);
 *   // In checkbox: onCheckedChange={(checked) => handleRowSelect(id, !!checked, event)}
 *   // Wrap checkbox in onClick handler to capture the native event for shift detection.
 */
export function useShiftSelect<T extends string>(
  orderedIds: T[],
  selectedIds: Set<T>,
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<T>>> | ((next: Set<T>) => void),
) {
  const lastSelectedIndex = useRef<number | null>(null);

  const handleRowSelect = useCallback(
    (id: T, checked: boolean, shiftKey: boolean) => {
      const currentIndex = orderedIds.indexOf(id);

      if (shiftKey && lastSelectedIndex.current !== null && checked) {
        // Range select
        const start = Math.min(lastSelectedIndex.current, currentIndex);
        const end = Math.max(lastSelectedIndex.current, currentIndex);
        const rangeIds = orderedIds.slice(start, end + 1);

        const next = new Set(selectedIds);
        for (const rid of rangeIds) {
          next.add(rid);
        }
        setSelectedIds(next);
      } else {
        // Normal single toggle
        const next = new Set(selectedIds);
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
        setSelectedIds(next);
      }

      if (checked) {
        lastSelectedIndex.current = currentIndex;
      }
    },
    [orderedIds, selectedIds, setSelectedIds],
  );

  return { handleRowSelect };
}
