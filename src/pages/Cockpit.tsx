import { useEffect, useState, useRef, useCallback } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useSaveShortcut, useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { supabase } from '@/integrations/supabase/client';
import { postGoodsIssue, postGoodsReceipt } from '@/lib/inventory-posting';
import { checkAndCompleteDelivery } from '@/lib/delivery-fulfillment';
import { createMultiplePackagingUnits } from '@/lib/packaging-units';
import { logMaterialMovement } from '@/lib/material-movements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { ReceiveDeliveryDialog } from '@/components/ReceiveDeliveryDialog';
import { InventoryDetailDialog } from '@/components/InventoryDetailDialog';
import BinDialog, { BinDialogRef } from '@/components/cockpit/BinDialog';
import ViewBinDialog from '@/components/cockpit/ViewBinDialog';
import ViewAreaDialog from '@/components/cockpit/ViewAreaDialog';
import AutoMakeBinsDialog from '@/components/cockpit/AutoMakeBinsDialog';
import AutoMakeAreasDialog from '@/components/cockpit/AutoMakeAreasDialog';
import BinSequenceDialog from '@/components/cockpit/BinSequenceDialog';
import { BulkInventoryActionsDialog } from '@/components/cockpit/BulkInventoryActionsDialog';
import MaterialMovementsDialog from '@/components/cockpit/MaterialMovementsDialog';
import ViewWorkOrderDialog from '@/components/cockpit/ViewWorkOrderDialog';
import { ImportProgressDialog, ImportResult } from '@/components/ImportProgressDialog';
import CockpitUsersTab from '@/components/cockpit/CockpitUsersTab';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowLeft, Gauge, MapPin, Package, ShoppingCart, Truck, Users, TrendingUp, Lock, Grid3X3, Box, Plus, Pencil, Trash2, Boxes, Search, Loader2, PanelLeftClose, PanelLeft, Wand2, Split, Package2, X, MoveRight, Eye, Maximize2, Minimize2, ClipboardList, ArrowUpDown, RefreshCw, ListTodo, AlertTriangle } from 'lucide-react';
import { useTableSort } from '@/hooks/use-table-sort';
import { SortableTableHead } from '@/components/SortableTableHead';
import { toast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Location {
  id: string;
  location_id: string;
  name: string;
  type: string;
  address_line1: string;
  city: string;
  state: string;
}

interface Area {
  id: string;
  area_id: string;
  name: string;
  description: string | null;
  location_id: string;
  width?: number | null;
  width_uom?: string | null;
  length?: number | null;
  length_uom?: string | null;
  height?: number | null;
  height_uom?: string | null;
  is_production_enabled?: boolean;
  is_goods_receipt_enabled?: boolean;
  is_goods_issue_enabled?: boolean;
}

interface Bin {
  id: string;
  bin_id: string;
  name: string;
  description: string | null;
  capacity: string | null;
  area_id: string;
  width?: number | null;
  width_uom?: string | null;
  length?: number | null;
  length_uom?: string | null;
  height?: number | null;
  height_uom?: string | null;
  weight_capacity?: number | null;
  weight_capacity_uom?: string | null;
  is_production_enabled?: boolean;
  is_hazardous?: boolean;
  allow_put_away?: boolean;
  allow_picking?: boolean;
}

interface Delivery {
  id: string;
  delivery_id: string;
  status: string;
  expected_date: string | null;
  created_at?: string | null;
  purchase_order_id: string | null;
  is_fulfilled: boolean;
  vendor?: { name: string } | null;
  purchase_order?: { 
    po_number: string;
    source_location_id: string | null;
    source_location?: { name: string; location_id: string } | null;
  } | null;
}

interface InventoryItem {
  id: string;
  location_id: string;
  bin_id: string | null;
  product_id: string;
  quantity: number;
  min_quantity: number | null;
  max_quantity: number | null;
  pu_id: string | null;
  batch_id: string | null;
  uom_id: string | null;
  product?: { name: string; product_id: string; sku: string | null; company_id: string; hazardous?: boolean };
  bin?: { bin_id: string; name: string } | null;
  packaging_unit?: { pu_number: string } | null;
  batch?: { batch_number: string; expiration_date: string | null } | null;
  uom?: { id: string; name: string; abbreviation: string | null } | null;
  received_at?: string | null; // Date product arrived in its current bin (or was first received)
}

interface OutboundOrder {
  id: string;
  delivery_number: string;
  status: string;
  sales_order_id: string | null;
  purchase_order_id: string | null;
  customer_id: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  goods_issue_id: string | null;
  created_at: string;
  notes: string | null;
  expected_date: string | null;
  customer?: { name: string; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null } | null;
  to_location?: { name: string; location_id: string } | null;
  sales_order?: { so_number: string; total_amount: number } | null;
  purchase_order?: { po_number: string; total_amount: number } | null;
}

interface OutboundOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  uom_id?: string | null;
  product?: { name: string; product_id: string; unit?: string | null };
}

interface ProductionOrder {
  id: string;
  order_number: string;
  status: string;
  quantity: number;
  created_at: string;
  product?: { name: string; product_id: string } | null;
  bom?: { name: string; bom_id: string } | null;
}


const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  confirmed: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  processing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  shipped: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  in_transit: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  partial: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  delivered: 'bg-green-500/10 text-green-600 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

type SidebarTab = 'deliveries' | 'orders' | 'work_orders' | 'production' | 'areas' | 'bins' | 'users' | 'inventory';

