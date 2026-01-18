import { useEffect } from 'react';
import { useSearch } from '@/contexts/SearchContext';

/**
 * Hook that registers the global CTRL+K shortcut for search
 * Should be used once at the app root level
 */
export function useGlobalSearch() {
  const { toggleSearch } = useSearch();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearch]);
}
