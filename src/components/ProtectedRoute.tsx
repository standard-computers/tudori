import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useRouteAccess } from '@/hooks/use-route-access';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wrapper component that checks transaction access for the current route
 * Shows loading state while checking, redirects to dashboard if access denied
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { checking, hasAccess } = useRouteAccess(location.pathname);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return null; // Will redirect via the hook
  }

  return <>{children}</>;
};
