import { useEffect, useState, useRef, useMemo } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useReduceAppLoad } from '@/hooks/use-reduce-app-load';
import { AppLoadQueryDialog, QueryField } from '@/components/AppLoadQueryDialog';
import { useNavigate } from 'react-router-dom';
import { OutboundDeliveriesTab } from '@/components/deliveries/OutboundDeliveriesTab';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useVendorSources } from '@/hooks/use-vendor-sources';
import { useTableSort } from '@/hooks/use-table-sort';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { ColumnToggle } from '@/components/ColumnToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/SortableTableHead';
import { ImportProgressDialog } from '@/components/ImportProgressDialog';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { ArrowLeft, Plus, Truck, Pencil, Trash2, Package, Eye, MoreHorizontal, Maximize2, Minimize2, SendHorizonal, Search, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { ViewDeliveryItemsTab } from '@/components/deliveries/ViewDeliveryItemsTab';
import { PackingTab } from '@/components/deliveries/PackingTab';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';

// Statuses that prevent editing
const NON_EDITABLE_STATUSES = ['delivered', 'shipped', 'in_transit'];

// Column definitions for Deliveries table
const DELIVERY_COLUMNS: ColumnDefinition[] = [
  { key: 'delivery_id', label: 'ID', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'purchase_order', label: 'PO', defaultVisible: true },
  { key: 'vendor', label: 'Vendor', defaultVisible: true },
  { key: 'location', label: 'Location', defaultVisible: true },
  { key: 'package_count', label: 'Packages', defaultVisible: true },
  { key: 'expected_date', label: 'Expected', defaultVisible: true },
  { key: 'delivered_date', label: 'Delivered', defaultVisible: true },
  { key: 'tracking_number', label: 'Tracking #', defaultVisible: true },
  { key: 'carrier', label: 'Carrier', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

interface Delivery {
  id: string;
  delivery_id: string;
  purchase_order_id: string | null;
  location_id: string | null;
  vendor_id: string | null;
  source_location_id: string | null;
  status: string;
  expected_date: string | null;
  delivered_date: string | null;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  purchase_order?: { po_number: string } | null;
  location?: { name: string } | null;
  vendor?: { name: string } | null;
  source_location?: { name: string } | null;
  delivery_items?: { pu_id: string | null }[] | null;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
}

interface Location {
  id: string;
  name: string;
  location_id: string;
}

interface Vendor {
  id: string;
  name: string;
  vendor_id: string;
}

// Extended interfaces for nested detail dialogs
interface VendorDetail {
  id: string;
  vendor_id: string;
  name: string;
  type: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
}

interface LocationDetail {
  id: string;
  location_id: string;
  name: string;
  type: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

interface PODetail {
  id: string;
  po_number: string;
  status: string;
  order_date: string | null;
  expected_delivery_date: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  vendor?: { name: string; vendor_id: string } | null;
  location?: { name: string; location_id: string } | null;
}

interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  pu_id: string | null;
  uom_id: string | null;
  product?: { name: string; product_id: string; unit?: string | null; width?: number | null; length?: number | null; height?: number | null; weight?: number | null; width_uom?: string | null; length_uom?: string | null; height_uom?: string | null; weight_uom?: string | null };
  packaging_unit?: { pu_number: string } | null;
  uom?: { id: string; name: string; abbreviation: string | null; conversion_factor?: number } | null;
}

interface PackingItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  pu_id: string | null;
  pu_number: string | null;
}

interface Product {
  id: string;
  name: string;
  product_id: string;
  unit?: string | null;
}

interface ProductUom {
  id: string;
  product_id: string;
  name: string;
  abbreviation: string | null;
  conversion_factor: number;
}

interface Carrier {
  id: string;
  name: string;
  carrier_id: string;
}

const DELIVERY_STATUSES = ['pending', 'in_transit', 'delivered', 'cancelled'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'in_transit': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'delivered': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

const Deliveries = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<'inbound' | 'outbound'>('inbound');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextDeliveryId, setNextDeliveryId] = useState('DEL-0001');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewDelivery, setViewDelivery] = useState<Delivery | null>(null);
  const [viewItems, setViewItems] = useState<DeliveryItem[]>([]);
  
  // Nested detail dialog states
  const [isVendorDetailOpen, setIsVendorDetailOpen] = useState(false);
  const [isLocationDetailOpen, setIsLocationDetailOpen] = useState(false);
  const [isPODetailOpen, setIsPODetailOpen] = useState(false);
  const [detailVendor, setDetailVendor] = useState<VendorDetail | null>(null);
  const [detailLocation, setDetailLocation] = useState<LocationDetail | null>(null);
  const [detailPO, setDetailPO] = useState<PODetail | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [isDialogMaximized, setIsDialogMaximized] = useMaximizedState();
  const [isViewMaximized, setIsViewMaximized] = useMaximizedState();
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [newItemProductId, setNewItemProductId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [inTransitConfirmOpen, setInTransitConfirmOpen] = useState(false);
  const [inTransitDeliveryId, setInTransitDeliveryId] = useState<string | null>(null);
  const [selectedInboundIds, setSelectedInboundIds] = useState<Set<string>>(new Set());
  const [isBulkInTransit, setIsBulkInTransit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Table sorting and filtering
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    sortedAndFilteredData,
  } = useTableSort(deliveries, 'delivery_id', 'desc');

  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? 'del/edit' : 'del/new');
    } else {
      setTransaction('del');
    }
  }, [isDialogOpen, isEditing, setTransaction]);

  // Use vendor sources hook
  const { vendorOptions } = useVendorSources(companyId);

  // Location options for SearchableSelect
  const locationOptions: SearchableSelectOption[] = useMemo(() => {
    return locations.map((loc) => ({
      value: loc.id,
      label: loc.name,
      sublabel: loc.location_id,
    }));
  }, [locations]);

  // PO options for SearchableSelect
  const poOptions: SearchableSelectOption[] = useMemo(() => {
    return purchaseOrders.map((po) => ({
      value: po.id,
      label: po.po_number,
    }));
  }, [purchaseOrders]);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

  const [formData, setFormData] = useState({
    delivery_id: '',
    purchase_order_id: '',
    location_id: '',
    vendor_id: '',
    status: 'pending',
    expected_date: '',
    delivered_date: '',
    tracking_number: '',
    carrier: '',
    notes: '',
  });

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

  const { reduceAppLoad, loading: reduceAppLoadLoading } = useReduceAppLoad();
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);

  const deliveryQueryFields: QueryField[] = [
    { key: 'delivery_id', label: 'Delivery ID' },
    { key: 'status', label: 'Status' },
    { key: 'tracking_number', label: 'Tracking Number' },
  ];

  useEffect(() => {
    if (companyId && !reduceAppLoadLoading) {
      if (reduceAppLoad) {
        setShowQueryDialog(true);
      } else {
        fetchDeliveries();
      }
      fetchNextDeliveryId();
      fetchPurchaseOrders();
      fetchLocations();
      fetchProducts();
      fetchCarriers();
    }
  }, [companyId, reduceAppLoad, reduceAppLoadLoading]);

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

  const fetchDeliveries = async (filters?: Record<string, string>) => {
    let query = supabase
      .from('deliveries')
      .select(`
        *,
        purchase_order:purchase_orders(po_number),
        location:locations!deliveries_location_id_fkey(name),
        vendor:vendors(name),
        source_location:locations!deliveries_source_location_id_fkey(name),
        delivery_items(pu_id)
      `)
      .eq('company_id', companyId!);

    if (filters?.delivery_id) query = query.ilike('delivery_id', `%${filters.delivery_id}%`);
    if (filters?.status) query = query.ilike('status', `%${filters.status}%`);
    if (filters?.tracking_number) query = query.ilike('tracking_number', `%${filters.tracking_number}%`);

    const { data, error } = await query.order('delivery_id', { ascending: false });

    if (error) {
      toast.error('Failed to load deliveries');
      return;
    }

    setDeliveries(data || []);
  };

  const handleQueryDialogSearch = async (filters: Record<string, string>) => {
    setQueryLoading(true);
    await fetchDeliveries(filters);
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const handleQueryDialogLoadAll = async () => {
    setQueryLoading(true);
    await fetchDeliveries();
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const fetchNextDeliveryId = async () => {
    const { data, error } = await supabase.rpc('get_next_delivery_id', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextDeliveryId(data);
    }
  };

  const fetchPurchaseOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, po_number')
      .eq('company_id', companyId!)
      .order('po_number', { ascending: false });
    
    setPurchaseOrders(data || []);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, location_id')
      .eq('company_id', companyId!)
      .order('name');
    
    setLocations(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, product_id, unit')
      .eq('company_id', companyId!)
      .order('name');
    
    setProducts(data || []);
  };

  const [productUoms, setProductUoms] = useState<ProductUom[]>([]);

  const fetchProductUoms = async (productIds: string[]) => {
    if (productIds.length === 0) return;
    const { data } = await supabase
      .from('product_uoms')
      .select('id, product_id, name, abbreviation, conversion_factor')
      .in('product_id', productIds);
    setProductUoms((data || []) as ProductUom[]);
  };

  const fetchCarriers = async () => {
    const { data } = await supabase
      .from('carriers')
      .select('id, name, carrier_id')
      .eq('company_id', companyId!)
      .eq('is_active', true)
      .order('name');
    
    setCarriers(data || []);
  };

  const fetchDeliveryItems = async (deliveryId: string) => {
    const { data } = await supabase
      .from('delivery_items')
      .select(`
        *,
        product:products(name, product_id, unit, width, length, height, weight, width_uom, length_uom, height_uom, weight_uom),
        packaging_unit:packaging_units(pu_number),
        uom:product_uoms(id, name, abbreviation, conversion_factor)
      `)
      .eq('delivery_id', deliveryId);
    
    const items = (data || []) as unknown as DeliveryItem[];
    setDeliveryItems(items);
    // Fetch UoMs for all products in the items
    const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))];
    if (productIds.length > 0) fetchProductUoms(productIds);
  };

  const handleAddItem = async () => {
    if (!editingId || !newItemProductId) return;

    const { error } = await supabase
      .from('delivery_items')
      .insert({
        delivery_id: editingId,
        product_id: newItemProductId,
        quantity: newItemQuantity,
      });

    if (error) {
      toast.error('Failed to add item');
      return;
    }

    toast.success('Item added');
    setNewItemProductId('');
    setNewItemQuantity(1);
    fetchDeliveryItems(editingId);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!editingId) return;

    const { error } = await supabase
      .from('delivery_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to remove item');
      return;
    }

    toast.success('Item removed');
    fetchDeliveryItems(editingId);
  };

  const handleUpdateItemQuantity = async (itemId: string, quantity: number) => {
    if (!editingId) return;

    const { error } = await supabase
      .from('delivery_items')
      .update({ quantity })
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to update quantity');
      return;
    }

    fetchDeliveryItems(editingId);
  };

  const handleUpdateItemUom = async (itemId: string, uomId: string | null) => {
    if (!editingId) return;
    const { error } = await supabase
      .from('delivery_items')
      .update({ uom_id: uomId })
      .eq('id', itemId);
    if (error) {
      toast.error('Failed to update UoM');
      return;
    }
    fetchDeliveryItems(editingId);
  };

  const handleViewUpdateItemUom = async (itemId: string, uomId: string | null) => {
    if (!viewDelivery) return;
    const { error } = await supabase
      .from('delivery_items')
      .update({ uom_id: uomId })
      .eq('id', itemId);
    if (error) { toast.error('Failed to update UoM'); return; }
    fetchViewItems(viewDelivery.id);
  };

  // fetchVendors removed - using useVendorSources hook instead


  const resetForm = () => {
    setFormData({
      delivery_id: nextDeliveryId,
      purchase_order_id: '',
      location_id: '',
      vendor_id: '',
      status: 'pending',
      expected_date: '',
      delivered_date: '',
      tracking_number: '',
      carrier: '',
      notes: '',
    });
    setIsEditing(false);
    setEditingId(null);
    setDeliveryItems([]);
    setActiveTab('details');
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, delivery_id: nextDeliveryId }));
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', handleOpenDialog);
  useTransactionAction('new', handleOpenDialog);

  const handleView = async (delivery: Delivery) => {
    setViewDelivery(delivery);
    await fetchViewItems(delivery.id);
    setIsViewOpen(true);
  };

  const fetchViewItems = async (deliveryId: string) => {
    const { data } = await supabase
      .from('delivery_items')
      .select(`
        *,
        product:products(name, product_id, unit, width, length, height, weight, width_uom, length_uom, height_uom, weight_uom),
        uom:product_uoms(id, name, abbreviation, conversion_factor)
      `)
      .eq('delivery_id', deliveryId);
    const items = (data || []) as unknown as DeliveryItem[];
    setViewItems(items);
    const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))];
    if (productIds.length > 0) fetchProductUoms(productIds);
  };

  const handleViewAddItem = async (productId: string, quantity: number) => {
    if (!viewDelivery) return;
    const { error } = await supabase
      .from('delivery_items')
      .insert({ delivery_id: viewDelivery.id, product_id: productId, quantity });
    if (error) { toast.error('Failed to add item'); return; }
    toast.success('Item added');
    fetchViewItems(viewDelivery.id);
  };

  const handleViewRemoveItem = async (itemId: string) => {
    if (!viewDelivery) return;
    const { error } = await supabase.from('delivery_items').delete().eq('id', itemId);
    if (error) { toast.error('Failed to remove item'); return; }
    toast.success('Item removed');
    fetchViewItems(viewDelivery.id);
  };

  const handleViewUpdateItemQuantity = async (itemId: string, quantity: number) => {
    if (!viewDelivery) return;
    const { error } = await supabase.from('delivery_items').update({ quantity }).eq('id', itemId);
    if (error) { toast.error('Failed to update quantity'); return; }
    fetchViewItems(viewDelivery.id);
  };

  // Helper to open vendor detail dialog
  const openVendorDetail = async (vendorId: string | null) => {
    if (!vendorId) return;
    const { data: vendor } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();
    if (vendor) {
      setDetailVendor(vendor as VendorDetail);
      setIsVendorDetailOpen(true);
    }
  };

  // Helper to open location detail dialog
  const openLocationDetail = async (locationId: string | null) => {
    if (!locationId) return;
    const { data: location } = await supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .single();
    if (location) {
      setDetailLocation(location as LocationDetail);
      setIsLocationDetailOpen(true);
    }
  };

  // Helper to open PO detail dialog
  const openPODetail = async (poId: string | null) => {
    if (!poId) return;
    const { data: po } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        vendor:vendors(name, vendor_id),
        location:locations!purchase_orders_location_id_fkey(name, location_id)
      `)
      .eq('id', poId)
      .single();
    if (po) {
      setDetailPO(po as unknown as PODetail);
      setIsPODetailOpen(true);
    }
  };

  const handleMarkInTransit = async () => {
    if (!inTransitDeliveryId) return;
    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'in_transit' })
      .eq('id', inTransitDeliveryId);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Delivery marked as In Transit');
      fetchDeliveries();
    }
    setInTransitConfirmOpen(false);
    setInTransitDeliveryId(null);
  };

  const inboundInTransitEligibleCount = useMemo(() => {
    return Array.from(selectedInboundIds).filter(id => {
      const d = deliveries.find(del => del.id === id);
      return d && d.status === 'pending';
    }).length;
  }, [selectedInboundIds, deliveries]);

  const [transitProgressOpen, setTransitProgressOpen] = useState(false);
  const [transitProgressTotal, setTransitProgressTotal] = useState(0);
  const [transitProgressProcessed, setTransitProgressProcessed] = useState(0);
  const [transitProgressResults, setTransitProgressResults] = useState<import('@/components/ImportProgressDialog').ImportResult[]>([]);
  const [transitProgressComplete, setTransitProgressComplete] = useState(false);

  const handleBulkMarkInTransit = async () => {
    const eligibleIds = Array.from(selectedInboundIds).filter(id => {
      const d = deliveries.find(del => del.id === id);
      return d && d.status === 'pending';
    });
    if (eligibleIds.length === 0) return;
    setInTransitConfirmOpen(false);
    setIsBulkInTransit(true);
    setTransitProgressOpen(true);
    setTransitProgressTotal(eligibleIds.length);
    setTransitProgressProcessed(0);
    setTransitProgressResults([]);
    setTransitProgressComplete(false);

    for (let i = 0; i < eligibleIds.length; i++) {
      const id = eligibleIds[i];
      const d = deliveries.find(del => del.id === id);
      const label = d?.delivery_id || id.slice(0, 8);
      const { error } = await supabase
        .from('deliveries')
        .update({ status: 'in_transit' })
        .eq('id', id);
      setTransitProgressProcessed(i + 1);
      setTransitProgressResults(prev => [...prev, {
        row: i + 1,
        status: error ? 'error' as const : 'success' as const,
        message: error ? `${label}: ${error.message}` : `${label} marked as In Transit`,
      }]);
    }

    setTransitProgressComplete(true);
    setSelectedInboundIds(new Set());
    fetchDeliveries();
    setIsBulkInTransit(false);
  };

  const handleEdit = (delivery: Delivery) => {
    setFormData({
      delivery_id: delivery.delivery_id,
      purchase_order_id: delivery.purchase_order_id || '',
      location_id: delivery.location_id || '',
      vendor_id: delivery.vendor_id || '',
      status: delivery.status,
      expected_date: delivery.expected_date || '',
      delivered_date: delivery.delivered_date || '',
      tracking_number: delivery.tracking_number || '',
      carrier: delivery.carrier || '',
      notes: delivery.notes || '',
    });
    setIsEditing(true);
    setEditingId(delivery.id);
    setActiveTab('details');
    fetchDeliveryItems(delivery.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('deliveries')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete delivery');
      return;
    }

    toast.success('Delivery deleted');
    fetchDeliveries();
    fetchNextDeliveryId();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      purchase_order_id: formData.purchase_order_id || null,
      location_id: formData.location_id || null,
      vendor_id: formData.vendor_id || null,
      status: formData.status,
      expected_date: formData.expected_date || null,
      delivered_date: formData.delivered_date || null,
      tracking_number: formData.tracking_number || null,
      carrier: formData.carrier || null,
      notes: formData.notes || null,
    };

    if (isEditing && editingId) {
      const { error } = await supabase
        .from('deliveries')
        .update(payload)
        .eq('id', editingId);

      if (error) {
        toast.error('Failed to update delivery');
        return;
      }

      toast.success('Delivery updated');
    } else {
      const { error } = await supabase
        .from('deliveries')
        .insert({
          ...payload,
          company_id: companyId!,
          delivery_id: formData.delivery_id,
        });

      if (error) {
        toast.error('Failed to create delivery');
        return;
      }

      toast.success('Delivery created');
    }

    setIsDialogOpen(false);
    fetchDeliveries();
    fetchNextDeliveryId();
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
      <AppLoadQueryDialog
        open={showQueryDialog}
        onClose={() => setShowQueryDialog(false)}
        onQuery={handleQueryDialogSearch}
        onLoadAll={handleQueryDialogLoadAll}
        fields={deliveryQueryFields}
        title="Load Deliveries"
        loading={queryLoading}
      />
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Truck className="w-7 h-7 text-teal-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Deliveries</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQueryDialog(true)} title="Search deliveries">
                <Search className="w-4 h-4" />
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenDialog} size="icon" className="relative">
                    <Plus className="w-4 h-4" />
                    <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
                  </Button>
                </DialogTrigger>
              <DialogContent className={`transition-all duration-200 ${isDialogMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[900px]'}`} onOpenAutoFocus={(e) => e.preventDefault()}>
                <button
                  type="button"
                  onClick={() => setIsDialogMaximized(!isDialogMaximized)}
                  className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                >
                  {isDialogMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Delivery' : 'Add Delivery'}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? 'Update delivery details and items.' : 'Track a new delivery.'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!isEditing && (
                    <div className="absolute right-16 top-4 z-10">
                      <CopyFromIdDialog<Delivery>
                        idLabel="Delivery ID"
                        onFetch={async (id) => {
                          const { data } = await supabase
                            .from('deliveries')
                            .select('*')
                            .eq('company_id', companyId!)
                            .eq('delivery_id', id)
                            .maybeSingle();
                          return data;
                        }}
                        onApply={(delivery) => {
                          setFormData(prev => ({
                            ...prev,
                            status: delivery.status,
                            purchase_order_id: delivery.purchase_order_id || '',
                            location_id: delivery.location_id || '',
                            vendor_id: delivery.vendor_id || '',
                            carrier: delivery.carrier || '',
                            tracking_number: '', // Don't copy tracking number
                            expected_date: delivery.expected_date || '',
                            delivered_date: '',
                            notes: delivery.notes || '',
                          }));
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="items" disabled={!isEditing}>
                          Items {isEditing && deliveryItems.length > 0 && `(${deliveryItems.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="packing" disabled={!isEditing || deliveryItems.length === 0}>
                          Packing
                        </TabsTrigger>
                      </TabsList>
                    
                      <TabsContent value="details" className="mt-4">
                      <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="delivery_id">Delivery ID</Label>
                            <Input
                              id="delivery_id"
                              value={formData.delivery_id}
                              onChange={(e) => setFormData({ ...formData, delivery_id: e.target.value })}
                              disabled={isEditing}
                              className={isEditing ? 'bg-muted' : ''}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                              value={formData.status}
                              onValueChange={(value) => setFormData({ ...formData, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DELIVERY_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="purchase_order_id">Purchase Order</Label>
                          <Select
                            value={formData.purchase_order_id}
                            onValueChange={(value) => setFormData({ ...formData, purchase_order_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select PO (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              {purchaseOrders.map((po) => (
                                <SelectItem key={po.id} value={po.id}>
                                  {po.po_number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="vendor_id">Vendor</Label>
                            <SearchableSelect
                              options={vendorOptions}
                              value={formData.vendor_id}
                              onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                              placeholder="Select vendor..."
                              allowClear
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="location_id">Destination</Label>
                            <Select
                              value={formData.location_id}
                              onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="carrier">Carrier</Label>
                            <Select
                              value={formData.carrier}
                              onValueChange={(value) => setFormData({ ...formData, carrier: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select carrier" />
                              </SelectTrigger>
                              <SelectContent>
                                {carriers.map((carrier) => (
                                  <SelectItem key={carrier.id} value={carrier.name}>
                                    {carrier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tracking_number">Tracking Number</Label>
                            <Input
                              id="tracking_number"
                              value={formData.tracking_number}
                              onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                              placeholder="1Z999AA10123456784"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="expected_date">Expected Date</Label>
                            <Input
                              id="expected_date"
                              type="date"
                              value={formData.expected_date}
                              onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="delivered_date">Delivered Date</Label>
                            <Input
                              id="delivered_date"
                              type="date"
                              value={formData.delivered_date}
                              onChange={(e) => setFormData({ ...formData, delivered_date: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">Notes</Label>
                          <Input
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional notes..."
                          />
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="items" className="mt-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Delivery Items</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => {
                            if (newItemProductId) {
                              handleAddItem();
                            } else {
                              // Add empty row
                              setDeliveryItems([...deliveryItems, {
                                id: `new-${Date.now()}`,
                                delivery_id: editingId || '',
                                product_id: '',
                                quantity: 1,
                                pu_id: null,
                                uom_id: null,
                                notes: null,
                                product: null,
                              }]);
                            }
                          }}>
                            <Plus className="w-4 h-4" />
                            Add Item
                          </Button>
                        </div>
                        
                        {deliveryItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                            No items added yet. Click "Add Item" to start.
                          </p>
                        ) : (
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                 <TableRow>
                                  <TableHead className="w-10">#</TableHead>
                                  <TableHead>Product</TableHead>
                                  <TableHead>UoM</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Volume</TableHead>
                                  <TableHead className="text-right">Weight</TableHead>
                                  <TableHead className="w-10"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {deliveryItems.map((item, index) => {
                                  const itemUoms = productUoms.filter(u => u.product_id === item.product_id);
                                  const conversionFactor = item.uom?.conversion_factor || 1;
                                  const baseQty = item.quantity * conversionFactor;
                                  const p = item.product;
                                  const vol = (p?.width && p?.length && p?.height) ? (p.width * p.length * p.height * baseQty) : null;
                                  const wt = p?.weight ? (p.weight * baseQty) : null;
                                  return (
                                  <TableRow key={item.id}>
                                    <TableCell className="p-2 text-muted-foreground text-sm font-mono">
                                      {index + 1}
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <Select
                                        value={item.product_id}
                                        onValueChange={(value) => {
                                          const updated = [...deliveryItems];
                                          const product = products.find(p => p.id === value);
                                          updated[index] = { 
                                            ...updated[index], 
                                            product_id: value,
                                            product: product || null,
                                            uom_id: null,
                                            uom: null,
                                          };
                                          setDeliveryItems(updated);
                                          fetchProductUoms([...new Set([...deliveryItems.map(i => i.product_id), value].filter(Boolean))]);
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select product" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {products.map((product) => (
                                            <SelectItem key={product.id} value={product.id}>
                                              {product.product_id} - {product.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="p-2">
                                      {itemUoms.length > 0 ? (
                                        <Select
                                          value={item.uom_id || '_base'}
                                          onValueChange={(value) => handleUpdateItemUom(item.id, value === '_base' ? null : value)}
                                        >
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder={item.product?.unit || 'Base'} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="_base">
                                              {item.product?.unit || 'Base'}
                                            </SelectItem>
                                            {itemUoms.map((uom) => (
                                              <SelectItem key={uom.id} value={uom.id}>
                                                {uom.abbreviation || uom.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <span className="text-sm text-muted-foreground px-2">
                                          {item.product?.unit || '—'}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <Input
                                        type="number"
                                        min={1}
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                        className="text-right"
                                      />
                                    </TableCell>
                                    <TableCell className="p-2 text-right text-sm font-mono text-muted-foreground">
                                      {vol != null ? `${vol.toFixed(2)} ${p?.width_uom || ''}³` : '—'}
                                    </TableCell>
                                    <TableCell className="p-2 text-right text-sm font-mono text-muted-foreground">
                                      {wt != null ? `${wt.toFixed(2)} ${p?.weight_uom || ''}` : '—'}
                                    </TableCell>
                                    <TableCell className="p-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveItem(item.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                  );
                                })}

                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="packing" className="mt-4">
                      {companyId && (
                        <PackingTab
                          deliveryItems={deliveryItems}
                          companyId={companyId}
                          deliveryId={editingId!}
                          onRefreshItems={() => editingId && fetchDeliveryItems(editingId)}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                  </div>
                  
                  <DialogFooter className="shrink-0">
                    <Button type="submit">
                      {isEditing ? 'Update' : 'Create'}
                      <Kbd className="ml-2">⌘S</Kbd>
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as 'inbound' | 'outbound')} className="w-full">
          <div className="border-b border-border px-4">
            <TabsList className="h-10 bg-transparent p-0 gap-4">
              <TabsTrigger value="inbound" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2">
                Inbound
              </TabsTrigger>
              <TabsTrigger value="outbound" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2">
                Outbound
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="inbound" className="mt-0">
            {deliveries.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No inbound deliveries yet</h3>
                <p className="text-muted-foreground mb-4">
                  Track your first delivery to get started.
                </p>
                <Button onClick={handleOpenDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Delivery
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden">
                {selectedInboundIds.size > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
                    <span className="text-sm text-muted-foreground">{selectedInboundIds.size} selected</span>
                    {inboundInTransitEligibleCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setInTransitConfirmOpen(true)}
                        disabled={isBulkInTransit}
                      >
                        <SendHorizonal className="w-4 h-4 mr-2" />
                        Mark In Transit ({inboundInTransitEligibleCount})
                      </Button>
                    )}
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={sortedAndFilteredData.length > 0 && sortedAndFilteredData.every(d => selectedInboundIds.has(d.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedInboundIds(new Set(sortedAndFilteredData.map(d => d.id)));
                            } else {
                              setSelectedInboundIds(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <SortableTableHead
                        label="ID"
                        sortKey="delivery_id"
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={handleSort}
                        filterValue={filters['delivery_id'] || ''}
                        onFilter={(value) => setFilter('delivery_id', value)}
                        className="w-28"
                      />
                      <SortableTableHead
                        label="PO"
                        sortKey="purchase_order.po_number"
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={handleSort}
                        filterValue={filters['purchase_order.po_number'] || ''}
                        onFilter={(value) => setFilter('purchase_order.po_number', value)}
                      />
                      <SortableTableHead
                        label="Vendor"
                        sortKey="vendor.name"
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={handleSort}
                        filterValue={filters['vendor.name'] || ''}
                        onFilter={(value) => setFilter('vendor.name', value)}
                      />
                      <SortableTableHead
                        label="Destination"
                        sortKey="location.name"
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={handleSort}
                        filterValue={filters['location.name'] || ''}
                        onFilter={(value) => setFilter('location.name', value)}
                      />
                      <SortableTableHead
                        label="Carrier"
                        sortKey="carrier"
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={handleSort}
                        filterValue={filters['carrier'] || ''}
                        onFilter={(value) => setFilter('carrier', value)}
                      />
                      <SortableTableHead
                        label="Packages"
                        sortKey="package_count"
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={handleSort}
                        filterable={false}
                        className="text-right"
                      />
                      <SortableTableHead
                        label="Expected"
                        sortKey="expected_date"
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={handleSort}
                        filterable={false}
                      />
                      <SortableTableHead
                        label="Status"
                        sortKey="status"
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={handleSort}
                        filterValue={filters['status'] || ''}
                        onFilter={(value) => setFilter('status', value)}
                      />
                      <SortableTableHead
                        label="Actions"
                        sortKey=""
                        currentSortKey={sortConfig.key}
                        currentSortDirection={sortConfig.direction}
                        onSort={() => {}}
                        filterable={false}
                        className="w-24"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAndFilteredData.map((delivery) => {
                      const isEditable = !NON_EDITABLE_STATUSES.includes(delivery.status);
                      return (
                        <TableRow key={delivery.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedInboundIds.has(delivery.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedInboundIds);
                                if (checked) next.add(delivery.id); else next.delete(delivery.id);
                                setSelectedInboundIds(next);
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            <button
                              onClick={() => handleView(delivery)}
                              className="text-primary hover:underline cursor-pointer"
                            >
                              {delivery.delivery_id}
                            </button>
                          </TableCell>
                          <TableCell>{delivery.purchase_order?.po_number || '—'}</TableCell>
                          <TableCell>{delivery.vendor?.name || delivery.source_location?.name || '—'}</TableCell>
                          <TableCell>{delivery.location?.name || '—'}</TableCell>
                          <TableCell>{delivery.carrier || '—'}</TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const puIds = new Set((delivery.delivery_items || []).map(i => i.pu_id).filter(Boolean));
                              return puIds.size > 0 ? (
                                <Badge variant="outline" className="font-mono">
                                  <Package className="w-3 h-3 mr-1" />
                                  {puIds.size}
                                </Badge>
                              ) : '—';
                            })()}
                          </TableCell>
                          <TableCell>
                            {delivery.expected_date 
                              ? format(new Date(delivery.expected_date), 'MMM d, yyyy')
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(delivery.status)}>
                              {delivery.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleView(delivery)}
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {delivery.status === 'pending' && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setInTransitDeliveryId(delivery.id);
                                        setInTransitConfirmOpen(true);
                                      }}
                                    >
                                      <SendHorizonal className="w-4 h-4 mr-2" />
                                      Mark In Transit
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleEdit(delivery)}
                                    disabled={!isEditable}
                                  >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(delivery.id)}
                                    disabled={!isEditable}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="outbound" className="mt-0">
            {companyId && <OutboundDeliveriesTab companyId={companyId} />}
          </TabsContent>
        </Tabs>
      </main>

      {/* In Transit Confirmation Dialog */}
      <AlertDialog open={inTransitConfirmOpen} onOpenChange={(open) => {
        setInTransitConfirmOpen(open);
        if (!open) setInTransitDeliveryId(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as In Transit?</AlertDialogTitle>
            <AlertDialogDescription>
              {inTransitDeliveryId
                ? 'Once marked as In Transit, this delivery can no longer be edited. Are you sure you want to continue?'
                : `${inboundInTransitEligibleCount} deliver${inboundInTransitEligibleCount === 1 ? 'y' : 'ies'} will be marked as In Transit and can no longer be edited. Continue?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={inTransitDeliveryId ? handleMarkInTransit : handleBulkMarkInTransit}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Delivery Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className={`flex flex-col transition-all duration-200 ${isViewMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[900px] max-h-[85vh]'}`}>
              {viewDelivery && !NON_EDITABLE_STATUSES.includes(viewDelivery.status) && (
                <button
                  onClick={() => {
                    setIsViewOpen(false);
                    if (viewDelivery) handleEdit(viewDelivery);
                  }}
                  title="Edit"
                  className="absolute right-16 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsViewMaximized(!isViewMaximized)}
                className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
              >
                {isViewMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>View Delivery</DialogTitle>
                <DialogDescription>
                  {viewDelivery?.delivery_id}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {viewDelivery && (() => {
            const hasPackedItems = viewItems.some(i => i.pu_id);
            const tabCount = hasPackedItems ? 3 : 2;
            return (
            <Tabs defaultValue="details" className="flex-1 overflow-y-auto px-6 pb-6">
              <TabsList className={`grid w-full grid-cols-${tabCount}`}>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">
                  Items {viewItems.length > 0 && `(${viewItems.length})`}
                </TabsTrigger>
                {hasPackedItems && (
                  <TabsTrigger value="packing">Packing</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Status</Label>
                    <div>
                      <Badge variant="outline" className={getStatusColor(viewDelivery.status)}>
                        {viewDelivery.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Purchase Order</Label>
                    {viewDelivery.purchase_order?.po_number ? (
                      <button
                        type="button"
                        onClick={() => openPODetail(viewDelivery.purchase_order_id)}
                        className="text-sm text-primary hover:underline font-mono block"
                      >
                        {viewDelivery.purchase_order.po_number}
                      </button>
                    ) : (
                      <p className="text-sm">—</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Vendor</Label>
                    {viewDelivery.vendor?.name ? (
                      <button
                        type="button"
                        onClick={() => openVendorDetail(viewDelivery.vendor_id)}
                        className="text-sm text-primary hover:underline block"
                      >
                        {viewDelivery.vendor.name}
                      </button>
                    ) : viewDelivery.source_location?.name ? (
                      <button
                        type="button"
                        onClick={() => openLocationDetail(viewDelivery.source_location_id)}
                        className="text-sm text-primary hover:underline block"
                      >
                        {viewDelivery.source_location.name}
                      </button>
                    ) : (
                      <p className="text-sm">—</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Destination</Label>
                    {viewDelivery.location?.name ? (
                      <button
                        type="button"
                        onClick={() => openLocationDetail(viewDelivery.location_id)}
                        className="text-sm text-primary hover:underline block"
                      >
                        {viewDelivery.location.name}
                      </button>
                    ) : (
                      <p className="text-sm">—</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Carrier</Label>
                    <p className="text-sm">{viewDelivery.carrier || '—'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Tracking Number</Label>
                    <p className="text-sm font-mono">{viewDelivery.tracking_number || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Expected Date</Label>
                    <p className="text-sm">
                      {viewDelivery.expected_date 
                        ? format(new Date(viewDelivery.expected_date), 'MMM d, yyyy')
                        : '—'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Delivered Date</Label>
                    <p className="text-sm">
                      {viewDelivery.delivered_date 
                        ? format(new Date(viewDelivery.delivered_date), 'MMM d, yyyy')
                        : '—'}
                    </p>
                  </div>
                </div>
                {viewDelivery.notes && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="text-sm">{viewDelivery.notes}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="items" className="mt-4">
                <ViewDeliveryItemsTab
                  viewItems={viewItems}
                  viewDelivery={viewDelivery}
                  products={products}
                  productUoms={productUoms}
                  isEditable={false}
                  onAddItem={handleViewAddItem}
                  onRemoveItem={handleViewRemoveItem}
                  onUpdateQuantity={handleViewUpdateItemQuantity}
                  onUpdateUom={handleViewUpdateItemUom}
                />
              </TabsContent>

              {hasPackedItems && (
                <TabsContent value="packing" className="mt-4">
                  {(() => {
                    const unpackedItems = viewItems.filter(i => !i.pu_id);
                    const packedByPu = viewItems.filter(i => i.pu_id).reduce((acc, item) => {
                      const key = item.pu_id!;
                      if (!acc[key]) acc[key] = { puNumber: item.packaging_unit?.pu_number || key, items: [] };
                      acc[key].items.push(item);
                      return acc;
                    }, {} as Record<string, { puNumber: string; items: typeof viewItems }>);

                    return (
                      <div className="grid grid-cols-2 gap-4">
                        {/* Unpacked column */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Unpacked Items</h4>
                          {unpackedItems.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">All items are packed</p>
                          ) : (
                            <div className="space-y-1">
                              {unpackedItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                  <span className="truncate">{item.product?.name || item.product_id}</span>
                                  <span className="text-muted-foreground ml-2 shrink-0">
                                    × {item.quantity} {item.uom?.abbreviation || item.product?.unit || 'EA'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Packages column */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Packages</h4>
                          {Object.entries(packedByPu).map(([puId, { puNumber, items }]) => (
                            <div key={puId} className="border rounded-md">
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                                <Package className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-mono font-medium">{puNumber}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="p-2 space-y-1">
                                {items.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between px-2 py-1 text-sm">
                                    <span className="truncate">{item.product?.name || item.product_id}</span>
                                    <span className="text-muted-foreground ml-2 shrink-0">
                                      × {item.quantity} {item.uom?.abbreviation || item.product?.unit || 'EA'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>
              )}
            </Tabs>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Vendor Detail Dialog */}
      <Dialog open={isVendorDetailOpen} onOpenChange={setIsVendorDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>
              {detailVendor?.vendor_id}
            </DialogDescription>
          </DialogHeader>
          {detailVendor && (
            <div className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{detailVendor.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p>{detailVendor.type || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Contact</Label>
                  <p>{detailVendor.contact_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p>{detailVendor.phone || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Email</Label>
                <p>{detailVendor.email || '-'}</p>
              </div>
              {(detailVendor.address_line1 || detailVendor.city) && (
                <div>
                  <Label className="text-muted-foreground text-xs">Address</Label>
                  <p>{detailVendor.address_line1}</p>
                  {detailVendor.address_line2 && <p>{detailVendor.address_line2}</p>}
                  <p>
                    {[detailVendor.city, detailVendor.state, detailVendor.postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {detailVendor.country && <p>{detailVendor.country}</p>}
                </div>
              )}
              {detailVendor.website && (
                <div>
                  <Label className="text-muted-foreground text-xs">Website</Label>
                  <p>{detailVendor.website}</p>
                </div>
              )}
              {detailVendor.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <p className="text-sm text-muted-foreground">{detailVendor.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Location Detail Dialog */}
      <Dialog open={isLocationDetailOpen} onOpenChange={setIsLocationDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Destination Details</DialogTitle>
            <DialogDescription>
              {detailLocation?.location_id}
            </DialogDescription>
          </DialogHeader>
          {detailLocation && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{detailLocation.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p>{detailLocation.type || '-'}</p>
                </div>
              </div>
              {(detailLocation.address_line1 || detailLocation.city) && (
                <div>
                  <Label className="text-muted-foreground text-xs">Address</Label>
                  <p>{detailLocation.address_line1}</p>
                  {detailLocation.address_line2 && <p>{detailLocation.address_line2}</p>}
                  <p>
                    {[detailLocation.city, detailLocation.state, detailLocation.postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {detailLocation.country && <p>{detailLocation.country}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PO Detail Dialog */}
      <Dialog open={isPODetailOpen} onOpenChange={setIsPODetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>
              {detailPO?.po_number}
            </DialogDescription>
          </DialogHeader>
          {detailPO && (
            <div className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <Badge variant="outline" className="mt-1">
                    {detailPO.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Vendor</Label>
                  <p className="font-medium">{detailPO.vendor?.name || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Order Date</Label>
                  <p>{detailPO.order_date ? format(new Date(detailPO.order_date), 'MMM d, yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Expected Delivery</Label>
                  <p>{detailPO.expected_delivery_date ? format(new Date(detailPO.expected_delivery_date), 'MMM d, yyyy') : '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Location</Label>
                  <p>{detailPO.location?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Total Amount</Label>
                  <p className="font-medium">${Number(detailPO.total_amount || 0).toFixed(2)}</p>
                </div>
              </div>
              {detailPO.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <p className="text-sm text-muted-foreground">{detailPO.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImportProgressDialog
        open={transitProgressOpen}
        onOpenChange={setTransitProgressOpen}
        title="Marking Deliveries In Transit"
        totalRows={transitProgressTotal}
        processedRows={transitProgressProcessed}
        results={transitProgressResults}
        isComplete={transitProgressComplete}
      />
    </div>
  );
};

export default Deliveries;
