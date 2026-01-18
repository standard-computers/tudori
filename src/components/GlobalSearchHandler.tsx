import { useEffect } from 'react';
import { useSearch } from '@/contexts/SearchContext';

/**
 * Component that registers the global CTRL+K shortcut for search
 * Must be rendered inside SearchProvider
 */
export function GlobalSearchHandler() {
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

  return null;
}
