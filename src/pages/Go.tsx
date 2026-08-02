import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTransaction } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { postGoodsReceipt } from '@/lib/inventory-posting';
import { checkAndCompleteDelivery } from '@/lib/delivery-fulfillment';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  ArrowLeft,
  MapPin,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  RefreshCw,
  Loader2,
  Play,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Zap,
  Repeat,
  Factory,
  MoreHorizontal,
  BarChart3,
} from 'lucide-react';
import { toast } from '@/lib/toast';

type ActivityType = 'inbound' | 'outbound' | 'internal' | null;
type InternalSubType = 'replenishments' | 'production' | 'other' | 'performance' | null;

interface Location {
  id: string;
  location_id: string;
  name: string;
}

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source_type: string | null;
  source_id: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  work_tasks: WorkTask[];
}

interface WorkTask {
  id: string;
  task_type: string;
  sequence: number;
  description: string | null;
  status: string;
  quantity: number | null;
  product_name?: string;
  source_bin_name?: string;
  destination_bin_name?: string;
}

// Classify a task into activity type
function classifyTask(task: { source_type: string | null; title: string }): ActivityType {
  const st = task.source_type?.toLowerCase() || '';
  const title = task.title.toLowerCase();
  // Inbound: only receiving inbound deliveries / put-away
  if (st === 'delivery' || title.includes('receive') || title.includes('inbound') || title.includes('put away')) {
    return 'inbound';
  }
  // Outbound: order fulfillment (sales orders, outbound deliveries, PO internal transfers)
  if (st === 'sales_order' || st === 'outbound_delivery' || st === 'purchase_order' || title.includes('ship') || title.includes('outbound') || title.includes('fulfill') || title.includes('pick') || title.includes('pack')) {
    return 'outbound';
  }
  return 'internal';
}

