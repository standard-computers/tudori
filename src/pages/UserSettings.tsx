import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, GripVertical, Eye, EyeOff, RotateCcw } from 'lucide-react';
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

interface AppPreference extends AppTile {
  visible: boolean;
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
      <div className={`w-10 h-10 rounded-lg ${app.color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
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
  const [apps, setApps] = useState<AppPreference[]>([]);
  const [saving, setSaving] = useState(false);

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
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    const { data } = await supabase
      .from('user_preferences')
      .select('dashboard_tile_order, hidden_tiles')
      .eq('user_id', user!.id)
      .maybeSingle();

    const hiddenTiles = new Set((data?.hidden_tiles as string[]) || []);
    
    if (data?.dashboard_tile_order) {
      const orderedApps = data.dashboard_tile_order
        .map((name: string) => {
          const app = defaultApps.find(a => a.name === name);
          return app ? { ...app, visible: !hiddenTiles.has(name) } : null;
        })
        .filter(Boolean) as AppPreference[];
      
      const savedNames = new Set(data.dashboard_tile_order);
      const newApps = defaultApps
        .filter(app => !savedNames.has(app.name))
        .map(app => ({ ...app, visible: !hiddenTiles.has(app.name) }));
      
      setApps([...orderedApps, ...newApps]);
    } else {
      setApps(defaultApps.map(app => ({ ...app, visible: !hiddenTiles.has(app.name) })));
    }
  };

  const savePreferences = useCallback(async (newApps: AppPreference[]) => {
    if (!user) return;
    setSaving(true);

    const order = newApps.map(app => app.name);
    const hidden = newApps.filter(app => !app.visible).map(app => app.name);

    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_preferences')
        .update({ 
          dashboard_tile_order: order,
          hidden_tiles: hidden 
        })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_preferences')
        .insert({ 
          user_id: user.id, 
          dashboard_tile_order: order,
          hidden_tiles: hidden 
        });
    }

    setSaving(false);
    toast.success('Preferences saved');
  }, [user]);

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-display font-bold text-foreground">User Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <CardContent>
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
      </main>
    </div>
  );
};

export default UserSettings;
