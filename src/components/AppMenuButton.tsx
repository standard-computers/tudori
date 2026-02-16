import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useAppMenuPreference } from '@/hooks/use-app-menu-preference';
import { useTransactionAccess } from '@/hooks/use-transaction-access';
import { supabase } from '@/integrations/supabase/client';
import { defaultApps, AppTile } from '@/config/apps';
import { APP_NAME_TO_CODE } from '@/config/transaction-codes';

// Pages where the app menu should NOT appear
const EXCLUDED_PATHS = ['/', '/auth', '/complete-profile', '/dashboard'];

export function AppMenuButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const showAppMenu = useAppMenuPreference();
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<AppTile[]>(defaultApps);
  const [hiddenTiles, setHiddenTiles] = useState<Set<string>>(new Set());
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);

  const { hasAccess } = useTransactionAccess(companyId);

  useEffect(() => {
    if (!user || loaded) return;
    
    const load = async () => {
      const [{ data: profile }, { data: prefs }] = await Promise.all([
        supabase.from('profiles').select('company_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_preferences').select('dashboard_tile_order, hidden_tiles').eq('user_id', user.id).maybeSingle(),
      ]);

      if (profile?.company_id) setCompanyId(profile.company_id);
      
      const hidden = new Set((prefs?.hidden_tiles as string[]) || []);
      setHiddenTiles(hidden);

      if (prefs?.dashboard_tile_order) {
        const ordered = prefs.dashboard_tile_order
          .map((name: string) => defaultApps.find(a => a.name === name))
          .filter(Boolean) as AppTile[];
        const savedNames = new Set(prefs.dashboard_tile_order);
        const newApps = defaultApps.filter(a => !savedNames.has(a.name));
        setApps([...ordered, ...newApps]);
      }
      setLoaded(true);
    };
    load();
  }, [user, loaded]);

  const isVisible = !!user && showAppMenu && !EXCLUDED_PATHS.includes(location.pathname);

  // Set a data attribute on <html> so headers can add padding via CSS
  useEffect(() => {
    document.documentElement.setAttribute('data-app-menu', isVisible ? 'true' : 'false');
    return () => document.documentElement.removeAttribute('data-app-menu');
  }, [isVisible]);

  if (!isVisible) return null;

  const visibleApps = apps.filter(app => {
    if (hiddenTiles.has(app.name)) return false;
    const code = APP_NAME_TO_CODE[app.name];
    if (code && !hasAccess(code)) return false;
    return true;
  });

  return (
    <div className="fixed top-2.5 right-4 z-40">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10 bg-card border shadow-sm hover:bg-accent">
            <LayoutGrid className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-1">
            {visibleApps.map(app => {
              const Icon = app.icon;
              const isActive = app.path === location.pathname;
              return (
                <button
                  key={app.name}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors text-center ${
                    isActive ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                  }`}
                  onClick={() => {
                    if (app.path) navigate(app.path);
                    setOpen(false);
                  }}
                >
                  <Icon className={`w-6 h-6 ${app.color}`} />
                  <span className="text-xs text-foreground leading-tight truncate w-full">{app.name}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