export default function Go() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useTransaction('go');

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [activity, setActivity] = useState<ActivityType>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [internalSubType, setInternalSubType] = useState<InternalSubType>(null);

  // Counts per activity type
  const [inboundCount, setInboundCount] = useState(0);
  const [outboundCount, setOutboundCount] = useState(0);
  const [internalCount, setInternalCount] = useState(0);

  // Fetch company_id from profiles
  useEffect(() => {
    if (!user) return;
    const fetchCompanyId = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (data?.company_id) {
        setCompanyId(data.company_id);
      }
    };
    fetchCompanyId();
  }, [user]);

  // Fetch user's accessible locations
  useEffect(() => {
    if (!user || !companyId) return;

    const fetchLocations = async () => {
      setLoading(true);
      const { data: locationUsers } = await supabase
        .from('location_users')
        .select('location_id')
        .eq('user_id', user.id);

      if (!locationUsers?.length) {
        setLoading(false);
        return;
      }

      const locationIds = locationUsers.map((lu) => lu.location_id);
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, location_id, name')
        .in('id', locationIds)
        .order('name');

      if (locationData) {
        setLocations(locationData);
        if (locationData.length === 1) {
          setSelectedLocationId(locationData[0].id);
        }
      }
      setLoading(false);
    };

    fetchLocations();
  }, [user, companyId]);

  // Fetch task counts when location changes
  const fetchCounts = useCallback(async () => {
    if (!selectedLocationId || !companyId) return;

    const { data: allTasks } = await supabase
      .from('tasks')
      .select('id, source_type, title')
      .eq('company_id', companyId)
      .eq('location_id', selectedLocationId)
      .in('status', ['todo', 'in_progress']);

    if (allTasks) {
      setInboundCount(allTasks.filter((t) => classifyTask(t) === 'inbound').length);
      setOutboundCount(allTasks.filter((t) => classifyTask(t) === 'outbound').length);
      setInternalCount(allTasks.filter((t) => classifyTask(t) === 'internal').length);
    }
  }, [selectedLocationId, companyId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Fetch tasks for selected activity type
  const fetchTasks = useCallback(async () => {
    if (!selectedLocationId || !companyId || !activity) return;

    setLoadingTasks(true);
    const { data: taskData } = await supabase
      .from('tasks')
      .select('id, title, description, status, priority, source_type, source_id, due_date, assigned_to, created_at')
      .eq('company_id', companyId)
      .eq('location_id', selectedLocationId)
      .in('status', ['todo', 'in_progress'])
      .order('created_at', { ascending: true });

    if (taskData) {
      const filtered = taskData.filter((t) => classifyTask(t) === activity);

      // Fetch work_tasks for each task
      const taskIds = filtered.map((t) => t.id);
      const workTasksMap: Record<string, WorkTask[]> = {};

      if (taskIds.length > 0) {
        const { data: workTasks } = await supabase
          .from('work_tasks')
          .select('id, work_order_id, task_type, sequence, description, status, quantity, product_id, source_bin_id, destination_bin_id')
          .in('work_order_id', taskIds)
          .order('sequence');

        if (workTasks?.length) {
          const productIds = [...new Set(workTasks.filter((wt) => wt.product_id).map((wt) => wt.product_id))] as string[];
          const binIds = [...new Set([
            ...workTasks.filter((wt) => wt.source_bin_id).map((wt) => wt.source_bin_id),
            ...workTasks.filter((wt) => wt.destination_bin_id).map((wt) => wt.destination_bin_id),
          ])] as string[];

          const productMap: Record<string, string> = {};
          const binMap: Record<string, string> = {};

          if (productIds.length) {
            const { data: products } = await supabase
              .from('products')
              .select('id, name')
              .in('id', productIds);
            products?.forEach((p) => (productMap[p.id] = p.name));
          }

          if (binIds.length) {
            const { data: bins } = await supabase
              .from('bins')
              .select('id, name')
              .in('id', binIds);
            bins?.forEach((b) => (binMap[b.id] = b.name));
          }

          workTasks.forEach((wt) => {
            const key = wt.work_order_id;
            if (!workTasksMap[key]) workTasksMap[key] = [];
            workTasksMap[key].push({
              id: wt.id,
              task_type: wt.task_type,
              sequence: wt.sequence,
              description: wt.description,
              status: wt.status,
              quantity: wt.quantity,
              product_name: wt.product_id ? productMap[wt.product_id] : undefined,
              source_bin_name: wt.source_bin_id ? binMap[wt.source_bin_id] : undefined,
              destination_bin_name: wt.destination_bin_id ? binMap[wt.destination_bin_id] : undefined,
            });
          });
        }
      }

      setTasks(
        filtered.map((t) => ({
          ...t,
          work_tasks: workTasksMap[t.id] || [],
        }))
      );
    }
    setLoadingTasks(false);
  }, [selectedLocationId, companyId, activity]);

  useEffect(() => {
    if (activity) fetchTasks();
  }, [activity, fetchTasks]);

  // Update task status
  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId);
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to update task');
    } else {
      toast.success(newStatus === 'done' ? 'Task completed' : 'Task started');
      fetchTasks();
      fetchCounts();
    }
    setUpdatingTaskId(null);
  };

  // Update work task status
  const handleWorkTaskStatusChange = async (workTaskId: string, newStatus: string) => {
    setUpdatingTaskId(workTaskId);

    // If completing a 'receive' task, create a Goods Receipt with ledger transaction
    if (newStatus === 'done') {
      const { data: wt } = await supabase
        .from('work_tasks')
        .select('id, task_type, product_id, quantity, pu_id, destination_bin_id, work_order_id')
        .eq('id', workTaskId)
        .single();

      if (wt && (wt as any).task_type === 'receive' && companyId && selectedLocationId) {
        try {
          const workTask = wt as any;
          // Get parent task for delivery reference
          const { data: parentTask } = await supabase
            .from('tasks')
            .select('source_id')
            .eq('id', workTask.work_order_id)
            .single();

          const deliverySourceId = parentTask?.source_id;

          // Get delivery info
          const { data: delivery } = await supabase
            .from('deliveries')
            .select('delivery_id, purchase_order_id')
            .eq('id', deliverySourceId || '')
            .maybeSingle();

          // Create goods receipt
          const { data: receiptNumber } = await supabase.rpc(
            'get_next_goods_receipt_number',
            { p_company_id: companyId }
          );

          if (receiptNumber) {
            const { data: goodsReceipt, error: grError } = await supabase
              .from('goods_receipts' as any)
              .insert({
                company_id: companyId,
                receipt_number: receiptNumber,
                location_id: selectedLocationId,
                delivery_id: deliverySourceId || null,
                purchase_order_id: delivery?.purchase_order_id || null,
                receipt_date: new Date().toISOString().split('T')[0],
                status: 'pending',
                task_id: workTask.work_order_id,
                notes: `Received via Go app from delivery ${delivery?.delivery_id || ''}`,
              })
              .select()
              .single();

            if (!grError && goodsReceipt) {
              // Create GR item with destination bin (GR area bin)
              await supabase.from('goods_receipt_items').insert({
                goods_receipt_id: (goodsReceipt as any).id,
                product_id: workTask.product_id,
                quantity: workTask.quantity,
                pu_id: workTask.pu_id || null,
                bin_id: workTask.destination_bin_id || null,
              });

              // Post the goods receipt (updates inventory + ledger)
              const postResult = await postGoodsReceipt((goodsReceipt as any).id, selectedLocationId);
              if (postResult.success) {
                toast.success(`Goods Receipt ${receiptNumber} created`);

                // Check if delivery is fully received and mark as delivered
                if (deliverySourceId) {
                  const completed = await checkAndCompleteDelivery(deliverySourceId);
                  if (completed) {
                    toast.success('Delivery marked as delivered (fully received)');
                  }
                }
              } else {
                toast.error(postResult.error || 'Failed to post goods receipt');
              }
            }
          }
        } catch (err) {
          console.error('Error creating GR in Go app:', err);
          toast.error('Failed to create goods receipt');
        }
      }
    }

    const { error } = await supabase
      .from('work_tasks')
      .update({ status: newStatus })
      .eq('id', workTaskId);

    if (error) {
      toast.error('Failed to update step');
    } else {
      toast.success(newStatus === 'done' ? 'Step completed' : 'Step started');
      fetchTasks();
    }
    setUpdatingTaskId(null);
  };

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => {
            if (activity === 'internal' && internalSubType) {
              setInternalSubType(null);
              setTasks([]);
              setExpandedTaskId(null);
            } else if (activity) {
              setActivity(null);
              setInternalSubType(null);
              setTasks([]);
              setExpandedTaskId(null);
            } else {
              navigate(-1);
            }
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-1.5 min-w-0">
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">Go</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selectedLocationId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                fetchCounts();
                if (activity) fetchTasks();
                toast.success('Refreshed');
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          {selectedLocation && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{selectedLocation.name}</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedLocationId ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Select a Location</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Choose a location to view and manage work.
            </p>
            {locations.length > 0 ? (
              <div className="w-full max-w-xs space-y-4">
                <SearchableSelect
                  options={locations.map((loc) => ({
                    value: loc.id,
                    label: `${loc.location_id} ${loc.name}`,
                  }))}
                  value={selectedLocationId}
                  onValueChange={setSelectedLocationId}
                  placeholder="Search locations..."
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground text-center">
                  {locations.length} location{locations.length !== 1 ? 's' : ''} available
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No locations assigned to you.</p>
            )}
          </div>
        ) : !activity ? (
          <div className="p-4 space-y-4">
            <div className="pt-2 pb-1">
              <h2 className="text-xl font-bold">What are you working on?</h2>
              <p className="text-sm text-muted-foreground mt-1">Select an activity type</p>
            </div>

            <div className="space-y-3">
              <ActivityCard
                icon={PackagePlus}
                label="Inbound"
                description="Receive deliveries & put away stock"
                count={inboundCount}
                iconClassName="text-emerald-600 dark:text-emerald-400"
                bgClassName="bg-emerald-100 dark:bg-emerald-900/30"
                onClick={() => setActivity('inbound')}
              />
              <ActivityCard
                icon={PackageMinus}
                label="Outbound"
                description="Pick, pack & ship orders"
                count={outboundCount}
                iconClassName="text-blue-600 dark:text-blue-400"
                bgClassName="bg-blue-100 dark:bg-blue-900/30"
                onClick={() => setActivity('outbound')}
              />
              <ActivityCard
                icon={ArrowLeftRight}
                label="Internal"
                description="Move stock & internal tasks"
                count={internalCount}
                iconClassName="text-amber-600 dark:text-amber-400"
                bgClassName="bg-amber-100 dark:bg-amber-900/30"
                onClick={() => {
                  setActivity('internal');
                  setInternalSubType(null);
                }}
              />
            </div>
          </div>
        ) : activity === 'internal' && !internalSubType ? (
          <div className="p-4 space-y-4">
            <div className="pt-2 pb-1">
              <h2 className="text-xl font-bold">Internal</h2>
              <p className="text-sm text-muted-foreground mt-1">Select a category</p>
            </div>

            <div className="space-y-3">
              <ActivityCard
                icon={Repeat}
                label="Replenishments"
                description="Restock bins & replenish locations"
                count={0}
                iconClassName="text-violet-600 dark:text-violet-400"
                bgClassName="bg-violet-100 dark:bg-violet-900/30"
                onClick={() => setInternalSubType('replenishments')}
              />
              <ActivityCard
                icon={Factory}
                label="Production"
                description="Manufacturing & assembly tasks"
                count={0}
                iconClassName="text-orange-600 dark:text-orange-400"
                bgClassName="bg-orange-100 dark:bg-orange-900/30"
                onClick={() => setInternalSubType('production')}
              />
              <ActivityCard
                icon={MoreHorizontal}
                label="Other"
                description="Miscellaneous internal tasks"
                count={0}
                iconClassName="text-slate-600 dark:text-slate-400"
                bgClassName="bg-slate-100 dark:bg-slate-900/30"
                onClick={() => setInternalSubType('other')}
              />
              <ActivityCard
                icon={BarChart3}
                label="Performance"
                description="Metrics & productivity tracking"
                count={0}
                iconClassName="text-teal-600 dark:text-teal-400"
                bgClassName="bg-teal-100 dark:bg-teal-900/30"
                onClick={() => setInternalSubType('performance')}
              />
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1">
              <Badge variant="secondary" className="text-xs capitalize">
                {activity}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loadingTasks ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No open tasks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    expanded={expandedTaskId === task.id}
                    onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    onStatusChange={handleTaskStatusChange}
                    onWorkTaskStatusChange={handleWorkTaskStatusChange}
                    updatingTaskId={updatingTaskId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Activity Card Component
function ActivityCard({
  icon: Icon,
  label,
  description,
  count,
  iconClassName,
  bgClassName,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  count: number;
  iconClassName: string;
  bgClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/20 transition-all active:scale-[0.98] text-left"
      onClick={onClick}
    >
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', bgClassName)}>
        <Icon className={cn('w-6 h-6', iconClassName)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {count > 0 && (
          <Badge variant="secondary" className="text-xs font-semibold tabular-nums">
            {count}
          </Badge>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  );
}

// Task Card Component
function TaskCard({
  task,
  expanded,
  onToggle,
  onStatusChange,
  onWorkTaskStatusChange,
  updatingTaskId,
}: {
  task: TaskItem;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (taskId: string, status: string) => void;
  onWorkTaskStatusChange: (workTaskId: string, status: string) => void;
  updatingTaskId: string | null;
}) {
  const isUpdating = updatingTaskId === task.id;
  const hasWorkTasks = task.work_tasks.length > 0;
  const completedSteps = task.work_tasks.filter((wt) => wt.status === 'done').length;
  const totalSteps = task.work_tasks.length;
  const allWorkTasksDone = !hasWorkTasks || completedSteps === totalSteps;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={onToggle}
      >
        <div
          className={cn(
            'w-2.5 h-2.5 rounded-full shrink-0',
            task.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{task.title}</div>
          {task.description && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</div>
          )}
          {hasWorkTasks && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {completedSteps}/{totalSteps}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {task.priority === 'high' && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              High
            </Badge>
          )}
          <ChevronRight
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              expanded && 'rotate-90'
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {hasWorkTasks && (
            <div className="p-3 space-y-2">
              {task.work_tasks.map((wt) => (
                <WorkTaskRow
                  key={wt.id}
                  workTask={wt}
                  onStatusChange={onWorkTaskStatusChange}
                  isUpdating={updatingTaskId === wt.id}
                />
              ))}
            </div>
          )}

          <div className="px-3 pb-3 flex gap-2">
            {task.status === 'todo' && (
              <Button
                size="sm"
                className="flex-1 h-10"
                onClick={() => onStatusChange(task.id, 'in_progress')}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1.5" />
                    Start
                  </>
                )}
              </Button>
            )}
            {task.status === 'in_progress' && (
              <Button
                size="sm"
                className="flex-1 h-10"
                onClick={() => onStatusChange(task.id, 'done')}
                disabled={isUpdating || !allWorkTasksDone}
                title={!allWorkTasksDone ? 'Complete all steps before finishing the task' : undefined}
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Complete{hasWorkTasks && !allWorkTasksDone ? ` (${completedSteps}/${totalSteps})` : ''}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Work Task Step Row
function WorkTaskRow({
  workTask,
  onStatusChange,
  isUpdating,
}: {
  workTask: WorkTask;
  onStatusChange: (id: string, status: string) => void;
  isUpdating: boolean;
}) {
  const isDone = workTask.status === 'done';
  const isInProgress = workTask.status === 'in_progress';

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2.5 rounded-lg transition-colors',
        isDone ? 'bg-muted/50' : 'bg-muted/80'
      )}
    >
      <div
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
          isDone
            ? 'bg-primary text-primary-foreground'
            : isInProgress
              ? 'bg-accent/10 text-accent ring-1 ring-accent/30'
              : 'bg-muted-foreground/10 text-muted-foreground'
        )}
      >
        {isDone ? <CheckCircle2 className="w-4 h-4" /> : workTask.sequence}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-medium capitalize', isDone && 'line-through text-muted-foreground')}>
          {workTask.task_type}
        </div>
        {workTask.product_name && (
          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
            {workTask.product_name}
            {workTask.quantity ? ` × ${workTask.quantity}` : ''}
          </div>
        )}
        {(workTask.source_bin_name || workTask.destination_bin_name) && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
            {workTask.source_bin_name && <span>{workTask.source_bin_name}</span>}
            {workTask.source_bin_name && workTask.destination_bin_name && (
              <ArrowRight className="w-2.5 h-2.5" />
            )}
            {workTask.destination_bin_name && <span>{workTask.destination_bin_name}</span>}
          </div>
        )}
      </div>
      {!isDone && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(workTask.id, isInProgress ? 'done' : 'in_progress');
          }}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isInProgress ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
