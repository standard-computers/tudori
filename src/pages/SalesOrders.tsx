import { useEffect, useState, useMemo } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useVendorSources } from '@/hooks/use-vendor-sources';
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
import { ArrowLeft, DollarSign, Plus, Eye, Loader2, MoreHorizontal, Trash2, Pencil, Check, X, BookOpen } from 'lucide-react';
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

interface SalesOrder {
  id: string;
  so_number: string;
  status: string;
  customer_id: string | null;
  location_id: string | null;
  bill_to_location_id: string | null;
  ledger_id: string | null;
  tax_rate_id: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  created_at: string;
  customer?: { name: string } | null;
  location?: { name: string } | null;
  bill_to_location?: { name: string } | null;
  ledger?: { name: string } | null;
  tax_rate?: { name: string; rate: number } | null;
  applied_tax_rates?: { tax_rate_id: string; tax_amount: number; tax_rate: { name: string; rate: number } }[];
}

interface SalesOrderItem {
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

interface Customer {
  id: string;
  name: string;
  customer_id: string;
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
}

interface InventoryRecord {
  id: string;
  product_id: string;
  quantity: number;
  bin_id: string | null;
  product?: { name: string; product_id: string };
  bin?: { name: string; bin_id: string } | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500',
  pending: 'bg-yellow-500',
  confirmed: 'bg-indigo-500',
  processing: 'bg-blue-500',
  shipped: 'bg-purple-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const SalesOrders = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Use vendor sources hook for ship from options (vendors + all locations)
  const { vendorOptions: shipFromOptions, parseVendorValue } = useVendorSources(companyId, { includeAllLocations: true });
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set transaction based on dialog state
  useEffect(() => {
    if (isCreateDialogOpen) {
      setTransaction('so/new');
    } else if (isViewDialogOpen) {
      setTransaction('so/view');
    } else {
      setTransaction('so');
    }
  }, [isCreateDialogOpen, isViewDialogOpen, setTransaction]);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isCreateDialogOpen && !isSubmitting) {
      handleCreateOrder();
    }
  }, isCreateDialogOpen);
  
  // View dialog state
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [viewItems, setViewItems] = useState<SalesOrderItem[]>([]);
  
  // Create dialog form state
  const [formData, setFormData] = useState({
    customer_id: '',
    location_id: '',
    bill_to_location_id: '',
    ledger_id: '',
    notes: '',
  });
  const [orderItems, setOrderItems] = useState<{ product_id: string; quantity: number; unit_price: number }[]>([]);
  const [selectedTaxRates, setSelectedTaxRates] = useState<SelectedTaxRate[]>([]);
  const [viewTaxRates, setViewTaxRates] = useState<{ tax_rate_id: string; tax_amount: number; tax_rate: { name: string; rate: number } }[]>([]);
  const [isEditingTaxRates, setIsEditingTaxRates] = useState(false);
  const [editTaxRates, setEditTaxRates] = useState<SelectedTaxRate[]>([]);
  const [locationInventory, setLocationInventory] = useState<InventoryRecord[]>([]);

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
      fetchCustomers();
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
      .from('sales_orders' as any)
      .select(`
        *,
        customer:customers(name),
        location:locations!sales_orders_location_id_fkey(name),
        bill_to_location:locations!sales_orders_bill_to_location_id_fkey(name),
        ledger:ledgers(name),
        tax_rate:tax_rates(name, rate)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load sales orders');
      return;
    }

    setOrders((data as any) || []);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, location_id')
      .eq('company_id', companyId)
      .order('name');
    setLocations(data || []);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, customer_id')
      .eq('company_id', companyId)
      .order('name');
    setCustomers(data || []);
  };

  // Create customer options for SearchableSelect
  const customerOptions: SearchableSelectOption[] = useMemo(() => {
    return customers.map((cust) => ({
      value: cust.id,
      label: cust.name,
      sublabel: cust.customer_id,
    }));
  }, [customers]);

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
      .select('id, name, product_id, price')
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

  // Fetch inventory for selected ship from location
  const fetchLocationInventory = async (locationId: string) => {
    const { data } = await supabase
      .from('inventory')
      .select(`
        id,
        product_id,
        quantity,
        bin_id,
        product:products(name, product_id),
        bin:bins(name, bin_id)
      `)
      .eq('location_id', locationId)
      .gt('quantity', 0)
      .order('product_id');
    setLocationInventory((data as any) || []);
  };

  // Effect to fetch inventory when ship from location changes
  useEffect(() => {
    if (isCreateDialogOpen && formData.location_id) {
      const parsed = parseVendorValue(formData.location_id);
      if (parsed?.type === 'location') {
        fetchLocationInventory(parsed.id);
      } else {
        setLocationInventory([]);
      }
    } else {
      setLocationInventory([]);
    }
  }, [isCreateDialogOpen, formData.location_id, parseVendorValue]);

  // Calculate availability for order items
  const itemAvailability = useMemo(() => {
    const availability: Record<string, { available: number; required: number; sufficient: boolean }> = {};
    
    // Aggregate inventory by product
    const inventoryByProduct: Record<string, number> = {};
    locationInventory.forEach(inv => {
      inventoryByProduct[inv.product_id] = (inventoryByProduct[inv.product_id] || 0) + inv.quantity;
    });
    
    // Check each order item
    orderItems.forEach(item => {
      if (item.product_id) {
        const available = inventoryByProduct[item.product_id] || 0;
        const existingRequired = availability[item.product_id]?.required || 0;
        availability[item.product_id] = {
          available,
          required: existingRequired + item.quantity,
          sufficient: available >= (existingRequired + item.quantity),
        };
      }
    });
    
    return availability;
  }, [locationInventory, orderItems]);

  // Check if any order item has stock issues
  const hasStockIssue = useMemo(() => {
    return Object.values(itemAvailability).some(a => !a.sufficient);
  }, [itemAvailability]);

  const handleCreateClick = () => {
    const defaultRate = taxRates.find(r => r.is_default);
    setFormData({ customer_id: '', location_id: '', bill_to_location_id: '', ledger_id: '', notes: '' });
    setOrderItems([]);
    setSelectedTaxRates(defaultRate ? [{ tax_rate_id: defaultRate.id, name: defaultRate.name, rate: defaultRate.rate }] : []);
    setIsCreateDialogOpen(true);
  };

  // Keyboard shortcut for creating new SO
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
    if (!formData.customer_id) {
      toast.error('Please select a customer');
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
      toast.error('Please create a ledger first before creating sales orders');
      return;
    }

    // Determine which ledger to use - prioritize explicit selection
    let selectedLedgerId: string | null = formData.ledger_id || null;
    
    if (!selectedLedgerId) {
      if (ledgers.length === 1) {
        selectedLedgerId = ledgers[0].id;
      } else if (formData.bill_to_location_id) {
        const locationLedger = ledgers.find(l => l.location_id === formData.bill_to_location_id);
        if (locationLedger) {
          selectedLedgerId = locationLedger.id;
        } else {
          const generalLedger = ledgers.find(l => !l.location_id);
          if (generalLedger) {
            selectedLedgerId = generalLedger.id;
          } else {
            toast.error('No ledger found for the selected bill-to location.');
            return;
          }
        }
      } else {
        const generalLedger = ledgers.find(l => !l.location_id);
        if (generalLedger) {
          selectedLedgerId = generalLedger.id;
        } else {
          selectedLedgerId = ledgers[0].id;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // Get next SO number
      const { data: soNumber } = await supabase.rpc('get_next_so_number', {
        p_company_id: companyId,
      });

      const subtotal = calculateTotal();
      const taxAmount = calculateTax();
      const totalAmount = calculateGrandTotal();

      // Parse ship from value to extract actual ID
      const shipFromParsed = formData.location_id ? parseVendorValue(formData.location_id) : null;
      const shipFromLocationId = shipFromParsed?.type === 'location' ? shipFromParsed.id : null;
      const shipFromVendorId = shipFromParsed?.type === 'vendor' ? shipFromParsed.id : null;

      // Create sales order
      const { data: order, error: orderError } = await supabase
        .from('sales_orders' as any)
        .insert({
          company_id: companyId,
          so_number: soNumber,
          status: 'draft',
          customer_id: formData.customer_id || null,
          location_id: shipFromLocationId,
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

      // Create sales order tax rates
      if (selectedTaxRates.length > 0) {
        const taxRatesToInsert = selectedTaxRates.map(sr => ({
          sales_order_id: (order as any).id,
          tax_rate_id: sr.tax_rate_id,
          tax_amount: subtotal * (sr.rate / 100),
        }));

        const { error: taxError } = await supabase
          .from('sales_order_tax_rates' as any)
          .insert(taxRatesToInsert);

        if (taxError) throw taxError;
      }

      // Create ledger transaction (positive amount for sales)
      if (selectedLedgerId) {
        const { error: txError } = await supabase
          .from('ledger_transactions' as any)
          .insert({
            ledger_id: selectedLedgerId,
            transaction_type: 'sales_order',
            reference_id: (order as any).id,
            reference_number: soNumber,
            amount: totalAmount, // Positive for sales
            description: `Sales Order ${soNumber}`,
          });

        if (txError) {
          console.error('Error creating ledger transaction:', txError);
        }
      }

      // Create order items
      const itemsToInsert = orderItems.map(item => ({
        sales_order_id: (order as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items' as any)
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(`Sales Order ${soNumber} created`);
      setIsCreateDialogOpen(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Failed to create sales order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewOrder = async (order: SalesOrder) => {
    setViewOrder(order);
    
    const { data: items } = await supabase
      .from('sales_order_items' as any)
      .select(`
        *,
        product:products(name, price)
      `)
      .eq('sales_order_id', order.id);

    setViewItems((items as any) || []);

    // Fetch applied tax rates
    const { data: appliedTaxRates } = await supabase
      .from('sales_order_tax_rates' as any)
      .select(`
        tax_rate_id,
        tax_amount,
        tax_rate:tax_rates(name, rate)
      `)
      .eq('sales_order_id', order.id);

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
        .from('sales_order_tax_rates' as any)
        .delete()
        .eq('sales_order_id', viewOrder.id);

      // Calculate new totals
      const subtotal = viewOrder.subtotal || 0;
      const totalTaxRate = editTaxRates.reduce((sum, r) => sum + r.rate, 0);
      const taxAmount = subtotal * (totalTaxRate / 100);
      const totalAmount = subtotal + taxAmount;

      // Insert new tax rates
      if (editTaxRates.length > 0) {
        const taxRatesToInsert = editTaxRates.map(er => ({
          sales_order_id: viewOrder.id,
          tax_rate_id: er.tax_rate_id,
          tax_amount: subtotal * (er.rate / 100),
        }));

        await supabase
          .from('sales_order_tax_rates' as any)
          .insert(taxRatesToInsert);
      }

      // Update SO totals
      await supabase
        .from('sales_orders' as any)
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
      const { error } = await supabase
        .from('sales_orders' as any)
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        toast.error('Failed to update status');
        return;
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
    if (!confirm('Are you sure you want to delete this sales order?')) return;

    const { error } = await supabase
      .from('sales_orders' as any)
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete sales order');
      return;
    }

    toast.success('Sales order deleted');
    fetchOrders();
  };

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
                <DollarSign className="w-7 h-7 text-emerald-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Sales Orders</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCreateClick} variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Create SO
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
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No sales orders yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first sales order to track customer orders
            </p>
            <Button onClick={handleCreateClick}>
              <Plus className="w-4 h-4 mr-2" />
              Create Sales Order
            </Button>
          </div>
        ) : (
          <SalesOrdersTable 
            orders={orders} 
            onViewOrder={handleViewOrder} 
            onDeleteOrder={handleDeleteOrder} 
          />
        )}
      </main>

      {/* Create SO Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Sales Order</DialogTitle>
            <DialogDescription>
              Create a new sales order for a customer
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pb-6">
          {/* Header Fields */}
          <div className="grid grid-cols-3 gap-4 pb-4 border-b px-6">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <SearchableSelect
                options={customerOptions}
                value={formData.customer_id}
                onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                placeholder="Select customer"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Ship From</Label>
              <SearchableSelect
                options={shipFromOptions}
                value={formData.location_id}
                onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                placeholder="Select source"
                allowClear
                clearLabel="No source"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill_to_location">Bill From</Label>
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
          <Tabs defaultValue="items" className="w-full px-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="rates">Rates</TabsTrigger>
              <TabsTrigger value="availability" className="relative">
                Availability
                {hasStockIssue && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                    !
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
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
                          options={productOptions}
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
                      <div className="w-24 text-right font-mono text-sm pt-2">
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

            <TabsContent value="availability" className="space-y-4 mt-4">
              {!formData.location_id ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Select a "Ship From" location to view inventory availability
                </p>
              ) : parseVendorValue(formData.location_id)?.type !== 'location' ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Inventory availability is only shown for location sources
                </p>
              ) : orderItems.length === 0 || orderItems.every(i => !i.product_id) ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Add items to see their availability
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(itemAvailability).map(([productId, availability]) => {
                      const product = products.find(p => p.id === productId);
                      return (
                        <TableRow key={productId}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{product?.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{product?.product_id}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{availability.required}</TableCell>
                          <TableCell className="text-right font-mono">{availability.available}</TableCell>
                          <TableCell className="text-right">
                            {availability.sufficient ? (
                              <Badge variant="default" className="bg-primary text-primary-foreground">
                                <Check className="w-3 h-3 mr-1" />
                                In Stock
                              </Badge>
                            ) : availability.available > 0 ? (
                              <Badge variant="secondary" className="bg-accent text-accent-foreground">
                                Partial ({availability.available})
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <X className="w-3 h-3 mr-1" />
                                Out of Stock
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="assignment" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <Label>Ledger Assignment</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select the ledger to record this sales order transaction. The transaction will be recorded as a positive amount (revenue).
                </p>
                <SearchableSelect
                  options={ledgers.map(l => ({
                    value: l.id,
                    label: l.name,
                    sublabel: l.location_id ? locations.find(loc => loc.id === l.location_id)?.name : 'General',
                  }))}
                  value={formData.ledger_id}
                  onValueChange={(value) => setFormData({ ...formData, ledger_id: value })}
                  placeholder="Auto-select based on Bill From location"
                  allowClear
                  clearLabel="Auto-select"
                />
                {formData.ledger_id && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <span className="text-muted-foreground">Transaction amount: </span>
                    <span className="font-mono text-green-600">+${calculateGrandTotal().toFixed(2)}</span>
                  </div>
                )}
                {!formData.ledger_id && formData.bill_to_location_id && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <span className="text-muted-foreground">Will use ledger for: </span>
                    <span>{locations.find(l => l.id === formData.bill_to_location_id)?.name || 'Bill From location'}</span>
                  </div>
                )}
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
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
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
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Sales Order {viewOrder?.so_number}</DialogTitle>
            <DialogDescription>
              View order details and update status
            </DialogDescription>
          </DialogHeader>
          
          {viewOrder && (
            <div className="flex-1 overflow-y-auto space-y-4 px-6 pb-6">
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
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="mt-1 font-medium">{viewOrder.customer?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ship From</Label>
                  <p className="mt-1">{viewOrder.location?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bill From</Label>
                  <p className="mt-1">{viewOrder.bill_to_location?.name || '-'}</p>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="items">Items</TabsTrigger>
                  <TabsTrigger value="rates">Rates</TabsTrigger>
                  <TabsTrigger value="assignment">Assignment</TabsTrigger>
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

                <TabsContent value="assignment" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      <Label>Ledger Assignment</Label>
                    </div>
                    <div className="p-4 border rounded-lg space-y-3">
                      <div>
                        <Label className="text-muted-foreground text-xs">Assigned Ledger</Label>
                        <p className="font-medium">{viewOrder.ledger?.name || 'Not assigned'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Transaction Amount</Label>
                        <p className="font-mono text-green-600">+${Number(viewOrder.total_amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
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
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Order Date</Label>
                    <p className="text-sm">{new Date(viewOrder.order_date).toLocaleDateString()}</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Separate table component for sorting/filtering
function SalesOrdersTable({
  orders,
  onViewOrder,
  onDeleteOrder,
}: {
  orders: SalesOrder[];
  onViewOrder: (order: SalesOrder) => void;
  onDeleteOrder: (id: string) => void;
}) {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(orders, 'so_number', 'desc');

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
                label="SO #"
                sortKey="so_number"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['so_number']}
                onFilter={(v) => setFilter('so_number', v)}
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
                label="Customer"
                sortKey="customer.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['customer.name']}
                onFilter={(v) => setFilter('customer.name', v)}
              />
              <SortableTableHead
                label="Ship From"
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
              />
              <SortableTableHead
                label="Date"
                sortKey="order_date"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
              />
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onViewOrder(order)}
              >
                <TableCell className="font-medium">{order.so_number}</TableCell>
                <TableCell>
                  <Badge className={`${statusColors[order.status] || 'bg-gray-500'} text-white`}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>{order.customer?.name || '-'}</TableCell>
                <TableCell>{order.location?.name || '-'}</TableCell>
                <TableCell className="font-mono">
                  ${Number(order.total_amount || 0).toFixed(2)}
                </TableCell>
                <TableCell>
                  {new Date(order.order_date).toLocaleDateString()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewOrder(order)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteOrder(order.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default SalesOrders;
