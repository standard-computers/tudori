import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useVendorSources } from '@/hooks/use-vendor-sources';
import { useExcel } from '@/hooks/use-excel';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { SortableTableHead } from '@/components/SortableTableHead';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { ArrowLeft, FileSpreadsheet, Plus, Play, Trash2, Eye, Loader2, MoreHorizontal, ShoppingCart, Check, X, History } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AuditHistoryTab } from '@/components/AuditHistoryTab';
interface Requisition {
  id: string;
  requisition_id: string;
  status: string;
  location_id: string | null;
  vendor_id: string | null;
  source_location_id: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  created_by: string | null;
  location?: { name: string; location_id: string } | null;
  source_location?: { name: string; location_id: string } | null;
  vendor?: { name: string; vendor_id: string } | null;
  creator?: { first_name: string | null; last_name: string | null } | null;
}

// Full vendor details for detail dialog
interface VendorDetail {
  id: string;
  vendor_id: string;
  name: string;
  type: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
}

// Full location details for detail dialog
interface LocationDetail {
  id: string;
  location_id: string;
  name: string;
  type: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface RequisitionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  product?: { name: string; price: number | null };
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

interface Product {
  id: string;
  name: string;
  product_id: string;
  price: number | null;
  vendor_id: string | null;
  status: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  vendor_id: string | null;
  location_id: string | null;
  bill_to_location_id: string | null;
  ledger_id: string | null;
  requisition_id: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  order_date: string;
  vendor?: { name: string } | null;
  location?: { name: string } | null;
  bill_to_location?: { name: string } | null;
  ledger?: { name: string } | null;
}

interface PurchaseOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  product?: { name: string; price: number | null };
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500',
  pending: 'bg-yellow-500',
  approved: 'bg-green-500',
  ordered: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
};

