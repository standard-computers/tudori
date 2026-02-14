import { useState, useEffect } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { createPackagingUnit } from '@/lib/packaging-units';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Maximize2, Minimize2, Trash2, Play, CheckCircle2, Package, ArrowDown, Loader2, Info, ListChecks } from 'lucide-react';

interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  source_type: string | null;
  source_id: string | null;
  assigned_to: string | null;
  created_at: string;
  assignee?: { first_name: string; last_name: string } | null;
}

interface WorkTask {
  id: string;
  task_type: string;
  sequence: number;
  description: string | null;
  product_id: string | null;
  quantity: number | null;
  source_bin_id: string | null;
  destination_bin_id: string | null;
  pu_id: string | null;
  status: string;
  product?: { name: string; product_id: string } | null;
  source_bin?: { bin_id: string; name: string; area?: { area_id: string; name: string } | null } | null;
  destination_bin?: { bin_id: string; name: string; area?: { area_id: string; name: string } | null } | null;
  packaging_unit?: { pu_number: string } | null;
}

interface AnticipatedTask {
  task_type: string;
  sequence: number;
  description: string;
  product_name?: string;
  product_id_code?: string;
  quantity?: number;
  source_bin?: string;
  source_area?: string;
  destination_bin?: string;
  destination_area?: string;
}

interface ViewWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
  locationId: string | null;
  companyId: string | null;
  onStarted: () => void;
  onCompleted: () => void;
  onDelete: (id: string) => void;
}

