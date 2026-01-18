import { useEffect, useState, useRef, useMemo } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useVendorSources } from '@/hooks/use-vendor-sources';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { ArrowLeft, ShoppingCart, Plus, Eye, Loader2, MoreHorizontal, Trash2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
}

interface SelectedTaxRate {
  tax_rate_id: string;
  name: string;
  rate: number;
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
  tax_rate_id: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  created_at: string;
  vendor?: { name: string } | null;
  location?: { name: string } | null;
  bill_to_location?: { name: string } | null;
  ledger?: { name: string } | null;
  requisition?: { requisition_id: string } | null;
  tax_rate?: { name: string; rate: number } | null;
  applied_tax_rates?: { tax_rate_id: string; tax_amount: number; tax_rate: { name: string; rate: number } }[];
}

interface PurchaseOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
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

interface Ledger {
  id: string;
  name: string;
  location_id: string | null;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  product_id: string;
  price: number | null;
  vendor_id: string | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500',
  pending: 'bg-yellow-500',
  sent: 'bg-blue-500',
  confirmed: 'bg-indigo-500',
  shipped: 'bg-purple-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const Orders = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Use vendor sources hook for combined vendors + DC/warehouse locations
  const { vendorOptions, plainVendorOptions, parseVendorValue, getVendorDisplayName } = useVendorSources(companyId);
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set transaction based on dialog state
  useEffect(() => {
    if (isCreateDialogOpen) {
      setTransaction('ord/new');
    } else if (isViewDialogOpen) {
      setTransaction('ord/view');
    } else {
      setTransaction('ord');
    }
  }, [isCreateDialogOpen, isViewDialogOpen, setTransaction]);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isCreateDialogOpen && !isSubmitting) {
      handleCreateOrder();
    }
  }, isCreateDialogOpen);
  
  // View dialog state
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [viewItems, setViewItems] = useState<PurchaseOrderItem[]>([]);
  
  // Create dialog form state
  const [formData, setFormData] = useState({
    vendor_id: '',
    location_id: '',
    bill_to_location_id: '',
    notes: '',
  });
  const [orderItems, setOrderItems] = useState<{ product_id: string; quantity: number; unit_price: number }[]>([]);
  const [selectedTaxRates, setSelectedTaxRates] = useState<SelectedTaxRate[]>([]);
  const [viewTaxRates, setViewTaxRates] = useState<{ tax_rate_id: string; tax_amount: number; tax_rate: { name: string; rate: number } }[]>([]);
  const [isEditingTaxRates, setIsEditingTaxRates] = useState(false);
  const [editTaxRates, setEditTaxRates] = useState<SelectedTaxRate[]>([]);

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
      fetchOrders();
      fetchLocations();
      fetchProducts();
      fetchTaxRates();
      fetchLedgers();
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

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        vendor:vendors(name),
        location:locations!purchase_orders_location_id_fkey(name),
        bill_to_location:locations!purchase_orders_bill_to_location_id_fkey(name),
        ledger:ledgers(name),
        requisition:requisitions(requisition_id),
        tax_rate:tax_rates(name, rate)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load purchase orders');
      return;
    }

    setOrders(data || []);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, location_id')
      .eq('company_id', companyId)
      .order('name');
    setLocations(data || []);
  };

  // Create location options for SearchableSelect
  const locationOptions: SearchableSelectOption[] = useMemo(() => {
    return locations.map((loc) => ({
      value: loc.id,
      label: loc.name,
      sublabel: loc.location_id,
    }));
  }, [locations]);

  // Create product options for SearchableSelect
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return products.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `$${p.price?.toFixed(2) || '0.00'}`,
    }));
  }, [products]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, product_id, price, vendor_id')
      .eq('company_id', companyId)
      .order('name');
    setProducts(data || []);
  };

  const fetchTaxRates = async () => {
    const { data } = await supabase
      .from('tax_rates')
      .select('id, name, rate, is_default')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setTaxRates(data || []);
    
    // Set default tax rate in selected rates
    const defaultRate = data?.find(r => r.is_default);
    if (defaultRate) {
      setSelectedTaxRates([{ tax_rate_id: defaultRate.id, name: defaultRate.name, rate: defaultRate.rate }]);
    }
  };

  const fetchLedgers = async () => {
    const { data } = await supabase
      .from('ledgers' as any)
      .select('id, name, location_id, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setLedgers((data as any) || []);
  };

  const handleCreateClick = () => {
    const defaultRate = taxRates.find(r => r.is_default);
    setFormData({ vendor_id: '', location_id: '', bill_to_location_id: '', notes: '' });
    setOrderItems([]);
    setSelectedTaxRates(defaultRate ? [{ tax_rate_id: defaultRate.id, name: defaultRate.name, rate: defaultRate.rate }] : []);
    setIsCreateDialogOpen(true);
  };

  // Keyboard shortcut for creating new PO
  useKeyboardShortcut('n', handleCreateClick);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const updateOrderItem = (index: number, field: string, value: string | number) => {
    const newItems = [...orderItems];
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      newItems[index] = {
        ...newItems[index],
        product_id: value as string,
        unit_price: product?.price || 0,
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setOrderItems(newItems);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const calculateTotalTaxRate = () => {
    return selectedTaxRates.reduce((sum, r) => sum + r.rate, 0);
  };

  const calculateTax = () => {
    return calculateTotal() * (calculateTotalTaxRate() / 100);
  };

  const calculateGrandTotal = () => {
    return calculateTotal() + calculateTax();
  };

  const addTaxRate = (taxRateId: string) => {
    const rate = taxRates.find(r => r.id === taxRateId);
    if (rate && !selectedTaxRates.find(sr => sr.tax_rate_id === taxRateId)) {
      setSelectedTaxRates([...selectedTaxRates, { tax_rate_id: rate.id, name: rate.name, rate: rate.rate }]);
    }
  };

  const removeTaxRate = (taxRateId: string) => {
    setSelectedTaxRates(selectedTaxRates.filter(r => r.tax_rate_id !== taxRateId));
  };

  const availableTaxRates = taxRates.filter(r => !selectedTaxRates.find(sr => sr.tax_rate_id === r.id));

  const handleCreateOrder = async () => {
    if (!formData.vendor_id) {
      toast.error('Please select a vendor');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (orderItems.some(item => !item.product_id)) {
      toast.error('Please select a product for all items');
      return;
    }

    // Check if ledgers exist
    if (ledgers.length === 0) {
      toast.error('Please create a ledger first before creating purchase orders');
      return;
    }

    // Determine which ledger to use
    let selectedLedgerId: string | null = null;
    
    if (ledgers.length === 1) {
      // If only one ledger, use it automatically
      selectedLedgerId = ledgers[0].id;
    } else if (formData.bill_to_location_id) {
      // Find ledger for the bill-to location
      const locationLedger = ledgers.find(l => l.location_id === formData.bill_to_location_id);
      if (locationLedger) {
        selectedLedgerId = locationLedger.id;
      } else {
        // Find a general ledger (no location)
        const generalLedger = ledgers.find(l => !l.location_id);
        if (generalLedger) {
          selectedLedgerId = generalLedger.id;
        } else {
          toast.error('No ledger found for the selected bill-to location. Please create a ledger for this location or select a different location.');
          return;
        }
      }
    } else {
      // No bill-to location, use general ledger
      const generalLedger = ledgers.find(l => !l.location_id);
      if (generalLedger) {
        selectedLedgerId = generalLedger.id;
      } else {
        selectedLedgerId = ledgers[0].id; // Fall back to first ledger
      }
    }

    setIsSubmitting(true);

    try {
      // Get next PO number
      const { data: poNumber } = await supabase.rpc('get_next_po_number', {
        p_company_id: companyId,
      });

      const subtotal = calculateTotal();
      const taxAmount = calculateTax();
      const totalAmount = calculateGrandTotal();

      // Create purchase order
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          company_id: companyId,
          po_number: poNumber,
          status: 'draft',
          vendor_id: formData.vendor_id || null,
          location_id: formData.location_id || null,
          bill_to_location_id: formData.bill_to_location_id || null,
          ledger_id: selectedLedgerId,
          tax_rate_id: selectedTaxRates.length === 1 ? selectedTaxRates[0].tax_rate_id : null,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create purchase order tax rates
      if (selectedTaxRates.length > 0) {
        const taxRatesToInsert = selectedTaxRates.map(sr => ({
          purchase_order_id: order.id,
          tax_rate_id: sr.tax_rate_id,
          tax_amount: subtotal * (sr.rate / 100),
        }));

        const { error: taxError } = await supabase
          .from('purchase_order_tax_rates')
          .insert(taxRatesToInsert);

        if (taxError) throw taxError;
      }

      // Create ledger transaction (negative amount for purchase)
      if (selectedLedgerId) {
        const { error: txError } = await supabase
          .from('ledger_transactions' as any)
          .insert({
            ledger_id: selectedLedgerId,
            transaction_type: 'purchase_order',
            reference_id: order.id,
            reference_number: poNumber,
            amount: -totalAmount, // Negative for purchases
            description: `Purchase Order ${poNumber}`,
          });

        if (txError) {
          console.error('Error creating ledger transaction:', txError);
          // Don't throw, the PO was created successfully
        }
      }

      // Create order items
      const itemsToInsert = orderItems.map(item => ({
        purchase_order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(`Purchase Order ${poNumber} created`);
      setIsCreateDialogOpen(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Failed to create purchase order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewOrder = async (order: PurchaseOrder) => {
    setViewOrder(order);
    
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select(`
        *,
        product:products(name, price)
      `)
      .eq('purchase_order_id', order.id);

    setViewItems(items || []);

    // Fetch applied tax rates
    const { data: appliedTaxRates } = await supabase
      .from('purchase_order_tax_rates')
      .select(`
        tax_rate_id,
        tax_amount,
        tax_rate:tax_rates(name, rate)
      `)
      .eq('purchase_order_id', order.id);

    setViewTaxRates((appliedTaxRates as any) || []);
    setIsEditingTaxRates(false);
    setIsViewDialogOpen(true);
  };

  const handleEditTaxRates = () => {
    setEditTaxRates(viewTaxRates.map(vt => ({
      tax_rate_id: vt.tax_rate_id,
      name: vt.tax_rate.name,
      rate: vt.tax_rate.rate,
    })));
    setIsEditingTaxRates(true);
  };

  const addEditTaxRate = (taxRateId: string) => {
    const rate = taxRates.find(r => r.id === taxRateId);
    if (rate && !editTaxRates.find(er => er.tax_rate_id === taxRateId)) {
      setEditTaxRates([...editTaxRates, { tax_rate_id: rate.id, name: rate.name, rate: rate.rate }]);
    }
  };

  const removeEditTaxRate = (taxRateId: string) => {
    setEditTaxRates(editTaxRates.filter(r => r.tax_rate_id !== taxRateId));
  };

  const availableEditTaxRates = taxRates.filter(r => !editTaxRates.find(er => er.tax_rate_id === r.id));

  const handleSaveTaxRates = async () => {
    if (!viewOrder) return;
    setIsSubmitting(true);

    try {
      // Delete existing tax rates
      await supabase
        .from('purchase_order_tax_rates')
        .delete()
        .eq('purchase_order_id', viewOrder.id);

      // Calculate new totals
      const subtotal = viewOrder.subtotal || 0;
      const totalTaxRate = editTaxRates.reduce((sum, r) => sum + r.rate, 0);
      const taxAmount = subtotal * (totalTaxRate / 100);
      const totalAmount = subtotal + taxAmount;

      // Insert new tax rates
      if (editTaxRates.length > 0) {
        const taxRatesToInsert = editTaxRates.map(er => ({
          purchase_order_id: viewOrder.id,
          tax_rate_id: er.tax_rate_id,
          tax_amount: subtotal * (er.rate / 100),
        }));

        await supabase
          .from('purchase_order_tax_rates')
          .insert(taxRatesToInsert);
      }

      // Update PO totals
      await supabase
        .from('purchase_orders')
        .update({
          tax_rate_id: editTaxRates.length === 1 ? editTaxRates[0].tax_rate_id : null,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .eq('id', viewOrder.id);

      // Refresh view
      setViewTaxRates(editTaxRates.map(er => ({
        tax_rate_id: er.tax_rate_id,
        tax_amount: subtotal * (er.rate / 100),
        tax_rate: { name: er.name, rate: er.rate },
      })));
      setViewOrder({ ...viewOrder, tax_amount: taxAmount, total_amount: totalAmount });
      setIsEditingTaxRates(false);
      toast.success('Tax rates updated');
      fetchOrders();
    } catch (error: any) {
      toast.error('Failed to update tax rates');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      // Get the order to check current status and get details
      const order = orders.find(o => o.id === id);
      if (!order) return;

      // Fetch automation settings
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', companyId)
        .eq('setting_key', 'po_automation')
        .maybeSingle();

      const settings = settingsData?.setting_value && typeof settingsData.setting_value === 'object' && !Array.isArray(settingsData.setting_value)
        ? settingsData.setting_value as Record<string, unknown>
        : null;

      const autoCreateDelivery = settings?.auto_create_delivery_on_confirmed ?? true;
      const autoMarkShipped = settings?.auto_mark_delivery_shipped ?? true;
      const autoMarkDelivered = settings?.auto_mark_delivery_delivered ?? true;

      // Update the PO status
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        toast.error('Failed to update status');
        return;
      }

      // Auto-create delivery when status changes to 'confirmed'
      if (newStatus === 'confirmed' && autoCreateDelivery) {
        // Get next delivery ID
        const { data: deliveryId } = await supabase.rpc('get_next_delivery_id', {
          p_company_id: companyId,
        });

        // Create delivery
        await supabase
          .from('deliveries')
          .insert({
            company_id: companyId,
            delivery_id: deliveryId,
            purchase_order_id: id,
            vendor_id: order.vendor_id,
            location_id: order.location_id,
            status: 'pending',
            expected_date: order.expected_delivery_date,
            notes: `Auto-created from PO ${order.po_number}`,
          });

        toast.success(`Delivery ${deliveryId} created automatically`);
      }

      // Auto-mark delivery as shipped when PO is marked shipped
      if (newStatus === 'shipped' && autoMarkShipped) {
        await supabase
          .from('deliveries')
          .update({ status: 'shipped' })
          .eq('purchase_order_id', id);
      }

      // Auto-mark delivery as delivered when PO is marked delivered
      if (newStatus === 'delivered' && autoMarkDelivered) {
        await supabase
          .from('deliveries')
          .update({ 
            status: 'delivered',
            delivered_date: new Date().toISOString().split('T')[0]
          })
          .eq('purchase_order_id', id);
      }

      toast.success('Status updated');
      fetchOrders();
      
      if (viewOrder?.id === id) {
        setViewOrder({ ...viewOrder, status: newStatus });
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete purchase order');
      return;
    }

    toast.success('Purchase order deleted');
    fetchOrders();
  };

  // Filter products by selected vendor (handle new vendor:id format)
  const filteredProducts = useMemo(() => {
    if (!formData.vendor_id) return products;
    const parsed = parseVendorValue(formData.vendor_id);
    if (parsed?.type === 'vendor') {
      return products.filter(p => p.vendor_id === parsed.id);
    }
    // For location-based vendors (DC/warehouse), show all products
    return products;
  }, [formData.vendor_id, products, parseVendorValue]);

  // Create filtered product options for SearchableSelect
  const filteredProductOptions: SearchableSelectOption[] = useMemo(() => {
    return filteredProducts.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `$${p.price?.toFixed(2) || '0.00'}`,
    }));
  }, [filteredProducts]);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-display font-bold text-foreground">Purchase Orders</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCreateClick} variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Create PO
                <Kbd>N</Kbd>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No purchase orders yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first purchase order to send to vendors
            </p>
            <Button onClick={handleCreateClick}>
              <Plus className="w-4 h-4 mr-2" />
              Create Purchase Order
            </Button>
          </div>
        ) : (
          <OrdersTable 
            orders={orders} 
            onViewOrder={handleViewOrder} 
            onDeleteOrder={handleDeleteOrder} 
          />
        )}
      </main>

      {/* Create PO Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Create a new purchase order to send to a vendor
            </DialogDescription>
          </DialogHeader>
          
          {/* Header Fields */}
          <div className="grid grid-cols-3 gap-4 pb-4 border-b">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor / Source *</Label>
              <SearchableSelect
                options={vendorOptions}
                value={formData.vendor_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, vendor_id: value });
                  setOrderItems([]);
                }}
                placeholder="Select vendor or source"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Ship To</Label>
              <SearchableSelect
                options={locationOptions}
                value={formData.location_id}
                onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                placeholder="Select location"
                allowClear
                clearLabel="No location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill_to_location">Bill To</Label>
              <SearchableSelect
                options={locationOptions}
                value={formData.bill_to_location_id}
                onValueChange={(value) => setFormData({ ...formData, bill_to_location_id: value })}
                placeholder="Select location"
                allowClear
                clearLabel="No location (general ledger)"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="items" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="rates">Rates</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Order Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              {orderItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No items added yet. Click "Add Item" to start.
                </p>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <SearchableSelect
                          options={filteredProductOptions}
                          value={item.product_id}
                          onValueChange={(value) => updateOrderItem(index, 'product_id', value)}
                          placeholder="Select product"
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          placeholder="Qty"
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateOrderItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          placeholder="Price"
                        />
                      </div>
                      <div className="w-24 text-right font-mono text-sm py-2">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOrderItem(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end gap-8 text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono">${calculateTotal().toFixed(2)}</span>
                </div>
                {selectedTaxRates.map((sr) => (
                  <div key={sr.tax_rate_id} className="flex justify-end gap-8 text-sm">
                    <span className="text-muted-foreground">{sr.name} ({sr.rate}%):</span>
                    <span className="font-mono">${(calculateTotal() * sr.rate / 100).toFixed(2)}</span>
                  </div>
                ))}
                {selectedTaxRates.length === 0 && (
                  <div className="flex justify-end gap-8 text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="font-mono">$0.00</span>
                  </div>
                )}
                <div className="flex justify-end gap-8 text-base font-semibold">
                  <span>Total:</span>
                  <span className="font-mono">${calculateGrandTotal().toFixed(2)}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rates" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Tax Rates</Label>
                {availableTaxRates.length > 0 && (
                  <Select onValueChange={addTaxRate}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Add tax rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTaxRates.map((rate) => (
                        <SelectItem key={rate.id} value={rate.id}>
                          {rate.name} ({rate.rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {selectedTaxRates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No tax rates applied
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedTaxRates.map((sr) => (
                    <Badge key={sr.tax_rate_id} variant="secondary" className="flex items-center gap-1 py-1">
                      {sr.name} ({sr.rate}%)
                      <button
                        type="button"
                        onClick={() => removeTaxRate(sr.tax_rate_id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Combined tax rate: {calculateTotalTaxRate().toFixed(2)}%
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Order Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes or special instructions for this order..."
                  rows={6}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Order
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Order {viewOrder?.po_number}</DialogTitle>
            <DialogDescription>
              View order details and update status
            </DialogDescription>
          </DialogHeader>
          
          {viewOrder && (
            <div className="space-y-4">
              {/* Header Fields */}
              <div className="grid grid-cols-4 gap-4 pb-4 border-b">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Select
                      value={viewOrder.status}
                      onValueChange={(value) => handleUpdateStatus(viewOrder.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="mt-1 font-medium">{viewOrder.vendor?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ship To</Label>
                  <p className="mt-1">{viewOrder.location?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bill To</Label>
                  <p className="mt-1">{viewOrder.bill_to_location?.name || '-'}</p>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="items">Items</TabsTrigger>
                  <TabsTrigger value="rates">Rates</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="space-y-4 mt-4">
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
                        {viewItems.map((item) => (
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

                  {/* Totals */}
                  <div className="border-t pt-4">
                    <div className="flex justify-end gap-8 text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono">${Number(viewOrder.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {viewTaxRates.map((vt) => (
                      <div key={vt.tax_rate_id} className="flex justify-end gap-8 text-sm">
                        <span className="text-muted-foreground">{vt.tax_rate.name} ({vt.tax_rate.rate}%):</span>
                        <span className="font-mono">${Number(vt.tax_amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {viewTaxRates.length === 0 && (
                      <div className="flex justify-end gap-8 text-sm">
                        <span className="text-muted-foreground">Tax:</span>
                        <span className="font-mono">$0.00</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-8 text-base font-semibold">
                      <span>Total:</span>
                      <span className="font-mono">${Number(viewOrder.total_amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rates" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label>Tax Rates</Label>
                    {!isEditingTaxRates && (
                      <Button variant="ghost" size="sm" onClick={handleEditTaxRates}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {isEditingTaxRates ? (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Edit Tax Rates</span>
                        {availableEditTaxRates.length > 0 && (
                          <Select onValueChange={addEditTaxRate}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Add tax rate" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableEditTaxRates.map((rate) => (
                                <SelectItem key={rate.id} value={rate.id}>
                                  {rate.name} ({rate.rate}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      {editTaxRates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tax rates</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {editTaxRates.map((er) => (
                            <Badge key={er.tax_rate_id} variant="secondary" className="flex items-center gap-1 py-1">
                              {er.name} ({er.rate}%)
                              <button
                                type="button"
                                onClick={() => removeEditTaxRate(er.tax_rate_id)}
                                className="ml-1 hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingTaxRates(false)}>
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveTaxRates} disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    viewTaxRates.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {viewTaxRates.map((vt) => (
                          <Badge key={vt.tax_rate_id} variant="outline">
                            {vt.tax_rate.name} ({vt.tax_rate.rate}%)
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                        No tax rates applied
                      </p>
                    )
                  )}
                </TabsContent>

                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Order Notes</Label>
                    {viewOrder.notes ? (
                      <p className="text-sm p-3 bg-muted rounded-lg">{viewOrder.notes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                        No notes for this order
                      </p>
                    )}
                  </div>
                  {viewOrder.requisition && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">From Requisition</Label>
                      <p className="text-sm">{viewOrder.requisition.requisition_id}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Order Date</Label>
                    <p className="text-sm">{new Date(viewOrder.order_date).toLocaleDateString()}</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Separate table component for sorting/filtering
function OrdersTable({
  orders,
  onViewOrder,
  onDeleteOrder,
}: {
  orders: PurchaseOrder[];
  onViewOrder: (order: PurchaseOrder) => void;
  onDeleteOrder: (id: string) => void;
}) {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(orders, 'po_number', 'desc');

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
              <SortableTableHead
                label="PO #"
                sortKey="po_number"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['po_number']}
                onFilter={(v) => setFilter('po_number', v)}
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
                label="Vendor"
                sortKey="vendor.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['vendor.name']}
                onFilter={(v) => setFilter('vendor.name', v)}
              />
              <SortableTableHead
                label="Location"
                sortKey="location.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['location.name']}
                onFilter={(v) => setFilter('location.name', v)}
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
                label="Order Date"
                sortKey="order_date"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
              />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono">{order.po_number}</TableCell>
                <TableCell>
                  <Badge className={`${statusColors[order.status]} text-white`}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>{order.vendor?.name || '-'}</TableCell>
                <TableCell>{order.location?.name || '-'}</TableCell>
                <TableCell className="text-right font-mono">
                  ${Number(order.total_amount || 0).toFixed(2)}
                </TableCell>
                <TableCell>
                  {new Date(order.order_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewOrder(order)}
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
                          onClick={() => onDeleteOrder(order.id)}
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

export default Orders;