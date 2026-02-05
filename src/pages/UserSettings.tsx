import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ArrowLeft, GripVertical, Eye, EyeOff, RotateCcw, User, LayoutGrid, Loader2, Moon, Sun } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { designSystems, applyDesignSystem } from '@/config/design-systems';
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
import { toast } from 'sonner';
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
  const [profile, setProfile] = useState<UserProfile>({ first_name: '', last_name: '', avatar_url: null, company_id: null });
  const [savingProfile, setSavingProfile] = useState(false);
   const [designSystem, setDesignSystem] = useState('default');

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
    }
  }, [user, profile.company_id, accessLoading]);

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
       .select('dashboard_tile_order, hidden_tiles, open_apps_in_new_tab, theme, design_system')
      .eq('user_id', user!.id)
      .maybeSingle();

    const hiddenTiles = new Set((data?.hidden_tiles as string[]) || []);
    setOpenInNewTab(data?.open_apps_in_new_tab || false);
    
    // Apply saved theme
    if (data?.theme) {
      setTheme(data.theme);
    }
     
     // Apply saved design system
     if (data?.design_system) {
       setDesignSystem(data.design_system);
       applyDesignSystem(data.design_system, (data.theme || 'light') as 'light' | 'dark');
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

  const handleThemeChange = async (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light';
    setTheme(newTheme);
     applyDesignSystem(designSystem, newTheme);
    
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
     applyDesignSystem(newDesignSystem, (theme || 'light') as 'light' | 'dark');
     
     if (!user) return;
     
     const { data: existing } = await supabase
       .from('user_preferences')
       .select('id')
       .eq('user_id', user.id)
       .maybeSingle();
 
     if (existing) {
       await supabase
         .from('user_preferences')
         .update({ design_system: newDesignSystem })
         .eq('user_id', user.id);
     } else {
       await supabase
         .from('user_preferences')
         .insert({ user_id: user.id, design_system: newDesignSystem });
     }
     
     toast.success('Design system saved');
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center h-16 gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
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
                    ) : (
                      <Sun className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <Label htmlFor="dark-mode" className="text-base font-medium">Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
                    </div>
                  </div>
                  <Switch
                    id="dark-mode"
                    checked={theme === 'dark'}
                    onCheckedChange={handleThemeChange}
                  />
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
                 <Select value={designSystem} onValueChange={handleDesignSystemChange}>
                   <SelectTrigger className="w-full">
                     <SelectValue placeholder="Select a design system" />
                   </SelectTrigger>
                   <SelectContent>
                     {designSystems.map((ds) => (
                       <SelectItem key={ds.id} value={ds.id}>
                         <div className="flex items-center gap-3">
                           <div 
                             className="w-4 h-4 rounded-full border border-border" 
                             style={{ backgroundColor: ds.preview }}
                           />
                           <div>
                             <span className="font-medium">{ds.name}</span>
                             <span className="text-muted-foreground ml-2 text-xs">{ds.description}</span>
                           </div>
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 
                 <div className="grid grid-cols-5 gap-3 pt-2">
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
                 </div>
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