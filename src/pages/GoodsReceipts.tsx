import { useEffect, useState, useRef, useMemo } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useVendorSources } from '@/hooks/use-vendor-sources';
import { useTableSort } from '@/hooks/use-table-sort';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { ColumnToggle } from '@/components/ColumnToggle';
import { postGoodsReceipt } from '@/lib/inventory-posting';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/SortableTableHead';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuditHistoryTab } from '@/components/AuditHistoryTab';
import { ArrowLeft, Plus, PackagePlus, Pencil, Trash2, Check, X, Eye, MoreHorizontal, History, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { format, parseISO } from 'date-fns';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useExcel } from '@/hooks/use-excel';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { ImportProgressDialog, ImportResult } from '@/components/ImportProgressDialog';

interface GoodsReceipt {
  id: string;
  receipt_number: string;
  location_id: string;
  vendor_id: string | null;
  delivery_id: string | null;
  purchase_order_id: string | null;
  receipt_date: string;
  status: string;
  notes: string | null;
  location?: { name: string } | null;
  vendor?: { name: string } | null;
  delivery?: { delivery_id: string } | null;
  purchase_order?: { po_number: string } | null;
}

interface GoodsReceiptItem {
  id: string;
  goods_receipt_id: string;
  product_id: string;
  quantity: number;
  bin_id: string | null;
  notes: string | null;
  product?: { name: string; product_id: string };
  bin?: { name: string } | null;
}

interface Location {
  id: string;
  name: string;
  location_id: string;
}

interface Product {
  id: string;
  name: string;
  product_id: string;
}

interface Delivery {
  id: string;
  delivery_id: string;
  vendor_id: string | null;
  location_id: string | null;
  vendor?: { name: string } | null;
  location?: { name: string } | null;
}

const RECEIPT_STATUSES = ['pending', 'posted', 'cancelled'];