const ViewWorkOrderDialog = ({
  open,
  onOpenChange,
  workOrder,
  locationId,
  companyId,
  onStarted,
  onCompleted,
  onDelete,
}: ViewWorkOrderDialogProps) => {
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [activeTab, setActiveTab] = useState('details');
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [anticipatedTasks, setAnticipatedTasks] = useState<AnticipatedTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (open && workOrder) {
      setActiveTab('details');
      if (workOrder.status === 'todo') {
        generateAnticipatedTasks();
      } else if (workOrder.status === 'in_progress') {
        fetchWorkTasks();
      }
    }
  }, [open, workOrder]);

  const fetchWorkTasks = async () => {
    if (!workOrder) return;
    setIsLoadingTasks(true);
    const { data, error } = await supabase
      .from('work_tasks')
      .select(`
        id, task_type, sequence, description, product_id, quantity,
        source_bin_id, destination_bin_id, pu_id, status,
        product:products(name, product_id),
        source_bin:bins!work_tasks_source_bin_id_fkey(bin_id, name, area:areas(area_id, name)),
        destination_bin:bins!work_tasks_destination_bin_id_fkey(bin_id, name, area:areas(area_id, name)),
        packaging_unit:packaging_units(pu_number)
      `)
      .eq('work_order_id', workOrder.id)
      .order('sequence');
    
    setIsLoadingTasks(false);
    if (error) {
      console.error('Failed to fetch work tasks:', error);
      return;
    }
    setWorkTasks((data || []) as unknown as WorkTask[]);
  };

  const generateAnticipatedTasks = async () => {
    if (!workOrder || !locationId) return;
    setIsLoadingTasks(true);
    const anticipated: AnticipatedTask[] = [];

    const isPick = workOrder.title.startsWith('Pick:');
    const isPackShip = workOrder.title.startsWith('Pack & Ship:');

    if (isPick) {
      // Parse product_id and quantity from description
      // Format: "Pick 4 unit(s) of GJO30403 for PO ..."
      const descMatch = workOrder.description?.match(/Pick (\d+) unit\(s\) of (\S+)/);
      const qty = descMatch ? parseInt(descMatch[1], 10) : 0;
      const productCode = descMatch ? descMatch[2] : null;

      if (productCode && qty > 0) {
        // Find product
        const { data: products } = await supabase
          .from('products')
          .select('id, product_id, name')
          .eq('product_id', productCode)
          .limit(1);
        const product = products?.[0];

        // Find best bin (using picking_sequence)
        const { data: invData } = await supabase
          .from('inventory')
          .select(`
            id, quantity, bin_id, product_id,
            bin:bins(bin_id, name, picking_sequence, area_id, area:areas(area_id, name))
          `)
          .eq('location_id', locationId)
          .eq('product_id', product?.id || '')
          .gt('quantity', 0)
          .order('quantity', { ascending: false });

        const inventoryLines = (invData || []) as any[];
        // Sort by picking_sequence
        inventoryLines.sort((a: any, b: any) => {
          const seqA = a.bin?.picking_sequence;
          const seqB = b.bin?.picking_sequence;
          if (seqA == null && seqB == null) return 0;
          if (seqA == null) return 1;
          if (seqB == null) return -1;
          return seqA - seqB;
        });

        const bestLine = inventoryLines[0];
        const sourceBinLabel = bestLine?.bin?.bin_id ? `${bestLine.bin.bin_id} (${bestLine.bin.name})` : 'Best available bin';
        const sourceAreaLabel = bestLine?.bin?.area?.name ? `${bestLine.bin.area.area_id} — ${bestLine.bin.area.name}` : undefined;

        // Find GI staging area
        const { data: giAreas } = await supabase
          .from('areas')
          .select('id, area_id, name')
          .eq('location_id', locationId)
          .eq('is_goods_issue_enabled', true)
          .limit(1);

        let dropBin = 'GI staging area';
        let dropArea: string | undefined;
        if (giAreas && giAreas.length > 0) {
          dropArea = `${giAreas[0].area_id} — ${giAreas[0].name}`;
          const { data: giBins } = await supabase
            .from('bins')
            .select('bin_id, name, put_away_sequence')
            .eq('area_id', giAreas[0].id)
            .eq('allow_put_away', true)
            .order('put_away_sequence', { ascending: true, nullsFirst: false })
            .limit(1);
          if (giBins && giBins.length > 0) {
            dropBin = `${giBins[0].bin_id} (${giBins[0].name})`;
          } else {
            dropBin = `${giAreas[0].area_id} — ${giAreas[0].name}`;
          }
        }

        anticipated.push({
          task_type: 'pick',
          sequence: 1,
          description: `Pick ${qty} × ${product?.name || productCode} from ${sourceBinLabel} into new PU`,
          product_name: product?.name,
          product_id_code: productCode,
          quantity: qty,
          source_bin: sourceBinLabel,
          source_area: sourceAreaLabel,
        });

        anticipated.push({
          task_type: 'drop',
          sequence: 2,
          description: `Drop PU in ${dropBin}`,
          destination_bin: dropBin,
          destination_area: dropArea,
        });
      }
    } else if (isPackShip) {
      anticipated.push({
        task_type: 'pack',
        sequence: 1,
        description: 'Pack all picked items into shipping containers',
      });
      anticipated.push({
        task_type: 'ship',
        sequence: 2,
        description: 'Create outbound delivery and complete shipment',
      });
    }

    setAnticipatedTasks(anticipated);
    setIsLoadingTasks(false);
  };

  const handleStart = async () => {
    if (!workOrder || !locationId || !companyId) return;
    setIsStarting(true);

    try {
      const tasksToInsert: any[] = [];
      const isPick = workOrder.title.startsWith('Pick:');
      const isPackShip = workOrder.title.startsWith('Pack & Ship:');

      if (isPick) {
        const descMatch = workOrder.description?.match(/Pick (\d+) unit\(s\) of (\S+)/);
        const qty = descMatch ? parseInt(descMatch[1], 10) : 0;
        const productCode = descMatch ? descMatch[2] : null;

        if (productCode && qty > 0) {
          // Find product
          const { data: products } = await supabase
            .from('products')
            .select('id, product_id, name')
            .eq('product_id', productCode)
            .limit(1);
          const product = products?.[0];

          if (product) {
            // Find best bin using picking_sequence
            const { data: invData } = await supabase
              .from('inventory')
              .select(`
                id, quantity, bin_id, product_id,
                bin:bins(id, bin_id, name, picking_sequence, area_id)
              `)
              .eq('location_id', locationId)
              .eq('product_id', product.id)
              .gt('quantity', 0);

            const inventoryLines = (invData || []) as any[];
            inventoryLines.sort((a: any, b: any) => {
              const seqA = a.bin?.picking_sequence;
              const seqB = b.bin?.picking_sequence;
              if (seqA == null && seqB == null) return 0;
              if (seqA == null) return 1;
              if (seqB == null) return -1;
              return seqA - seqB;
            });

            const bestLine = inventoryLines[0];
            const sourceBinId = bestLine?.bin?.id || null;
            const sourceBinCode = bestLine?.bin?.bin_id || 'unknown';

            // Generate a new PU
            let puId: string | null = null;
            const puResult = await createPackagingUnit(companyId, product.id, qty);
            if (puResult) {
              puId = puResult.id;
            }

            // Find GI staging area + drop bin
            const { data: giAreas } = await supabase
              .from('areas')
              .select('id, area_id, name')
              .eq('location_id', locationId)
              .eq('is_goods_issue_enabled', true)
              .limit(1);

            let destBinId: string | null = null;
            let destBinCode = 'GI area';
            if (giAreas && giAreas.length > 0) {
              const { data: giBins } = await supabase
                .from('bins')
                .select('id, bin_id, name, put_away_sequence')
                .eq('area_id', giAreas[0].id)
                .eq('allow_put_away', true)
                .order('put_away_sequence', { ascending: true, nullsFirst: false })
                .limit(1);
              if (giBins && giBins.length > 0) {
                destBinId = giBins[0].id;
                destBinCode = `${giBins[0].bin_id} (${giBins[0].name})`;
              }
            }

            // Pick task
            tasksToInsert.push({
              work_order_id: workOrder.id,
              task_type: 'pick',
              sequence: 1,
              description: `Pick ${qty} × ${product.name} from ${sourceBinCode}${puId ? ' into new PU' : ''}`,
              product_id: product.id,
              quantity: qty,
              source_bin_id: sourceBinId,
              pu_id: puId,
              status: 'pending',
            });

            // Drop task
            tasksToInsert.push({
              work_order_id: workOrder.id,
              task_type: 'drop',
              sequence: 2,
              description: `Drop PU in ${destBinCode}`,
              product_id: product.id,
              quantity: qty,
              destination_bin_id: destBinId,
              pu_id: puId,
              status: 'pending',
            });
          }
        }
      } else if (isPackShip) {
        tasksToInsert.push({
          work_order_id: workOrder.id,
          task_type: 'pack',
          sequence: 1,
          description: 'Pack all picked items into shipping containers',
          status: 'pending',
        });
        tasksToInsert.push({
          work_order_id: workOrder.id,
          task_type: 'ship',
          sequence: 2,
          description: 'Create outbound delivery and complete shipment',
          status: 'pending',
        });
      }

      // Insert work tasks
      if (tasksToInsert.length > 0) {
        const { error: insertError } = await supabase.from('work_tasks').insert(tasksToInsert);
        if (insertError) {
          console.error('Failed to create work tasks:', insertError);
          toast.error('Failed to create work tasks');
          setIsStarting(false);
          return;
        }
      }

      // Update work order status
      await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', workOrder.id);
      toast.success(`Started: ${workOrder.title}`);
      onStarted();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to start work order:', err);
      toast.error('Failed to start work order');
    } finally {
      setIsStarting(false);
    }
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'pick': return <Package className="w-4 h-4 text-blue-500" />;
      case 'drop': return <ArrowDown className="w-4 h-4 text-amber-500" />;
      case 'pack': return <Package className="w-4 h-4 text-violet-500" />;
      case 'ship': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case 'pick': return 'Pick';
      case 'drop': return 'Drop';
      case 'pack': return 'Pack';
      case 'ship': return 'Ship';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Done</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">In Progress</Badge>;
      default:
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Pending</Badge>;
    }
  };

  if (!workOrder) return null;

  const hasTasks = workOrder.status === 'in_progress' ? workTasks.length > 0 : anticipatedTasks.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setIsMaximized(false); onOpenChange(o); }}>
      <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[900px] max-h-[85vh]'}`}>
        <button
          type="button"
          onClick={() => setIsMaximized(!isMaximized)}
          className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <DialogHeader>
          <DialogTitle>Work Order Details</DialogTitle>
          <DialogDescription className="sr-only">View work order details and tasks</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabsList className="mx-6 grid grid-cols-2">
            <TabsTrigger value="details" className="gap-2">
              <Info className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <ListChecks className="w-4 h-4" />
              Tasks
              {hasTasks && (
                <Badge variant="secondary" className="ml-1">
                  {workOrder.status === 'in_progress' ? workTasks.length : anticipatedTasks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
            <TabsContent value="details" className="mt-0 h-full">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <p className="text-sm font-medium">{workOrder.title}</p>
                </div>
                {workOrder.description && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm">{workOrder.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div>
                      <Badge variant="outline" className={
                        workOrder.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          : 'bg-muted text-muted-foreground'
                      }>
                        {workOrder.status === 'in_progress' ? 'In Progress' : 'To Do'}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <div>
                      <Badge variant="outline" className={
                        workOrder.priority === 'urgent' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                        workOrder.priority === 'high' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                        workOrder.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                        'bg-slate-500/10 text-slate-600 border-slate-500/20'
                      }>
                        {workOrder.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Source</Label>
                    <div>
                      {workOrder.source_type ? (
                        <Badge variant="outline" className={
                          workOrder.source_type === 'sales_order'
                            ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
                            : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                        }>
                          {workOrder.source_type === 'sales_order' ? 'Sales Order' : 'Purchase Order'}
                        </Badge>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Assigned To</Label>
                    <p className="text-sm">
                      {workOrder.assignee
                        ? `${workOrder.assignee.first_name} ${workOrder.assignee.last_name}`
                        : <span className="text-muted-foreground">Unassigned</span>}
                    </p>
                  </div>
                  {workOrder.due_date && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Due Date</Label>
                      <p className="text-sm">{new Date(workOrder.due_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Created</Label>
                    <p className="text-sm">{new Date(workOrder.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 h-full">
              {isLoadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : workOrder.status === 'todo' ? (
                /* Anticipated tasks for unstarted work orders */
                anticipatedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ListChecks className="w-12 h-12 mb-3 opacity-30" />
                    <p className="font-medium">No anticipated tasks</p>
                    <p className="text-sm mt-1">Tasks will be generated when this work order is started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                      These tasks will be created when you start this work order
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead className="w-20">Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Source Area</TableHead>
                          <TableHead>Source Bin</TableHead>
                          <TableHead>Dest. Area</TableHead>
                          <TableHead>Dest. Bin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {anticipatedTasks.map((task, i) => (
                          <TableRow key={i} className="opacity-75">
                            <TableCell className="font-mono text-muted-foreground">{task.sequence}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {getTaskTypeIcon(task.task_type)}
                                <span className="text-xs font-medium">{getTaskTypeLabel(task.task_type)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{task.description}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{task.source_area || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{task.source_bin || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{task.destination_area || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{task.destination_bin || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : (
                /* Actual work tasks for started work orders */
                workTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ListChecks className="w-12 h-12 mb-3 opacity-30" />
                    <p className="font-medium">No work tasks</p>
                    <p className="text-sm mt-1">No tasks were generated for this work order</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="w-20">Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Source Area</TableHead>
                        <TableHead>Source Bin</TableHead>
                        <TableHead>Dest. Area</TableHead>
                        <TableHead>Dest. Bin</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-mono text-muted-foreground">{task.sequence}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {getTaskTypeIcon(task.task_type)}
                              <span className="text-xs font-medium">{getTaskTypeLabel(task.task_type)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{task.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.source_bin?.area ? `${task.source_bin.area.area_id} — ${task.source_bin.area.name}` : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.source_bin ? `${task.source_bin.bin_id} (${task.source_bin.name})` : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.destination_bin?.area ? `${task.destination_bin.area.area_id} — ${task.destination_bin.area.name}` : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.destination_bin ? `${task.destination_bin.bin_id} (${task.destination_bin.name})` : '—'}
                          </TableCell>
                          <TableCell>{getStatusBadge(task.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          {workOrder.status === 'todo' && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive mr-auto"
              onClick={() => onDelete(workOrder.id)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          {workOrder.status === 'todo' && (
            <Button
              variant="outline"
              onClick={handleStart}
              disabled={isStarting}
            >
              {isStarting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
              Start
            </Button>
          )}
          {workOrder.status === 'in_progress' && (
            <Button onClick={() => onCompleted()}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViewWorkOrderDialog;
