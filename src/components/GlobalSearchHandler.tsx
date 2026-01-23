import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSearch } from '@/contexts/SearchContext';

// Pages where F1 back navigation should work (list views)
const LIST_VIEW_ROUTES = [
  '/vendors',
  '/customers',
  '/products',
  '/orders',
  '/sales-orders',
  '/requisitions',
  '/deliveries',
  '/locations',
  '/ledgers',
  '/rates',
  '/users',
  '/cockpit',
  '/settings',
  '/user-settings',
  '/configuration',
  '/inventory',
  '/invoices',
  '/tasks',
  '/accounts',
  '/goods-receipts',
  '/goods-issues',
  '/credit-memos',
  '/debit-memos',
];

/**
 * Component that registers global keyboard shortcuts:
 * - CTRL+K: Open search
 * - F1: Go back (in list view transactions)
 * Must be rendered inside SearchProvider and Router
 */
export function GlobalSearchHandler() {
  const { toggleSearch } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CTRL+K or CMD+K: Toggle search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
        return;
      }

      // F1: Go back (only in list view transactions)
      if (e.key === 'F1') {
        e.preventDefault();
        const isListView = LIST_VIEW_ROUTES.some(route => location.pathname === route);
        if (isListView) {
          navigate('/dashboard');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearch, navigate, location.pathname]);

  return null;
}