// Column definitions for Goods Receipts table
const GOODS_RECEIPT_COLUMNS: ColumnDefinition[] = [
  { key: 'receipt_number', label: 'Receipt #', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'location', label: 'Location', defaultVisible: true },
  { key: 'vendor', label: 'Vendor', defaultVisible: true },
  { key: 'delivery', label: 'Delivery', defaultVisible: true },
  { key: 'purchase_order', label: 'PO', defaultVisible: true },
  { key: 'receipt_date', label: 'Date', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'posted': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

const GoodsReceipts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);

  // Auto-open view dialog when navigated here with openRef state (e.g. from Ledgers)
  useEffect(() => {
    const ref = (location.state as any)?.openRef;
    if (!ref || !receipts.length) return;
    const match = receipts.find(r => r.receipt_number === ref);
    if (match) {
      handleView(match);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state, receipts]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<GoodsReceipt | null>(null);
  const [viewReceiptItems, setViewReceiptItems] = useState<GoodsReceiptItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextReceiptNumber, setNextReceiptNumber] = useState('GR-0001');
  const [activeTab, setActiveTab] = useState('details');
  const [receiptItems, setReceiptItems] = useState<GoodsReceiptItem[]>([]);
  const [newItemProductId, setNewItemProductId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // Import/Export
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportComplete, setIsImportComplete] = useState(false);

  const { vendorOptions } = useVendorSources(companyId);

  const locationOptions: SearchableSelectOption[] = useMemo(() => {
    return locations.map((loc) => ({
      value: loc.id,
      label: loc.name,
      sublabel: loc.location_id,
    }));
  }, [locations]);

  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return products.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: p.product_id,
    }));
  }, [products]);

  const deliveryOptions: SearchableSelectOption[] = useMemo(() => {
    return deliveries.map((d) => ({
      value: d.id,
      label: d.delivery_id,
      sublabel: d.vendor?.name || 'No vendor',
    }));
  }, [deliveries]);

  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? 'gr/edit' : 'gr/new');
    } else {
      setTransaction('gr');
    }
  }, [isDialogOpen, isEditing, setTransaction]);

  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

  const [formData, setFormData] = useState({
    receipt_number: '',
    location_id: '',
    vendor_id: '',
    receipt_date: new Date().toISOString().split('T')[0],
    status: 'pending',
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

  useEffect(() => {
    if (companyId) {
      fetchReceipts();
      fetchNextReceiptNumber();
      fetchLocations();
      fetchProducts();
      fetchDeliveries();
    }
  }, [companyId]);

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

  const fetchReceipts = async () => {
    const { data, error } = await supabase
      .from('goods_receipts' as any)
      .select(`
        *,
        location:locations(name),
        vendor:vendors(name),
        delivery:deliveries(delivery_id),
        purchase_order:purchase_orders(po_number),
        goods_receipt_items(count)
      `)
      .eq('company_id', companyId!)
      .order('receipt_number', { ascending: false });

    if (error) {
      toast.error('Failed to load goods receipts');
      return;
    }

    setReceipts((data as any) || []);
  };

  const fetchNextReceiptNumber = async () => {
    const { data, error } = await supabase.rpc('get_next_goods_receipt_number', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextReceiptNumber(data);
    }
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
      .select('id, name, product_id')
      .eq('company_id', companyId!)
      .order('name');
    
    setProducts(data || []);
  };

  const fetchDeliveries = async () => {
    // Fetch deliveries that don't have a goods receipt yet (or are pending)
    const { data } = await supabase
      .from('deliveries')
      .select(`
        id, 
        delivery_id, 
        vendor_id, 
        location_id,
        vendor:vendors(name),
        location:locations!deliveries_location_id_fkey(name)
      `)
      .eq('company_id', companyId!)
      .in('status', ['pending', 'in_transit', 'delivered'])
      .order('delivery_id', { ascending: false });
    
    setDeliveries((data as any) || []);
  };

  const handleDeliverySelect = async (deliveryId: string) => {
    setSelectedDeliveryId(deliveryId);
    
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      setFormData(prev => ({
        ...prev,
        location_id: delivery.location_id || '',
        vendor_id: delivery.vendor_id || '',
      }));
    }
  };

  const copyDeliveryItems = async (deliveryId: string, receiptId: string) => {
    // Fetch delivery items
    const { data: deliveryItems } = await supabase
      .from('delivery_items')
      .select('product_id, quantity, notes')
      .eq('delivery_id', deliveryId);

    if (deliveryItems && deliveryItems.length > 0) {
      // Insert as goods receipt items
      const receiptItems = deliveryItems.map(item => ({
        goods_receipt_id: receiptId,
        product_id: item.product_id,
        quantity: item.quantity,
        notes: item.notes,
      }));

      await supabase
        .from('goods_receipt_items' as any)
        .insert(receiptItems);
    }
  };

  const fetchReceiptItems = async (receiptId: string) => {
    const { data } = await supabase
      .from('goods_receipt_items' as any)
      .select(`
        *,
        product:products(name, product_id)
      `)
      .eq('goods_receipt_id', receiptId);
    
    setReceiptItems((data as any) || []);
  };

  const handleAddItem = async () => {
    if (!editingId || !newItemProductId) return;

    const { error } = await supabase
      .from('goods_receipt_items' as any)
      .insert({
        goods_receipt_id: editingId,
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
    fetchReceiptItems(editingId);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!editingId) return;

    const { error } = await supabase
      .from('goods_receipt_items' as any)
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to remove item');
      return;
    }

    toast.success('Item removed');
    fetchReceiptItems(editingId);
  };

  const handlePostReceipt = async (receiptId: string, locationId: string) => {
    const result = await postGoodsReceipt(receiptId, locationId);
    if (result.success) {
      toast.success('Receipt posted - inventory updated');
      fetchReceipts();
    } else {
      toast.error(result.error || 'Failed to post receipt');
    }
  };

  const resetForm = () => {
    setFormData({
      receipt_number: nextReceiptNumber,
      location_id: '',
      vendor_id: '',
      receipt_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setSelectedDeliveryId('');
    setIsEditing(false);
    setEditingId(null);
    setReceiptItems([]);
    setActiveTab('details');
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, receipt_number: nextReceiptNumber }));
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', handleOpenDialog);
  useTransactionAction('new', handleOpenDialog);

  const handleView = async (receipt: GoodsReceipt) => {
    setViewingReceipt(receipt);
    // Fetch items for the view dialog
    const { data } = await supabase
      .from('goods_receipt_items' as any)
      .select(`
        *,
        product:products(name, product_id),
        bin:bins(name)
      `)
      .eq('goods_receipt_id', receipt.id);
    setViewReceiptItems((data as any) || []);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (receipt: GoodsReceipt) => {
    setFormData({
      receipt_number: receipt.receipt_number,
      location_id: receipt.location_id,
      vendor_id: receipt.vendor_id || '',
      receipt_date: receipt.receipt_date,
      status: receipt.status,
      notes: receipt.notes || '',
    });
    setSelectedDeliveryId(receipt.delivery_id || '');
    setIsEditing(true);
    setEditingId(receipt.id);
    setActiveTab('details');
    fetchReceiptItems(receipt.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const receipt = receipts.find(r => r.id === id);
    if (receipt?.status === 'posted') {
      toast.error('Cannot delete posted receipt');
      return;
    }

    const { error } = await supabase
      .from('goods_receipts' as any)
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete goods receipt');
      return;
    }

    toast.success('Goods receipt deleted');
    fetchReceipts();
    fetchNextReceiptNumber();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEditing && !selectedDeliveryId) {
      toast.error('Please select an inbound delivery');
      return;
    }

    if (!formData.location_id) {
      toast.error('Please select a location');
      return;
    }

    const payload = {
      location_id: formData.location_id,
      vendor_id: formData.vendor_id || null,
      delivery_id: selectedDeliveryId || null,
      receipt_date: formData.receipt_date,
      status: formData.status,
      notes: formData.notes || null,
    };

    if (isEditing && editingId) {
      const { error } = await supabase
        .from('goods_receipts' as any)
        .update(payload)
        .eq('id', editingId);

      if (error) {
        toast.error('Failed to update goods receipt');
        return;
      }

      toast.success('Goods receipt updated');
    } else {
      const { data, error } = await supabase
        .from('goods_receipts' as any)
        .insert({
          ...payload,
          company_id: companyId!,
          receipt_number: formData.receipt_number,
        })
        .select()
        .single();

      if (error) {
        toast.error('Failed to create goods receipt');
        return;
      }

      const newReceiptId = (data as any).id;

      // Copy items from delivery
      if (selectedDeliveryId) {
        await copyDeliveryItems(selectedDeliveryId, newReceiptId);
        
        // Auto-post the receipt
        const postResult = await postGoodsReceipt(newReceiptId, formData.location_id);
        if (postResult.success) {
          toast.success('Goods receipt created and posted - inventory updated');
        } else {
          toast.error(postResult.error || 'Failed to auto-post receipt');
        }
      }

      setIsDialogOpen(false);
      fetchReceipts();
      fetchNextReceiptNumber();
      fetchDeliveries();
      return;
    }

    setIsDialogOpen(false);
    fetchReceipts();
  };

  // --- Import/Export handlers ---
  const handleDownloadTemplate = () => {
    exportToExcel([], 'goods_receipts_template.xlsx', 'Goods Receipts', [
      { header: 'Location', key: 'Location', width: 20 },
      { header: 'Vendor', key: 'Vendor', width: 20 },
      { header: 'Receipt Date', key: 'Receipt Date', width: 15 },
      { header: 'Notes', key: 'Notes', width: 30 },
    ]);
  };

  const handleExportReceipts = () => {
    const exportData = receipts.map(r => ({
      'Receipt #': r.receipt_number,
      'Status': r.status,
      'Location': (r.location as any)?.name || '',
      'Vendor': (r.vendor as any)?.name || '',
      'Delivery': (r.delivery as any)?.delivery_id || '',
      'PO': (r.purchase_order as any)?.po_number || '',
      'Receipt Date': format(parseISO(r.receipt_date), 'yyyy-MM-dd'),
      'Items': (r as any).goods_receipt_items?.[0]?.count ?? 0,
      'Notes': r.notes || '',
    }));
    exportToExcel(exportData, 'goods_receipts.xlsx', 'Goods Receipts');
  };

  const handleImportReceipts = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) { toast.error('No data found in file'); return; }

      setImportResults([]); setImportTotal(rows.length); setImportProcessed(0);
      setIsImportComplete(false); setIsImportDialogOpen(true);
      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]; const rowNum = i + 2;
        try {
          const locationName = row['Location']?.toString().trim();
          if (!locationName) { results.push({ row: rowNum, status: 'error', message: 'Location is required' }); setImportResults([...results]); setImportProcessed(i + 1); continue; }
          const location = locations.find(l => l.name.toLowerCase() === locationName.toLowerCase());
          if (!location) { results.push({ row: rowNum, status: 'error', message: `Location "${locationName}" not found` }); setImportResults([...results]); setImportProcessed(i + 1); continue; }

          const vendorName = row['Vendor']?.toString().trim();
          let vendorId: string | null = null;
          if (vendorName) {
            const v = vendorOptions.find(vo => vo.label.toLowerCase() === vendorName.toLowerCase());
            if (!v) { results.push({ row: rowNum, status: 'error', message: `Vendor "${vendorName}" not found` }); setImportResults([...results]); setImportProcessed(i + 1); continue; }
            vendorId = v.value;
          }

          const { data: receiptNumber } = await supabase.rpc('get_next_goods_receipt_number', { p_company_id: companyId });
          const { error: insertError } = await supabase.from('goods_receipts' as any).insert({
            company_id: companyId,
            receipt_number: receiptNumber,
            location_id: location.id,
            vendor_id: vendorId,
            receipt_date: row['Receipt Date']?.toString().trim() || new Date().toISOString().split('T')[0],
            status: 'pending',
            notes: row['Notes']?.toString().trim() || null,
          });
          if (insertError) throw insertError;
          results.push({ row: rowNum, status: 'success', message: `Goods receipt created at "${locationName}"` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed' });
        }
        setImportResults([...results]); setImportProcessed(i + 1);
      }
      setIsImportComplete(true); fetchReceipts(); fetchNextReceiptNumber();
    } catch (err: any) { toast.error(err.message || 'Failed to read file'); }
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
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ArrowLeft className="w-5 h-5" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <div className="flex items-center gap-3">
                <PackagePlus className="w-7 h-7 text-emerald-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Goods Receipts</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ImportExportButtons
                importEnabled={isImportEnabled('goods_receipt')}
                exportEnabled={isExportEnabled('goods_receipt')}
                onImport={handleImportReceipts}
                onExport={handleExportReceipts}
                onDownloadTemplate={handleDownloadTemplate}
                entityName="Goods Receipts"
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenDialog} size="icon" className="relative">
                  <Plus className="w-4 h-4" />
                  <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
                </Button>
              </DialogTrigger>
              <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[550px]'}`} onOpenAutoFocus={(e) => e.preventDefault()}>
                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                >
                  {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <DialogHeader>
                  <DialogTitle>{isEditing ? 'Edit Goods Receipt' : 'New Goods Receipt'}</DialogTitle>
                  <DialogDescription>
                    {isEditing ? 'Update the goods receipt details.' : 'Create a new goods receipt to add inventory.'}
                  </DialogDescription>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="items" disabled={!isEditing}>Items</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details">
                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 py-4 pb-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="receipt_number">Receipt Number</Label>
                          <Input
                            id="receipt_number"
                            value={formData.receipt_number}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="receipt_date">Receipt Date</Label>
                          <Input
                            id="receipt_date"
                            type="date"
                            value={formData.receipt_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, receipt_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="space-y-2">
                          <Label htmlFor="delivery_id">Inbound Delivery *</Label>
                          <SearchableSelect
                            options={deliveryOptions}
                            value={selectedDeliveryId}
                            onValueChange={handleDeliverySelect}
                            placeholder="Select delivery"
                          />
                          {deliveries.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No pending deliveries available. Create a delivery first.
                            </p>
                          )}
                        </div>
                      )}
                      {isEditing && (
                        <div className="space-y-2">
                          <Label>Delivery</Label>
                          <Input
                            value={deliveries.find(d => d.id === selectedDeliveryId)?.delivery_id || '-'}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="location_id">Location *</Label>
                        <SearchableSelect
                          options={locationOptions}
                          value={formData.location_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value }))}
                          placeholder="Select location"
                          disabled={!isEditing && !!selectedDeliveryId}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vendor_id">Vendor</Label>
                        <SearchableSelect
                          options={vendorOptions}
                          value={formData.vendor_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, vendor_id: value }))}
                          placeholder="Select vendor (optional)"
                          disabled={!isEditing && !!selectedDeliveryId}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                          disabled={formData.status === 'posted'}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECEIPT_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Input
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Optional notes"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
                      </DialogFooter>
                    </form>
                  </TabsContent>
                  <TabsContent value="items">
                    <div className="space-y-4 py-4">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <SearchableSelect
                            options={productOptions}
                            value={newItemProductId}
                            onValueChange={setNewItemProductId}
                            placeholder="Select product"
                          />
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={newItemQuantity}
                          onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                        <Button type="button" onClick={handleAddItem} disabled={!newItemProductId}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receiptItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{item.product?.name}</div>
                                  <div className="text-xs text-muted-foreground">{item.product?.product_id}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {receiptItems.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                No items added
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <DialogFooter>
                      </DialogFooter>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </header>

      <GoodsReceiptsTable
        receipts={receipts}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPost={handlePostReceipt}
      />

      {/* View Goods Receipt Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[550px]'}`}>
          <div className="absolute right-10 top-4 z-10 flex items-center gap-2">
            {viewingReceipt?.status !== 'posted' && (
              <button
                type="button"
                onClick={() => {
                  setIsViewDialogOpen(false);
                  if (viewingReceipt) handleEdit(viewingReceipt);
                }}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
          <DialogHeader>
            <DialogTitle>View Goods Receipt</DialogTitle>
            <DialogDescription>
              {viewingReceipt?.receipt_number}
            </DialogDescription>
          </DialogHeader>
          {viewingReceipt && (
            <Tabs defaultValue="details" className="w-full px-4 pb-4">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1">
                  <History className="w-3.5 h-3.5" /> History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="px-2">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Receipt #</Label>
                      <p className="font-mono">{viewingReceipt.receipt_number}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Date</Label>
                      <p>{format(parseISO(viewingReceipt.receipt_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Status</Label>
                      <Badge variant="outline" className={getStatusColor(viewingReceipt.status)}>
                        {viewingReceipt.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Location</Label>
                      <p>{viewingReceipt.location?.name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Vendor</Label>
                      <p>{viewingReceipt.vendor?.name || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Delivery</Label>
                      <p className="font-mono">{viewingReceipt.delivery?.delivery_id || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Purchase Order</Label>
                      <p className="font-mono">{viewingReceipt.purchase_order?.po_number || '-'}</p>
                    </div>
                  </div>
                  {viewingReceipt.notes && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Notes</Label>
                      <p className="whitespace-pre-wrap">{viewingReceipt.notes}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="items" className="px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Bin</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewReceiptItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.product?.name}</div>
                            <div className="text-xs text-muted-foreground">{item.product?.product_id}</div>
                          </div>
                        </TableCell>
                        <TableCell>{item.bin?.name || '-'}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                    {viewReceiptItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No items
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="history" className="px-2">
                <AuditHistoryTab
                  tableName="goods_receipts"
                  recordId={viewingReceipt.id}
                  fieldLabels={{
                    status: 'Status',
                    receipt_date: 'Receipt Date',
                    location_id: 'Location',
                    vendor_id: 'Vendor',
                    delivery_id: 'Delivery',
                    notes: 'Notes',
                  }}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ImportProgressDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Importing Goods Receipts"
        totalRows={importTotal}
        processedRows={importProcessed}
        results={importResults}
        isComplete={isImportComplete}
      />
    </div>
  );
};

interface GoodsReceiptsTableProps {
  receipts: GoodsReceipt[];
  onView: (receipt: GoodsReceipt) => void;
  onEdit: (receipt: GoodsReceipt) => void;
  onDelete: (id: string) => void;
  onPost: (id: string, locationId: string) => void;
}

const GoodsReceiptsTable = ({ receipts, onView, onEdit, onDelete, onPost }: GoodsReceiptsTableProps) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(receipts, 'receipt_number', 'desc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {receipts.length} receipts
          </span>
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
            <X className="w-3 h-3 mr-1" />
            Clear filters
          </Button>
          {Object.entries(filters).map(([key, value]) => value && (
            <Badge key={key} variant="secondary" className="text-xs">
              {key}: {value}
              <button onClick={() => setFilter(key, '')} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              label="Receipt #"
              sortKey="receipt_number"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['receipt_number']}
              onFilter={(value) => setFilter('receipt_number', value)}
            />
            <SortableTableHead
              label="Delivery"
              sortKey="delivery.delivery_id"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['delivery.delivery_id']}
              onFilter={(value) => setFilter('delivery.delivery_id', value)}
            />
            <SortableTableHead
              label="Date"
              sortKey="receipt_date"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterable={false}
            />
            <SortableTableHead
              label="Location"
              sortKey="location.name"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['location.name']}
              onFilter={(value) => setFilter('location.name', value)}
            />
            <SortableTableHead
              label="Vendor"
              sortKey="vendor.name"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['vendor.name']}
              onFilter={(value) => setFilter('vendor.name', value)}
            />
            <SortableTableHead
              label="PO"
              sortKey="purchase_order.po_number"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['purchase_order.po_number']}
              onFilter={(value) => setFilter('purchase_order.po_number', value)}
            />
            <SortableTableHead
              label="Status"
              sortKey="status"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['status']}
              onFilter={(value) => setFilter('status', value)}
            />
            <SortableTableHead
              label="Items"
              sortKey="item_count"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterable={false}
            />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAndFilteredData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                {receipts.length === 0
                  ? 'No goods receipts found. Create one to start receiving inventory.'
                  : 'No receipts match your filters'}
              </TableCell>
            </TableRow>
          ) : (
            sortedAndFilteredData.map((receipt) => (
              <TableRow key={receipt.id}>
                <TableCell className="font-mono">
                  <button
                    type="button"
                    onClick={() => onView(receipt)}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    {receipt.receipt_number}
                  </button>
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">{receipt.delivery?.delivery_id || '-'}</TableCell>
                <TableCell>{format(parseISO(receipt.receipt_date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{receipt.location?.name || '-'}</TableCell>
                <TableCell>{receipt.vendor?.name || '-'}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{receipt.purchase_order?.po_number || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(receipt.status)}>
                    {receipt.status}
                  </Badge>
                </TableCell>
                <TableCell>{(receipt as any).goods_receipt_items?.[0]?.count ?? 0}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(receipt)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {receipt.status === 'pending' && (
                          <DropdownMenuItem onClick={() => onPost(receipt.id, receipt.location_id)}>
                            <Check className="w-4 h-4 mr-2" />
                            Post to Inventory
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onEdit(receipt)}
                          disabled={receipt.status === 'posted'}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(receipt.id)}
                          disabled={receipt.status === 'posted'}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default GoodsReceipts;
