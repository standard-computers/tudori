import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useSaveShortcut, useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { supabase } from '@/integrations/supabase/client';
import { postGoodsIssue } from '@/lib/inventory-posting';
import { createMultiplePackagingUnits } from '@/lib/packaging-units';
import { logMaterialMovement } from '@/lib/material-movements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { ReceiveDeliveryDialog } from '@/components/ReceiveDeliveryDialog';
import { InventoryDetailDialog } from '@/components/InventoryDetailDialog';
import BinDialog, { BinDialogRef } from '@/components/cockpit/BinDialog';
import ViewBinDialog from '@/components/cockpit/ViewBinDialog';
import AutoMakeBinsDialog from '@/components/cockpit/AutoMakeBinsDialog';
import { BulkInventoryActionsDialog } from '@/components/cockpit/BulkInventoryActionsDialog';
import MaterialMovementsDialog from '@/components/cockpit/MaterialMovementsDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
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
import { ArrowLeft, Gauge, MapPin, Package, ShoppingCart, Truck, Users, TrendingUp, Lock, Grid3X3, Box, Plus, Pencil, Trash2, Boxes, Search, Loader2, PanelLeftClose, PanelLeft, Wand2, Split, Package2, X, MoveRight, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { useTableSort } from '@/hooks/use-table-sort';
import { SortableTableHead } from '@/components/SortableTableHead';
import { toast } from 'sonner';
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
}

interface Delivery {
  id: string;
  delivery_id: string;
  status: string;
  expected_date: string | null;
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
  product?: { name: string; product_id: string; sku: string | null; company_id: string };
  bin?: { bin_id: string; name: string } | null;
  packaging_unit?: { pu_number: string } | null;
}

interface SalesOrder {
  id: string;
  so_number: string;
  status: string;
  customer_id: string | null;
  location_id: string | null;
  total_amount: number;
  order_date: string;
  customer?: { name: string; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null } | null;
}

interface SalesOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: { name: string; product_id: string };
}

interface InternalPurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  source_location_id: string;
  location_id: string | null;
  total_amount: number;
  created_at: string;
  location?: { name: string; location_id: string } | null;
}

interface PurchaseOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: { name: string; product_id: string };
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  confirmed: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  processing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  shipped: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  delivered: 'bg-green-500/10 text-green-600 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

