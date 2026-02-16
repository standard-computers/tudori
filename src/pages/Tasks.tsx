import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NavLink } from "@/components/NavLink";
import { Plus, GripVertical, Calendar, MapPin, User, Package, Trash2, RefreshCw } from "lucide-react";
import { toast } from '@/lib/toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  location_id: string | null;
  assigned_to: string | null;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  location?: { name: string; location_id: string } | null;
  assignee?: { first_name: string; last_name: string } | null;
}

interface Location {
  id: string;
  name: string;
  location_id: string;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface Delivery {
  id: string;
  delivery_id: string;
  status: string;
  expected_date: string | null;
  location_id: string | null;
  vendor?: { name: string } | null;
  location?: { name: string } | null;
}

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-muted' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500/10' },
  { id: 'done', label: 'Done', color: 'bg-green-500/10' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

const TaskCard = ({ task, onEdit, onDelete }: { task: Task; onEdit: (task: Task) => void; onDelete: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priority = PRIORITIES.find(p => p.value === task.priority);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`${priority?.color} text-white text-xs`}>{priority?.label}</Badge>
            {task.source_type && (
              <Badge variant="outline" className="text-xs">
                <Package className="w-3 h-3 mr-1" />
                {task.source_type}
              </Badge>
            )}
          </div>
          <h4 className="font-medium text-sm truncate">{task.title}</h4>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {task.location.name}
              </span>
            )}
            {task.assignee && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {task.assignee.first_name}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

const KanbanColumn = ({ 
  column, 
  tasks, 
  onEdit, 
  onDelete,
  onAddTask 
}: { 
  column: typeof COLUMNS[0]; 
  tasks: Task[]; 
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAddTask: (status: string) => void;
}) => {
  return (
    <div className={`flex-1 min-w-[300px] rounded-lg ${column.color} p-3`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          {column.label}
          <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddTask(column.id)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[200px]">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

const Tasks = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    location_id: '',
    assigned_to: '',
  });

  // Pull deliveries dialog
  const [isPullDialogOpen, setIsPullDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    setTransaction('TASKS');
  }, [setTransaction]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchTasks();
      fetchLocations();
      fetchProfiles();
      fetchPendingDeliveries();
    }
  }, [companyId, selectedLocation]);

  const fetchCompanyId = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user!.id)
      .single();
    if (data?.company_id) {
      setCompanyId(data.company_id);
    }
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    let query = supabase
      .from("tasks")
      .select("*")
      .eq("company_id", companyId!)
      .order("created_at", { ascending: false });

    if (selectedLocation !== 'all') {
      query = query.eq("location_id", selectedLocation);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
    } else {
      // Fetch related data separately
      const locationIds = [...new Set((data || []).filter(t => t.location_id).map(t => t.location_id))];
      const assigneeIds = [...new Set((data || []).filter(t => t.assigned_to).map(t => t.assigned_to))];

      const [locationsResult, profilesResult] = await Promise.all([
        locationIds.length > 0 
          ? supabase.from("locations").select("id, name, location_id").in("id", locationIds)
          : { data: [] },
        assigneeIds.length > 0
          ? supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", assigneeIds)
          : { data: [] }
      ]);

      const locationsMap = new Map((locationsResult.data || []).map(l => [l.id, l]));
      const profilesMap = new Map((profilesResult.data || []).map(p => [p.user_id, p]));

      const tasksWithRelations = (data || []).map(task => ({
        ...task,
        location: task.location_id ? locationsMap.get(task.location_id) || null : null,
        assignee: task.assigned_to ? profilesMap.get(task.assigned_to) || null : null,
      }));

      setTasks(tasksWithRelations as Task[]);
    }
    setIsLoading(false);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from("locations")
      .select("id, name, location_id")
      .eq("company_id", companyId!)
      .order("name");
    setLocations(data || []);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .eq("company_id", companyId!);
    setProfiles(data || []);
  };

  const fetchPendingDeliveries = async () => {
    const { data: deliveriesData } = await supabase
      .from("deliveries")
      .select("id, delivery_id, status, expected_date, location_id, vendor_id")
      .eq("company_id", companyId!)
      .in("status", ["pending", "in_transit"])
      .order("expected_date", { ascending: true });

    if (deliveriesData && deliveriesData.length > 0) {
      const vendorIds = [...new Set(deliveriesData.filter(d => d.vendor_id).map(d => d.vendor_id))];
      const locationIds = [...new Set(deliveriesData.filter(d => d.location_id).map(d => d.location_id))];

      const [vendorsResult, locationsResult] = await Promise.all([
        vendorIds.length > 0
          ? supabase.from("vendors").select("id, name").in("id", vendorIds)
          : { data: [] },
        locationIds.length > 0
          ? supabase.from("locations").select("id, name").in("id", locationIds)
          : { data: [] }
      ]);

      const vendorsMap = new Map((vendorsResult.data || []).map(v => [v.id, v]));
      const locationsMap = new Map((locationsResult.data || []).map(l => [l.id, l]));

      const deliveriesWithRelations = deliveriesData.map(d => ({
        ...d,
        vendor: d.vendor_id ? vendorsMap.get(d.vendor_id) || null : null,
        location: d.location_id ? locationsMap.get(d.location_id) || null : null,
      }));

      setPendingDeliveries(deliveriesWithRelations as Delivery[]);
    } else {
      setPendingDeliveries([]);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Find the column the task was dropped into
    const overTask = tasks.find(t => t.id === overId);
    let newStatus = activeTask.status;

    if (overTask) {
      newStatus = overTask.status;
    } else {
      // Dropped on column directly
      const column = COLUMNS.find(c => c.id === overId);
      if (column) {
        newStatus = column.id;
      }
    }

    if (newStatus !== activeTask.status) {
      // Update in database
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", activeId);

      if (error) {
        toast.error("Failed to update task status");
      } else {
        setTasks(prev => prev.map(t => 
          t.id === activeId ? { ...t, status: newStatus } : t
        ));
      }
    }
  };

  const handleAddTask = (status: string = 'todo') => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      status,
      priority: 'medium',
      due_date: '',
      location_id: selectedLocation !== 'all' ? selectedLocation : '',
      assigned_to: '',
    });
    setIsDialogOpen(true);
  };

  useTransactionAction('new', () => handleAddTask());

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      location_id: task.location_id || '',
      assigned_to: task.assigned_to || '',
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete task");
    } else {
      toast.success("Task deleted");
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleSaveTask = async () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    const taskData = {
      ...formData,
      company_id: companyId!,
      location_id: formData.location_id || null,
      assigned_to: formData.assigned_to || null,
      due_date: formData.due_date || null,
      created_by: user!.id,
    };

    if (editingTask) {
      const { error } = await supabase
        .from("tasks")
        .update(taskData)
        .eq("id", editingTask.id);
      if (error) {
        toast.error("Failed to update task");
      } else {
        toast.success("Task updated");
        fetchTasks();
      }
    } else {
      const { error } = await supabase.from("tasks").insert(taskData);
      if (error) {
        toast.error("Failed to create task");
      } else {
        toast.success("Task created");
        fetchTasks();
      }
    }
    setIsDialogOpen(false);
  };

  const handlePullDeliveries = async () => {
    // Get existing delivery task source_ids
    const existingSourceIds = tasks
      .filter(t => t.source_type === 'delivery')
      .map(t => t.source_id);

    const newDeliveries = pendingDeliveries.filter(d => !existingSourceIds.includes(d.id));

    if (newDeliveries.length === 0) {
      toast.info("No new deliveries to pull");
      setIsPullDialogOpen(false);
      return;
    }

    const tasksToCreate = newDeliveries.map(delivery => ({
      company_id: companyId!,
      title: `Receive delivery ${delivery.delivery_id}`,
      description: `Receive and process inbound delivery from ${delivery.vendor?.name || 'vendor'}`,
      status: 'todo',
      priority: 'medium',
      due_date: delivery.expected_date,
      location_id: delivery.location_id,
      source_type: 'delivery',
      source_id: delivery.id,
      created_by: user!.id,
    }));

    const { error } = await supabase.from("tasks").insert(tasksToCreate);
    if (error) {
      toast.error("Failed to create tasks from deliveries");
    } else {
      toast.success(`Created ${tasksToCreate.length} tasks from pending deliveries`);
      fetchTasks();
    }
    setIsPullDialogOpen(false);
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <NavLink to="/dashboard">Dashboard</NavLink>
              <span className="text-muted-foreground">/</span>
              <h1 className="text-lg font-semibold">Tasks</h1>
            </div>
            <div className="flex items-center gap-3 pr-16">
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setIsPullDialogOpen(true)} title="Pull Deliveries">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button onClick={() => handleAddTask()} size="icon" className="relative">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasks.filter(t => t.status === column.id)}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onAddTask={handleAddTask}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="bg-card border rounded-lg p-3 shadow-lg">
                <h4 className="font-medium text-sm">{activeTask.title}</h4>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Task description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={v => setFormData(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={formData.location_id || "__none__"} onValueChange={v => setFormData(prev => ({ ...prev, location_id: v === "__none__" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={formData.assigned_to || "__none__"} onValueChange={v => setFormData(prev => ({ ...prev, assigned_to: v === "__none__" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveTask}>{editingTask ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pull Deliveries Dialog */}
      <Dialog open={isPullDialogOpen} onOpenChange={setIsPullDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pull Pending Deliveries</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Create tasks from {pendingDeliveries.length} pending deliveries that don't already have tasks.
            </p>
            {pendingDeliveries.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {pendingDeliveries.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium text-sm">{d.delivery_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.vendor?.name} → {d.location?.name}
                      </p>
                    </div>
                    {d.expected_date && (
                      <Badge variant="outline">
                        {new Date(d.expected_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">No pending deliveries</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handlePullDeliveries} disabled={pendingDeliveries.length === 0}>
              Pull {pendingDeliveries.length} Deliveries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
