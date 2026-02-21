import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAccess } from '@/hooks/use-transaction-access';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, GripVertical, Eye, EyeOff, RotateCcw, User, LayoutGrid, Loader2, Moon, Sun, MapPin, Palette } from 'lucide-react';
 import { Kbd } from '@/components/ui/kbd';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Slider } from '@/components/ui/slider';
 import { designSystems, applyDesignSystem, buildCustomDesignSystem } from '@/config/design-systems';
import { setMaximizePreferenceCache } from '@/hooks/use-maximize-preference';
import { setAppMenuPreferenceCache } from '@/hooks/use-app-menu-preference';
import { Maximize2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from '@/lib/toast';
import { defaultApps, AppTile } from '@/config/apps';
import { APP_NAME_TO_CODE } from '@/config/transaction-codes';

interface AppPreference extends AppTile {
  visible: boolean;
}

interface UserProfile {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  company_id: string | null;
}

interface SortableAppItemProps {
  app: AppPreference;
  onToggleVisibility: (name: string) => void;
}

const SortableAppItem = ({ app, onToggleVisibility }: SortableAppItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = app.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 rounded-lg border bg-card ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${!app.visible ? 'opacity-60' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="w-10 h-10 flex items-center justify-center">
        <Icon className={`w-6 h-6 ${app.color}`} />
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{app.name}</p>
        <p className="text-xs text-muted-foreground">{app.description}</p>
      </div>
      <div className="flex items-center gap-2">
        {app.visible ? (
          <Eye className="w-4 h-4 text-muted-foreground" />
        ) : (
          <EyeOff className="w-4 h-4 text-muted-foreground" />
        )}
        <Switch
          checked={app.visible}
          onCheckedChange={() => onToggleVisibility(app.name)}
        />
      </div>
    </div>
  );
};

const UserSettings = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const { theme, setTheme } = useTheme();
  const [apps, setApps] = useState<AppPreference[]>([]);
  const [saving, setSaving] = useState(false);
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [maximizeWindows, setMaximizeWindows] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ first_name: '', last_name: '', avatar_url: null, company_id: null });
  const [savingProfile, setSavingProfile] = useState(false);
  const [showAppMenu, setShowAppMenu] = useState(true);
   const [designSystem, setDesignSystem] = useState('default');
  const [customHsl, setCustomHsl] = useState({ h: 220, s: 50, l: 35 });
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [userLocations, setUserLocations] = useState<{ id: string; location_id: string; name: string }[]>([]);
  // Get transaction access for the user's company
  const { hasAccess, loading: accessLoading } = useTransactionAccess(profile.company_id || undefined);

  // Set transaction on mount
  useEffect(() => {
    setTransaction('uset');
  }, [setTransaction]);

  // Ctrl+S to save profile
  useSaveShortcut(() => {
    if (!savingProfile) {
      handleSaveProfile();
    }
  }, true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Fetch preferences after profile AND access data are loaded
  useEffect(() => {
    if (user && profile.company_id && !accessLoading) {
      fetchPreferences();
      fetchUserLocations();
    }
  }, [user, profile.company_id, accessLoading]);

  const fetchUserLocations = async () => {
    if (!user) return;
    const { data: luData } = await supabase
      .from('location_users')
      .select('location_id')
      .eq('user_id', user.id);

    if (!luData || luData.length === 0) {
      setUserLocations([]);
      return;
    }

    const locIds = luData.map(l => l.location_id);
    const { data: locs } = await supabase
      .from('locations')
      .select('id, location_id, name')
      .in('id', locIds)
      .order('location_id');

    setUserLocations(locs || []);
  };

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url, company_id')
      .eq('user_id', user!.id)
      .single();

    if (data) {
      setProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        avatar_url: data.avatar_url,
        company_id: data.company_id,
      });
    }
  };

  const fetchPreferences = async () => {
    const { data } = await supabase
      .from('user_preferences')
       .select('dashboard_tile_order, hidden_tiles, open_apps_in_new_tab, theme, design_system, maximize_windows, show_app_menu, default_location_id')
      .eq('user_id', user!.id)
      .maybeSingle();

    const hiddenTiles = new Set((data?.hidden_tiles as string[]) || []);
    setOpenInNewTab(data?.open_apps_in_new_tab || false);
    setMaximizeWindows(data?.maximize_windows || false);
    setMaximizePreferenceCache(data?.maximize_windows || false);
    setShowAppMenu(data?.show_app_menu ?? true);
    setAppMenuPreferenceCache(data?.show_app_menu ?? true);
    setDefaultLocationId(data?.default_location_id || null);
    // Apply saved theme
    if (data?.theme) {
      setTheme(data.theme);
    }
     
     // Apply saved design system
     if (data?.design_system) {
       setDesignSystem(data.design_system);
       const savedCustomHsl = (data as any).custom_primary_hsl as { h: number; s: number; l: number } | null;
       if (savedCustomHsl) setCustomHsl(savedCustomHsl);
       applyDesignSystem(data.design_system, (data.theme || 'light') as 'light' | 'dark', savedCustomHsl || undefined);
     }
    
    // Filter apps based on transaction access
    const accessibleApps = defaultApps.filter(app => {
      const code = APP_NAME_TO_CODE[app.name];
      return code ? hasAccess(code) : true;
    });
    
    if (data?.dashboard_tile_order) {
      const orderedApps = data.dashboard_tile_order
        .map((name: string) => {
          const app = accessibleApps.find(a => a.name === name);
          return app ? { ...app, visible: !hiddenTiles.has(name) } : null;
        })
        .filter(Boolean) as AppPreference[];
      
      const savedNames = new Set(data.dashboard_tile_order);
      const newApps = accessibleApps
        .filter(app => !savedNames.has(app.name))
        .map(app => ({ ...app, visible: !hiddenTiles.has(app.name) }));
      
      setApps([...orderedApps, ...newApps]);
    } else {
      setApps(accessibleApps.map(app => ({ ...app, visible: !hiddenTiles.has(app.name) })));
    }
  };

  const savePreferences = useCallback(async (newApps: AppPreference[], newOpenInNewTab?: boolean) => {
    if (!user) return;
    setSaving(true);

    const order = newApps.map(app => app.name);
    const hidden = newApps.filter(app => !app.visible).map(app => app.name);

    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const updateData: any = { 
      dashboard_tile_order: order,
      hidden_tiles: hidden 
    };
    
    if (newOpenInNewTab !== undefined) {
      updateData.open_apps_in_new_tab = newOpenInNewTab;
    }

    if (existing) {
      await supabase
        .from('user_preferences')
        .update(updateData)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_preferences')
        .insert({ 
          user_id: user.id, 
          ...updateData
        });
    }

    setSaving(false);
    toast.success('Preferences saved');
  }, [user]);

  const handleOpenInNewTabChange = async (checked: boolean) => {
    setOpenInNewTab(checked);
    await savePreferences(apps, checked);
  };

  const handleMaximizeWindowsChange = async (checked: boolean) => {
    setMaximizeWindows(checked);
    setMaximizePreferenceCache(checked);
    
    if (!user) return;
    
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_preferences')
        .update({ maximize_windows: checked })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_preferences')
        .insert({ user_id: user.id, maximize_windows: checked });
    }
    
    toast.success('Preference saved');
  };

  const handleShowAppMenuChange = async (checked: boolean) => {
    setShowAppMenu(checked);
    setAppMenuPreferenceCache(checked);
    if (!user) return;
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      await supabase.from('user_preferences').update({ show_app_menu: checked }).eq('user_id', user.id);
    } else {
      await supabase.from('user_preferences').insert({ user_id: user.id, show_app_menu: checked });
    }
    toast.success('Preference saved');
  };

  const handleDefaultLocationChange = async (value: string) => {
    const newValue = value === 'none' ? null : value;
    setDefaultLocationId(newValue);
    if (!user) return;
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      await supabase.from('user_preferences').update({ default_location_id: newValue }).eq('user_id', user.id);
    } else {
      await supabase.from('user_preferences').insert({ user_id: user.id, default_location_id: newValue });
    }
    toast.success('Default location saved');
  };

  const handleThemeModeChange = async (newTheme: string) => {
    setTheme(newTheme);
    const resolvedTheme = newTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : newTheme;
    applyDesignSystem(designSystem, resolvedTheme as 'light' | 'dark', designSystem === 'custom' ? customHsl : undefined);
    
    if (!user) return;
    
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_preferences')
        .update({ theme: newTheme })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_preferences')
        .insert({ user_id: user.id, theme: newTheme });
    }
    
    toast.success('Theme preference saved');
  };
 
   const handleDesignSystemChange = async (newDesignSystem: string) => {
     setDesignSystem(newDesignSystem);
     const resolvedTheme = theme === 'system'
       ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
       : (theme || 'light');
     applyDesignSystem(newDesignSystem, resolvedTheme as 'light' | 'dark', newDesignSystem === 'custom' ? customHsl : undefined);
     
     if (!user) return;
     
     const { data: existing } = await supabase
       .from('user_preferences')
       .select('id')
       .eq('user_id', user.id)
       .maybeSingle();
 
     const updatePayload: any = { design_system: newDesignSystem };
     if (newDesignSystem === 'custom') {
       updatePayload.custom_primary_hsl = customHsl;
     }

     if (existing) {
       await supabase
         .from('user_preferences')
         .update(updatePayload)
         .eq('user_id', user.id);
     } else {
       await supabase
         .from('user_preferences')
         .insert({ user_id: user.id, ...updatePayload });
     }
     
     toast.success('Design system saved');
   };

   const handleCustomHslChange = async (newHsl: { h: number; s: number; l: number }) => {
     setCustomHsl(newHsl);
     setDesignSystem('custom');
     const resolvedTheme = theme === 'system'
       ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
       : (theme || 'light');
     applyDesignSystem('custom', resolvedTheme as 'light' | 'dark', newHsl);

     if (!user) return;
     const { data: existing } = await supabase
       .from('user_preferences')
       .select('id')
       .eq('user_id', user.id)
       .maybeSingle();

     const payload: any = { design_system: 'custom', custom_primary_hsl: newHsl };
     if (existing) {
       await supabase.from('user_preferences').update(payload).eq('user_id', user.id);
     } else {
       await supabase.from('user_preferences').insert({ user_id: user.id, ...payload });
     }
   };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setApps((items) => {
        const oldIndex = items.findIndex(item => item.name === active.id);
        const newIndex = items.findIndex(item => item.name === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        savePreferences(newItems);
        return newItems;
      });
    }
  };

  const handleToggleVisibility = (name: string) => {
    setApps((items) => {
      const newItems = items.map(item =>
        item.name === name ? { ...item, visible: !item.visible } : item
      );
      savePreferences(newItems);
      return newItems;
    });
  };

  const handleReset = async () => {
    const resetApps = defaultApps.map(app => ({ ...app, visible: true }));
    setApps(resetApps);
    await savePreferences(resetApps);
    toast.success('Dashboard reset to defaults');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
      })
      .eq('user_id', user.id);

    setSavingProfile(false);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile saved');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center h-16 gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-display font-bold text-foreground">User Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Sun className="w-4 h-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="apps" className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              Apps
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={profile.first_name}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={profile.last_name}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                    <Kbd className="ml-2">⌘S</Kbd>
                  </Button>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how the application looks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                      <Moon className="w-5 h-5 text-muted-foreground" />
                    ) : theme === 'system' ? (
                      <Monitor className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Sun className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <Label className="text-base font-medium">Theme</Label>
                      <p className="text-sm text-muted-foreground">Choose light, dark, or match your system</p>
                    </div>
                  </div>
                  <div className="flex items-center rounded-lg border border-border p-1 gap-0.5">
                    <button
                      onClick={() => handleThemeModeChange('light')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        theme === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      Light
                    </button>
                    <button
                      onClick={() => handleThemeModeChange('dark')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        theme === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      Dark
                    </button>
                    <button
                      onClick={() => handleThemeModeChange('system')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        theme === 'system' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      System
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Windows</CardTitle>
                <CardDescription>
                  Control how dialog windows behave
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Maximize2 className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="maximize-windows" className="text-base font-medium">Maximize Windows</Label>
                      <p className="text-sm text-muted-foreground">Automatically maximize dialogs when they open</p>
                    </div>
                  </div>
                  <Switch
                    id="maximize-windows"
                    checked={maximizeWindows}
                    onCheckedChange={handleMaximizeWindowsChange}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Navigation</CardTitle>
                <CardDescription>
                  Control navigation shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="show-app-menu" className="text-base font-medium">App Menu</Label>
                      <p className="text-sm text-muted-foreground">Show app menu button in every page header</p>
                    </div>
                  </div>
                  <Switch
                    id="show-app-menu"
                    checked={showAppMenu}
                    onCheckedChange={handleShowAppMenuChange}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cockpit</CardTitle>
                <CardDescription>
                  Set your default location for the Cockpit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="default-location" className="text-base font-medium">Default Location</Label>
                      <p className="text-sm text-muted-foreground">Auto-load this location when opening the Cockpit</p>
                    </div>
                  </div>
                  <Select value={defaultLocationId || 'none'} onValueChange={handleDefaultLocationChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {userLocations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.location_id} – {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
             
             <Card>
               <CardHeader>
                 <CardTitle>Design System</CardTitle>
                 <CardDescription>
                   Choose a color palette for the interface
                 </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="grid grid-cols-5 gap-3">
                   {designSystems.map((ds) => (
                     <button
                       key={ds.id}
                       onClick={() => handleDesignSystemChange(ds.id)}
                       className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                         designSystem === ds.id 
                           ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                           : 'border-border hover:border-muted-foreground/30'
                       }`}
                     >
                       <div 
                         className="w-8 h-8 rounded-full border-2 border-background shadow-md" 
                         style={{ backgroundColor: ds.preview }}
                       />
                       <span className="text-xs font-medium text-center">{ds.name}</span>
                     </button>
                   ))}
                   <button
                     onClick={() => handleDesignSystemChange('custom')}
                     className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                       designSystem === 'custom' 
                         ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                         : 'border-border hover:border-muted-foreground/30'
                     }`}
                   >
                     <div 
                       className="w-8 h-8 rounded-full border-2 border-background shadow-md flex items-center justify-center"
                       style={{ backgroundColor: `hsl(${customHsl.h}, ${customHsl.s}%, ${customHsl.l}%)` }}
                     >
                       <Palette className="w-4 h-4 text-white" />
                     </div>
                     <span className="text-xs font-medium text-center">Custom</span>
                   </button>
                 </div>

                 {designSystem === 'custom' && (
                   <div className="space-y-4 pt-2 border-t">
                     <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <Label className="text-sm">Hue</Label>
                         <span className="text-xs text-muted-foreground">{customHsl.h}°</span>
                       </div>
                       <div className="relative">
                         <div className="absolute inset-0 h-2 top-1/2 -translate-y-1/2 rounded-full" style={{ background: 'linear-gradient(to right, hsl(0,70%,50%), hsl(60,70%,50%), hsl(120,70%,50%), hsl(180,70%,50%), hsl(240,70%,50%), hsl(300,70%,50%), hsl(360,70%,50%))' }} />
                         <Slider
                           value={[customHsl.h]}
                           min={0}
                           max={360}
                           step={1}
                           onValueChange={([h]) => handleCustomHslChange({ ...customHsl, h })}
                           className="relative"
                         />
                       </div>
                     </div>
                     <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <Label className="text-sm">Saturation</Label>
                         <span className="text-xs text-muted-foreground">{customHsl.s}%</span>
                       </div>
                       <Slider
                         value={[customHsl.s]}
                         min={10}
                         max={100}
                         step={1}
                         onValueChange={([s]) => handleCustomHslChange({ ...customHsl, s })}
                       />
                     </div>
                     <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <Label className="text-sm">Lightness</Label>
                         <span className="text-xs text-muted-foreground">{customHsl.l}%</span>
                       </div>
                       <Slider
                         value={[customHsl.l]}
                         min={15}
                         max={55}
                         step={1}
                         onValueChange={([l]) => handleCustomHslChange({ ...customHsl, l })}
                       />
                     </div>
                     <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                       <div 
                         className="w-10 h-10 rounded-lg shadow-md border border-border" 
                         style={{ backgroundColor: `hsl(${customHsl.h}, ${customHsl.s}%, ${customHsl.l}%)` }}
                       />
                       <div className="text-sm">
                         <p className="font-medium">Preview</p>
                         <p className="text-muted-foreground text-xs">hsl({customHsl.h}, {customHsl.s}%, {customHsl.l}%)</p>
                       </div>
                     </div>
                   </div>
                 )}
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="apps">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Dashboard Apps</CardTitle>
                    <CardDescription>
                      Drag to reorder and toggle visibility of dashboard tiles
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2 p-3 rounded-lg border bg-muted/50">
                  <Checkbox 
                    id="open-new-tab" 
                    checked={openInNewTab}
                    onCheckedChange={handleOpenInNewTabChange}
                  />
                  <Label 
                    htmlFor="open-new-tab" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Open apps in new tabs
                  </Label>
                </div>
                
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={apps.map(app => app.name)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {apps.map((app) => (
                        <SortableAppItem
                          key={app.name}
                          app={app}
                          onToggleVisibility={handleToggleVisibility}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default UserSettings;