type SidebarTab = 'deliveries' | 'orders' | 'areas' | 'bins' | 'inventory';

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

  // Areas & Bins state
  const [areas, setAreas] = useState<Area[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isAreaMaximized, setIsAreaMaximized] = useState(false);
  const [isBinDialogOpen, setIsBinDialogOpen] = useState(false);
  const [isViewBinDialogOpen, setIsViewBinDialogOpen] = useState(false);
  const [isAutoMakeDialogOpen, setIsAutoMakeDialogOpen] = useState(false);
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
  });
  const [areaDialogTab, setAreaDialogTab] = useState('general');
  const areaFormRef = useRef<HTMLFormElement>(null);
  const binDialogRef = useRef<BinDialogRef>(null);

  // Deliveries state
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState<number>(0);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  
  // Receive delivery state
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

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

  // Sales orders state
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [salesOrdersCount, setSalesOrdersCount] = useState<number>(0);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<SalesOrder | null>(null);
  const [salesOrderItems, setSalesOrderItems] = useState<SalesOrderItem[]>([]);
  const [isFulfillDialogOpen, setIsFulfillDialogOpen] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);

  // Internal purchase orders state (POs where this location is the source/vendor)
  const [internalPOs, setInternalPOs] = useState<InternalPurchaseOrder[]>([]);
  const [selectedInternalPO, setSelectedInternalPO] = useState<InternalPurchaseOrder | null>(null);
  const [internalPOItems, setInternalPOItems] = useState<PurchaseOrderItem[]>([]);
  const [isInternalPOFulfillDialogOpen, setIsInternalPOFulfillDialogOpen] = useState(false);

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
    }
  }, [selectedLocationId, locations]);

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
      fetchOutstandingSalesOrders();
      fetchInternalPurchaseOrders();
    } else {
      setPendingDeliveriesCount(0);
      setInventory([]);
      setSalesOrders([]);
      setSalesOrdersCount(0);
      setInternalPOs([]);
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
    const { data: accessibleLocationIds } = await supabase
      .from('location_users')
      .select('location_id')
      .eq('user_id', user!.id);

    if (!accessibleLocationIds || accessibleLocationIds.length === 0) {
      setLocations([]);
      return;
    }

    const locationIds = accessibleLocationIds.map(l => l.location_id);

    const { data } = await supabase
      .from('locations')
      .select('id, location_id, name, type, address_line1, city, state')
      .eq('company_id', companyId!)
      .in('id', locationIds)
      .order('location_id');

    setLocations(data || []);
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
    if (!selectedLocationId) return;
    const { data, count, error } = await supabase
      .from('deliveries')
      .select(`
        id, 
        delivery_id, 
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
      .neq('status', 'delivered')
      .order('expected_date', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch pending deliveries:', error);
      return;
    }
    setPendingDeliveriesCount(count || 0);
    setPendingDeliveries((data || []) as unknown as Delivery[]);
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
        product:products(name, product_id, sku, company_id),
        bin:bins(bin_id, name),
        packaging_unit:packaging_units(pu_number)
      `)
      .eq('location_id', selectedLocationId)
      .order('quantity', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch inventory:', error);
      return;
    }
    setInventory((data || []) as unknown as InventoryItem[]);
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

  const fetchOutstandingSalesOrders = async () => {
    if (!selectedLocationId) return;
    const { data, count, error } = await supabase
      .from('sales_orders' as any)
      .select(`
        id,
        so_number,
        status,
        customer_id,
        location_id,
        total_amount,
        order_date,
        customer:customers(name, address_line1, city, state, postal_code, country)
      `, { count: 'exact' })
      .eq('location_id', selectedLocationId)
      .in('status', ['draft', 'confirmed', 'processing'])
      .order('order_date', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch sales orders:', error);
      return;
    }
    setSalesOrders((data as any) || []);
    setSalesOrdersCount(count || 0);
  };

  const fetchSalesOrderItems = async (orderId: string) => {
    const { data } = await supabase
      .from('sales_order_items' as any)
      .select(`
        id,
        product_id,
        quantity,
        product:products(name, product_id)
      `)
      .eq('sales_order_id', orderId);
    
    setSalesOrderItems((data as any) || []);
  };

  // Fetch internal purchase orders where this location is the source (vendor)
  const fetchInternalPurchaseOrders = async () => {
    if (!selectedLocationId) return;
    const { data, error } = await supabase
      .from('purchase_orders' as any)
      .select(`
        id,
        po_number,
        status,
        source_location_id,
        location_id,
        total_amount,
        created_at,
        location:locations!purchase_orders_location_id_fkey(name, location_id)
      `)
      .eq('source_location_id', selectedLocationId)
      .in('status', ['draft', 'confirmed', 'processing'])
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch internal purchase orders:', error);
      return;
    }
    setInternalPOs((data as any) || []);
  };

  const fetchInternalPOItems = async (orderId: string) => {
    const { data } = await supabase
      .from('purchase_order_items' as any)
      .select(`
        id,
        product_id,
        quantity,
        product:products(name, product_id)
      `)
      .eq('purchase_order_id', orderId);
    
    setInternalPOItems((data as any) || []);
  };

  const handleFulfillOrder = async () => {
    if (!selectedSalesOrder || !selectedLocationId || !companyId) return;
    
    setIsFulfilling(true);
    
    try {
      const { data: items } = await supabase
        .from('sales_order_items' as any)
        .select('product_id, quantity')
        .eq('sales_order_id', selectedSalesOrder.id);
      
      if (!items || items.length === 0) {
        toast.error('No items to fulfill');
        setIsFulfilling(false);
        return;
      }

      for (const item of items as any[]) {
        const { data: invData } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', selectedLocationId)
          .eq('product_id', item.product_id);
        
        const totalAvailable = (invData || []).reduce((sum: number, inv: any) => sum + inv.quantity, 0);
        if (totalAvailable < item.quantity) {
          const { data: productData } = await supabase
            .from('products')
            .select('name')
            .eq('id', item.product_id)
            .single();
          toast.error(`Insufficient inventory for ${productData?.name || 'product'}. Available: ${totalAvailable}, Required: ${item.quantity}`);
          setIsFulfilling(false);
          return;
        }
      }

      const { data: deliveryNumber } = await supabase.rpc('get_next_outbound_delivery_number', {
        p_company_id: companyId,
      });

      const customer = selectedSalesOrder.customer;
      const { data: outboundDelivery, error: odError } = await supabase
        .from('outbound_deliveries' as any)
        .insert({
          company_id: companyId,
          delivery_number: deliveryNumber,
          sales_order_id: selectedSalesOrder.id,
          from_location_id: selectedLocationId,
          customer_id: selectedSalesOrder.customer_id,
          ship_to_address_line1: customer?.address_line1 || null,
          ship_to_city: customer?.city || null,
          ship_to_state: customer?.state || null,
          ship_to_postal_code: customer?.postal_code || null,
          ship_to_country: customer?.country || 'United States',
          status: 'in_transit',
          shipped_date: new Date().toISOString().split('T')[0],
          notes: `Created from SO ${selectedSalesOrder.so_number}`,
        })
        .select()
        .single();

      if (odError) {
        console.error('Failed to create outbound delivery:', odError);
        toast.error('Failed to create outbound delivery');
        setIsFulfilling(false);
        return;
      }

      const { data: issueNumber } = await supabase.rpc('get_next_goods_issue_number', {
        p_company_id: companyId,
      });

      const { data: goodsIssue, error: giError } = await supabase
        .from('goods_issues' as any)
        .insert({
          company_id: companyId,
          issue_number: issueNumber,
          location_id: selectedLocationId,
          customer_id: selectedSalesOrder.customer_id,
          sales_order_id: selectedSalesOrder.id,
          outbound_delivery_id: (outboundDelivery as any).id,
          status: 'pending',
          notes: `Fulfillment for SO ${selectedSalesOrder.so_number}, OD ${deliveryNumber}`,
        })
        .select()
        .single();

      if (giError) {
        console.error('Failed to create goods issue:', giError);
        toast.error('Failed to create goods issue');
        setIsFulfilling(false);
        return;
      }

      const giItems = (items as any[]).map(item => ({
        goods_issue_id: (goodsIssue as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('goods_issue_items' as any)
        .insert(giItems);

      if (itemsError) {
        console.error('Failed to create goods issue items:', itemsError);
      }

      await supabase
        .from('outbound_deliveries' as any)
        .update({ goods_issue_id: (goodsIssue as any).id })
        .eq('id', (outboundDelivery as any).id);

      const postResult = await postGoodsIssue((goodsIssue as any).id, selectedLocationId);
      if (!postResult.success) {
        toast.error(postResult.error || 'Failed to auto-post goods issue');
        setIsFulfilling(false);
        return;
      }

      await supabase
        .from('sales_orders' as any)
        .update({ status: 'shipped' })
        .eq('id', selectedSalesOrder.id);

      toast.success(`Order fulfilled - Outbound Delivery ${deliveryNumber} created, inventory updated.`);
      
      setIsFulfillDialogOpen(false);
      setSelectedSalesOrder(null);
      setSalesOrderItems([]);
      fetchOutstandingSalesOrders();
    } catch (error) {
      console.error('Fulfillment error:', error);
      toast.error('Failed to fulfill order');
    } finally {
      setIsFulfilling(false);
    }
  };

  // Handle fulfillment for internal purchase orders (this location is the source/vendor)
  const handleFulfillInternalPO = async () => {
    if (!selectedInternalPO || !selectedLocationId || !companyId) return;
    
    setIsFulfilling(true);
    
    try {
      const { data: items } = await supabase
        .from('purchase_order_items' as any)
        .select('product_id, quantity')
        .eq('purchase_order_id', selectedInternalPO.id);
      
      if (!items || items.length === 0) {
        toast.error('No items to fulfill');
        setIsFulfilling(false);
        return;
      }

      // Check inventory availability
      for (const item of items as any[]) {
        const { data: invData } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', selectedLocationId)
          .eq('product_id', item.product_id);
        
        const totalAvailable = (invData || []).reduce((sum: number, inv: any) => sum + inv.quantity, 0);
        if (totalAvailable < item.quantity) {
          const { data: productData } = await supabase
            .from('products')
            .select('name')
            .eq('id', item.product_id)
            .single();
          toast.error(`Insufficient inventory for ${productData?.name || 'product'}. Available: ${totalAvailable}, Required: ${item.quantity}`);
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
          status: 'pending',
          notes: `Internal transfer fulfillment for PO ${selectedInternalPO.po_number}`,
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
      const giItems = (items as any[]).map(item => ({
        goods_issue_id: (goodsIssue as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('goods_issue_items' as any)
        .insert(giItems);

      if (itemsError) {
        console.error('Failed to create goods issue items:', itemsError);
      }

      // Post the goods issue to update inventory
      const postResult = await postGoodsIssue((goodsIssue as any).id, selectedLocationId);
      if (!postResult.success) {
        toast.error(postResult.error || 'Failed to post goods issue');
        setIsFulfilling(false);
        return;
      }

      // Mark the associated delivery as fulfilled so destination can receive
      await supabase
        .from('deliveries' as any)
        .update({ 
          is_fulfilled: true,
          status: 'shipped'
        })
        .eq('purchase_order_id', selectedInternalPO.id);

      // Update PO status to shipped
      await supabase
        .from('purchase_orders' as any)
        .update({ status: 'shipped' })
        .eq('id', selectedInternalPO.id);

      toast.success(`Internal transfer fulfilled - PO ${selectedInternalPO.po_number} shipped, inventory updated.`);
      
      setIsInternalPOFulfillDialogOpen(false);
      setSelectedInternalPO(null);
      setInternalPOItems([]);
      fetchInternalPurchaseOrders();
      fetchInventory();
    } catch (error) {
      console.error('Internal PO fulfillment error:', error);
      toast.error('Failed to fulfill internal transfer');
    } finally {
      setIsFulfilling(false);
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
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                  <ArrowLeft className="w-5 h-5" />
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
                  <Select onValueChange={setSelectedLocationId}>
                    <SelectTrigger className="w-full h-14 text-lg">
                      <SelectValue placeholder="Select a location..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id} className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {location.location_id}
                            </span>
                            <span className="font-medium">{location.name}</span>
                            <span className="text-muted-foreground text-sm">({location.type})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

  const sidebarItems: { id: SidebarTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'deliveries', label: 'Inbound Shipments', icon: Truck, count: pendingDeliveriesCount },
    { id: 'orders', label: 'Orders to Fulfill', icon: ShoppingCart, count: salesOrdersCount },
    { id: 'inventory', label: 'Inventory', icon: Boxes, count: inventory.length },
    { id: 'areas', label: 'Areas', icon: Grid3X3, count: areas.length },
    { id: 'bins', label: 'Bins', icon: Box, count: bins.length },
  ];

  // Location Dashboard with Sidebar
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
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
              </div>
            </div>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{location.location_id}</span>
                      <span>{location.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="flex flex-1 h-[calc(100vh-4rem)]">
        {/* Vertical Sidebar */}
        <aside className={cn(
          "border-r border-border bg-card/30 flex-shrink-0 flex flex-col transition-all duration-200",
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
          <div className="p-2 border-t border-border">
            <Tooltip>
              <TooltipProvider delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className={cn("w-full", sidebarCollapsed && "px-0")}
                  >
                    {sidebarCollapsed ? (
                      <PanelLeft className="w-4 h-4" />
                    ) : (
                      <>
                        <PanelLeftClose className="w-4 h-4 mr-2" />
                        Collapse
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                {sidebarCollapsed && (
                  <TooltipContent side="right">Expand sidebar</TooltipContent>
                )}
              </TooltipProvider>
            </Tooltip>
          </div>
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
                        <TableHead>Delivery ID</TableHead>
                        <TableHead>PO #</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Expected Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingDeliveries.map((delivery) => {
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
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {delivery.status === 'shipped' && isInternalTransfer 
                                  ? 'Ready to Receive' 
                                  : delivery.status.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedDelivery(delivery);
                                  setIsReceiveDialogOpen(true);
                                }}
                                disabled={isInternalTransfer && !delivery.is_fulfilled}
                              >
                                {isInternalTransfer && !delivery.is_fulfilled ? 'Awaiting' : 'Receive'}
                              </Button>
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
                <Button variant="outline" size="sm" onClick={() => navigate('/sales-orders')}>
                  View All
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                {salesOrders.length === 0 && internalPOs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                    <p>No orders to fulfill</p>
                    <p className="text-xs mt-1">Confirmed orders shipping from this location will appear here</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Ship To</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Internal Purchase Orders (this location is the vendor) */}
                      {internalPOs.map((po) => (
                        <TableRow key={`po-${po.id}`} className="bg-blue-500/5">
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              Transfer
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{po.po_number}</TableCell>
                          <TableCell>{po.location?.name || '—'}</TableCell>
                          <TableCell>
                            {po.created_at 
                              ? new Date(po.created_at).toLocaleDateString() 
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColors[po.status] || ''}>
                              {po.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${po.total_amount?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedInternalPO(po);
                                fetchInternalPOItems(po.id);
                                setIsInternalPOFulfillDialogOpen(true);
                              }}
                            >
                              Fulfill
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Sales Orders */}
                      {salesOrders.map((order) => (
                        <TableRow key={`so-${order.id}`}>
                          <TableCell>
                            <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/20">
                              Sales
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{order.so_number}</TableCell>
                          <TableCell>{order.customer?.name || '—'}</TableCell>
                          <TableCell>
                            {order.order_date 
                              ? new Date(order.order_date).toLocaleDateString() 
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColors[order.status] || ''}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${order.total_amount?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedSalesOrder(order);
                                fetchSalesOrderItems(order.id);
                                setIsFulfillDialogOpen(true);
                              }}
                            >
                              Fulfill
                            </Button>
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
                <Button size="sm" onClick={() => openAreaDialog()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Area
                  <Kbd className="ml-2">A</Kbd>
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                {areas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Grid3X3 className="w-12 h-12 mb-3 opacity-30" />
                    <p className="font-medium">No areas defined</p>
                    <p className="text-sm mt-1">Create areas to organize your warehouse layout</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Bins</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areas.map((area) => (
                        <TableRow key={area.id}>
                          <TableCell className="font-mono">{area.area_id}</TableCell>
                          <TableCell className="font-medium">{area.name}</TableCell>
                          <TableCell className="text-muted-foreground">{area.description || '—'}</TableCell>
                          <TableCell className="text-right">{bins.filter(b => b.area_id === area.id).length}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAreaDialog(area)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteArea(area.id)}>
                                <Trash2 className="w-4 h-4" />
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
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bins.map((bin) => {
                        const area = areas.find(a => a.id === bin.area_id);
                        return (
                          <TableRow key={bin.id}>
                            <TableCell className="font-mono">{bin.bin_id}</TableCell>
                            <TableCell className="font-medium">{bin.name}</TableCell>
                            <TableCell>{area?.name || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{bin.capacity || '—'}</TableCell>
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
                              <TableCell className="text-right text-muted-foreground">{item.min_quantity ?? '—'}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{item.max_quantity ?? '—'}</TableCell>
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
              <Button type="button" variant="outline" onClick={() => setIsAreaDialogOpen(false)}>
                Cancel
                <Kbd>Esc</Kbd>
              </Button>
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

      {/* Receive Delivery Dialog */}
      {selectedDelivery && selectedLocationId && (
        <ReceiveDeliveryDialog
          open={isReceiveDialogOpen}
          onOpenChange={(open) => {
            setIsReceiveDialogOpen(open);
            if (!open) setSelectedDelivery(null);
          }}
          deliveryId={selectedDelivery.id}
          deliveryDisplayId={selectedDelivery.delivery_id}
          purchaseOrderId={selectedDelivery.purchase_order_id}
          locationId={selectedLocationId}
          onReceived={() => {
            fetchPendingDeliveries();
            fetchInventory();
            setSelectedDelivery(null);
          }}
        />
      )}

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

      {/* Fulfill Order Dialog */}
      <Dialog open={isFulfillDialogOpen} onOpenChange={(open) => {
        setIsFulfillDialogOpen(open);
        if (!open) {
          setSelectedSalesOrder(null);
          setSalesOrderItems([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fulfill Order</DialogTitle>
            <DialogDescription>
              Create an outbound delivery and goods issue for {selectedSalesOrder?.so_number}
            </DialogDescription>
          </DialogHeader>
          {selectedSalesOrder && (
            <div className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedSalesOrder.customer?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">${selectedSalesOrder.total_amount?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
              
              {selectedSalesOrder.customer && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Ship To</p>
                  <p>{selectedSalesOrder.customer.address_line1 || 'No address'}</p>
                  {selectedSalesOrder.customer.city && (
                    <p>{selectedSalesOrder.customer.city}, {selectedSalesOrder.customer.state} {selectedSalesOrder.customer.postal_code}</p>
                  )}
                </div>
              )}

              <div>
                <p className="text-muted-foreground text-sm mb-2">Items to fulfill</p>
                <div className="border rounded-md max-h-48 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesOrderItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{item.product?.product_id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="bg-muted/50 p-3 rounded-md text-sm">
                <p className="font-medium mb-1">This will:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Create an Outbound Delivery to the customer</li>
                  <li>Create a Goods Issue referencing the delivery</li>
                  <li>Update the sales order status to "Shipped"</li>
                </ul>
                <p className="mt-2 text-xs">Post the Goods Issue to deduct inventory</p>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 px-6 sticky bottom-0 bg-background border-t pt-4">
            <Button variant="outline" onClick={() => setIsFulfillDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleFulfillOrder} disabled={isFulfilling || salesOrderItems.length === 0}>
              {isFulfilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fulfill Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill Internal PO Dialog */}
      <Dialog open={isInternalPOFulfillDialogOpen} onOpenChange={(open) => {
        setIsInternalPOFulfillDialogOpen(open);
        if (!open) {
          setSelectedInternalPO(null);
          setInternalPOItems([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fulfill Internal Transfer</DialogTitle>
            <DialogDescription>
              Ship items to {selectedInternalPO?.location?.name} for PO {selectedInternalPO?.po_number}
            </DialogDescription>
          </DialogHeader>
          {selectedInternalPO && (
            <div className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Destination</p>
                  <p className="font-medium">{selectedInternalPO.location?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{selectedInternalPO.location?.location_id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Value</p>
                  <p className="font-medium">${selectedInternalPO.total_amount?.toFixed(2) || '0.00'}</p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-2">Items to transfer</p>
                <div className="border rounded-md max-h-48 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {internalPOItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{item.product?.product_id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="bg-blue-500/10 p-3 rounded-md text-sm border border-blue-500/20">
                <p className="font-medium mb-1 text-blue-700">This will:</p>
                <ul className="list-disc list-inside text-blue-600 space-y-1">
                  <li>Create a Goods Issue to deduct inventory from this location</li>
                  <li>Mark the delivery as fulfilled so destination can receive</li>
                  <li>Update the purchase order status to "Shipped"</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 px-6 sticky bottom-0 bg-background border-t pt-4">
            <Button variant="outline" onClick={() => setIsInternalPOFulfillDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleFulfillInternalPO} disabled={isFulfilling || internalPOItems.length === 0}>
              {isFulfilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fulfill Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Package Dialog */}
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
                  {bins.map((bin) => {
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
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              Cancel
            </Button>
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
    </div>
  );
};

export default Cockpit;
