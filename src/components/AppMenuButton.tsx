import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [apps, setApps] = useState<AppTile[]>(defaultApps);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
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

  // CTRL+. shortcut to toggle the app menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    if (isVisible) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [isVisible]);

  // Focus search input & clear search when popover opens/closes
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  if (!isVisible) return null;

  const visibleApps = apps.filter(app => {
    if (app.name === 'Logout') return false; // handled separately
    if (hiddenTiles.has(app.name)) return false;
    const code = APP_NAME_TO_CODE[app.name];
    if (code && !hasAccess(code)) return false;
    if (search && !app.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const logoutApp = defaultApps.find(a => a.name === 'Logout')!;
  const showLogout = !search || 'logout'.includes(search.toLowerCase());

  const handleAppClick = (app: AppTile) => {
    if (app.name === 'Logout') {
      setOpen(false);
      setLogoutConfirmOpen(true);
      return;
    }
    if (app.path) navigate(app.path);
    setOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const renderTile = (app: AppTile) => {
    const Icon = app.icon;
    const isActive = app.path === location.pathname;
    return (
      <button
        key={app.name}
        className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors text-center ${
          isActive ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
        }`}
        onClick={() => handleAppClick(app)}
      >
        <Icon className={`w-6 h-6 ${app.color}`} />
        <span className="text-xs text-foreground leading-tight truncate w-full">{app.name}</span>
      </button>
    );
  };

  return (
    <>
      <div className="fixed top-2.5 right-4 z-[51]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 bg-card border shadow-sm hover:bg-accent">
              <LayoutGrid className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2 max-h-[70vh] overflow-y-auto">
            <Input
              ref={searchRef}
              placeholder="Search apps..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mb-2 h-8 text-sm"
            />
            <div className="grid grid-cols-3 gap-1">
              {visibleApps.map(renderTile)}
              {showLogout && renderTile(logoutApp)}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to log out?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