const Requisitions = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const runFormRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Use vendor sources hook for combined vendors + DC/warehouse locations
  const { vendorOptions, parseVendorValue } = useVendorSources(companyId);
  
  // Excel import/export
  const { exportToExcel, readExcel } = useExcel();
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // View dialog state
  const [viewRequisition, setViewRequisition] = useState<Requisition | null>(null);
  const [viewLinkedPO, setViewLinkedPO] = useState<{ po_number: string } | null>(null);
  const [viewItems, setViewItems] = useState<RequisitionItem[]>([]);
  
  // PO View dialog state (for viewing created PO after conversion)
  const [isPOViewDialogOpen, setIsPOViewDialogOpen] = useState(false);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
  const [viewPOItems, setViewPOItems] = useState<PurchaseOrderItem[]>([]);
  
  // Nested detail dialog states
  const [isVendorDetailOpen, setIsVendorDetailOpen] = useState(false);
  const [isLocationDetailOpen, setIsLocationDetailOpen] = useState(false);
  const [detailVendor, setDetailVendor] = useState<VendorDetail | null>(null);
  const [detailLocation, setDetailLocation] = useState<LocationDetail | null>(null);
  const [detailLocationLabel, setDetailLocationLabel] = useState<string>('');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk conversion progress state
  const [isBulkConverting, setIsBulkConverting] = useState(false);
  const [bulkConvertProgress, setBulkConvertProgress] = useState({ current: 0, total: 0, currentAction: '' });
  const [bulkConvertResults, setBulkConvertResults] = useState<{ success: string[]; failed: string[] }>({ success: [], failed: [] });

  // Clear selection when requisitions change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [requisitions]);

  // Check if selected requisitions can be converted
  const selectedConvertibleReqs = useMemo(() => {
    return requisitions.filter(
      (r) => selectedIds.has(r.id) && r.status !== 'ordered' && r.status !== 'completed' && r.status !== 'cancelled'
    );
  }, [requisitions, selectedIds]);

  // Internal conversion function without UI side effects (for bulk operations)
  const convertRequisitionToPO = async (requisition: Requisition): Promise<{ success: boolean; poNumber?: string; error?: string }> => {
    try {
      // Fetch requisition items
      const { data: reqItems, error: itemsError } = await supabase
        .from('requisition_items')
        .select('*, product:products(name, price)')
        .eq('requisition_id', requisition.id);

      if (itemsError) throw itemsError;

      if (!reqItems || reqItems.length === 0) {
        return { success: false, error: 'No items found' };
      }

      // Fetch active ledgers for auto-selection
      const { data: ledgersData } = await supabase
        .from('ledgers' as any)
        .select('id, name, location_id, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      const ledgers = (ledgersData as any) || [];

      if (ledgers.length === 0) {
        return { success: false, error: 'No ledger available' };
      }

      // Get next PO number
      const { data: poNumber, error: poNumError } = await supabase.rpc('get_next_po_number', {
        p_company_id: companyId,
      });

      if (poNumError) throw poNumError;

      // Calculate totals
      const subtotal = reqItems.reduce((sum, item) => {
        return sum + (item.unit_price || item.product?.price || 0) * item.quantity;
      }, 0);
      const totalAmount = subtotal;

      // Parse vendor_id
      const parsedVendor = requisition.vendor_id ? parseVendorValue(requisition.vendor_id) : null;
      const poVendorId = parsedVendor?.type === 'vendor' ? parsedVendor.id : null;
      const poSourceLocationId = requisition.source_location_id || (parsedVendor?.type === 'location' ? parsedVendor.id : null);

      // Auto-select ledger
      let selectedLedgerId: string | null = null;
      if (ledgers.length === 1) {
        selectedLedgerId = ledgers[0].id;
      } else if (requisition.location_id) {
        const locationLedger = ledgers.find((l: any) => l.location_id === requisition.location_id);
        if (locationLedger) {
          selectedLedgerId = locationLedger.id;
        } else {
          const generalLedger = ledgers.find((l: any) => !l.location_id);
          selectedLedgerId = generalLedger?.id || ledgers[0].id;
        }
      } else {
        const generalLedger = ledgers.find((l: any) => !l.location_id);
        selectedLedgerId = generalLedger?.id || ledgers[0].id;
      }

      // Create purchase order
      const { data: newPO, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          company_id: companyId,
          po_number: poNumber,
          status: 'draft',
          vendor_id: poVendorId,
          source_location_id: poSourceLocationId,
          location_id: requisition.location_id,
          bill_to_location_id: requisition.location_id,
          ledger_id: selectedLedgerId,
          requisition_id: requisition.id,
          subtotal,
          tax_amount: 0,
          total_amount: totalAmount,
          notes: `Converted from requisition ${requisition.requisition_id}`,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create purchase order items
      const poItems = reqItems.map(item => ({
        purchase_order_id: newPO.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price || item.product?.price || 0,
        total_price: (item.unit_price || item.product?.price || 0) * item.quantity,
      }));

      const { error: poItemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);

      if (poItemsError) throw poItemsError;

      // Note: Ledger transaction is created when the Goods Receipt is posted

      // Update requisition status to 'ordered'
      await supabase
        .from('requisitions')
        .update({ status: 'ordered' })
        .eq('id', requisition.id);

      return { success: true, poNumber };
    } catch (error: any) {
      console.error('Error converting to PO:', error);
      return { success: false, error: error.message || 'Conversion failed' };
    }
  };

  const handleBulkConvert = async () => {
    if (selectedConvertibleReqs.length === 0) return;

    const total = selectedConvertibleReqs.length;
    setIsBulkConverting(true);
    setBulkConvertProgress({ current: 0, total, currentAction: 'Starting conversion...' });
    setBulkConvertResults({ success: [], failed: [] });

    const successList: string[] = [];
    const failedList: string[] = [];

    for (let i = 0; i < selectedConvertibleReqs.length; i++) {
      const req = selectedConvertibleReqs[i];
      setBulkConvertProgress({
        current: i + 1,
        total,
        currentAction: `Converting ${req.requisition_id} to Purchase Order...`,
      });

      const result = await convertRequisitionToPO(req);
      
      if (result.success && result.poNumber) {
        successList.push(`${req.requisition_id} → ${result.poNumber}`);
      } else {
        failedList.push(`${req.requisition_id}: ${result.error || 'Unknown error'}`);
      }
    }

    setBulkConvertResults({ success: successList, failed: failedList });
    setBulkConvertProgress({ current: total, total, currentAction: 'Completed' });
    
    // Brief delay to show completion, then close
    setTimeout(() => {
      setIsBulkConverting(false);
      setSelectedIds(new Set());
      fetchRequisitions();
      
      // Show summary toast
      if (failedList.length === 0) {
        toast.success(`Successfully converted ${successList.length} requisition(s) to Purchase Orders`);
      } else if (successList.length === 0) {
        toast.error(`Failed to convert ${failedList.length} requisition(s)`);
      } else {
        toast.info(`Converted ${successList.length} requisition(s), ${failedList.length} failed`);
      }
    }, 1500);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    // Check if any selected requisitions have linked POs
    const selectedReqs = requisitions.filter(r => selectedIds.has(r.id));
    const { data: linkedPOs } = await supabase
      .from('purchase_orders')
      .select('requisition_id, po_number')
      .in('requisition_id', selectedReqs.map(r => r.id));

    if (linkedPOs && linkedPOs.length > 0) {
      const blockedIds = new Set(linkedPOs.map(po => po.requisition_id));
      const blockedReqs = selectedReqs.filter(r => blockedIds.has(r.id));
      toast.error(`Cannot delete ${blockedReqs.length} requisition(s) already converted to POs`);
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} requisition(s)?`)) return;

    const { error } = await supabase
      .from('requisitions')
      .delete()
      .in('id', Array.from(selectedIds));

    if (error) {
      toast.error('Failed to delete requisitions');
      return;
    }

    toast.success(`Deleted ${selectedIds.size} requisition(s)`);
    setSelectedIds(new Set());
    fetchRequisitions();
  };
  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction('req/new');
    } else if (isViewDialogOpen) {
      setTransaction('req/view');
    } else if (isRunDialogOpen) {
      setTransaction('req/run');
    } else if (isPOViewDialogOpen) {
      setTransaction('ord/view');
    } else {
      setTransaction('req');
    }
  }, [isDialogOpen, isViewDialogOpen, isRunDialogOpen, isPOViewDialogOpen, setTransaction]);

  // Ctrl+S to save in run dialog
  useSaveShortcut(() => {
    if (isRunDialogOpen && !isRunning && suggestedItems.length > 0) {
      handleRunRequisition();
    }
  }, isRunDialogOpen);
  
  // Run dialog form state
  const [runFormData, setRunFormData] = useState({
    location_id: '',
    vendor_id: '',
  });
  const [suggestedItems, setSuggestedItems] = useState<{ product: Product; quantity: number }[]>([]);

  // Location options for SearchableSelect
  const locationOptions: SearchableSelectOption[] = useMemo(() => {
    return locations.map((loc) => ({
      value: loc.id,
      label: loc.name,
      sublabel: loc.location_id,
    }));
  }, [locations]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchRequisitions();
      fetchLocations();
      fetchProducts();
    }
  }, [companyId]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);
    }
    setLoading(false);
  };

  const fetchRequisitions = async () => {
    const { data, error } = await supabase
      .from('requisitions')
      .select(`
        *,
        location:locations!requisitions_location_id_fkey(name, location_id),
        source_location:locations!requisitions_source_location_id_fkey(name, location_id),
        vendor:vendors(name, vendor_id)
      `)
      .eq('company_id', companyId)
      .order('requisition_id', { ascending: false });

    if (error) {
      console.error('Error fetching requisitions:', error);
      toast.error('Failed to load requisitions');
      return;
    }

    // Fetch creator info separately for requisitions with created_by
    const reqs = (data || []) as any[];
    const createdByIds = [...new Set(reqs.filter(r => r.created_by).map(r => r.created_by))];
    
    let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
    if (createdByIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', createdByIds);
      
      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
          return acc;
        }, {} as Record<string, { first_name: string | null; last_name: string | null }>);
      }
    }

    // Merge creator info into requisitions
    const requisitionsWithCreator = reqs.map(req => ({
      ...req,
      creator: req.created_by ? profilesMap[req.created_by] || null : null,
    }));

    setRequisitions(requisitionsWithCreator);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, location_id')
      .eq('company_id', companyId)
      .order('name');
    setLocations(data || []);
  };


  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, product_id, price, vendor_id, status')
      .eq('company_id', companyId)
      .eq('status', 'active') // Only fetch active products
      .order('name');
    setProducts(data || []);
  };

  const handleRunClick = () => {
    setRunFormData({ location_id: '', vendor_id: '' });
    setSuggestedItems([]);
    setIsRunDialogOpen(true);
  };

  // Keyboard shortcut for running requisition
  useKeyboardShortcut('n', handleRunClick);

  const generateSuggestions = () => {
    // Filter products by selected vendor if one is selected
    let eligibleProducts = products;
    if (runFormData.vendor_id) {
      const parsed = parseVendorValue(runFormData.vendor_id);
      if (parsed?.type === 'vendor') {
        eligibleProducts = products.filter(p => p.vendor_id === parsed.id);
      }
    }

    // Generate suggested items (in a real app, this would be based on inventory levels, reorder points, etc.)
    // For now, suggest all eligible products with a random quantity between 1-10
    const suggestions = eligibleProducts.map(product => ({
      product,
      quantity: Math.floor(Math.random() * 10) + 1,
    }));

    setSuggestedItems(suggestions);
  };

  const handleRunRequisition = async () => {
    if (!runFormData.location_id) {
      toast.error('Please select a destination location');
      return;
    }

    if (suggestedItems.length === 0) {
      toast.error('No items to include in requisition');
      return;
    }

    setIsRunning(true);

    try {
      // Group items by vendor_id
      const itemsByVendor = new Map<string | null, { product: Product; quantity: number }[]>();
      
      for (const item of suggestedItems) {
        const vendorId = item.product.vendor_id;
        if (!itemsByVendor.has(vendorId)) {
          itemsByVendor.set(vendorId, []);
        }
        itemsByVendor.get(vendorId)!.push(item);
      }

      const locationName = locations.find(l => l.id === runFormData.location_id)?.name || 'location';
      const createdReqIds: string[] = [];
      let totalItemsCreated = 0;

      // Create separate requisition for each vendor group
      for (const [vendorId, vendorItems] of itemsByVendor) {
        // Get next requisition ID for each requisition
        const { data: nextId, error: idError } = await supabase.rpc('get_next_requisition_id', {
          p_company_id: companyId,
        });

        if (idError) throw idError;

        // Calculate total amount for this vendor's items
        const totalAmount = vendorItems.reduce((sum, item) => {
          return sum + (item.product.price || 0) * item.quantity;
        }, 0);

        // Create requisition for this vendor
        const { data: requisition, error: reqError } = await supabase
          .from('requisitions')
          .insert({
            company_id: companyId,
            requisition_id: nextId,
            status: 'draft',
            location_id: runFormData.location_id || null,
            vendor_id: vendorId,
            total_amount: totalAmount,
            notes: `Auto-generated requisition for ${locationName}`,
            created_by: user?.id || null,
          })
          .select()
          .single();

        if (reqError) throw reqError;

        // Create requisition items for this vendor
        const itemsToInsert = vendorItems.map(item => ({
          requisition_id: requisition.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
        }));

        const { error: itemsError } = await supabase
          .from('requisition_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        createdReqIds.push(nextId);
        totalItemsCreated += vendorItems.length;
      }

      // Show appropriate success message
      if (createdReqIds.length === 1) {
        toast.success(`Requisition ${createdReqIds[0]} created with ${totalItemsCreated} items`);
      } else {
        toast.success(`Created ${createdReqIds.length} requisitions (${createdReqIds.join(', ')}) with ${totalItemsCreated} total items`);
      }
      
      setIsRunDialogOpen(false);
      fetchRequisitions();
    } catch (error: any) {
      console.error('Error creating requisition:', error);
      toast.error(error.message || 'Failed to create requisition');
    } finally {
      setIsRunning(false);
    }
  };

  const handleViewRequisition = async (requisition: Requisition) => {
    setViewRequisition(requisition);
    setViewLinkedPO(null);
    
    // Fetch items for this requisition
    const { data: items } = await supabase
      .from('requisition_items')
      .select(`
        *,
        product:products(name, price)
      `)
      .eq('requisition_id', requisition.id);

    setViewItems(items || []);
    
    // Fetch linked PO if exists
    const { data: linkedPO } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .eq('requisition_id', requisition.id)
      .maybeSingle();
    
    setViewLinkedPO(linkedPO);
    setIsViewDialogOpen(true);
  };

  const handleDeleteRequisition = async (id: string) => {
    // Check if a PO exists for this requisition
    const { data: linkedPO } = await supabase
      .from('purchase_orders')
      .select('id, po_number')
      .eq('requisition_id', id)
      .maybeSingle();

    if (linkedPO) {
      toast.error(`Cannot delete: Requisition has been converted to PO ${linkedPO.po_number}`);
      return;
    }

    if (!confirm('Are you sure you want to delete this requisition?')) return;

    const { error } = await supabase
      .from('requisitions')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete requisition');
      return;
    }

    toast.success('Requisition deleted');
    fetchRequisitions();
  };

  const handleConvertToPO = async (requisition: Requisition) => {
    try {
      // Fetch requisition items
      const { data: reqItems, error: itemsError } = await supabase
        .from('requisition_items')
        .select('*, product:products(name, price)')
        .eq('requisition_id', requisition.id);

      if (itemsError) throw itemsError;

      if (!reqItems || reqItems.length === 0) {
        toast.error('No items found in this requisition');
        return;
      }

      // Fetch active ledgers for auto-selection
      const { data: ledgersData } = await supabase
        .from('ledgers' as any)
        .select('id, name, location_id, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      const ledgers = (ledgersData as any) || [];

      if (ledgers.length === 0) {
        toast.error('Please create a ledger first before converting to PO');
        return;
      }

      // Get next PO number
      const { data: poNumber, error: poNumError } = await supabase.rpc('get_next_po_number', {
        p_company_id: companyId,
      });

      if (poNumError) throw poNumError;

      // Calculate totals - no tax for PR to PO conversion (tax can be added manually later)
      const subtotal = reqItems.reduce((sum, item) => {
        return sum + (item.unit_price || item.product?.price || 0) * item.quantity;
      }, 0);
      const totalAmount = subtotal; // Net value only, no tax

      // Parse vendor_id from requisition (handles 'vendor:uuid' format)
      const parsedVendor = requisition.vendor_id ? parseVendorValue(requisition.vendor_id) : null;
      const poVendorId = parsedVendor?.type === 'vendor' ? parsedVendor.id : null;
      const poSourceLocationId = requisition.source_location_id || (parsedVendor?.type === 'location' ? parsedVendor.id : null);

      // Auto-select ledger: prefer location-specific, then first active
      let selectedLedgerId: string | null = null;
      if (ledgers.length === 1) {
        selectedLedgerId = ledgers[0].id;
      } else if (requisition.location_id) {
        // Find ledger for the requisition location
        const locationLedger = ledgers.find((l: any) => l.location_id === requisition.location_id);
        if (locationLedger) {
          selectedLedgerId = locationLedger.id;
        } else {
          // Find a general ledger (no location) or use first active
          const generalLedger = ledgers.find((l: any) => !l.location_id);
          selectedLedgerId = generalLedger?.id || ledgers[0].id;
        }
      } else {
        // No location, use general ledger or first active
        const generalLedger = ledgers.find((l: any) => !l.location_id);
        selectedLedgerId = generalLedger?.id || ledgers[0].id;
      }

      // Create purchase order
      const { data: newPO, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          company_id: companyId,
          po_number: poNumber,
          status: 'draft',
          vendor_id: poVendorId,
          source_location_id: poSourceLocationId,
          location_id: requisition.location_id,
          bill_to_location_id: requisition.location_id, // Use same location for bill-to
          ledger_id: selectedLedgerId,
          requisition_id: requisition.id,
          subtotal,
          tax_amount: 0,
          total_amount: totalAmount,
          notes: `Converted from requisition ${requisition.requisition_id}`,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create purchase order items
      const poItems = reqItems.map(item => ({
        purchase_order_id: newPO.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price || item.product?.price || 0,
        total_price: (item.unit_price || item.product?.price || 0) * item.quantity,
      }));

      const { error: poItemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);

      if (poItemsError) throw poItemsError;

      // Note: Ledger transaction is created when the Goods Receipt is posted

      // Update requisition status to 'ordered'
      const { error: updateError } = await supabase
        .from('requisitions')
        .update({ status: 'ordered' })
        .eq('id', requisition.id);

      if (updateError) throw updateError;

      toast.success(`Requisition ${requisition.requisition_id} converted to ${poNumber}`);
      fetchRequisitions();
      
      // Fetch the created PO with related data and open view dialog
      const { data: fullPO } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendor:vendors(name),
          location:locations!purchase_orders_location_id_fkey(name),
          bill_to_location:locations!purchase_orders_bill_to_location_id_fkey(name),
          ledger:ledgers(name)
        `)
        .eq('id', newPO.id)
        .single();
      
      if (fullPO) {
        setViewPO(fullPO as PurchaseOrder);
        
        // Fetch the PO items
        const { data: poItemsData } = await supabase
          .from('purchase_order_items')
          .select(`
            *,
            product:products(name, price)
          `)
          .eq('purchase_order_id', newPO.id);
        
        setViewPOItems(poItemsData || []);
        setIsPOViewDialogOpen(true);
      }
    } catch (error: any) {
      console.error('Error converting to PO:', error);
      toast.error(error.message || 'Failed to convert to purchase order');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('requisitions')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    toast.success('Status updated');
    fetchRequisitions();
    
    if (viewRequisition?.id === id) {
      setViewRequisition({ ...viewRequisition, status: newStatus });
    }
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    setSuggestedItems(prev => {
      const newItems = [...prev];
      newItems[index].quantity = quantity;
      return newItems;
    });
  };

  const removeItem = (index: number) => {
    setSuggestedItems(prev => prev.filter((_, i) => i !== index));
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
  const openLocationDetail = async (locationId: string | null, label: string) => {
    if (!locationId) return;
    const { data: location } = await supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .single();
    if (location) {
      setDetailLocation(location as LocationDetail);
      setDetailLocationLabel(label);
      setIsLocationDetailOpen(true);
    }
  };

  // Export requisitions to XLSX
  const handleExport = useCallback(async () => {
    if (requisitions.length === 0) {
      toast.error('No requisitions to export');
      return;
    }

    const exportData = requisitions.map(r => ({
      requisition_id: r.requisition_id,
      status: r.status,
      location_id: r.location?.location_id || '',
      location_name: r.location?.name || '',
      vendor_id: r.vendor?.vendor_id || '',
      vendor_name: r.vendor?.name || 'All Vendors',
      total_amount: r.total_amount ?? '',
      notes: r.notes || '',
      created_at: r.created_at,
    }));

    await exportToExcel(
      exportData,
      `requisitions_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      'Requisitions'
    );
    toast.success(`Exported ${exportData.length} requisitions`);
  }, [requisitions, exportToExcel]);

  // Download import template
  const handleDownloadTemplate = useCallback(async () => {
    const templateData = [{
      requisition_id: 'REQ-001',
      status: 'draft',
      location_id: 'LOC-001',
      vendor_id: 'VEND-001',
      notes: 'Example notes',
    }];

    await exportToExcel(templateData, 'requisitions_import_template.xlsx', 'Requisitions Template');
    toast.success('Template downloaded');
  }, [exportToExcel]);

  // Handle file import
  const handleImport = useCallback(async (file: File) => {
    if (!companyId) return;
    
    try {
      const jsonData = await readExcel(file);

      if (jsonData.length === 0) {
        toast.error('No data found in file');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          let requisitionId = row.requisition_id?.toString() || '';
          
          // Auto-generate requisition_id if not provided
          if (!requisitionId) {
            const { data: nextId, error: idError } = await supabase.rpc('get_next_requisition_id', {
              p_company_id: companyId,
            });
            
            if (idError || !nextId) {
              console.error('Error generating requisition ID:', idError);
              errorCount++;
              continue;
            }
            requisitionId = nextId;
          }

          // Look up location by location_id
          let locationUuid: string | null = null;
          if (row.location_id) {
            const { data: loc } = await supabase
              .from('locations')
              .select('id')
              .eq('location_id', row.location_id.toString())
              .eq('company_id', companyId)
              .single();
            locationUuid = loc?.id || null;
          }

          // Look up vendor by vendor_id
          let vendorUuid: string | null = null;
          if (row.vendor_id) {
            const { data: vend } = await supabase
              .from('vendors')
              .select('id')
              .eq('vendor_id', row.vendor_id.toString())
              .eq('company_id', companyId)
              .single();
            vendorUuid = vend?.id || null;
          }

          const requisitionData = {
            company_id: companyId,
            requisition_id: requisitionId,
            status: row.status?.toString() || 'draft',
            location_id: locationUuid,
            vendor_id: vendorUuid,
            notes: row.notes?.toString() || null,
            total_amount: 0,
          };

          // Check if requisition exists
          const existing = requisitions.find(r => r.requisition_id === requisitionData.requisition_id);
          
          if (existing) {
            await supabase.from('requisitions').update(requisitionData).eq('id', existing.id);
          } else {
            await supabase.from('requisitions').insert(requisitionData);
          }
          successCount++;
        } catch (err) {
          console.error('Error importing row:', err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} requisitions`);
        fetchRequisitions();
      }
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} rows`);
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to import file');
    }
  }, [companyId, requisitions, readExcel, fetchRequisitions]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-7 h-7 text-sky-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Requisitions</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ImportExportButtons
                importEnabled={isImportEnabled('requisition')}
                exportEnabled={isExportEnabled('requisition')}
                entityName="Requisitions"
                onExport={handleExport}
                onImport={handleImport}
                onDownloadTemplate={handleDownloadTemplate}
              />
              {selectedIds.size > 0 && (
                <Button onClick={handleBulkDelete} variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedIds.size})
                </Button>
              )}
              {selectedConvertibleReqs.length > 0 && (
                <Button onClick={handleBulkConvert} variant="secondary">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Convert ({selectedConvertibleReqs.length})
                </Button>
              )}
              <Button onClick={handleRunClick} variant="default">
                <Play className="w-4 h-4 mr-2" />
                Run
                <Kbd>N</Kbd>
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* Main content */}
      <main className="flex-1">
        {requisitions.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No requisitions yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Run" to generate purchase requisitions based on your products
            </p>
            <Button onClick={handleRunClick}>
              <Play className="w-4 h-4 mr-2" />
              Run First Requisition
            </Button>
          </div>
        ) : (
          <RequisitionsTable 
            requisitions={requisitions} 
            onViewRequisition={handleViewRequisition} 
            onConvertToPO={handleConvertToPO}
            onDeleteRequisition={handleDeleteRequisition}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onLocationClick={(locationId) => openLocationDetail(locationId, 'Location')}
            onVendorClick={openVendorDetail}
          />
        )}
      </main>

      {/* Run Dialog */}
      <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Run Purchase Requisition</DialogTitle>
            <DialogDescription>
              Generate a purchase requisition by selecting a destination location and optionally filtering by vendor
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="run_location">Destination Location *</Label>
                <SearchableSelect
                  options={locationOptions}
                  value={runFormData.location_id}
                  onValueChange={(value) => setRunFormData({ ...runFormData, location_id: value })}
                  placeholder="Select location"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="run_vendor">Filter by Vendor (optional)</Label>
                <SearchableSelect
                  options={vendorOptions}
                  value={runFormData.vendor_id}
                  onValueChange={(value) => setRunFormData({ ...runFormData, vendor_id: value })}
                  placeholder="All vendors"
                  allowClear
                  clearLabel="All Vendors"
                />
              </div>
            </div>

            <Button onClick={generateSuggestions} variant="outline" className="w-full">
              Generate Suggested Items
            </Button>

            {suggestedItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-32">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestedItems.map((item, index) => (
                      <TableRow key={item.product.id}>
                        <TableCell>{item.product.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${item.product.price?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${((item.product.price || 0) * item.quantity).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-4 border-t bg-muted/50 flex justify-between">
                  <span className="font-medium">Total:</span>
                  <span className="font-mono font-bold">
                    ${suggestedItems.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={() => setIsRunDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRunRequisition} 
              disabled={isRunning || suggestedItems.length === 0}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Requisition
                  <Kbd className="ml-2">⌘S</Kbd>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Requisition {viewRequisition?.requisition_id}</DialogTitle>
            <DialogDescription>
              View requisition details and update status
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {viewRequisition && (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-1">
                    <History className="w-3.5 h-3.5" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4">
              <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Select
                    value={viewRequisition.status}
                    onValueChange={(value) => handleUpdateStatus(viewRequisition.id, value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Amount</Label>
                  <p className="mt-1 font-mono text-lg">${viewRequisition.total_amount?.toFixed(2) || '0.00'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  {viewRequisition.location ? (
                    <button
                      type="button"
                      onClick={() => openLocationDetail(viewRequisition.location_id, 'Location')}
                      className="mt-1 text-sm text-primary hover:underline font-mono block"
                    >
                      {viewRequisition.location.name}
                    </button>
                  ) : (
                    <p className="mt-1">-</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendor / Source</Label>
                  {viewRequisition.vendor ? (
                    <button
                      type="button"
                      onClick={() => openVendorDetail(viewRequisition.vendor_id)}
                      className="mt-1 text-sm text-primary hover:underline font-mono block"
                    >
                      {viewRequisition.vendor.name}
                    </button>
                  ) : viewRequisition.source_location ? (
                    <p className="mt-1 text-sm">
                      {viewRequisition.source_location.name} <span className="text-muted-foreground">({viewRequisition.source_location.location_id} • Internal)</span>
                    </p>
                  ) : (
                    <p className="mt-1">All Vendors</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Associated PO</Label>
                  {viewLinkedPO ? (
                    <p className="mt-1 text-sm font-mono">{viewLinkedPO.po_number}</p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">-</p>
                  )}
                </div>
              </div>

              {viewRequisition.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1">{viewRequisition.notes}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground mb-2 block">Items</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product?.name || 'Unknown Product'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">
                            ${item.unit_price?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${((item.unit_price || 0) * item.quantity).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <AuditHistoryTab 
                    tableName="requisitions" 
                    recordId={viewRequisition.id}
                    fieldLabels={{
                      status: "Status",
                      vendor_id: "Vendor",
                      location_id: "Location",
                      source_location_id: "Source Location",
                      notes: "Notes",
                      total_amount: "Total Amount",
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* PO View Dialog (shown after converting requisition to PO) */}
      <Dialog open={isPOViewDialogOpen} onOpenChange={setIsPOViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Purchase Order {viewPO?.po_number}</DialogTitle>
            <DialogDescription>
              Purchase order created from requisition
            </DialogDescription>
          </DialogHeader>
          
          {viewPO && (
            <div className="flex-1 overflow-y-auto space-y-4 px-6 pb-6">
              {/* Header Fields */}
              <div className="grid grid-cols-4 gap-4 pb-4 border-b">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge className="bg-slate-500 text-white capitalize">{viewPO.status}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="mt-1 font-medium">{viewPO.vendor?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ship To</Label>
                  <p className="mt-1">{viewPO.location?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bill To</Label>
                  <p className="mt-1">{viewPO.bill_to_location?.name || '-'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <Label className="text-muted-foreground mb-2 block">Items</Label>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewPOItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product?.name || 'Unknown'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">
                            ${Number(item.unit_price || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${Number(item.total_price || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end gap-8 text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono">${Number(viewPO.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-mono">${Number(viewPO.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 text-base font-semibold">
                  <span>Total:</span>
                  <span className="font-mono">${Number(viewPO.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Notes */}
              {viewPO.notes && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm p-3 bg-muted rounded-lg">{viewPO.notes}</p>
                </div>
              )}

              {/* Ledger info */}
              {viewPO.ledger && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Ledger</Label>
                  <p className="text-sm">{viewPO.ledger.name}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={() => setIsPOViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsPOViewDialogOpen(false);
              navigate('/orders');
            }}>
              Go to Purchase Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Conversion Progress Dialog */}
      <Dialog open={isBulkConverting} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Converting Requisitions</DialogTitle>
            <DialogDescription>
              Converting {bulkConvertProgress.total} requisition(s) to Purchase Orders
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 px-6 py-4 pb-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono">{bulkConvertProgress.current} / {bulkConvertProgress.total}</span>
              </div>
              <Progress value={(bulkConvertProgress.current / bulkConvertProgress.total) * 100} className="h-2" />
            </div>
            
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {bulkConvertProgress.currentAction !== 'Completed' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 text-green-500" />
              )}
              <span>{bulkConvertProgress.currentAction}</span>
            </div>

            {bulkConvertResults.success.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Converted</Label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {bulkConvertResults.success.map((item, i) => (
                    <div key={i} className="text-xs font-mono flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Check className="w-3 h-3" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bulkConvertResults.failed.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Failed</Label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {bulkConvertResults.failed.map((item, i) => (
                    <div key={i} className="text-xs font-mono flex items-center gap-2 text-destructive">
                      <X className="w-3 h-3" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
            <div className="space-y-4 px-6">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVendorDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Detail Dialog */}
      <Dialog open={isLocationDetailOpen} onOpenChange={setIsLocationDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailLocationLabel} Details</DialogTitle>
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
                  <p className="capitalize">{detailLocation.type}</p>
                </div>
              </div>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLocationDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Separate table component for sorting/filtering
function RequisitionsTable({
  requisitions,
  onViewRequisition,
  onConvertToPO,
  onDeleteRequisition,
  selectedIds,
  onSelectionChange,
  onLocationClick,
  onVendorClick,
}: {
  requisitions: Requisition[];
  onViewRequisition: (requisition: Requisition) => void;
  onConvertToPO: (requisition: Requisition) => void;
  onDeleteRequisition: (id: string) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onLocationClick: (locationId: string | null) => void;
  onVendorClick: (vendorId: string | null) => void;
}) {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(requisitions, 'requisition_id', 'desc');

  const allVisibleSelected = sortedAndFilteredData.length > 0 && 
    sortedAndFilteredData.every((r) => selectedIds.has(r.id));
  const someVisibleSelected = sortedAndFilteredData.some((r) => selectedIds.has(r.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newIds = new Set(selectedIds);
      sortedAndFilteredData.forEach((r) => newIds.add(r.id));
      onSelectionChange(newIds);
    } else {
      const newIds = new Set(selectedIds);
      sortedAndFilteredData.forEach((r) => newIds.delete(r.id));
      onSelectionChange(newIds);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newIds = new Set(selectedIds);
    if (checked) {
      newIds.add(id);
    } else {
      newIds.delete(id);
    }
    onSelectionChange(newIds);
  };

  const hasFilters = Object.values(filters).some((v) => v);

  return (
    <div className="space-y-4">
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {Object.entries(filters).map(([key, value]) =>
            value ? (
              <Badge key={key} variant="secondary">
                {key}: {value}
              </Badge>
            ) : null
          )}
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear all
          </Button>
        </div>
      )}
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  {...(someVisibleSelected && !allVisibleSelected ? { 'data-state': 'indeterminate' } : {})}
                />
              </TableHead>
              <SortableTableHead
                label="ID"
                sortKey="requisition_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['requisition_id']}
                onFilter={(v) => setFilter('requisition_id', v)}
              />
              <SortableTableHead
                label="Status"
                sortKey="status"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['status']}
                onFilter={(v) => setFilter('status', v)}
              />
              <SortableTableHead
                label="Location"
                sortKey="location.location_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['location.location_id']}
                onFilter={(v) => setFilter('location.location_id', v)}
              />
              <SortableTableHead
                label="Location Name"
                sortKey="location.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['location.name']}
                onFilter={(v) => setFilter('location.name', v)}
              />
              <SortableTableHead
                label="Vendor"
                sortKey="vendor.vendor_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['vendor.vendor_id']}
                onFilter={(v) => setFilter('vendor.vendor_id', v)}
              />
              <SortableTableHead
                label="Vendor Name"
                sortKey="vendor.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['vendor.name']}
                onFilter={(v) => setFilter('vendor.name', v)}
              />
              <SortableTableHead
                label="Total"
                sortKey="total_amount"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                className="text-right"
                filterable={false}
              />
              <SortableTableHead
                label="Created By"
                sortKey="creator.last_name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['creator.last_name']}
                onFilter={(v) => setFilter('creator.last_name', v)}
              />
              <SortableTableHead
                label="Date"
                sortKey="created_at"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
              />
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((req) => (
              <TableRow key={req.id} data-state={selectedIds.has(req.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(req.id)}
                    onCheckedChange={(checked) => handleSelectRow(req.id, !!checked)}
                    aria-label={`Select ${req.requisition_id}`}
                  />
                </TableCell>
                <TableCell className="font-mono">
                  <button
                    onClick={() => onViewRequisition(req)}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    {req.requisition_id}
                  </button>
                </TableCell>
                <TableCell>
                  <Badge className={`${statusColors[req.status]} text-white`}>
                    {req.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {req.location?.location_id ? (
                    <button
                      onClick={() => onLocationClick(req.location_id)}
                      className="text-primary hover:underline font-mono"
                    >
                      {req.location.location_id}
                    </button>
                  ) : '-'}
                </TableCell>
                <TableCell>{req.location?.name || '-'}</TableCell>
                <TableCell>
                  {req.vendor?.vendor_id ? (
                    <button
                      onClick={() => onVendorClick(req.vendor_id)}
                      className="text-primary hover:underline font-mono"
                    >
                      {req.vendor.vendor_id}
                    </button>
                  ) : req.source_location?.location_id ? (
                    <span className="font-mono text-muted-foreground">{req.source_location.location_id}</span>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {req.vendor?.name || (req.source_location?.name ? `${req.source_location.name} (Internal)` : 'All Vendors')}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${req.total_amount?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell>
                  {req.creator ? `${req.creator.first_name || ''} ${req.creator.last_name || ''}`.trim() || '-' : '-'}
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(req.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(req.created_at).toLocaleTimeString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewRequisition(req)}
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
                        <DropdownMenuItem
                          onClick={() => onConvertToPO(req)}
                          disabled={req.status === 'ordered' || req.status === 'completed'}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Convert to PO
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteRequisition(req.id)}
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default Requisitions;