const Cockpit = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('deliveries');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLocationAdmin, setIsLocationAdmin] = useState(false);
  const locationRoleMapRef = useRef<Record<string, string>>({});

  // Areas & Bins state
  const [areas, setAreas] = useState<Area[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isAreaMaximized, setIsAreaMaximized] = useMaximizedState();
  const [isBinDialogOpen, setIsBinDialogOpen] = useState(false);
  const [isViewBinDialogOpen, setIsViewBinDialogOpen] = useState(false);
  const [isViewAreaDialogOpen, setIsViewAreaDialogOpen] = useState(false);
  const [viewingArea, setViewingArea] = useState<Area | null>(null);
  const [isAutoMakeDialogOpen, setIsAutoMakeDialogOpen] = useState(false);
  const [isAutoMakeAreasDialogOpen, setIsAutoMakeAreasDialogOpen] = useState(false);
  const [isBinSequenceDialogOpen, setIsBinSequenceDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  const [viewingBin, setViewingBin] = useState<Bin | null>(null);
const [areaFormData, setAreaFormData] = useState({ 
    area_id: '', 
    name: '', 
    description: '',
    width: '' as string | number,
    width_uom: 'in',
    length: '' as string | number,
    length_uom: 'in',
    height: '' as string | number,
    height_uom: 'in',
    is_production_enabled: false,
    is_goods_receipt_enabled: false,
    is_goods_issue_enabled: false,
  });
  const [areaDialogTab, setAreaDialogTab] = useState('general');
  const areaFormRef = useRef<HTMLFormElement>(null);
  const binDialogRef = useRef<BinDialogRef>(null);

  // Deliveries state
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState<number>(0);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [deliveriesWithOpenTasks, setDeliveriesWithOpenTasks] = useState<Set<string>>(new Set());
  
  // Receive delivery state
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [isNoInventoryAccountOpen, setIsNoInventoryAccountOpen] = useState(false);

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [isInventoryDetailOpen, setIsInventoryDetailOpen] = useState(false);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());
  const [isBulkPackageDialogOpen, setIsBulkPackageDialogOpen] = useState(false);
  const [isBulkExploding, setIsBulkExploding] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [moveToBinId, setMoveToBinId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);
  const [isMaterialFlowDialogOpen, setIsMaterialFlowDialogOpen] = useState(false);

   // Outbound orders to fulfill state
  const [outboundOrders, setOutboundOrders] = useState<OutboundOrder[]>([]);
  const [selectedOutboundOrder, setSelectedOutboundOrder] = useState<OutboundOrder | null>(null);
  const [outboundOrderItems, setOutboundOrderItems] = useState<OutboundOrderItem[]>([]);
  const [fulfillQuantities, setFulfillQuantities] = useState<Record<string, number>>({});
  const [isFulfillDialogOpen, setIsFulfillDialogOpen] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);

  // View delivery / order detail dialogs
  const [viewingOutboundDelivery, setViewingOutboundDelivery] = useState<OutboundOrder | null>(null);
  const [viewingOutboundDeliveryItems, setViewingOutboundDeliveryItems] = useState<OutboundOrderItem[]>([]);
  const [isViewDeliveryDetailOpen, setIsViewDeliveryDetailOpen] = useState(false);
  const [viewingOrderDetail, setViewingOrderDetail] = useState<OutboundOrder | null>(null);
  const [viewingOrderDetailItems, setViewingOrderDetailItems] = useState<OutboundOrderItem[]>([]);
  const [isViewOrderDetailOpen, setIsViewOrderDetailOpen] = useState(false);

  // Multi-select fulfillment state
  const [selectedFulfillOrderIds, setSelectedFulfillOrderIds] = useState<Set<string>>(new Set());
  const [isBulkFulfilling, setIsBulkFulfilling] = useState(false);
  const [isBulkFulfillDialogOpen, setIsBulkFulfillDialogOpen] = useState(false);
  const [bulkFulfillProgressOpen, setBulkFulfillProgressOpen] = useState(false);
  const [bulkFulfillResults, setBulkFulfillResults] = useState<ImportResult[]>([]);
  const [bulkFulfillProcessed, setBulkFulfillProcessed] = useState(0);
  const [bulkFulfillTotal, setBulkFulfillTotal] = useState(0);
  const [bulkFulfillComplete, setBulkFulfillComplete] = useState(false);

  // Work orders (tasks) state
  const [workOrders, setWorkOrders] = useState<{ id: string; title: string; description: string | null; status: string; priority: string; due_date: string | null; source_type: string | null; source_id: string | null; assigned_to: string | null; created_at: string; assignee?: { first_name: string; last_name: string } | null }[]>([]);

  // Work task preview dialog state
  const [isWorkPreviewOpen, setIsWorkPreviewOpen] = useState(false);
  const [workPreviewTasks, setWorkPreviewTasks] = useState<{ title: string; description: string }[]>([]);
  const [workPreviewOrderInfo, setWorkPreviewOrderInfo] = useState<{ orderType: 'so' | 'po'; orderId: string; orderNumber: string }[]>([]);
  const [isCreatingWorkTasks, setIsCreatingWorkTasks] = useState(false);

  // Work orders multi-select state
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<Set<string>>(new Set());
  const [viewingWorkOrder, setViewingWorkOrder] = useState<typeof workOrders[number] | null>(null);
  const [isDeleteWorkOrdersOpen, setIsDeleteWorkOrdersOpen] = useState(false);
  const [workOrderIdsToDelete, setWorkOrderIdsToDelete] = useState<string[]>([]);

  // Production orders state
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);

  // Receiving tasks state
  const [isCreatingReceiveTasks, setIsCreatingReceiveTasks] = useState(false);
  const [isReceiveTaskPreviewOpen, setIsReceiveTaskPreviewOpen] = useState(false);
  const [receiveTaskPreviewList, setReceiveTaskPreviewList] = useState<{ title: string; description: string }[]>([]);
  const [receiveTaskDelivery, setReceiveTaskDelivery] = useState<Delivery | null>(null);
  const [receiveTaskPayloads, setReceiveTaskPayloads] = useState<any[]>([]);
  const [isLoadingReceivePreview, setIsLoadingReceivePreview] = useState(false);

  // Preview receiving tasks before creating
  const handlePreviewReceiveTasks = async (delivery: Delivery) => {
    if (!companyId || !selectedLocationId || !user) return;
    setIsLoadingReceivePreview(true);
    try {
      // Check if tasks already exist for this delivery
      const { count: existingCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('source_type', 'delivery_receive')
        .eq('source_id', delivery.id)
        .in('status', ['todo', 'in_progress']);
      
      if (existingCount && existingCount > 0) {
        toast.error(`${existingCount} receiving task(s) already exist for this delivery`);
        setIsLoadingReceivePreview(false);
        return;
      }

      // Fetch delivery items with PU info
      const { data: deliveryItems } = await supabase
        .from('delivery_items')
        .select('id, product_id, quantity, pu_id, packaging_unit:packaging_units(pu_number), product:products(name, product_id)')
        .eq('delivery_id', delivery.id);

      if (!deliveryItems || deliveryItems.length === 0) {
        toast.error('No items found on this delivery');
        setIsLoadingReceivePreview(false);
        return;
      }

      const tasksToCreate: any[] = [];
      const previewList: { title: string; description: string }[] = [];

      // Create one task per PU, or one per product line if no PU
      const hasPackages = deliveryItems.some((item: any) => item.pu_id);

      if (hasPackages) {
        const puGroups = new Map<string, { puNumber: string; items: any[] }>();
        const unpackedItems: any[] = [];

        for (const item of deliveryItems as any[]) {
          if (item.pu_id) {
            const existing = puGroups.get(item.pu_id);
            if (existing) {
              existing.items.push(item);
            } else {
              puGroups.set(item.pu_id, {
                puNumber: item.packaging_unit?.pu_number || item.pu_id,
                items: [item],
              });
            }
          } else {
            unpackedItems.push(item);
          }
        }

        // One task per PU
        for (const [puId, group] of puGroups) {
          const itemSummary = group.items.map((i: any) => `${i.product?.name || 'Unknown'} x${i.quantity}`).join(', ');
          const title = `Receive ${group.puNumber} from ${delivery.delivery_id}`;
          const description = `Package ${group.puNumber}: ${itemSummary}`;
          previewList.push({ title, description: `${description}\n→ Receive then Put Away` });
          tasksToCreate.push({
            company_id: companyId,
            location_id: selectedLocationId,
            title,
            description,
            status: 'todo',
            priority: 'medium',
            source_type: 'delivery_receive',
            source_id: delivery.id,
            created_by: user.id,
          });
        }

        // One task per unpacked product line
        for (const item of unpackedItems) {
          const productName = (item as any).product?.name || 'Unknown';
          const title = `Receive ${productName} x${item.quantity} from ${delivery.delivery_id}`;
          const description = `${productName} x${item.quantity} (unpacked)`;
          previewList.push({ title, description: `${description}\n→ Receive then Put Away` });
          tasksToCreate.push({
            company_id: companyId,
            location_id: selectedLocationId,
            title,
            description,
            status: 'todo',
            priority: 'medium',
            source_type: 'delivery_receive',
            source_id: delivery.id,
            created_by: user.id,
          });
        }
      } else {
        // No packages: one task per product line
        for (const item of deliveryItems as any[]) {
          const productName = (item as any).product?.name || 'Unknown';
          const title = `Receive ${productName} x${item.quantity} from ${delivery.delivery_id}`;
          const description = `${productName} x${item.quantity}`;
          previewList.push({ title, description: `${description}\n→ Receive then Put Away` });
          tasksToCreate.push({
            company_id: companyId,
            location_id: selectedLocationId,
            title,
            description,
            status: 'todo',
            priority: 'medium',
            source_type: 'delivery_receive',
            source_id: delivery.id,
            created_by: user.id,
          });
        }
      }

      setReceiveTaskPreviewList(previewList);
      setReceiveTaskPayloads(tasksToCreate);
      setReceiveTaskDelivery(delivery);
      setIsReceiveTaskPreviewOpen(true);
    } catch (err) {
      console.error('Error loading receiving task preview:', err);
      toast.error('Failed to load task preview');
    } finally {
      setIsLoadingReceivePreview(false);
    }
  };

  // Confirm and create receiving tasks
  const handleConfirmReceiveTasks = async () => {
    if (receiveTaskPayloads.length === 0) return;
    setIsCreatingReceiveTasks(true);
    try {
      const { error } = await supabase.from('tasks').insert(receiveTaskPayloads);
      if (error) {
        toast.error('Failed to create receiving tasks');
      } else {
        toast.success(`Created ${receiveTaskPayloads.length} receiving task${receiveTaskPayloads.length !== 1 ? 's' : ''}`);
        fetchWorkOrders();
        fetchPendingDeliveries();
      }
    } catch (err) {
      console.error('Error creating receiving tasks:', err);
      toast.error('Failed to create receiving tasks');
    } finally {
      setIsCreatingReceiveTasks(false);
      setIsReceiveTaskPreviewOpen(false);
    }
  };

  // Complete a delivery receiving task - per-item GR creation then put-away
  const handleCompleteReceiveTask = async (taskId: string, deliverySourceId: string) => {
    if (!companyId || !selectedLocationId) return;

    try {
      // Get the work_tasks for this task
      const { data: workTasksList } = await supabase
        .from('work_tasks')
        .select('id, task_type, status, product_id, quantity, pu_id, destination_bin_id')
        .eq('work_order_id', taskId)
        .order('sequence');

      // If this task has work_tasks, check if all are done
      if (workTasksList && workTasksList.length > 0) {
        const allDone = workTasksList.every((wt: any) => wt.status === 'done');
        if (!allDone) {
          toast.error('Please complete all sub-tasks (Receive then Put Away) before marking done');
          return;
        }
      }

      // Mark task as done
      await supabase.from('tasks').update({ status: 'done' }).eq('id', taskId);

      // Check if all tasks for this delivery are now done
      const { data: remainingTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('company_id', companyId)
        .eq('source_type', 'delivery_receive')
        .eq('source_id', deliverySourceId)
        .in('status', ['todo', 'in_progress']);

      if (remainingTasks && remainingTasks.length > 0) {
        toast.success('Task completed. Remaining tasks must be completed to finish receiving.');
        fetchWorkOrders();
        return;
      }

      // All tasks done — update delivery status
      const { data: delivery } = await supabase
        .from('deliveries')
        .select('delivery_id, purchase_order_id')
        .eq('id', deliverySourceId)
        .single();

      if (delivery) {
        await supabase
          .from('deliveries')
          .update({ status: 'delivered', delivered_date: new Date().toISOString().split('T')[0] })
          .eq('id', deliverySourceId);

        if (delivery.purchase_order_id) {
          const { syncPurchaseOrderStatus } = await import('@/lib/delivery-fulfillment');
          await syncPurchaseOrderStatus(delivery.purchase_order_id);
        }

        toast.success(`All receiving tasks completed for ${delivery.delivery_id}`);
      }

      fetchWorkOrders();
      fetchPendingDeliveries();
      fetchInventory();
    } catch (err) {
      console.error('Error completing receive task:', err);
      toast.error('Failed to complete receiving');
      fetchWorkOrders();
    }
  };

  // Complete a single receive work task - creates GR for this item
  const handleCompleteReceiveWorkTask = async (workTaskId: string, workOrderId: string) => {
    if (!companyId || !selectedLocationId) return;

    try {
      // Get work task details
      const { data: workTask } = await supabase
        .from('work_tasks')
        .select('id, product_id, quantity, pu_id, work_order_id, destination_bin_id')
        .eq('id', workTaskId)
        .single();

      if (!workTask) {
        toast.error('Work task not found');
        return;
      }

      // Get parent task info for delivery reference
      const { data: parentTask } = await supabase
        .from('tasks')
        .select('source_id')
        .eq('id', workOrderId)
        .single();

      const deliverySourceId = parentTask?.source_id;

      // Get delivery info
      const { data: delivery } = await supabase
        .from('deliveries')
        .select('delivery_id, purchase_order_id')
        .eq('id', deliverySourceId || '')
        .single();

      // Create goods receipt for this specific item
      const { data: receiptNumber } = await supabase.rpc(
        'get_next_goods_receipt_number',
        { p_company_id: companyId }
      );

      if (!receiptNumber) {
        toast.error('Failed to generate receipt number');
        return;
      }

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
          task_id: workOrderId,
          notes: `Received via task: ${(workTask as any).product_id ? 'product' : 'items'} from delivery ${delivery?.delivery_id || ''}`,
        })
        .select()
        .single();

      if (grError || !goodsReceipt) {
        toast.error('Failed to create goods receipt');
        return;
      }

      // Create GR item with destination bin (GR area bin)
      const receiveBinId = (workTask as any).destination_bin_id || null;
      await supabase.from('goods_receipt_items').insert({
        goods_receipt_id: (goodsReceipt as any).id,
        product_id: (workTask as any).product_id,
        quantity: (workTask as any).quantity,
        pu_id: (workTask as any).pu_id || null,
        bin_id: receiveBinId,
      });

      // Post the goods receipt to update inventory (unbinned)
      const postResult = await postGoodsReceipt((goodsReceipt as any).id, selectedLocationId);

      // Mark receive work task as done
      await supabase.from('work_tasks').update({ status: 'done' }).eq('id', workTaskId);

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

      fetchInventory();
    } catch (err) {
      console.error('Error completing receive work task:', err);
      toast.error('Failed to complete receiving step');
    }
  };

  // Complete a put_away work task - moves inventory to target bin
  const handleCompletePutAwayWorkTask = async (workTaskId: string) => {
    if (!companyId || !selectedLocationId) return;

    try {
      // Get work task details
      const { data: workTask } = await supabase
        .from('work_tasks')
        .select('id, product_id, quantity, pu_id, destination_bin_id, source_bin_id')
        .eq('id', workTaskId)
        .single();

      if (!workTask) {
        toast.error('Work task not found');
        return;
      }

      const destBinId = (workTask as any).destination_bin_id;
      const productId = (workTask as any).product_id;
      const puId = (workTask as any).pu_id;

      // Get the source bin (GR area bin where product was received)
      const sourceBinId = (workTask as any).source_bin_id || null;

      if (destBinId && productId) {
        // Find inventory at source bin (GR area) for this product/PU
        let query = supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', selectedLocationId)
          .eq('product_id', productId);

        if (sourceBinId) {
          query = query.eq('bin_id', sourceBinId);
        } else {
          query = query.is('bin_id', null);
        }

        if (puId) {
          query = query.eq('pu_id', puId);
        } else {
          query = query.is('pu_id', null);
        }

        const { data: unbinnedInv } = await query.limit(1).maybeSingle();

        if (unbinnedInv) {
          // Move inventory to the target bin
          await supabase
            .from('inventory')
            .update({ bin_id: destBinId, updated_at: new Date().toISOString() })
            .eq('id', unbinnedInv.id);
        }
      }

      // Mark put_away work task as done
      await supabase.from('work_tasks').update({ status: 'done' }).eq('id', workTaskId);
      toast.success('Put away completed');
      fetchInventory();
    } catch (err) {
      console.error('Error completing put away work task:', err);
      toast.error('Failed to complete put away step');
    }
  };


  // Save shortcuts
  useSaveShortcut(() => {
    if (isAreaDialogOpen) areaFormRef.current?.requestSubmit();
    else if (isBinDialogOpen) binDialogRef.current?.submit();
  });

  const isWarehouseOrDC = selectedLocation?.type === 'Warehouse' || selectedLocation?.type === 'Distribution Center';

  // Set transaction
  useEffect(() => {
    setTransaction('cpit');
  }, [setTransaction]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId && user) {
      fetchAccessibleLocations();
    }
  }, [companyId, user]);

  useEffect(() => {
    if (selectedLocationId && locations.length > 0) {
      const location = locations.find(l => l.id === selectedLocationId);
      setSelectedLocation(location || null);
      setIsLocationAdmin(locationRoleMapRef.current[selectedLocationId] === 'admin');
    }
  }, [selectedLocationId, locations]);

  const refreshCockpit = useCallback(() => {
    if (!selectedLocationId) return;
    fetchAreas();
    fetchPendingDeliveries();
    fetchInventory();
    fetchOutboundOrders();
    fetchWorkOrders();
    fetchProductionOrders();
  }, [selectedLocationId]);

  useEffect(() => {
    if (selectedLocationId) {
      fetchAreas();
    } else {
      setAreas([]);
      setBins([]);
    }
  }, [selectedLocationId]);

  useEffect(() => {
    if (selectedLocationId) {
      fetchPendingDeliveries();
      fetchInventory();
      fetchOutboundOrders();
      fetchWorkOrders();
      fetchProductionOrders();
    } else {
      setPendingDeliveriesCount(0);
      setInventory([]);
      setOutboundOrders([]);
      setWorkOrders([]);
      setProductionOrders([]);
    }
  }, [selectedLocationId]);

  const fetchCompanyId = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();
    
    if (data?.company_id) {
      setCompanyId(data.company_id);
    }
  };

  const fetchAccessibleLocations = async () => {
    const [{ data: accessibleLocationData }, { data: prefs }] = await Promise.all([
      supabase
        .from('location_users')
        .select('location_id, role')
        .eq('user_id', user!.id),
      supabase
        .from('user_preferences')
        .select('default_location_id')
        .eq('user_id', user!.id)
        .maybeSingle(),
    ]);

    if (!accessibleLocationData || accessibleLocationData.length === 0) {
      setLocations([]);
      return;
    }

    // Store role map for quick lookup
    const roleMap: Record<string, string> = {};
    accessibleLocationData.forEach((l: any) => {
      roleMap[l.location_id] = l.role || 'member';
    });
    locationRoleMapRef.current = roleMap;

    const locationIds = accessibleLocationData.map(l => l.location_id);

    const { data } = await supabase
      .from('locations')
      .select('id, location_id, name, type, address_line1, city, state')
      .eq('company_id', companyId!)
      .in('id', locationIds)
      .order('location_id');

    setLocations(data || []);

    // Auto-select default location if set and accessible
    if (!selectedLocationId && prefs?.default_location_id && data?.some(l => l.id === prefs.default_location_id)) {
      setSelectedLocationId(prefs.default_location_id);
    }
  };

  const fetchAreas = async () => {
    if (!selectedLocationId) return;
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('location_id', selectedLocationId)
      .order('area_id');
    
    if (error) {
      console.error('Failed to fetch areas:', error);
      return;
    }
    setAreas(data || []);
    
    if (data && data.length > 0) {
      const areaIds = data.map(a => a.id);
      const { data: binData } = await supabase
        .from('bins')
        .select('*')
        .in('area_id', areaIds)
        .order('bin_id');
      setBins(binData || []);
    } else {
      setBins([]);
    }
  };

  const fetchPendingDeliveries = async () => {
    if (!selectedLocationId || !companyId) return;
    const { data, count, error } = await supabase
      .from('deliveries')
      .select(`
        id, 
        delivery_id, 
        created_at,
        status, 
        expected_date, 
        purchase_order_id, 
        is_fulfilled,
        vendor:vendors(name), 
        purchase_order:purchase_orders(
          po_number, 
          source_location_id, 
          source_location:locations!purchase_orders_source_location_id_fkey(name, location_id)
        )
      `, { count: 'exact' })
      .eq('location_id', selectedLocationId)
      .in('status', ['in_transit', 'partially_delivered'])
      .order('expected_date', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch pending deliveries:', error);
      return;
    }
    setPendingDeliveriesCount(count || 0);
    setPendingDeliveries((data || []) as unknown as Delivery[]);

    // Fetch delivery IDs that have open receiving tasks
    if (data && data.length > 0) {
      const deliveryIds = data.map((d: any) => d.id);
      const { data: openTasks } = await supabase
        .from('tasks')
        .select('source_id')
        .eq('company_id', companyId)
        .eq('source_type', 'delivery_receive')
        .in('source_id', deliveryIds)
        .in('status', ['todo', 'in_progress']);
      
      const idsWithTasks = new Set((openTasks || []).map((t: any) => t.source_id as string));
      setDeliveriesWithOpenTasks(idsWithTasks);
    } else {
      setDeliveriesWithOpenTasks(new Set());
    }
  };

  const fetchInventory = async () => {
    if (!selectedLocationId) return;
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        id,
        location_id,
        bin_id,
        product_id,
        quantity,
        min_quantity,
        max_quantity,
        pu_id,
        batch_id,
        uom_id,
        product:products(name, product_id, sku, company_id, hazardous),
        bin:bins(bin_id, name),
        packaging_unit:packaging_units(pu_number),
        batch:batches(batch_number, expiration_date),
        uom:product_uoms(id, name, abbreviation)
      `)
      .eq('location_id', selectedLocationId)
      .order('quantity', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch inventory:', error);
      return;
    }

    // Fetch material movements for this location to derive received_at dates
    const { data: movements } = await supabase
      .from('material_movements')
      .select('product_id, pu_id, destination_bin_id, bin_id, movement_type, created_at')
      .eq('location_id', selectedLocationId)
      .in('movement_type', ['receipt', 'move_in', 'transfer'])
      .order('created_at', { ascending: false });

    const movementList = (movements || []) as Array<{
      product_id: string;
      pu_id: string | null;
      destination_bin_id: string | null;
      bin_id: string | null;
      movement_type: string;
      created_at: string;
    }>;

    const inventoryWithDates = ((data || []) as any[]).map((item: any) => {
      let received_at: string | null = null;

      if (item.bin_id) {
        // Binned: find latest move_in or transfer into this bin for this product
        const match = movementList.find(
          m =>
            m.product_id === item.product_id &&
            (m.pu_id === item.pu_id || (!m.pu_id && !item.pu_id)) &&
            (m.destination_bin_id === item.bin_id || m.bin_id === item.bin_id) &&
            (m.movement_type === 'move_in' || m.movement_type === 'transfer')
        );
        // Fallback to any receipt movement for this product if no bin movement found
        received_at = match?.created_at ?? (
          movementList.find(
            m => m.product_id === item.product_id && m.movement_type === 'receipt'
          )?.created_at ?? null
        );
      } else {
        // Unbinned: latest receipt movement for this product(/pu)
        const match = movementList.find(
          m =>
            m.product_id === item.product_id &&
            (m.pu_id === item.pu_id || (!m.pu_id && !item.pu_id)) &&
            m.movement_type === 'receipt'
        );
        received_at = match?.created_at ?? null;
      }

      return { ...item, received_at };
    });

    setInventory(inventoryWithDates as unknown as InventoryItem[]);
    setSelectedInventoryIds(new Set());
  };

  // Filtered inventory based on search
  // Use table sort hook for inventory
  const {
    sortConfig: inventorySortConfig,
    filters: inventoryFilters,
    handleSort: handleInventorySort,
    setFilter: setInventoryFilter,
    clearAllFilters: clearAllInventoryFilters,
    sortedAndFilteredData: sortedAndFilteredInventory,
  } = useTableSort(inventory, 'product.product_id', 'asc');

  // Apply additional text search on top of column filters
  const filteredInventory = sortedAndFilteredInventory.filter(item => {
    if (!inventorySearch) return true;
    const search = inventorySearch.toLowerCase();
    return (
      item.product?.name?.toLowerCase().includes(search) ||
      item.product?.product_id?.toLowerCase().includes(search) ||
      item.product?.sku?.toLowerCase().includes(search) ||
      item.bin?.bin_id?.toLowerCase().includes(search)
    );
  });

  const hasActiveInventoryFilters = Object.keys(inventoryFilters).length > 0;

  // Sort hooks for other cockpit tables
  const {
    sortConfig: deliverySortConfig,
    filters: deliveryFilters,
    handleSort: handleDeliverySort,
    setFilter: setDeliveryFilter,
    sortedAndFilteredData: sortedDeliveries,
  } = useTableSort(pendingDeliveries, 'delivery_id', 'asc');

  const {
    sortConfig: ordersSortConfig,
    filters: ordersFilters,
    handleSort: handleOrdersSort,
    setFilter: setOrdersFilter,
    sortedAndFilteredData: sortedOutboundOrders,
  } = useTableSort(outboundOrders, 'delivery_number', 'asc');

  const {
    sortConfig: workOrdersSortConfig,
    filters: workOrdersFilters,
    handleSort: handleWorkOrdersSort,
    setFilter: setWorkOrdersFilter,
    sortedAndFilteredData: sortedWorkOrders,
  } = useTableSort(workOrders, 'status', 'asc');

  const {
    sortConfig: areasSortConfig,
    filters: areasFilters,
    handleSort: handleAreasSort,
    setFilter: setAreasFilter,
    sortedAndFilteredData: sortedAreas,
  } = useTableSort(areas, 'area_id', 'asc');

  const {
    sortConfig: binsSortConfig,
    filters: binsFilters,
    handleSort: handleBinsSort,
    setFilter: setBinsFilter,
    sortedAndFilteredData: sortedBins,
  } = useTableSort(bins, 'bin_id', 'asc');

  // Get selected inventory items
  const selectedInventoryItems = inventory.filter(item => selectedInventoryIds.has(item.id));

  // Bulk explode handler
  const handleBulkExplode = async () => {
    if (selectedInventoryIds.size === 0) {
      toast.error('No items selected');
      return;
    }

    const itemsToExplode = selectedInventoryItems.filter(item => item.quantity > 1);
    if (itemsToExplode.length === 0) {
      toast.error('Selected items must have quantity > 1 to explode');
      return;
    }

    const companyIdForExplode = itemsToExplode[0]?.product?.company_id;
    if (!companyIdForExplode) {
      toast.error('Missing company information');
      return;
    }

    setIsBulkExploding(true);
    try {
      let totalCreated = 0;

      for (const item of itemsToExplode) {
        const hasExistingPU = !!item.pu_id;
        const newPUsNeeded = hasExistingPU ? item.quantity - 1 : item.quantity;

        // Create PUs only for items that need them
        const itemsForPU = Array.from({ length: newPUsNeeded }, () => ({
          productId: item.product_id,
          quantity: 1,
        }));

        const createdPUs = newPUsNeeded > 0 
          ? await createMultiplePackagingUnits(companyIdForExplode, itemsForPU)
          : [];

        // Update the original record to quantity 1 (keeping existing PU if present)
        await supabase
          .from('inventory')
          .update({ quantity: 1 })
          .eq('id', item.id);

        // Create new individual inventory records for remaining units
        if (createdPUs.length > 0) {
          const inventoryRecords = createdPUs.map((pu) => ({
            location_id: item.location_id,
            product_id: item.product_id,
            bin_id: item.bin_id,
            quantity: 1,
            min_quantity: item.min_quantity,
            max_quantity: item.max_quantity,
            pu_id: pu.id,
          }));

          await supabase.from('inventory').insert(inventoryRecords);
        }

        totalCreated += item.quantity; // Original (1) + new records
      }

      toast.success(`Exploded ${itemsToExplode.length} items into ${totalCreated} individual units`);
      setSelectedInventoryIds(new Set());
      fetchInventory();
    } catch (error) {
      console.error('Bulk explode error:', error);
      toast.error('Failed to explode selected items');
    } finally {
      setIsBulkExploding(false);
    }
  };

  const handleBulkMoveToBin = async () => {
    if (selectedInventoryIds.size === 0 || !moveToBinId) return;
    
    setIsMoving(true);
    
    try {
      const itemIds = Array.from(selectedInventoryIds);
      
      // Get the inventory items being moved for logging
      const itemsToMove = inventory.filter(inv => selectedInventoryIds.has(inv.id));
      
      const { error } = await supabase
        .from('inventory')
        .update({ bin_id: moveToBinId })
        .in('id', itemIds);
      
      if (error) throw error;
      
      // Log material movements for each item (bin-to-bin transfer)
      if (companyId && selectedLocationId) {
        for (const invItem of itemsToMove) {
          await logMaterialMovement({
            companyId,
            locationId: selectedLocationId,
            productId: invItem.product_id,
            quantity: invItem.quantity,
            movementType: 'transfer',
            puId: invItem.pu_id,
            binId: moveToBinId,
            sourceBinId: invItem.bin_id,
            destinationBinId: moveToBinId,
          });
        }
      }
      
      const targetBin = bins.find(b => b.id === moveToBinId);
      toast.success(`Moved ${itemIds.length} items to ${targetBin?.bin_id || 'selected bin'}`);
      setSelectedInventoryIds(new Set());
      setIsMoveDialogOpen(false);
      setMoveToBinId('');
      fetchInventory();
    } catch (error) {
      console.error('Bulk move error:', error);
      toast.error('Failed to move items');
    } finally {
      setIsMoving(false);
    }
  };

  const fetchOutboundOrders = async () => {
    if (!selectedLocationId) return;
    const { data, error } = await supabase
      .from('outbound_deliveries' as any)
      .select(`
        id,
        delivery_number,
        status,
        sales_order_id,
        purchase_order_id,
        customer_id,
        from_location_id,
        to_location_id,
        goods_issue_id,
        created_at,
        notes,
        expected_date,
        customer:customers!outbound_deliveries_customer_id_fkey(name, address_line1, city, state, postal_code, country),
        to_location:locations!outbound_deliveries_to_location_id_fkey(name, location_id),
        sales_order:sales_orders!outbound_deliveries_sales_order_id_fkey(so_number, total_amount),
        purchase_order:purchase_orders!outbound_deliveries_purchase_order_id_fkey(po_number, total_amount)
      `)
      .eq('from_location_id', selectedLocationId)
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch outbound orders:', error);
      return;
    }
    setOutboundOrders((data as any) || []);
  };

  const fetchOutboundOrderItems = async (order: OutboundOrder) => {
    if (order.sales_order_id) {
      const { data } = await supabase
        .from('sales_order_items' as any)
        .select(`
          id,
          product_id,
          quantity,
          uom_id,
          product:products(name, product_id)
        `)
        .eq('sales_order_id', order.sales_order_id);
      setOutboundOrderItems((data as any) || []);
    } else if (order.purchase_order_id) {
      const { data } = await supabase
        .from('purchase_order_items' as any)
        .select(`
          id,
          product_id,
          quantity,
          uom_id,
          product:products(name, product_id)
        `)
        .eq('purchase_order_id', order.purchase_order_id);
      setOutboundOrderItems((data as any) || []);
    } else {
      setOutboundOrderItems([]);
    }
  };

  // View delivery detail
  const handleViewDeliveryDetail = async (od: OutboundOrder) => {
    setViewingOutboundDelivery(od);
    setIsViewDeliveryDetailOpen(true);
    // Fetch outbound delivery items
    const { data } = await supabase
      .from('outbound_delivery_items' as any)
      .select('id, product_id, quantity, product:products(name, product_id, unit)')
      .eq('outbound_delivery_id', od.id);
    setViewingOutboundDeliveryItems((data as any) || []);
  };

  // View order detail
  const handleViewOrderDetail = async (od: OutboundOrder) => {
    setViewingOrderDetail(od);
    setIsViewOrderDetailOpen(true);
    if (od.sales_order_id) {
      const { data } = await supabase
        .from('sales_order_items' as any)
        .select('id, product_id, quantity, product:products(name, product_id, unit)')
        .eq('sales_order_id', od.sales_order_id);
      setViewingOrderDetailItems((data as any) || []);
    } else if (od.purchase_order_id) {
      const { data } = await supabase
        .from('purchase_order_items' as any)
        .select('id, product_id, quantity, product:products(name, product_id, unit)')
        .eq('purchase_order_id', od.purchase_order_id);
      setViewingOrderDetailItems((data as any) || []);
    } else {
      setViewingOrderDetailItems([]);
    }
  };

  // Check if the selected location has an active inventory account
  const checkLocationHasInventoryAccount = async (): Promise<boolean> => {
    if (!selectedLocationId) return false;
    const { data } = await supabase
      .from('accounts' as any)
      .select('id')
      .eq('location_id', selectedLocationId)
      .eq('type', 'inventory')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    return !!(data as any)?.id;
  };

  // Fetch work orders (tasks) for the selected location
  const fetchWorkOrders = async () => {
    if (!selectedLocationId || !companyId) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, source_type, source_id, assigned_to, created_at')
      .eq('company_id', companyId)
      .eq('location_id', selectedLocationId)
      .in('status', ['todo', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch work orders:', error);
      return;
    }

    // Fetch assignee names
    const assigneeIds = [...new Set((data || []).filter(t => t.assigned_to).map(t => t.assigned_to!))];
    let assigneeMap = new Map<string, { first_name: string; last_name: string }>();
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', assigneeIds);
      assigneeMap = new Map((profiles || []).map(p => [p.user_id, p]));
    }

    setWorkOrders((data || []).map(t => ({
      ...t,
      assignee: t.assigned_to ? assigneeMap.get(t.assigned_to) || null : null,
    })));
  };

  // Fetch production orders for the selected location
  const fetchProductionOrders = async () => {
    if (!selectedLocationId || !companyId) return;
    const { data, error } = await supabase
      .from('production_orders')
      .select('id, order_number, status, quantity, created_at, product:products(name, product_id), bom:bill_of_materials(name, bom_id)')
      .eq('company_id', companyId)
      .eq('location_id', selectedLocationId)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch production orders:', error);
      return;
    }
    setProductionOrders((data || []) as ProductionOrder[]);
  };


  const checkOutstandingWorkOrders = async (sourceType: string, sourceId: string): Promise<number> => {
    if (!companyId) return 0;
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .in('status', ['todo', 'in_progress']);
    return count || 0;
  };

  const handleFulfillOutboundOrder = async () => {
    if (!selectedOutboundOrder || !selectedLocationId || !companyId) return;
    
    const sourceType = selectedOutboundOrder.sales_order_id ? 'sales_order' : 'purchase_order';
    const sourceId = selectedOutboundOrder.sales_order_id || selectedOutboundOrder.purchase_order_id || '';
    
    // Block if outstanding work orders exist
    const outstandingCount = await checkOutstandingWorkOrders(sourceType, sourceId);
    if (outstandingCount > 0) {
      toast.error(`Cannot fulfill: ${outstandingCount} outstanding work order${outstandingCount !== 1 ? 's' : ''} must be completed first.`);
      return;
    }

    setIsFulfilling(true);
    
    try {
      // Build items with fulfillment quantities
      const items = outboundOrderItems.map(item => ({
        product_id: item.product_id,
        quantity: fulfillQuantities[item.id] ?? item.quantity,
        originalQuantity: item.quantity,
        uom_id: (item as any).uom_id ?? null,
        product: item.product,
      })).filter(item => item.quantity > 0);
      
      if (items.length === 0) {
        toast.error('No items to fulfill');
        setIsFulfilling(false);
        return;
      }

      // Determine if this is a partial fulfillment
      const isPartial = items.some(item => item.quantity < item.originalQuantity) ||
        items.length < outboundOrderItems.length;

      // Check inventory availability
      for (const item of items) {
        const { data: invData } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', selectedLocationId)
          .eq('product_id', item.product_id);
        
        const totalAvailable = (invData || []).reduce((sum: number, inv: any) => sum + inv.quantity, 0);
        if (totalAvailable < item.quantity) {
          toast.error(`Insufficient inventory for ${item.product?.name || 'product'}. Available: ${totalAvailable}, Required: ${item.quantity}`);
          setIsFulfilling(false);
          return;
        }
      }

      // Create goods issue
      const { data: issueNumber } = await supabase.rpc('get_next_goods_issue_number', {
        p_company_id: companyId,
      });

      const { data: goodsIssue, error: giError } = await supabase
        .from('goods_issues' as any)
        .insert({
          company_id: companyId,
          issue_number: issueNumber,
          location_id: selectedLocationId,
          customer_id: selectedOutboundOrder.customer_id || null,
          sales_order_id: selectedOutboundOrder.sales_order_id || null,
          outbound_delivery_id: selectedOutboundOrder.id,
          status: 'pending',
          notes: `${isPartial ? 'Partial fulfillment' : 'Fulfillment'} for OD ${selectedOutboundOrder.delivery_number}`,
        })
        .select()
        .single();

      if (giError) {
        console.error('Failed to create goods issue:', giError);
        toast.error('Failed to create goods issue');
        setIsFulfilling(false);
        return;
      }

      // Create goods issue items
      const giItems = items.map(item => ({
        goods_issue_id: (goodsIssue as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
        uom_id: item.uom_id || null,
      }));

      const { error: itemsError } = await supabase
        .from('goods_issue_items' as any)
        .insert(giItems);

      if (itemsError) {
        console.error('Failed to create goods issue items:', itemsError);
      }

      // Update outbound delivery status
      const odStatus = isPartial ? 'partial' : 'in_transit';
      await supabase
        .from('outbound_deliveries' as any)
        .update({ 
          goods_issue_id: (goodsIssue as any).id,
          status: odStatus,
          ...(isPartial ? {} : { shipped_date: new Date().toISOString().split('T')[0] }),
        })
        .eq('id', selectedOutboundOrder.id);

      // Post the goods issue to update inventory
      const postResult = await postGoodsIssue((goodsIssue as any).id, selectedLocationId);
      if (!postResult.success) {
        toast.error(postResult.error || 'Failed to post goods issue');
        setIsFulfilling(false);
        return;
      }

      // Add items to outbound delivery
      const odItems = items.map(item => ({
        outbound_delivery_id: selectedOutboundOrder.id,
        product_id: item.product_id,
        quantity: item.quantity,
        uom_id: item.uom_id || null,
      }));
      await supabase.from('outbound_delivery_items' as any).insert(odItems);

      // Create inbound delivery at destination location (for internal transfers)
      if (selectedOutboundOrder.to_location_id) {
        try {
          const { data: deliveryId } = await supabase.rpc('get_next_delivery_id', { p_company_id: companyId });
          
          const { data: inboundDelivery, error: inboundError } = await supabase
            .from('deliveries')
            .insert({
              company_id: companyId,
              delivery_id: deliveryId,
              location_id: selectedOutboundOrder.to_location_id,
              purchase_order_id: selectedOutboundOrder.purchase_order_id || null,
              vendor_id: null,
              source_location_id: selectedLocationId,
              status: 'in_transit',
              expected_date: selectedOutboundOrder.expected_date || new Date().toISOString().split('T')[0],
              outbound_delivery_id: selectedOutboundOrder.id,
              is_fulfilled: true,
              notes: `Auto-created from outbound delivery ${selectedOutboundOrder.delivery_number}`,
            })
            .select()
            .single();

          if (inboundError) {
            console.error('Failed to create inbound delivery:', inboundError);
          } else if (inboundDelivery) {
            // Create delivery items for the inbound delivery matching fulfillment quantities
            const deliveryItems = items.map(item => ({
              delivery_id: inboundDelivery.id,
              product_id: item.product_id,
              quantity: item.quantity,
            }));
            await supabase.from('delivery_items').insert(deliveryItems);
          }
        } catch (err) {
          console.error('Failed to create inbound delivery:', err);
        }
      }

      // Update the source order status (full → shipped, partial → partial)
      const sourceStatus = isPartial ? 'partial' : 'shipped';
      if (selectedOutboundOrder.sales_order_id) {
        await supabase
          .from('sales_orders' as any)
          .update({ status: sourceStatus })
          .eq('id', selectedOutboundOrder.sales_order_id);
      } else if (selectedOutboundOrder.purchase_order_id) {
        await supabase
          .from('purchase_orders' as any)
          .update({ status: sourceStatus })
          .eq('id', selectedOutboundOrder.purchase_order_id);
      }

      toast.success(`${isPartial ? 'Partially fulfilled' : 'Fulfilled'} – OD ${selectedOutboundOrder.delivery_number} ${isPartial ? 'partially shipped' : 'in transit'}, inventory updated.`);
      
      setIsFulfillDialogOpen(false);
      setSelectedOutboundOrder(null);
      setOutboundOrderItems([]);
      setFulfillQuantities({});
      fetchOutboundOrders();
      fetchInventory();
    } catch (error) {
      console.error('Fulfillment error:', error);
      toast.error('Failed to fulfill order');
    } finally {
      setIsFulfilling(false);
    }
  };

  // Helper to toggle order selection
  const allFulfillableOrders = outboundOrders.map(od => ({ key: `od-${od.id}`, id: od.id }));

  const toggleFulfillOrderSelection = (key: string) => {
    setSelectedFulfillOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllFulfillOrders = () => {
    if (selectedFulfillOrderIds.size === allFulfillableOrders.length) {
      setSelectedFulfillOrderIds(new Set());
    } else {
      setSelectedFulfillOrderIds(new Set(allFulfillableOrders.map(o => o.key)));
    }
  };

  // Bulk fulfill handler - processes selected orders sequentially with progress
  const handleBulkFulfill = async () => {
    if (selectedFulfillOrderIds.size === 0 || !selectedLocationId || !companyId) return;
    
    const totalOrders = selectedFulfillOrderIds.size;
    setIsBulkFulfilling(true);
    setIsBulkFulfillDialogOpen(false);
    setBulkFulfillResults([]);
    setBulkFulfillProcessed(0);
    setBulkFulfillTotal(totalOrders);
    setBulkFulfillComplete(false);
    setBulkFulfillProgressOpen(true);

    let rowIndex = 0;

    try {
      for (const key of selectedFulfillOrderIds) {
        rowIndex++;
        const odId = key.replace('od-', '');
        const od = outboundOrders.find(o => o.id === odId);
        if (!od) {
          setBulkFulfillResults(prev => [...prev, { row: rowIndex, status: 'error', message: `${key}: Order not found` }]);
          setBulkFulfillProcessed(rowIndex);
          continue;
        }
        
        try {
          const dn = od.delivery_number;
          const sourceType = od.sales_order_id ? 'sales_order' : 'purchase_order';
          const sourceId = od.sales_order_id || od.purchase_order_id || '';

          // Step 1: Check work orders
          setBulkFulfillResults(prev => [...prev, { row: rowIndex, status: 'success', message: `${dn}: Checking work orders...` }]);
          const woCount = await checkOutstandingWorkOrders(sourceType, sourceId);
          if (woCount > 0) {
            setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'error', message: `${dn}: Has ${woCount} outstanding work order(s)` }; return next; });
            setBulkFulfillProcessed(rowIndex);
            continue;
          }

          // Step 2: Loading order items
          setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'success', message: `${dn}: Loading order items...` }; return next; });
          let items: any[] = [];
          if (od.sales_order_id) {
            const { data } = await supabase.from('sales_order_items' as any).select('product_id, quantity, uom_id').eq('sales_order_id', od.sales_order_id);
            items = (data as any) || [];
          } else if (od.purchase_order_id) {
            const { data } = await supabase.from('purchase_order_items' as any).select('product_id, quantity, uom_id').eq('purchase_order_id', od.purchase_order_id);
            items = (data as any) || [];
          }
          if (items.length === 0) {
            setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'error', message: `${dn}: No items found on source order` }; return next; });
            setBulkFulfillProcessed(rowIndex);
            continue;
          }

          // Step 3: Verifying inventory
          setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'success', message: `${dn}: Verifying inventory for ${items.length} product(s)...` }; return next; });
          let insufficientStock = false;
          for (const item of items) {
            const { data: invData } = await supabase.from('inventory').select('id, quantity').eq('location_id', selectedLocationId).eq('product_id', item.product_id);
            const totalAvailable = (invData || []).reduce((sum: number, inv: any) => sum + inv.quantity, 0);
            if (totalAvailable < item.quantity) { insufficientStock = true; break; }
          }
          if (insufficientStock) {
            setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'error', message: `${dn}: Insufficient inventory at location` }; return next; });
            setBulkFulfillProcessed(rowIndex);
            continue;
          }

          // Step 4: Creating goods issue
          setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'success', message: `${dn}: Creating goods issue...` }; return next; });
          const { data: issueNumber } = await supabase.rpc('get_next_goods_issue_number', { p_company_id: companyId });
          const { data: goodsIssue, error: giError } = await supabase
            .from('goods_issues' as any)
            .insert({
              company_id: companyId,
              issue_number: issueNumber,
              location_id: selectedLocationId,
              customer_id: od.customer_id || null,
              sales_order_id: od.sales_order_id || null,
              outbound_delivery_id: od.id,
              status: 'pending',
              notes: `Fulfillment for OD ${dn}`,
            })
            .select().single();
          if (giError) {
            setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'error', message: `${dn}: Failed to create goods issue — ${giError.message}` }; return next; });
            setBulkFulfillProcessed(rowIndex);
            continue;
          }

          // Step 5: Posting goods issue (deducting inventory & ledger)
          setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'success', message: `${dn}: Posting ${issueNumber} — deducting inventory & recording ledger...` }; return next; });
          const giItems = items.map((item: any) => ({ goods_issue_id: (goodsIssue as any).id, product_id: item.product_id, quantity: item.quantity, uom_id: item.uom_id || null }));
          await supabase.from('goods_issue_items' as any).insert(giItems);
          await supabase.from('outbound_deliveries' as any).update({ goods_issue_id: (goodsIssue as any).id, status: 'in_transit', shipped_date: new Date().toISOString().split('T')[0] }).eq('id', od.id);

          const postResult = await postGoodsIssue((goodsIssue as any).id, selectedLocationId);
          if (!postResult.success) {
            setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'error', message: `${dn}: Goods issue posting failed — ${postResult.error || 'unknown'}` }; return next; });
            setBulkFulfillProcessed(rowIndex);
            continue;
          }

          // Step 6: Creating outbound delivery items
          const odItems = items.map((item: any) => ({ outbound_delivery_id: od.id, product_id: item.product_id, quantity: item.quantity, uom_id: item.uom_id || null }));
          await supabase.from('outbound_delivery_items' as any).insert(odItems);

          // Step 7: Create inbound delivery at destination for internal transfers
          if (od.to_location_id) {
            setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'success', message: `${dn}: Creating inbound delivery at destination...` }; return next; });
            try {
              const { data: deliveryId } = await supabase.rpc('get_next_delivery_id', { p_company_id: companyId });
              const { data: inboundDelivery } = await supabase
                .from('deliveries')
                .insert({
                  company_id: companyId,
                  delivery_id: deliveryId,
                  location_id: od.to_location_id,
                  purchase_order_id: od.purchase_order_id || null,
                  vendor_id: null,
                  source_location_id: selectedLocationId,
                  status: 'in_transit',
                  expected_date: od.expected_date || new Date().toISOString().split('T')[0],
                  outbound_delivery_id: od.id,
                  is_fulfilled: true,
                  notes: `Auto-created from outbound delivery ${dn}`,
                })
                .select().single();
              if (inboundDelivery) {
                const deliveryItems = items.map((item: any) => ({ delivery_id: inboundDelivery.id, product_id: item.product_id, quantity: item.quantity }));
                await supabase.from('delivery_items').insert(deliveryItems);
              }
            } catch (err) { console.error('Failed to create inbound delivery:', err); }
          }

          // Step 8: Updating source order status
          setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'success', message: `${dn}: Updating order status to shipped...` }; return next; });
          if (od.sales_order_id) {
            await supabase.from('sales_orders' as any).update({ status: 'shipped' }).eq('id', od.sales_order_id);
          } else if (od.purchase_order_id) {
            await supabase.from('purchase_orders' as any).update({ status: 'shipped' }).eq('id', od.purchase_order_id);
          }

          setBulkFulfillResults(prev => { const next = [...prev]; next[next.length - 1] = { row: rowIndex, status: 'success', message: `${dn}: Fulfilled — GI ${issueNumber} posted, inventory deducted${od.to_location_id ? ', inbound delivery created' : ''}` }; return next; });
          setBulkFulfillProcessed(rowIndex);
        } catch (err) {
          console.error(`Failed to fulfill ${key}:`, err);
          setBulkFulfillResults(prev => [...prev, { row: rowIndex, status: 'error', message: `${od?.delivery_number || key}: ${err instanceof Error ? err.message : 'Unknown error'}` }]);
          setBulkFulfillProcessed(rowIndex);
        }
      }

      setSelectedFulfillOrderIds(new Set());
      fetchOutboundOrders();
      fetchInventory();
    } catch (error) {
      console.error('Bulk fulfillment error:', error);
    } finally {
      setIsBulkFulfilling(false);
      setBulkFulfillComplete(true);
    }
  };

  // Build a preview of anticipated work tasks for one or more orders
  const prepareWorkTasksPreview = async (orders: { orderType: 'so' | 'po'; orderId: string }[]) => {
    if (!companyId || !selectedLocationId) return;

    const allTasks: { title: string; description: string }[] = [];
    const orderInfos: { orderType: 'so' | 'po'; orderId: string; orderNumber: string }[] = [];

    for (const { orderType, orderId } of orders) {
      const sourceType = orderType === 'so' ? 'sales_order' : 'purchase_order';
      
      // Check if tasks already exist
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('company_id', companyId)
        .eq('source_type', sourceType)
        .eq('source_id', orderId);

      if (existingTasks && existingTasks.length > 0) {
        toast.info(`Work tasks already exist for this order`);
        continue;
      }

      const od = outboundOrders.find(o => o.id === orderId);
      if (!od) continue;

      let orderNumber = od.delivery_number;
      let shipTo = od.customer?.name || od.to_location?.name || 'Destination';
      let items: { product_id: string; quantity: number; product?: { name: string; product_id: string } }[] = [];

      if (od.sales_order_id) {
        const { data } = await supabase
          .from('sales_order_items' as any)
          .select('product_id, quantity, product:products(name, product_id)')
          .eq('sales_order_id', od.sales_order_id);
        items = (data as any) || [];
      } else if (od.purchase_order_id) {
        const { data } = await supabase
          .from('purchase_order_items' as any)
          .select('product_id, quantity, product:products(name, product_id)')
          .eq('purchase_order_id', od.purchase_order_id);
        items = (data as any) || [];
      }

      if (items.length === 0) continue;

      orderInfos.push({ orderType, orderId, orderNumber });

      for (const item of items) {
        allTasks.push({
          title: `Pick: ${item.product?.name || 'Product'} × ${item.quantity}`,
          description: `Pick ${item.quantity} unit(s) of ${item.product?.product_id || ''} for ${orderType === 'so' ? 'SO' : 'PO'} ${orderNumber} → ${shipTo}`,
        });
      }

      allTasks.push({
        title: `Pack & Ship: ${orderType === 'so' ? 'SO' : 'PO'} ${orderNumber}`,
        description: `Pack all picked items and complete shipment for ${orderType === 'so' ? 'SO' : 'PO'} ${orderNumber} → ${shipTo}`,
      });
    }

    if (allTasks.length === 0) return;

    setWorkPreviewTasks(allTasks);
    setWorkPreviewOrderInfo(orderInfos);
    setIsWorkPreviewOpen(true);
  };

  // Confirm and create the previewed work tasks
  const handleConfirmCreateWorkTasks = async () => {
    if (!companyId || !selectedLocationId || workPreviewOrderInfo.length === 0) return;

    setIsCreatingWorkTasks(true);
    try {
      let taskIdx = 0;
      for (const { orderType, orderId } of workPreviewOrderInfo) {
        const sourceType = orderType === 'so' ? 'sales_order' : 'purchase_order';
        
        // Collect tasks for this order from the preview list
        const tasksForOrder: { title: string; description: string }[] = [];
        while (taskIdx < workPreviewTasks.length) {
          const task = workPreviewTasks[taskIdx];
          tasksForOrder.push(task);
          taskIdx++;
          // Pack & Ship is always the last task per order
          if (task.title.startsWith('Pack & Ship:')) break;
        }

        const tasksToCreate = tasksForOrder.map(t => ({
          company_id: companyId,
          title: t.title,
          description: t.description,
          status: 'todo',
          priority: 'medium',
          location_id: selectedLocationId,
          source_type: sourceType,
          source_id: orderId,
          created_by: user!.id,
        }));

        const { error } = await supabase.from('tasks').insert(tasksToCreate);
        if (error) {
          console.error('Failed to create work tasks:', error);
          toast.error('Failed to create work tasks');
          continue;
        }

        // Update order status to processing
        if (orderType === 'so') {
          await supabase.from('sales_orders' as any).update({ status: 'processing' }).eq('id', orderId);
        } else {
          await supabase.from('purchase_orders' as any).update({ status: 'processing' }).eq('id', orderId);
        }
      }

      const orderCount = workPreviewOrderInfo.length;
      toast.success(`Created ${workPreviewTasks.length} work tasks for ${orderCount} order${orderCount !== 1 ? 's' : ''}`);
      setIsWorkPreviewOpen(false);
      setWorkPreviewTasks([]);
      setWorkPreviewOrderInfo([]);
      setSelectedFulfillOrderIds(new Set());
      fetchOutboundOrders();
      fetchWorkOrders();
    } catch (error) {
      console.error('Create work tasks error:', error);
      toast.error('Failed to create work tasks');
    } finally {
      setIsCreatingWorkTasks(false);
    }
  };

  const getNextAreaId = () => {
    if (areas.length === 0) return 'A001';
    const maxNum = Math.max(...areas.map(a => parseInt(a.area_id.replace(/\D/g, '') || '0', 10)));
    return `A${String(maxNum + 1).padStart(3, '0')}`;
  };

  const getNextBinId = (areaId: string) => {
    const areaBins = bins.filter(b => b.area_id === areaId);
    const area = areas.find(a => a.id === areaId);
    const areaPrefix = area?.area_id || 'A001';
    if (areaBins.length === 0) return `${areaPrefix}-B001`;
    const maxNum = Math.max(...areaBins.map(b => parseInt(b.bin_id.split('-B')[1] || '0', 10)));
    return `${areaPrefix}-B${String(maxNum + 1).padStart(3, '0')}`;
  };

  const openAreaDialog = (area?: Area) => {
    if (area) {
      setEditingArea(area);
      setAreaFormData({ 
        area_id: area.area_id, 
        name: area.name, 
        description: area.description || '',
        width: area.width ?? '',
        width_uom: area.width_uom || 'in',
        length: area.length ?? '',
        length_uom: area.length_uom || 'in',
        height: area.height ?? '',
        height_uom: area.height_uom || 'in',
        is_production_enabled: area.is_production_enabled ?? false,
        is_goods_receipt_enabled: area.is_goods_receipt_enabled ?? false,
        is_goods_issue_enabled: area.is_goods_issue_enabled ?? false,
      });
    } else {
      setEditingArea(null);
      setAreaFormData({ 
        area_id: getNextAreaId(), 
        name: '', 
        description: '',
        width: '',
        width_uom: 'in',
        length: '',
        length_uom: 'in',
        height: '',
        height_uom: 'in',
        is_production_enabled: false,
        is_goods_receipt_enabled: false,
        is_goods_issue_enabled: false,
      });
    }
    setAreaDialogTab('general');
    setIsAreaDialogOpen(true);
  };

  const openBinDialog = (bin?: Bin) => {
    setEditingBin(bin || null);
    setIsBinDialogOpen(true);
  };

  const handleAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) return;

    const areaData = {
      name: areaFormData.name,
      description: areaFormData.description || null,
      width: areaFormData.width === '' ? null : Number(areaFormData.width),
      width_uom: areaFormData.width === '' ? null : areaFormData.width_uom,
      length: areaFormData.length === '' ? null : Number(areaFormData.length),
      length_uom: areaFormData.length === '' ? null : areaFormData.length_uom,
      height: areaFormData.height === '' ? null : Number(areaFormData.height),
      height_uom: areaFormData.height === '' ? null : areaFormData.height_uom,
      is_production_enabled: areaFormData.is_production_enabled,
      is_goods_receipt_enabled: areaFormData.is_goods_receipt_enabled,
      is_goods_issue_enabled: areaFormData.is_goods_issue_enabled,
    };

    if (editingArea) {
      const { error } = await supabase
        .from('areas')
        .update(areaData)
        .eq('id', editingArea.id);
      if (error) {
        toast.error('Failed to update area');
        return;
      }
      toast.success('Area updated');
    } else {
      const { error } = await supabase
        .from('areas')
        .insert({ 
          location_id: selectedLocationId, 
          area_id: areaFormData.area_id, 
          ...areaData,
        });
      if (error) {
        toast.error('Failed to create area');
        return;
      }
      toast.success('Area created');
    }
    setIsAreaDialogOpen(false);
    fetchAreas();
  };

  const handleDeleteArea = async (id: string) => {
    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete area');
      return;
    }
    toast.success('Area deleted');
    fetchAreas();
  };

  const handleDeleteBin = async (id: string) => {
    const { error } = await supabase.from('bins').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete bin');
      return;
    }
    toast.success('Bin deleted');
    fetchAreas();
  };

  const fetchAreaForCopy = async (areaId: string): Promise<Area | null> => {
    const { data } = await supabase
      .from('areas')
      .select('*')
      .eq('area_id', areaId)
      .maybeSingle();
    return data;
  };

  const applyAreaCopy = (data: Area) => {
    setAreaFormData({
      ...areaFormData,
      name: data.name,
      description: data.description || '',
    });
  };

  useKeyboardShortcut('a', () => {
    if (isWarehouseOrDC && selectedLocationId) {
      openAreaDialog();
    }
  });

  useKeyboardShortcut('b', () => {
    if (isWarehouseOrDC && selectedLocationId && areas.length > 0) {
      openBinDialog();
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Location Selection Screen
  if (!selectedLocationId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                  <ArrowLeft className="w-5 h-5" />
                  <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
                </Button>
                <div className="flex items-center gap-3">
                  <Gauge className="w-7 h-7 text-orange-500" />
                  <h1 className="text-xl font-display font-bold text-foreground">Cockpit</h1>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card>
            <CardHeader className="text-center">
              <MapPin className="w-10 h-10 text-orange-500 mx-auto mb-4" />
              <CardTitle className="text-2xl">Select Location</CardTitle>
              <CardDescription>
                Choose a location to view its dashboard and key metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {locations.length === 0 ? (
                <div className="text-center py-4">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground font-medium">No accessible locations</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You don't have access to any locations. Contact your administrator to be added to a location.
                  </p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate('/locations')}
                    className="mt-2"
                  >
                    Manage locations
                  </Button>
                </div>
              ) : (
                <>
                  <SearchableSelect
                    options={locations.map((location) => ({
                      value: location.id,
                      label: `${location.location_id} ${location.name}`,
                      sublabel: location.type,
                    }))}
                    value={selectedLocationId || ""}
                    onValueChange={setSelectedLocationId}
                    placeholder="Select a location..."
                    className="w-full h-14 text-lg"
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    {locations.length} location{locations.length !== 1 ? 's' : ''} available
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const locationAllowsProduction = areas.some(a => a.is_production_enabled);

  const sidebarItems: { id: SidebarTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'deliveries', label: 'Inbound Shipments', icon: Truck, count: pendingDeliveriesCount },
    { id: 'orders', label: 'Orders to Fulfill', icon: ShoppingCart, count: outboundOrders.length },
    { id: 'work_orders', label: 'Work Orders', icon: ClipboardList, count: workOrders.length },
    ...(locationAllowsProduction ? [{ id: 'production' as SidebarTab, label: 'Production', icon: TrendingUp, count: productionOrders.length }] : []),
    { id: 'inventory', label: 'Inventory', icon: Boxes, count: inventory.length },
    { id: 'areas', label: 'Areas', icon: Grid3X3, count: areas.length },
    { id: 'bins', label: 'Bins', icon: Box, count: bins.length },
    { id: 'users', label: 'Users', icon: Users },
  ];


  // Location Dashboard with Sidebar
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedLocationId(null)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-display font-bold text-foreground">Cockpit</h1>
                  <p className="text-xs text-muted-foreground">
                    {selectedLocation?.name} • {selectedLocation?.location_id}
                  </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="ml-2"
              >
                {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </Button>
            </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshCockpit}
                disabled={!selectedLocationId}
                title="Refresh cockpit data"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <SearchableSelect
                options={locations.map((location) => ({
                  value: location.id,
                  label: `${location.location_id} ${location.name}`,
                  sublabel: location.type,
                }))}
                value={selectedLocationId || ""}
                onValueChange={setSelectedLocationId}
                placeholder="Select a location..."
                className="w-64"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 h-[calc(100vh-4rem)]">
        {/* Vertical Sidebar */}
        <aside className={cn(
          "bg-card/30 flex-shrink-0 flex flex-col transition-all duration-200",
          sidebarCollapsed ? "w-14" : "w-56"
        )}>
          <TooltipProvider delayDuration={0}>
            <nav className="p-2 space-y-1 flex-1">
              {sidebarItems.map((item) => (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left",
                        activeTab === item.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        sidebarCollapsed && "justify-center px-0"
                      )}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.count !== undefined && item.count > 0 && (
                            <span className={cn(
                              "text-xs px-1.5 py-0.5 rounded-full",
                              activeTab === item.id
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {item.count}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
                    <TooltipContent side="right" className="flex items-center gap-2">
                      {item.label}
                      {item.count !== undefined && item.count > 0 && (
                        <Badge variant="secondary" className="ml-1">{item.count}</Badge>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </nav>
          </TooltipProvider>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {/* Inbound Shipments Tab */}
          {activeTab === 'deliveries' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Truck className="w-5 h-5 text-amber-500" />
                    Inbound Shipments
                  </h2>
                  <p className="text-sm text-muted-foreground">Deliveries pending arrival at this location</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/deliveries')}>
                  View All
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                {pendingDeliveries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Truck className="w-12 h-12 mb-3 opacity-30" />
                    <p>No pending deliveries</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead label="Delivery ID" sortKey="delivery_id" currentSortKey={deliverySortConfig.key} currentSortDirection={deliverySortConfig.direction} onSort={handleDeliverySort} filterValue={deliveryFilters['delivery_id']} onFilter={(v) => setDeliveryFilter('delivery_id', v)} />
                        <SortableTableHead label="PO #" sortKey="purchase_order.po_number" currentSortKey={deliverySortConfig.key} currentSortDirection={deliverySortConfig.direction} onSort={handleDeliverySort} filterValue={deliveryFilters['purchase_order.po_number']} onFilter={(v) => setDeliveryFilter('purchase_order.po_number', v)} />
                        <SortableTableHead label="Source" sortKey="vendor.name" currentSortKey={deliverySortConfig.key} currentSortDirection={deliverySortConfig.direction} onSort={handleDeliverySort} filterValue={deliveryFilters['vendor.name']} onFilter={(v) => setDeliveryFilter('vendor.name', v)} />
                        <SortableTableHead label="Expected Date" sortKey="expected_date" currentSortKey={deliverySortConfig.key} currentSortDirection={deliverySortConfig.direction} onSort={handleDeliverySort} filterValue={deliveryFilters['expected_date']} onFilter={(v) => setDeliveryFilter('expected_date', v)} />
                        <SortableTableHead label="Created" sortKey="created_at" currentSortKey={deliverySortConfig.key} currentSortDirection={deliverySortConfig.direction} onSort={handleDeliverySort} filterable={false} />
                        <SortableTableHead label="Status" sortKey="status" currentSortKey={deliverySortConfig.key} currentSortDirection={deliverySortConfig.direction} onSort={handleDeliverySort} filterValue={deliveryFilters['status']} onFilter={(v) => setDeliveryFilter('status', v)} />
                        <TableHead className="w-44"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDeliveries.map((delivery) => {
                        const isInternalTransfer = !!delivery.purchase_order?.source_location_id;
                        const sourceName = isInternalTransfer 
                          ? delivery.purchase_order?.source_location?.name 
                          : delivery.vendor?.name;
                        
                        return (
                          <TableRow key={delivery.id}>
                            <TableCell className="font-mono">{delivery.delivery_id}</TableCell>
                            <TableCell>
                              {delivery.purchase_order?.po_number || '—'}
                              {isInternalTransfer && (
                                <Badge variant="outline" className="ml-2 text-xs">Transfer</Badge>
                              )}
                            </TableCell>
                            <TableCell>{sourceName || '—'}</TableCell>
                            <TableCell>
                              {delivery.created_at
                                ? new Date(delivery.created_at).toLocaleDateString()
                                : '—'}
                            </TableCell>
                            <TableCell>
                              {delivery.expected_date 
                                ? new Date(delivery.expected_date).toLocaleDateString() 
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                delivery.status === 'shipped' 
                                  ? 'bg-green-500/10 text-green-500' 
                                  : delivery.status === 'in_transit' 
                                  ? 'bg-blue-500/10 text-blue-500' 
                                  : delivery.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : delivery.status === 'partially_delivered'
                                  ? 'bg-orange-500/10 text-orange-500'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {delivery.status === 'shipped' && isInternalTransfer 
                                  ? 'Ready to Receive' 
                                  : delivery.status.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={async () => {
                                          const hasAccount = await checkLocationHasInventoryAccount();
                                          if (!hasAccount) { setIsNoInventoryAccountOpen(true); return; }
                                          handlePreviewReceiveTasks(delivery);
                                        }}
                                        disabled={isCreatingReceiveTasks || isLoadingReceivePreview || (isInternalTransfer && !delivery.is_fulfilled)}
                                      >
                                        {(isCreatingReceiveTasks || isLoadingReceivePreview) ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListTodo className="w-4 h-4" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Create receiving tasks</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={async () => {
                                    const hasAccount = await checkLocationHasInventoryAccount();
                                    if (!hasAccount) { setIsNoInventoryAccountOpen(true); return; }
                                    setSelectedDelivery(delivery);
                                    setIsReceiveDialogOpen(true);
                                  }}
                                  disabled={(isInternalTransfer && !delivery.is_fulfilled) || deliveriesWithOpenTasks.has(delivery.id)}
                                >
                                  {isInternalTransfer && !delivery.is_fulfilled ? 'Awaiting' : deliveriesWithOpenTasks.has(delivery.id) ? 'Tasks Open' : 'Receive'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Orders to Fulfill Tab */}
          {activeTab === 'orders' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-violet-500" />
                    Orders to Fulfill
                  </h2>
                  <p className="text-sm text-muted-foreground">Sales orders and internal transfers to fulfill from this location</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedFulfillOrderIds.size > 0 && (
                    <>
                      <Button 
                        variant="outline"
                        size="sm" 
                        onClick={() => {
                          const orders = Array.from(selectedFulfillOrderIds).map(key => ({
                            orderType: key.startsWith('po-') ? 'po' as const : 'so' as const,
                            orderId: key.replace(/^(po|so)-/, ''),
                          }));
                          prepareWorkTasksPreview(orders);
                        }}
                      >
                        <ClipboardList className="w-4 h-4 mr-1" />
                        Work ({selectedFulfillOrderIds.size})
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setIsBulkFulfillDialogOpen(true)}
                      >
                        Fulfill ({selectedFulfillOrderIds.size})
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate('/sales-orders')}>
                    View All
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {outboundOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                    <p>No orders to fulfill</p>
                    <p className="text-xs mt-1">Confirmed orders shipping from this location will appear here</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allFulfillableOrders.length > 0 && selectedFulfillOrderIds.size === allFulfillableOrders.length}
                            onCheckedChange={toggleAllFulfillOrders}
                          />
                        </TableHead>
                        <SortableTableHead label="Type" sortKey="purchase_order_id" currentSortKey={ordersSortConfig.key} currentSortDirection={ordersSortConfig.direction} onSort={handleOrdersSort} filterable={false} />
                        <SortableTableHead label="Delivery #" sortKey="delivery_number" currentSortKey={ordersSortConfig.key} currentSortDirection={ordersSortConfig.direction} onSort={handleOrdersSort} filterValue={ordersFilters['delivery_number']} onFilter={(v) => setOrdersFilter('delivery_number', v)} />
                        <SortableTableHead label="Order #" sortKey="sales_order.so_number" currentSortKey={ordersSortConfig.key} currentSortDirection={ordersSortConfig.direction} onSort={handleOrdersSort} filterValue={ordersFilters['sales_order.so_number']} onFilter={(v) => setOrdersFilter('sales_order.so_number', v)} />
                        <SortableTableHead label="Ship To" sortKey="customer.name" currentSortKey={ordersSortConfig.key} currentSortDirection={ordersSortConfig.direction} onSort={handleOrdersSort} filterValue={ordersFilters['customer.name']} onFilter={(v) => setOrdersFilter('customer.name', v)} />
                         <SortableTableHead label="Created" sortKey="created_at" currentSortKey={ordersSortConfig.key} currentSortDirection={ordersSortConfig.direction} onSort={handleOrdersSort} filterable={false} />
                         <SortableTableHead label="Status" sortKey="status" currentSortKey={ordersSortConfig.key} currentSortDirection={ordersSortConfig.direction} onSort={handleOrdersSort} filterValue={ordersFilters['status']} onFilter={(v) => setOrdersFilter('status', v)} />
                        <TableHead className="w-32"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedOutboundOrders.map((od) => {
                        const isTransfer = !!od.purchase_order_id;
                        return (
                          <TableRow key={`od-${od.id}`} className={isTransfer ? "bg-blue-500/5" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedFulfillOrderIds.has(`od-${od.id}`)}
                                onCheckedChange={() => toggleFulfillOrderSelection(`od-${od.id}`)}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isTransfer ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-violet-500/10 text-violet-600 border-violet-500/20"}>
                                {isTransfer ? 'Transfer' : 'Sales'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">
                              <button
                                className="text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer bg-transparent border-none p-0"
                                onClick={() => handleViewDeliveryDetail(od)}
                              >
                                {od.delivery_number}
                              </button>
                            </TableCell>
                            <TableCell className="font-mono">
                              {(od.sales_order?.so_number || od.purchase_order?.po_number) ? (
                                <button
                                  className="text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer bg-transparent border-none p-0"
                                  onClick={() => handleViewOrderDetail(od)}
                                >
                                  {od.sales_order?.so_number || od.purchase_order?.po_number}
                                </button>
                              ) : '—'}
                            </TableCell>
                            <TableCell>{od.customer?.name || od.to_location?.name || '—'}</TableCell>
                             <TableCell>
                               {od.created_at
                                 ? new Date(od.created_at).toLocaleDateString()
                                 : '—'}
                             </TableCell>
                             <TableCell>
                              <Badge variant="outline" className={statusColors[od.status] || ''}>
                                {od.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="outline"
                                        size="sm" 
                                        onClick={() => prepareWorkTasksPreview([{ orderType: isTransfer ? 'po' : 'so', orderId: od.sales_order_id || od.purchase_order_id || '' }])}
                                      >
                                        <ClipboardList className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Create work tasks</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Button 
                                  size="sm" 
                                  onClick={async () => {
                                    const sourceType = od.sales_order_id ? 'sales_order' : 'purchase_order';
                                    const sourceId = od.sales_order_id || od.purchase_order_id || '';
                                    const woCount = await checkOutstandingWorkOrders(sourceType, sourceId);
                                    if (woCount > 0) {
                                      toast.error(`Cannot fulfill: ${woCount} outstanding work order${woCount !== 1 ? 's' : ''} must be completed first.`);
                                      return;
                                    }
                                    setSelectedOutboundOrder(od);
                                    fetchOutboundOrderItems(od);
                                    setIsFulfillDialogOpen(true);
                                  }}
                                >
                                  Fulfill
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Work Orders Tab */}
          {activeTab === 'work_orders' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Work Orders
                  </h2>
                  <p className="text-sm text-muted-foreground">Active picking, packing, and shipping tasks for this location</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedWorkOrderIds.size > 0 && (
                    <>
                      {workOrders.some(t => selectedWorkOrderIds.has(t.id) && t.status === 'todo') && (
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const ids = Array.from(selectedWorkOrderIds).filter(id => workOrders.find(t => t.id === id)?.status === 'todo');
                            if (ids.length === 0) return;
                            await supabase.from('tasks').update({ status: 'in_progress' }).in('id', ids);
                            toast.success(`Started ${ids.length} task${ids.length !== 1 ? 's' : ''}`);
                            setSelectedWorkOrderIds(new Set());
                            fetchWorkOrders();
                          }}
                        >
                          Start ({workOrders.filter(t => selectedWorkOrderIds.has(t.id) && t.status === 'todo').length})
                        </Button>
                      )}
                      {workOrders.some(t => selectedWorkOrderIds.has(t.id) && t.status === 'in_progress') && (
                        <Button 
                          size="sm"
                          onClick={async () => {
                            const ids = Array.from(selectedWorkOrderIds).filter(id => workOrders.find(t => t.id === id)?.status === 'in_progress');
                            if (ids.length === 0) return;
                            // Check for delivery_receive tasks and handle them specially
                            const receiveTasks = ids.filter(id => {
                              const t = workOrders.find(wo => wo.id === id);
                              return t?.source_type === 'delivery_receive' && t?.source_id;
                            });
                            const normalTasks = ids.filter(id => !receiveTasks.includes(id));
                            
                            if (normalTasks.length > 0) {
                              await supabase.from('tasks').update({ status: 'done' }).in('id', normalTasks);
                            }
                            for (const taskId of receiveTasks) {
                              const t = workOrders.find(wo => wo.id === taskId);
                              if (t?.source_id) await handleCompleteReceiveTask(taskId, t.source_id);
                            }
                            if (normalTasks.length > 0) toast.success(`Completed ${normalTasks.length} task${normalTasks.length !== 1 ? 's' : ''}`);
                            setSelectedWorkOrderIds(new Set());
                            fetchWorkOrders();
                          }}
                        >
                          Done ({workOrders.filter(t => selectedWorkOrderIds.has(t.id) && t.status === 'in_progress').length})
                        </Button>
                      )}
                      {workOrders.some(t => selectedWorkOrderIds.has(t.id) && t.status === 'todo') && (
                        <Button 
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            const ids = Array.from(selectedWorkOrderIds).filter(id => workOrders.find(t => t.id === id)?.status === 'todo');
                            setWorkOrderIdsToDelete(ids);
                            setIsDeleteWorkOrdersOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete ({workOrders.filter(t => selectedWorkOrderIds.has(t.id) && t.status === 'todo').length})
                        </Button>
                      )}
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
                    View All Tasks
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {workOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mb-3 opacity-30" />
                    <p>No active work orders</p>
                    <p className="text-xs mt-1">Use "Work" on orders to create picking & packing tasks</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={sortedWorkOrders.length > 0 && selectedWorkOrderIds.size === sortedWorkOrders.length}
                            onCheckedChange={() => {
                              if (selectedWorkOrderIds.size === sortedWorkOrders.length) {
                                setSelectedWorkOrderIds(new Set());
                              } else {
                                setSelectedWorkOrderIds(new Set(sortedWorkOrders.map(t => t.id)));
                              }
                            }}
                          />
                        </TableHead>
                        <SortableTableHead label="Task" sortKey="title" currentSortKey={workOrdersSortConfig.key} currentSortDirection={workOrdersSortConfig.direction} onSort={handleWorkOrdersSort} filterValue={workOrdersFilters['title']} onFilter={(v) => setWorkOrdersFilter('title', v)} />
                        <SortableTableHead label="Source" sortKey="source_type" currentSortKey={workOrdersSortConfig.key} currentSortDirection={workOrdersSortConfig.direction} onSort={handleWorkOrdersSort} filterValue={workOrdersFilters['source_type']} onFilter={(v) => setWorkOrdersFilter('source_type', v)} />
                        <SortableTableHead label="Priority" sortKey="priority" currentSortKey={workOrdersSortConfig.key} currentSortDirection={workOrdersSortConfig.direction} onSort={handleWorkOrdersSort} filterValue={workOrdersFilters['priority']} onFilter={(v) => setWorkOrdersFilter('priority', v)} />
                        <SortableTableHead label="Status" sortKey="status" currentSortKey={workOrdersSortConfig.key} currentSortDirection={workOrdersSortConfig.direction} onSort={handleWorkOrdersSort} filterValue={workOrdersFilters['status']} onFilter={(v) => setWorkOrdersFilter('status', v)} />
                        <SortableTableHead label="Assigned To" sortKey="assignee.first_name" currentSortKey={workOrdersSortConfig.key} currentSortDirection={workOrdersSortConfig.direction} onSort={handleWorkOrdersSort} filterValue={workOrdersFilters['assignee.first_name']} onFilter={(v) => setWorkOrdersFilter('assignee.first_name', v)} />
                        <TableHead className="w-28"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedWorkOrders.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedWorkOrderIds.has(task.id)}
                              onCheckedChange={() => {
                                setSelectedWorkOrderIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(task.id)) next.delete(task.id);
                                  else next.add(task.id);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {task.source_type ? (
                              <Badge variant="outline" className={
                                task.source_type === 'sales_order' 
                                  ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' 
                                  : task.source_type === 'delivery_receive'
                                  ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                  : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                              }>
                                {task.source_type === 'sales_order' ? 'Sales' : task.source_type === 'purchase_order' ? 'Transfer' : task.source_type === 'delivery_receive' ? 'Receive' : task.source_type}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              task.priority === 'urgent' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                              task.priority === 'high' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                              task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                              'bg-slate-500/10 text-slate-600 border-slate-500/20'
                            }>
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              task.status === 'in_progress' 
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : 'bg-muted text-muted-foreground'
                            }>
                              {task.status === 'in_progress' ? 'In Progress' : 'To Do'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {task.assignee 
                              ? `${task.assignee.first_name} ${task.assignee.last_name}` 
                              : <span className="text-muted-foreground">Unassigned</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => setViewingWorkOrder(task)}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View details</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {task.status === 'todo' && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setViewingWorkOrder(task)}
                                  >
                                    Start
                                  </Button>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                          onClick={() => {
                                            setWorkOrderIdsToDelete([task.id]);
                                            setIsDeleteWorkOrdersOpen(true);
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </>
                              )}
                              {task.status === 'in_progress' && (
                                <Button 
                                  size="sm"
                                  onClick={async () => {
                                    if (task.source_type === 'delivery_receive' && task.source_id) {
                                      await handleCompleteReceiveTask(task.id, task.source_id);
                                    } else {
                                      await supabase.from('tasks').update({ status: 'done' }).eq('id', task.id);
                                      toast.success(`Completed: ${task.title}`);
                                      fetchWorkOrders();
                                    }
                                  }}
                                >
                                  Done
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Production Tab */}
          {activeTab === 'production' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Production
                  </h2>
                  <p className="text-sm text-muted-foreground">Production orders at this location</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/production')}>
                  View All
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                {productionOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
                    <p>No production orders</p>
                    <p className="text-xs mt-1">Create production orders from the Production app</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>BOM</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => navigate('/production')}
                            >
                              {order.order_number}
                            </button>
                          </TableCell>
                          <TableCell className="font-medium">
                            {order.product ? (
                              <div>
                                <p className="text-sm">{order.product.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{order.product.product_id}</p>
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {order.bom?.name || '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">{order.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              order.status === 'completed'
                                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                : order.status === 'in_progress'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : order.status === 'cancelled'
                                ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                            }>
                              {order.status === 'in_progress' ? 'In Progress' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Areas Tab */}
          {activeTab === 'areas' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5" />
                    Areas
                  </h2>
                  <p className="text-sm text-muted-foreground">Warehouse zones and sections</p>
                </div>
                <div className="flex gap-2">
                  {areas.length === 0 && (
                    <Button size="sm" variant="secondary" onClick={() => setIsAutoMakeAreasDialogOpen(true)}>
                      <Wand2 className="w-4 h-4 mr-1" />
                      AutoMake
                    </Button>
                  )}
                  <Button size="sm" onClick={() => openAreaDialog()}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Area
                    <Kbd className="ml-2">A</Kbd>
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {areas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Grid3X3 className="w-12 h-12 mb-3 opacity-30" />
                    <p className="font-medium">No areas defined</p>
                    <p className="text-sm mt-1 mb-4">Create areas to organize your warehouse layout</p>
                    <Button variant="secondary" onClick={() => setIsAutoMakeAreasDialogOpen(true)}>
                      <Wand2 className="w-4 h-4 mr-2" />
                      AutoMake Common Areas
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead label="ID" sortKey="area_id" currentSortKey={areasSortConfig.key} currentSortDirection={areasSortConfig.direction} onSort={handleAreasSort} filterValue={areasFilters['area_id']} onFilter={(v) => setAreasFilter('area_id', v)} />
                        <SortableTableHead label="Name" sortKey="name" currentSortKey={areasSortConfig.key} currentSortDirection={areasSortConfig.direction} onSort={handleAreasSort} filterValue={areasFilters['name']} onFilter={(v) => setAreasFilter('name', v)} />
                        <SortableTableHead label="Description" sortKey="description" currentSortKey={areasSortConfig.key} currentSortDirection={areasSortConfig.direction} onSort={handleAreasSort} filterValue={areasFilters['description']} onFilter={(v) => setAreasFilter('description', v)} />
                        <SortableTableHead label="GR" sortKey="is_goods_receipt_enabled" currentSortKey={areasSortConfig.key} currentSortDirection={areasSortConfig.direction} onSort={handleAreasSort} filterable={false} className="text-center" />
                        <SortableTableHead label="GI" sortKey="is_goods_issue_enabled" currentSortKey={areasSortConfig.key} currentSortDirection={areasSortConfig.direction} onSort={handleAreasSort} filterable={false} className="text-center" />
                        <SortableTableHead label="Production" sortKey="is_production_enabled" currentSortKey={areasSortConfig.key} currentSortDirection={areasSortConfig.direction} onSort={handleAreasSort} filterable={false} className="text-center" />
                        <TableHead className="text-right">Bins</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAreas.map((area) => (
                        <TableRow key={area.id}>
                          <TableCell className="font-mono">
                            <button type="button" className="text-primary hover:underline" onClick={() => { setViewingArea(area); setIsViewAreaDialogOpen(true); }}>
                              {area.area_id}
                            </button>
                          </TableCell>
                          <TableCell className="font-medium">{area.name}</TableCell>
                          <TableCell className="text-muted-foreground">{area.description || '—'}</TableCell>
                          <TableCell className="text-center">
                            <div className={`w-2 h-2 rounded-full mx-auto ${area.is_goods_receipt_enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`w-2 h-2 rounded-full mx-auto ${area.is_goods_issue_enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`w-2 h-2 rounded-full mx-auto ${area.is_production_enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                          </TableCell>
                          <TableCell className="text-right">{bins.filter(b => b.area_id === area.id).length}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingArea(area); setIsViewAreaDialogOpen(true); }}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAreaDialog(area)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Bins Tab */}
          {activeTab === 'bins' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Box className="w-5 h-5" />
                    Bins
                  </h2>
                  <p className="text-sm text-muted-foreground">Storage locations within areas</p>
                </div>
                <div className="flex gap-2">
                  {isLocationAdmin && (
                    <Button size="sm" variant="secondary" onClick={() => setIsBinSequenceDialogOpen(true)} disabled={bins.length === 0}>
                      <ArrowUpDown className="w-4 h-4 mr-1" />
                      Sequence
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setIsAutoMakeDialogOpen(true)} disabled={areas.length === 0}>
                    <Wand2 className="w-4 h-4 mr-1" />
                    AutoMake
                  </Button>
                  <Button size="sm" onClick={() => openBinDialog()} disabled={areas.length === 0}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Bin
                    <Kbd className="ml-2">B</Kbd>
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {bins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Box className="w-12 h-12 mb-3 opacity-30" />
                    <p className="font-medium">No bins defined</p>
                    <p className="text-sm mt-1">
                      {areas.length === 0 ? 'Create an area first to add bins' : 'Create bins to track inventory locations'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead label="ID" sortKey="bin_id" currentSortKey={binsSortConfig.key} currentSortDirection={binsSortConfig.direction} onSort={handleBinsSort} filterValue={binsFilters['bin_id']} onFilter={(v) => setBinsFilter('bin_id', v)} />
                        <SortableTableHead label="Name" sortKey="name" currentSortKey={binsSortConfig.key} currentSortDirection={binsSortConfig.direction} onSort={handleBinsSort} filterValue={binsFilters['name']} onFilter={(v) => setBinsFilter('name', v)} />
                        <SortableTableHead label="Area" sortKey="area_id" currentSortKey={binsSortConfig.key} currentSortDirection={binsSortConfig.direction} onSort={handleBinsSort} filterValue={binsFilters['area_id']} onFilter={(v) => setBinsFilter('area_id', v)} />
                        <SortableTableHead label="Capacity" sortKey="capacity" currentSortKey={binsSortConfig.key} currentSortDirection={binsSortConfig.direction} onSort={handleBinsSort} filterValue={binsFilters['capacity']} onFilter={(v) => setBinsFilter('capacity', v)} />
                        <SortableTableHead label="Put Away" sortKey="allow_put_away" currentSortKey={binsSortConfig.key} currentSortDirection={binsSortConfig.direction} onSort={handleBinsSort} filterable={false} className="text-center" />
                        <SortableTableHead label="Picking" sortKey="allow_picking" currentSortKey={binsSortConfig.key} currentSortDirection={binsSortConfig.direction} onSort={handleBinsSort} filterable={false} className="text-center" />
                        <SortableTableHead label="Production" sortKey="is_production_enabled" currentSortKey={binsSortConfig.key} currentSortDirection={binsSortConfig.direction} onSort={handleBinsSort} filterable={false} className="text-center" />
                        <SortableTableHead label="Hazardous" sortKey="is_hazardous" currentSortKey={binsSortConfig.key} currentSortDirection={binsSortConfig.direction} onSort={handleBinsSort} filterable={false} className="text-center" />
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBins.map((bin) => {
                        const area = areas.find(a => a.id === bin.area_id);
                        return (
                          <TableRow key={bin.id}>
                            <TableCell className="font-mono">
                              <button type="button" className="text-primary hover:underline" onClick={() => { setViewingBin(bin); setIsViewBinDialogOpen(true); }}>
                                {bin.bin_id}
                              </button>
                            </TableCell>
                            <TableCell className="font-medium">{bin.name}</TableCell>
                            <TableCell>{area?.name || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{bin.capacity || '—'}</TableCell>
                            <TableCell className="text-center">
                              <div className={`w-2 h-2 rounded-full mx-auto ${bin.allow_put_away ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={`w-2 h-2 rounded-full mx-auto ${bin.allow_picking ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={`w-2 h-2 rounded-full mx-auto ${bin.is_production_enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={`w-2 h-2 rounded-full mx-auto ${bin.is_hazardous ? 'bg-amber-500' : 'bg-muted-foreground/30'}`} />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8" 
                                  onClick={() => {
                                    setViewingBin(bin);
                                    setIsViewBinDialogOpen(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBinDialog(bin)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && selectedLocationId && companyId && (
            <CockpitUsersTab locationId={selectedLocationId} companyId={companyId} />
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Boxes className="w-5 h-5" />
                    Inventory
                    {selectedInventoryIds.size > 0 && (
                      <Badge variant="secondary" className="ml-2">{selectedInventoryIds.size} selected</Badge>
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground">Products stored at this location</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedInventoryIds.size > 0 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkExplode}
                        disabled={isBulkExploding}
                      >
                        {isBulkExploding ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Split className="w-4 h-4 mr-1" />
                        )}
                        Explode
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsBulkPackageDialogOpen(true)}
                      >
                        <Package2 className="w-4 h-4 mr-1" />
                        Package
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsMoveDialogOpen(true)}
                        disabled={bins.length === 0}
                      >
                        <MoveRight className="w-4 h-4 mr-1" />
                        Move to Bin
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedInventoryIds(new Set())}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                  {hasActiveInventoryFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllInventoryFilters}
                      className="text-muted-foreground"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMaterialFlowDialogOpen(true)}
                  >
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Material Flow
                  </Button>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {inventory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Boxes className="w-12 h-12 mb-3 opacity-30" />
                    <p className="font-medium">No inventory at this location</p>
                    <p className="text-sm mt-1">Inventory will appear here when products are received</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={filteredInventory.length > 0 && selectedInventoryIds.size === filteredInventory.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedInventoryIds(new Set(filteredInventory.map(i => i.id)));
                              } else {
                                setSelectedInventoryIds(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <SortableTableHead
                          label="Product ID"
                          sortKey="product.product_id"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['product.product_id']}
                          onFilter={(value) => setInventoryFilter('product.product_id', value)}
                        />
                        <SortableTableHead
                          label="Product Name"
                          sortKey="product.name"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['product.name']}
                          onFilter={(value) => setInventoryFilter('product.name', value)}
                        />
                        <SortableTableHead
                          label="SKU"
                          sortKey="product.sku"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['product.sku']}
                          onFilter={(value) => setInventoryFilter('product.sku', value)}
                        />
                        <SortableTableHead
                          label="PU #"
                          sortKey="packaging_unit.pu_number"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['packaging_unit.pu_number']}
                          onFilter={(value) => setInventoryFilter('packaging_unit.pu_number', value)}
                        />
                        <SortableTableHead
                          label="Bin"
                          sortKey="bin.bin_id"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['bin.bin_id']}
                          onFilter={(value) => setInventoryFilter('bin.bin_id', value)}
                        />
                        <SortableTableHead
                          label="Quantity"
                          sortKey="quantity"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['quantity']}
                          onFilter={(value) => setInventoryFilter('quantity', value)}
                          className="text-right"
                        />
                        <SortableTableHead
                          label="UoM"
                          sortKey="uom.abbreviation"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['uom.abbreviation']}
                          onFilter={(value) => setInventoryFilter('uom.abbreviation', value)}
                        />
                        <SortableTableHead
                          label="Min"
                          sortKey="min_quantity"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['min_quantity']}
                          onFilter={(value) => setInventoryFilter('min_quantity', value)}
                          className="text-right"
                        />
                        <SortableTableHead
                          label="Max"
                          sortKey="max_quantity"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['max_quantity']}
                          onFilter={(value) => setInventoryFilter('max_quantity', value)}
                          className="text-right"
                        />
                        <SortableTableHead
                          label="Batch"
                          sortKey="batch.batch_number"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['batch.batch_number']}
                          onFilter={(value) => setInventoryFilter('batch.batch_number', value)}
                        />
                        <SortableTableHead
                          label="Expiration"
                          sortKey="batch.expiration_date"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['batch.expiration_date']}
                          onFilter={(value) => setInventoryFilter('batch.expiration_date', value)}
                        />
                        <SortableTableHead
                          label="Received"
                          sortKey="received_at"
                          currentSortKey={inventorySortConfig.key}
                          currentSortDirection={inventorySortConfig.direction}
                          onSort={handleInventorySort}
                          filterValue={inventoryFilters['received_at']}
                          onFilter={(value) => setInventoryFilter('received_at', value)}
                        />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map((item) => {
                          const isLow = item.min_quantity && item.quantity <= item.min_quantity;
                          const isHigh = item.max_quantity && item.quantity >= item.max_quantity;
                          const isSelected = selectedInventoryIds.has(item.id);
                          return (
                            <TableRow 
                              key={item.id} 
                              className={cn(
                                "cursor-pointer hover:bg-muted/50",
                                isLow && "bg-amber-500/5",
                                isHigh && "bg-blue-500/5",
                                isSelected && "bg-primary/5"
                              )}
                              onClick={() => {
                                setSelectedInventoryItem(item);
                                setIsInventoryDetailOpen(true);
                              }}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const newSet = new Set(selectedInventoryIds);
                                    if (checked) {
                                      newSet.add(item.id);
                                    } else {
                                      newSet.delete(item.id);
                                    }
                                    setSelectedInventoryIds(newSet);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-mono">{item.product?.product_id || '—'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {item.product?.name || 'Unknown'}
                                  {isLow && (
                                    <span className="text-xs bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded">Low</span>
                                  )}
                                  {!item.bin_id && (
                                    <span className="text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">Put Away</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{item.product?.sku || '—'}</TableCell>
                              <TableCell className="font-mono text-sm text-primary">{item.packaging_unit?.pu_number || '—'}</TableCell>
                              <TableCell className="font-mono text-sm">{item.bin?.bin_id || 'Unassigned'}</TableCell>
                              <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item.uom?.abbreviation || item.uom?.name || 'base'}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{item.min_quantity ?? '—'}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{item.max_quantity ?? '—'}</TableCell>
                              <TableCell className="font-mono text-sm">{item.batch?.batch_number || '—'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.batch?.expiration_date
                                  ? new Date(item.batch.expiration_date).toLocaleDateString()
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.received_at
                                  ? new Date(item.received_at).toLocaleDateString()
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Area Dialog */}
      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isAreaMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[500px] max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => setIsAreaMaximized(!isAreaMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isAreaMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <form ref={areaFormRef} onSubmit={handleAreaSubmit} className="flex flex-col h-full">
            <DialogHeader>
              <DialogTitle>{editingArea ? 'Edit Area' : 'Add Area'}</DialogTitle>
              <DialogDescription>
                {editingArea ? 'Update area details.' : 'Create a new warehouse area.'}
              </DialogDescription>
            </DialogHeader>
            
            {!editingArea && (
              <div className="absolute right-16 top-4 z-10">
                <CopyFromIdDialog<Area>
                  onFetch={fetchAreaForCopy}
                  onApply={applyAreaCopy}
                  idLabel="Area ID"
                />
              </div>
            )}
            
            <div className="mt-4 px-6 pb-6">
              <Tabs value={areaDialogTab} onValueChange={setAreaDialogTab}>
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                  <TabsTrigger value="controls">Controls</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="area_id">Area ID</Label>
                    <Input
                      id="area_id"
                      value={areaFormData.area_id}
                      onChange={(e) => setAreaFormData({ ...areaFormData, area_id: e.target.value })}
                      disabled={!!editingArea}
                      className={editingArea ? 'bg-muted' : ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area_name">Name *</Label>
                    <Input
                      id="area_name"
                      value={areaFormData.name}
                      onChange={(e) => setAreaFormData({ ...areaFormData, name: e.target.value })}
                      placeholder="e.g., Receiving Zone"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area_description">Description</Label>
                    <Input
                      id="area_description"
                      value={areaFormData.description}
                      onChange={(e) => setAreaFormData({ ...areaFormData, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="dimensions" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="area_width">Width</Label>
                      <Input
                        id="area_width"
                        type="number"
                        step="0.01"
                        value={areaFormData.width}
                        onChange={(e) => setAreaFormData({ ...areaFormData, width: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="area_width_uom">Unit</Label>
                      <Select
                        value={areaFormData.width_uom}
                        onValueChange={(value) => setAreaFormData({ ...areaFormData, width_uom: value })}
                      >
                        <SelectTrigger id="area_width_uom">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">in</SelectItem>
                          <SelectItem value="ft">ft</SelectItem>
                          <SelectItem value="cm">cm</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="area_length">Length</Label>
                      <Input
                        id="area_length"
                        type="number"
                        step="0.01"
                        value={areaFormData.length}
                        onChange={(e) => setAreaFormData({ ...areaFormData, length: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="area_length_uom">Unit</Label>
                      <Select
                        value={areaFormData.length_uom}
                        onValueChange={(value) => setAreaFormData({ ...areaFormData, length_uom: value })}
                      >
                        <SelectTrigger id="area_length_uom">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">in</SelectItem>
                          <SelectItem value="ft">ft</SelectItem>
                          <SelectItem value="cm">cm</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="area_height">Height</Label>
                      <Input
                        id="area_height"
                        type="number"
                        step="0.01"
                        value={areaFormData.height}
                        onChange={(e) => setAreaFormData({ ...areaFormData, height: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="area_height_uom">Unit</Label>
                      <Select
                        value={areaFormData.height_uom}
                        onValueChange={(value) => setAreaFormData({ ...areaFormData, height_uom: value })}
                      >
                        <SelectTrigger id="area_height_uom">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">in</SelectItem>
                          <SelectItem value="ft">ft</SelectItem>
                          <SelectItem value="cm">cm</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="controls" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure how this area behaves in the system.
                  </p>
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="area_is_goods_receipt_enabled" className="font-medium">Goods Receipt</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow goods receipts to be posted to this area.
                        </p>
                      </div>
                      <Switch
                        id="area_is_goods_receipt_enabled"
                        checked={areaFormData.is_goods_receipt_enabled}
                        onCheckedChange={(checked) => setAreaFormData({ ...areaFormData, is_goods_receipt_enabled: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="area_is_goods_issue_enabled" className="font-medium">Goods Issue</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow goods issues to be posted from this area.
                        </p>
                      </div>
                      <Switch
                        id="area_is_goods_issue_enabled"
                        checked={areaFormData.is_goods_issue_enabled}
                        onCheckedChange={(checked) => setAreaFormData({ ...areaFormData, is_goods_issue_enabled: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="area_is_production_enabled" className="font-medium">Production</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow production orders to be processed in this area.
                        </p>
                      </div>
                      <Switch
                        id="area_is_production_enabled"
                        checked={areaFormData.is_production_enabled}
                        onCheckedChange={(checked) => setAreaFormData({ ...areaFormData, is_production_enabled: checked })}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter className="shrink-0 px-6 sticky bottom-0 bg-background border-t pt-4">
              {editingArea && (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto"
                  onClick={() => {
                    handleDeleteArea(editingArea.id);
                    setIsAreaDialogOpen(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
              <Button type="submit">
                {editingArea ? 'Save Changes' : 'Create'}
                <Kbd className="ml-2">⌘S</Kbd>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AutoMake Bins Dialog */}
      <AutoMakeBinsDialog
        open={isAutoMakeDialogOpen}
        onOpenChange={setIsAutoMakeDialogOpen}
        areas={areas}
        companyId={companyId}
        onCreated={fetchAreas}
      />

      {/* AutoMake Areas Dialog */}
      <AutoMakeAreasDialog
        open={isAutoMakeAreasDialogOpen}
        onOpenChange={setIsAutoMakeAreasDialogOpen}
        locationId={selectedLocationId}
        existingAreaIds={areas.map(a => a.area_id)}
        existingNames={areas.map(a => a.name)}
        onCreated={fetchAreas}
      />

      {/* Bin Sequence Dialog */}
      <BinSequenceDialog
        open={isBinSequenceDialogOpen}
        onOpenChange={setIsBinSequenceDialogOpen}
        bins={bins}
        areas={areas}
        onSaved={fetchAreas}
      />

      {/* Bin Dialog */}
      <BinDialog
        ref={binDialogRef}
        open={isBinDialogOpen}
        onOpenChange={setIsBinDialogOpen}
        editingBin={editingBin}
        areas={areas}
        getNextBinId={getNextBinId}
        onSaved={fetchAreas}
        companyId={companyId}
        onDelete={handleDeleteBin}
      />

      {/* View Bin Dialog */}
      <ViewBinDialog
        open={isViewBinDialogOpen}
        onOpenChange={(open) => {
          setIsViewBinDialogOpen(open);
          if (!open) setViewingBin(null);
        }}
        bin={viewingBin}
        area={areas.find(a => a.id === viewingBin?.area_id)}
        onEdit={() => {
          setIsViewBinDialogOpen(false);
          if (viewingBin) {
            openBinDialog(viewingBin);
          }
        }}
      />

      {/* View Area Dialog */}
      <ViewAreaDialog
        open={isViewAreaDialogOpen}
        onOpenChange={(open) => {
          setIsViewAreaDialogOpen(open);
          if (!open) setViewingArea(null);
        }}
        area={viewingArea}
        onEdit={() => {
          setIsViewAreaDialogOpen(false);
          if (viewingArea) {
            openAreaDialog(viewingArea);
          }
        }}
        onViewBin={(bin) => {
          setIsViewAreaDialogOpen(false);
          const fullBin = bins.find(b => b.id === bin.id);
          if (fullBin) {
            setViewingBin(fullBin);
            setIsViewBinDialogOpen(true);
          }
        }}
      />


      {selectedDelivery && selectedLocationId && (
        <ReceiveDeliveryDialog
          open={isReceiveDialogOpen}
          onOpenChange={(open) => {
            setIsReceiveDialogOpen(open);
          }}
          deliveryId={selectedDelivery.id}
          deliveryDisplayId={selectedDelivery.delivery_id}
          purchaseOrderId={selectedDelivery.purchase_order_id}
          locationId={selectedLocationId}
          onReceived={() => {
            fetchPendingDeliveries();
            fetchInventory();
          }}
          onFullyComplete={() => {
            setSelectedDelivery(null);
          }}
        />
      )}

      {/* No Inventory Account Dialog */}
      <Dialog open={isNoInventoryAccountOpen} onOpenChange={setIsNoInventoryAccountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Cannot Receive Goods
            </DialogTitle>
            <DialogDescription>
              Inventory account required for location to receive
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsNoInventoryAccountOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Detail Dialog */}
      {selectedLocationId && (
        <InventoryDetailDialog
          open={isInventoryDetailOpen}
          onOpenChange={(open) => {
            setIsInventoryDetailOpen(open);
            if (!open) setSelectedInventoryItem(null);
          }}
          item={selectedInventoryItem}
          locationId={selectedLocationId}
          onUpdated={fetchInventory}
        />
      )}

      {/* Fulfill Outbound Order Dialog */}
      <Dialog open={isFulfillDialogOpen} onOpenChange={(open) => {
        setIsFulfillDialogOpen(open);
        if (!open) {
          setSelectedOutboundOrder(null);
          setOutboundOrderItems([]);
          setFulfillQuantities({});
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedOutboundOrder?.purchase_order_id ? 'Fulfill Internal Transfer' : 'Fulfill Order'}</DialogTitle>
            <DialogDescription>
              {selectedOutboundOrder?.purchase_order_id
                ? `Ship items to ${selectedOutboundOrder?.to_location?.name} for ${selectedOutboundOrder?.delivery_number}`
                : `Create a goods issue for ${selectedOutboundOrder?.delivery_number}`}
            </DialogDescription>
          </DialogHeader>
          {selectedOutboundOrder && (
            <div className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{selectedOutboundOrder.purchase_order_id ? 'Destination' : 'Customer'}</p>
                  <p className="font-medium">{selectedOutboundOrder.customer?.name || selectedOutboundOrder.to_location?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Source Order</p>
                  <p className="font-medium">{selectedOutboundOrder.sales_order?.so_number || selectedOutboundOrder.purchase_order?.po_number || '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-2">Items to fulfill</p>
                <div className="border rounded-md max-h-48 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right w-24">Ordered</TableHead>
                        <TableHead className="text-right w-28">Fulfill Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outboundOrderItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{item.product?.product_id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={fulfillQuantities[item.id] ?? item.quantity}
                              onChange={(e) => setFulfillQuantities(prev => ({
                                ...prev,
                                [item.id]: Math.min(Number(e.target.value) || 0, item.quantity),
                              }))}
                              className="w-20 text-right ml-auto h-8"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className={cn(
                "p-3 rounded-md text-sm",
                selectedOutboundOrder.purchase_order_id ? "bg-blue-500/10 border border-blue-500/20" : "bg-muted/50"
              )}>
                <p className={cn("font-medium mb-1", selectedOutboundOrder.purchase_order_id && "text-blue-700")}>This will:</p>
                <ul className={cn("list-disc list-inside space-y-1", selectedOutboundOrder.purchase_order_id ? "text-blue-600" : "text-muted-foreground")}>
                  <li>Create a Goods Issue to deduct inventory from this location</li>
                  {selectedOutboundOrder.to_location_id && (
                    <li>Create an inbound delivery at the destination location</li>
                  )}
                  {outboundOrderItems.some(item => (fulfillQuantities[item.id] ?? item.quantity) < item.quantity) ? (
                    <>
                      <li>Mark the outbound delivery as "Partial"</li>
                      <li>Remain available for further fulfillment</li>
                    </>
                  ) : (
                    <>
                      <li>Mark the outbound delivery as "In Transit"</li>
                      <li>Update the source order status to "Shipped"</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 px-6 sticky bottom-0 bg-background border-t pt-4">
            <Button onClick={handleFulfillOutboundOrder} disabled={isFulfilling || outboundOrderItems.length === 0}>
              {isFulfilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedOutboundOrder?.purchase_order_id ? 'Fulfill Transfer' : 'Fulfill Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Fulfill Dialog */}
      <Dialog open={isBulkFulfillDialogOpen} onOpenChange={(open) => {
        if (!isBulkFulfilling) setIsBulkFulfillDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fulfill Selected Orders</DialogTitle>
            <DialogDescription>
              Process {selectedFulfillOrderIds.size} order{selectedFulfillOrderIds.size !== 1 ? 's' : ''} for fulfillment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6">
            <div className="border rounded-md max-h-48 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Ship To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(selectedFulfillOrderIds).map((key) => {
                    const odId = key.replace('od-', '');
                    const od = outboundOrders.find(o => o.id === odId);
                    if (!od) return null;
                    const isTransfer = !!od.purchase_order_id;
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <Badge variant="outline" className={isTransfer ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-violet-500/10 text-violet-600 border-violet-500/20"}>
                            {isTransfer ? 'Transfer' : 'Sales'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{od.delivery_number}</TableCell>
                        <TableCell>{od.customer?.name || od.to_location?.name || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted/50 p-3 rounded-md text-sm">
              <p className="font-medium mb-1">This will for each order:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Create outbound deliveries / goods issues</li>
                <li>Deduct inventory from this location</li>
                <li>Update order statuses to "Shipped"</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Orders with insufficient inventory will be skipped.</p>
            </div>
          </div>
          <DialogFooter className="shrink-0 px-6 sticky bottom-0 bg-background border-t pt-4">
            <Button onClick={handleBulkFulfill} disabled={isBulkFulfilling}>
              Fulfill {selectedFulfillOrderIds.size} Order{selectedFulfillOrderIds.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Fulfill Progress Dialog */}
      <ImportProgressDialog
        open={bulkFulfillProgressOpen}
        onOpenChange={setBulkFulfillProgressOpen}
        title="Fulfilling Orders"
        totalRows={bulkFulfillTotal}
        processedRows={bulkFulfillProcessed}
        results={bulkFulfillResults}
        isComplete={bulkFulfillComplete}
      />

      {/* Work Task Preview Dialog */}
      <Dialog open={isWorkPreviewOpen} onOpenChange={(open) => {
        if (!open) {
          setIsWorkPreviewOpen(false);
          setWorkPreviewTasks([]);
          setWorkPreviewOrderInfo([]);
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Work Tasks</DialogTitle>
            <DialogDescription>
              The following {workPreviewTasks.length} work task{workPreviewTasks.length !== 1 ? 's' : ''} will be created for {workPreviewOrderInfo.length} order{workPreviewOrderInfo.length !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            <div className="overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workPreviewTasks.map((task, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {task.title.startsWith('Pick:') ? (
                            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          {task.title}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {task.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted/50 p-3 rounded-md text-sm">
              <p className="font-medium mb-1">This will:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Create individual picking tasks for each line item</li>
                <li>Create a final pack &amp; ship task per order</li>
                <li>Update order status to "Processing"</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWorkPreviewOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmCreateWorkTasks} disabled={isCreatingWorkTasks}>
              {isCreatingWorkTasks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingWorkTasks ? 'Creating...' : `Create ${workPreviewTasks.length} Task${workPreviewTasks.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Task Preview Dialog */}
      <Dialog open={isReceiveTaskPreviewOpen} onOpenChange={(open) => {
        if (!open && !isCreatingReceiveTasks) {
          setIsReceiveTaskPreviewOpen(false);
          setReceiveTaskPreviewList([]);
          setReceiveTaskPayloads([]);
          setReceiveTaskDelivery(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Receiving Tasks</DialogTitle>
            <DialogDescription>
              {receiveTaskDelivery && `Delivery ${receiveTaskDelivery.delivery_id} — ${receiveTaskPreviewList.length} task${receiveTaskPreviewList.length !== 1 ? 's' : ''} will be created`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto px-6 py-2 space-y-2">
            {receiveTaskPreviewList.map((task, idx) => (
              <div key={idx} className="border rounded-md p-3 space-y-1">
                <div className="text-sm font-medium">{task.title}</div>
                <div className="text-xs text-muted-foreground">{task.description}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiveTaskPreviewOpen(false)} disabled={isCreatingReceiveTasks}>Cancel</Button>
            <Button onClick={handleConfirmReceiveTasks} disabled={isCreatingReceiveTasks}>
              {isCreatingReceiveTasks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingReceiveTasks ? 'Creating...' : `Create ${receiveTaskPreviewList.length} Task${receiveTaskPreviewList.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Work Order Dialog */}
      <ViewWorkOrderDialog
        open={!!viewingWorkOrder}
        onOpenChange={(open) => { if (!open) setViewingWorkOrder(null); }}
        workOrder={viewingWorkOrder}
        locationId={selectedLocationId}
        companyId={companyId}
        onStarted={() => {
          setViewingWorkOrder(null);
          fetchWorkOrders();
        }}
        onCompleted={async () => {
          if (!viewingWorkOrder) return;
          if (viewingWorkOrder.source_type === 'delivery_receive' && viewingWorkOrder.source_id) {
            await handleCompleteReceiveTask(viewingWorkOrder.id, viewingWorkOrder.source_id);
          } else {
            await supabase.from('tasks').update({ status: 'done' }).eq('id', viewingWorkOrder.id);
            toast.success(`Completed: ${viewingWorkOrder.title}`);
          }
          setViewingWorkOrder(null);
          fetchWorkOrders();
        }}
        onDelete={(id) => {
          setWorkOrderIdsToDelete([id]);
          setIsDeleteWorkOrdersOpen(true);
          setViewingWorkOrder(null);
        }}
        onReceiveWorkTask={async (workTaskId, workOrderId) => {
          await handleCompleteReceiveWorkTask(workTaskId, workOrderId);
        }}
        onPutAwayWorkTask={async (workTaskId) => {
          await handleCompletePutAwayWorkTask(workTaskId);
        }}
      />

      {/* Delete Work Orders Confirm Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteWorkOrdersOpen}
        onOpenChange={(open) => {
          setIsDeleteWorkOrdersOpen(open);
          if (!open) setWorkOrderIdsToDelete([]);
        }}
        title={workOrderIdsToDelete.length === 1 ? 'Delete Work Order' : `Delete ${workOrderIdsToDelete.length} Work Orders`}
        description={workOrderIdsToDelete.length === 1 
          ? 'Are you sure you want to delete this work order? This action cannot be undone.'
          : `Are you sure you want to delete ${workOrderIdsToDelete.length} work orders? This action cannot be undone.`
        }
        onConfirm={async () => {
          const { error } = await supabase.from('tasks').delete().in('id', workOrderIdsToDelete);
          if (error) {
            toast.error('Failed to delete work orders');
            return;
          }
          toast.success(`Deleted ${workOrderIdsToDelete.length} work order${workOrderIdsToDelete.length !== 1 ? 's' : ''}`);
          setIsDeleteWorkOrdersOpen(false);
          setWorkOrderIdsToDelete([]);
          setSelectedWorkOrderIds(new Set());
          fetchWorkOrders();
        }}
      />

      <BulkInventoryActionsDialog
        open={isBulkPackageDialogOpen}
        onOpenChange={setIsBulkPackageDialogOpen}
        selectedItems={selectedInventoryItems}
        onCompleted={() => {
          fetchInventory();
          setSelectedInventoryIds(new Set());
        }}
      />

      {/* Move to Bin Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={(open) => {
        setIsMoveDialogOpen(open);
        if (!open) setMoveToBinId('');
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Move to Bin</DialogTitle>
            <DialogDescription>
              Move {selectedInventoryIds.size} selected item{selectedInventoryIds.size !== 1 ? 's' : ''} to a bin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 px-6">
            <div className="space-y-2">
              <Label htmlFor="target-bin">Target Bin</Label>
              <Select value={moveToBinId} onValueChange={setMoveToBinId}>
                <SelectTrigger id="target-bin">
                  <SelectValue placeholder="Select a bin..." />
                </SelectTrigger>
                <SelectContent>
                  {bins.filter(bin => {
                    if (!bin.allow_put_away) return false;
                    // Hide hazardous bins unless all selected items are hazardous products
                    if (bin.is_hazardous) {
                      const selectedItems = inventory.filter(i => selectedInventoryIds.has(i.id));
                      return selectedItems.length > 0 && selectedItems.every(i => i.product?.hazardous);
                    }
                    return true;
                  }).map((bin) => {
                    const area = areas.find(a => a.id === bin.area_id);
                    return (
                      <SelectItem key={bin.id} value={bin.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{bin.bin_id}</span>
                          <span>{bin.name}</span>
                          {area && <span className="text-xs text-muted-foreground">({area.name})</span>}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button onClick={handleBulkMoveToBin} disabled={isMoving || !moveToBinId}>
              {isMoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Move Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Movements Dialog */}
      <MaterialMovementsDialog
        open={isMaterialFlowDialogOpen}
        onOpenChange={setIsMaterialFlowDialogOpen}
        locationId={selectedLocationId}
        locationName={selectedLocation?.name || ''}
      />

      {/* View Delivery Detail Dialog */}
      <Dialog open={isViewDeliveryDetailOpen} onOpenChange={setIsViewDeliveryDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delivery {viewingOutboundDelivery?.delivery_number}</DialogTitle>
            <DialogDescription>Outbound delivery details and line items</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {viewingOutboundDelivery && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <div><Badge variant="outline" className={statusColors[viewingOutboundDelivery.status] || ''}>{viewingOutboundDelivery.status}</Badge></div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <div>{viewingOutboundDelivery.purchase_order_id ? 'Transfer' : 'Sales'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ship To</span>
                    <div>{viewingOutboundDelivery.customer?.name || viewingOutboundDelivery.to_location?.name || '—'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expected Date</span>
                    <div>{viewingOutboundDelivery.expected_date || '—'}</div>
                  </div>
                  {viewingOutboundDelivery.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Notes</span>
                      <div>{viewingOutboundDelivery.notes}</div>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Line Items</h4>
                  {viewingOutboundDeliveryItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Product ID</TableHead>
                          <TableHead>UoM</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingOutboundDeliveryItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product?.name || '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{item.product?.product_id || '—'}</TableCell>
                            <TableCell>{item.product?.unit || '—'}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* View Order Detail Dialog */}
      <Dialog open={isViewOrderDetailOpen} onOpenChange={setIsViewOrderDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {viewingOrderDetail?.sales_order ? `Sales Order ${viewingOrderDetail.sales_order.so_number}` : 
               viewingOrderDetail?.purchase_order ? `Purchase Order ${viewingOrderDetail.purchase_order.po_number}` : 'Order'}
            </DialogTitle>
            <DialogDescription>Order details and line items</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {viewingOrderDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <div>{viewingOrderDetail.purchase_order_id ? 'Internal Transfer' : 'Sales Order'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ship To</span>
                    <div>{viewingOrderDetail.customer?.name || viewingOrderDetail.to_location?.name || '—'}</div>
                  </div>
                  {viewingOrderDetail.sales_order && (
                    <div>
                      <span className="text-muted-foreground">Total Amount</span>
                      <div>${viewingOrderDetail.sales_order.total_amount?.toFixed(2) || '0.00'}</div>
                    </div>
                  )}
                  {viewingOrderDetail.purchase_order && (
                    <div>
                      <span className="text-muted-foreground">Total Amount</span>
                      <div>${viewingOrderDetail.purchase_order.total_amount?.toFixed(2) || '0.00'}</div>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Line Items</h4>
                  {viewingOrderDetailItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Product ID</TableHead>
                          <TableHead>UoM</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingOrderDetailItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product?.name || '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{item.product?.product_id || '—'}</TableCell>
                            <TableCell>{item.product?.unit || '—'}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cockpit;
