import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { defaultApps } from '@/config/apps';

const APP_NAME = 'Operand';

export function usePageTitle() {
  const location = useLocation();

  useEffect(() => {
    const app = defaultApps.find(a => a.path && location.pathname.startsWith(a.path));
    document.title = app ? `${app.name} – ${APP_NAME}` : APP_NAME;
  }, [location.pathname]);
}
