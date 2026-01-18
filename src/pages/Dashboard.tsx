import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, LogOut, Settings as SettingsIcon, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableTile } from '@/components/DraggableTile';
import { defaultApps, AppTile } from '@/config/apps';
import { DollarSign, ShoppingCart, Users } from 'lucide-react';

interface Profile {
  first_name: string;
  last_name: string;
  company_id: string;
}

interface Company {
  name: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [apps, setApps] = useState<AppTile[]>([]);
  const [hiddenTiles, setHiddenTiles] = useState<Set<string>>(new Set());

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
      fetchPreferences();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('first_name, last_name, company_id')
      .eq('user_id', user!.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      
      if (profileData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profileData.company_id)
          .single();
        
        if (companyData) {
          setCompany(companyData);
        }
      }
    }
  };

  const fetchPreferences = async () => {
    const { data } = await supabase
      .from('user_preferences')
      .select('dashboard_tile_order, hidden_tiles')
      .eq('user_id', user!.id)
      .maybeSingle();

    const hidden = new Set((data?.hidden_tiles as string[]) || []);
    setHiddenTiles(hidden);

    if (data?.dashboard_tile_order) {
      // Reorder apps based on saved preferences
      const orderedApps = data.dashboard_tile_order
        .map((name: string) => defaultApps.find(app => app.name === name))
        .filter(Boolean) as AppTile[];
      
      // Add any new apps that might not be in saved preferences
      const savedNames = new Set(data.dashboard_tile_order);
      const newApps = defaultApps.filter(app => !savedNames.has(app.name));
      
      setApps([...orderedApps, ...newApps]);
    } else {
      setApps(defaultApps);
    }
  };

  const savePreferences = useCallback(async (newOrder: string[]) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_preferences')
        .update({ dashboard_tile_order: newOrder })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_preferences')
        .insert({ user_id: user.id, dashboard_tile_order: newOrder });
    }
  }, [user]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setApps((items) => {
        const oldIndex = items.findIndex(item => item.name === active.id);
        const newIndex = items.findIndex(item => item.name === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save the new order
        savePreferences(newItems.map(item => item.name));
        
        return newItems;
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const initials = profile 
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase() 
    : 'U';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <span className="text-lg font-display font-bold text-foreground">EnterpriseHub</span>
                {company && (
                  <p className="text-xs text-muted-foreground">{company.name}</p>
                )}
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">
                  {profile ? `${profile.first_name} ${profile.last_name}` : 'User'}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                    <Avatar className="h-10 w-10 border-2 border-accent/20">
                      <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{profile ? `${profile.first_name} ${profile.last_name}` : 'User'}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/user-settings')}>
                    <User className="mr-2 h-4 w-4" />
                    User Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Company Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome section */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Good {getTimeOfDay()}, {profile?.first_name || 'there'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            What would you like to work on today? <span className="text-xs">(Drag tiles to reorganize)</span>
          </p>
        </div>

        {/* Apps grid with drag and drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={apps.map(app => app.name)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {apps
                .filter(app => !hiddenTiles.has(app.name))
                .map((app, index) => (
                  <DraggableTile
                    key={app.name}
                    id={app.name}
                    name={app.name}
                    icon={app.icon}
                    color={app.color}
                    description={app.description}
                    path={app.path}
                    index={index}
                  />
                ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Quick stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-display font-bold text-foreground mt-1">$0.00</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-success" />
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-display font-bold text-foreground mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-display font-bold text-foreground mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default Dashboard;
