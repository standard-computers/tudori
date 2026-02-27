import { useEffect, useState, useRef, useMemo } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { postGoodsIssue } from '@/lib/inventory-posting';
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
import { ArrowLeft, Plus, PackageMinus, Pencil, Trash2, Check, X, Eye, MoreHorizontal, History, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { toast } from '@/lib/toast';
import { format, parseISO } from 'date-fns';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useExcel } from '@/hooks/use-excel';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { ImportProgressDialog, ImportResult } from '@/components/ImportProgressDialog';

interface GoodsIssue {
  id: string;
  issue_number: string;
  location_id: string;
  customer_id: string | null;
  sales_order_id: string | null;
  outbound_delivery_id: string | null;
  issue_date: string;
  status: string;
  notes: string | null;
  location?: { name: string } | null;
  customer?: { name: string } | null;
  sales_order?: { so_number: string } | null;
  outbound_delivery?: { delivery_number: string } | null;
}

interface GoodsIssueItem {
  id: string;
  goods_issue_id: string;
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

interface Customer {
  id: string;
  name: string;
  customer_id: string;
}

const ISSUE_STATUSES = ['pending', 'posted', 'cancelled', 'reversed'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'posted': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'reversed': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

const GoodsIssues = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [issues, setIssues] = useState<GoodsIssue[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingIssue, setViewingIssue] = useState<GoodsIssue | null>(null);
  const [viewIssueItems, setViewIssueItems] = useState<GoodsIssueItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextIssueNumber, setNextIssueNumber] = useState('GI-0001');
  const [activeTab, setActiveTab] = useState('details');
  const [issueItems, setIssueItems] = useState<GoodsIssueItem[]>([]);
  const [newItemProductId, setNewItemProductId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);

  // Import/Export
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportComplete, setIsImportComplete] = useState(false);

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

  const customerOptions: SearchableSelectOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: c.id,
      label: c.name,
      sublabel: c.customer_id,
    }));
  }, [customers]);

  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? 'gi/edit' : 'gi/new');
    } else {
      setTransaction('gi');
    }
  }, [isDialogOpen, isEditing, setTransaction]);

  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

  const [formData, setFormData] = useState({
    issue_number: '',
    location_id: '',
    customer_id: '',
    issue_date: new Date().toISOString().split('T')[0],
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
      fetchIssues();
      fetchNextIssueNumber();
      fetchLocations();
      fetchProducts();
      fetchCustomers();
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

      // Check if user has admin/owner/IT role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('company_id', data.company_id);

      const adminRoles = ['admin', 'owner', 'it'];
      setIsAdmin(roles?.some(r => adminRoles.includes(r.role)) ?? false);
    }
  };

  const fetchIssues = async () => {
    const { data, error } = await supabase
      .from('goods_issues' as any)
      .select(`
        *,
        location:locations(name),
        customer:customers(name),
        sales_order:sales_orders(so_number),
        outbound_delivery:outbound_deliveries!goods_issues_outbound_delivery_id_fkey(delivery_number),
        goods_issue_items(count)
      `)
      .eq('company_id', companyId!)
      .order('issue_number', { ascending: false });

    if (error) {
      toast.error('Failed to load goods issues');
      return;
    }

    setIssues((data as any) || []);
  };

  const fetchNextIssueNumber = async () => {
    const { data, error } = await supabase.rpc('get_next_goods_issue_number', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextIssueNumber(data);
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

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, customer_id')
      .eq('company_id', companyId!)
      .order('name');
    
    setCustomers(data || []);
  };

  const fetchIssueItems = async (issueId: string) => {
    const { data } = await supabase
      .from('goods_issue_items' as any)
      .select(`
        *,
        product:products(name, product_id)
      `)
      .eq('goods_issue_id', issueId);
    
    setIssueItems((data as any) || []);
  };

  const handleAddItem = async () => {
    if (!editingId || !newItemProductId) return;

    const { error } = await supabase
      .from('goods_issue_items' as any)
      .insert({
        goods_issue_id: editingId,
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
    fetchIssueItems(editingId);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!editingId) return;

    const { error } = await supabase
      .from('goods_issue_items' as any)
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to remove item');
      return;
    }

    toast.success('Item removed');
    fetchIssueItems(editingId);
  };

  const handlePostIssue = async (issueId: string, locationId: string) => {
    const result = await postGoodsIssue(issueId, locationId);
    if (result.success) {
      toast.success('Issue posted - inventory updated');
      fetchIssues();
    } else {
      toast.error(result.error || 'Failed to post issue');
    }
  };

  const handleReversal = async (issue: GoodsIssue) => {
    if (issue.status !== 'posted') {
      toast.error('Only posted goods issues can be reversed');
      return;
    }

    try {
      // 1. Fetch the GI items
      const { data: giItems, error: itemsError } = await supabase
        .from('goods_issue_items' as any)
        .select('*')
        .eq('goods_issue_id', issue.id);

      if (itemsError || !giItems || giItems.length === 0) {
        toast.error('Failed to fetch issue items for reversal');
        return;
      }

      // 2. Generate next GR number
      const { data: grNumber, error: grNumError } = await supabase.rpc('get_next_goods_receipt_number', {
        p_company_id: companyId!,
      });

      if (grNumError || !grNumber) {
        toast.error('Failed to generate goods receipt number');
        return;
      }

      // 3. Create reversing Goods Receipt
      const { data: newGR, error: grError } = await supabase
        .from('goods_receipts' as any)
        .insert({
          company_id: companyId!,
          receipt_number: grNumber,
          location_id: issue.location_id,
          vendor_id: null,
          purchase_order_id: null,
          delivery_id: null,
          status: 'posted',
          notes: `Reversal of GI ${issue.issue_number}`,
        })
        .select()
        .single();

      if (grError || !newGR) {
        toast.error('Failed to create reversing goods receipt');
        return;
      }

      // 4. Create GR items
      const grItems = (giItems as any[]).map((item: any) => ({
        goods_receipt_id: (newGR as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
        bin_id: item.bin_id,
        batch_id: null,
      }));

      const { error: grItemsError } = await supabase
        .from('goods_receipt_items' as any)
        .insert(grItems);

      if (grItemsError) {
        toast.error('Failed to create reversing receipt items');
        return;
      }

      // 5. Add inventory back for each item
      for (const item of giItems as any[]) {
        // Check if inventory record exists
        const { data: existingInv } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('location_id', issue.location_id)
          .eq('product_id', item.product_id)
          .is('bin_id', item.bin_id || null)
          .is('pu_id', null)
          .is('batch_id', null)
          .maybeSingle();

        if (existingInv) {
          await supabase
            .from('inventory')
            .update({ quantity: existingInv.quantity + item.quantity })
            .eq('id', existingInv.id);
        } else {
          await supabase
            .from('inventory')
            .insert({
              location_id: issue.location_id,
              product_id: item.product_id,
              bin_id: item.bin_id || null,
              quantity: item.quantity,
              pu_id: null,
              batch_id: null,
            });
        }
      }

      // 6. Set GI status to reversed
      await supabase
        .from('goods_issues' as any)
        .update({ status: 'reversed' })
        .eq('id', issue.id);

      toast.success(`Issue reversed — GR ${grNumber} created`);
      fetchIssues();

      // Close view dialog if open
      if (isViewDialogOpen && viewingIssue?.id === issue.id) {
        setViewingIssue({ ...issue, status: 'reversed' });
      }
    } catch (err) {
      toast.error('An error occurred during reversal');
    }
  };

  const resetForm = () => {
    setFormData({
      issue_number: nextIssueNumber,
      location_id: '',
      customer_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setIsEditing(false);
    setEditingId(null);
    setIssueItems([]);
    setActiveTab('details');
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, issue_number: nextIssueNumber }));
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', handleOpenDialog);
  useTransactionAction('new', handleOpenDialog);

  const handleView = async (issue: GoodsIssue) => {
    setViewingIssue(issue);
    const { data } = await supabase
      .from('goods_issue_items' as any)
      .select(`
        *,
        product:products(name, product_id),
        bin:bins(name)
      `)
      .eq('goods_issue_id', issue.id);
    setViewIssueItems((data as any) || []);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (issue: GoodsIssue) => {
    setFormData({
      issue_number: issue.issue_number,
      location_id: issue.location_id,
      customer_id: issue.customer_id || '',
      issue_date: issue.issue_date,
      status: issue.status,
      notes: issue.notes || '',
    });
    setIsEditing(true);
    setEditingId(issue.id);
    setActiveTab('details');
    fetchIssueItems(issue.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const issue = issues.find(i => i.id === id);
    if (issue?.status === 'posted') {
      toast.error('Cannot delete posted issue');
      return;
    }

    const { error } = await supabase
      .from('goods_issues' as any)
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete goods issue');
      return;
    }

    toast.success('Goods issue deleted');
    fetchIssues();
    fetchNextIssueNumber();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.location_id) {
      toast.error('Please select a location');
      return;
    }

    const payload = {
      location_id: formData.location_id,
      customer_id: formData.customer_id || null,
      issue_date: formData.issue_date,
      status: formData.status,
      notes: formData.notes || null,
    };

    if (isEditing && editingId) {
      const { error } = await supabase
        .from('goods_issues' as any)
        .update(payload)
        .eq('id', editingId);

      if (error) {
        toast.error('Failed to update goods issue');
        return;
      }

      toast.success('Goods issue updated');
    } else {
      const { data, error } = await supabase
        .from('goods_issues' as any)
        .insert({
          ...payload,
          company_id: companyId!,
          issue_number: formData.issue_number,
        })
        .select()
        .single();

      if (error) {
        toast.error('Failed to create goods issue');
        return;
      }

      // Switch to editing mode to add items
      setEditingId((data as any).id);
      setIsEditing(true);
      setActiveTab('items');
      toast.success('Goods issue created - add items');
      fetchIssues();
      fetchNextIssueNumber();
      return;
    }

    setIsDialogOpen(false);
    fetchIssues();
  };

  // --- Import/Export handlers ---
  const handleDownloadTemplate = () => {
    exportToExcel([], 'goods_issues_template.xlsx', 'Goods Issues', [
      { header: 'Location', key: 'Location', width: 20 },
      { header: 'Customer', key: 'Customer', width: 20 },
      { header: 'Issue Date', key: 'Issue Date', width: 15 },
      { header: 'Notes', key: 'Notes', width: 30 },
    ]);
  };

  const handleExportIssues = () => {
    const exportData = issues.map(i => ({
      'Issue #': i.issue_number,
      'Status': i.status,
      'Location': (i.location as any)?.name || '',
      'Customer': (i.customer as any)?.name || '',
      'Sales Order': (i.sales_order as any)?.so_number || '',
      'Outbound Delivery': (i.outbound_delivery as any)?.delivery_number || '',
      'Issue Date': format(parseISO(i.issue_date), 'yyyy-MM-dd'),
      'Items': (i as any).goods_issue_items?.[0]?.count ?? 0,
      'Notes': i.notes || '',
    }));
    exportToExcel(exportData, 'goods_issues.xlsx', 'Goods Issues');
  };

  const handleImportIssues = async (file: File) => {
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

          const customerName = row['Customer']?.toString().trim();
          let customerId: string | null = null;
          if (customerName) {
            const cust = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
            if (!cust) { results.push({ row: rowNum, status: 'error', message: `Customer "${customerName}" not found` }); setImportResults([...results]); setImportProcessed(i + 1); continue; }
            customerId = cust.id;
          }

          const { data: issueNumber } = await supabase.rpc('get_next_goods_issue_number', { p_company_id: companyId });
          const { error: insertError } = await supabase.from('goods_issues' as any).insert({
            company_id: companyId,
            issue_number: issueNumber,
            location_id: location.id,
            customer_id: customerId,
            issue_date: row['Issue Date']?.toString().trim() || new Date().toISOString().split('T')[0],
            status: 'pending',
            notes: row['Notes']?.toString().trim() || null,
          });
          if (insertError) throw insertError;
          results.push({ row: rowNum, status: 'success', message: `Goods issue created at "${locationName}"` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed' });
        }
        setImportResults([...results]); setImportProcessed(i + 1);
      }
      setIsImportComplete(true); fetchIssues(); fetchNextIssueNumber();
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
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <PackageMinus className="w-7 h-7 text-orange-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Goods Issues</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ImportExportButtons
                importEnabled={isImportEnabled('goods_issue')}
                exportEnabled={isExportEnabled('goods_issue')}
                onImport={handleImportIssues}
                onExport={handleExportIssues}
                onDownloadTemplate={handleDownloadTemplate}
                entityName="Goods Issues"
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
                  <DialogTitle>{isEditing ? 'Edit Goods Issue' : 'New Goods Issue'}</DialogTitle>
                  <DialogDescription>
                    {isEditing ? 'Update the goods issue details.' : 'Create a new goods issue to remove inventory.'}
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
                          <Label htmlFor="issue_number">Issue Number</Label>
                          <Input
                            id="issue_number"
                            value={formData.issue_number}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="issue_date">Issue Date</Label>
                          <Input
                            id="issue_date"
                            type="date"
                            value={formData.issue_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location_id">Location *</Label>
                        <SearchableSelect
                          options={locationOptions}
                          value={formData.location_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value }))}
                          placeholder="Select location"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer_id">Customer</Label>
                        <SearchableSelect
                          options={customerOptions}
                          value={formData.customer_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}
                          placeholder="Select customer (optional)"
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
                            {ISSUE_STATUSES.map((status) => (
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
                          {issueItems.map((item) => (
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
                          {issueItems.length === 0 && (
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

      <GoodsIssuesTable
        issues={issues}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPost={handlePostIssue}
        onReverse={handleReversal}
        isAdmin={isAdmin}
      />

      {/* View Goods Issue Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[550px]'}`}>
          <div className="absolute right-10 top-4 z-10 flex items-center gap-2">
            {isAdmin && viewingIssue?.status === 'posted' && (
              <button
                type="button"
                onClick={() => {
                  if (viewingIssue) handleReversal(viewingIssue);
                }}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                title="Attempt Reversal"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only">Attempt Reversal</span>
              </button>
            )}
            {viewingIssue?.status !== 'posted' && viewingIssue?.status !== 'reversed' && (
              <button
                type="button"
                onClick={() => {
                  setIsViewDialogOpen(false);
                  if (viewingIssue) handleEdit(viewingIssue);
                }}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
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
            <DialogTitle>View Goods Issue</DialogTitle>
            <DialogDescription>
              {viewingIssue?.issue_number}
            </DialogDescription>
          </DialogHeader>
          {viewingIssue && (
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
                      <Label className="text-muted-foreground text-xs">Issue #</Label>
                      <p className="font-mono">{viewingIssue.issue_number}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Date</Label>
                      <p>{format(parseISO(viewingIssue.issue_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Status</Label>
                      <Badge variant="outline" className={getStatusColor(viewingIssue.status)}>
                        {viewingIssue.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Location</Label>
                      <p>{viewingIssue.location?.name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Customer</Label>
                      <p>{viewingIssue.customer?.name || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Sales Order</Label>
                      <p className="font-mono">{viewingIssue.sales_order?.so_number || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Outbound Delivery</Label>
                      <p className="font-mono">{viewingIssue.outbound_delivery?.delivery_number || '-'}</p>
                    </div>
                  </div>
                  {viewingIssue.notes && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Notes</Label>
                      <p className="whitespace-pre-wrap">{viewingIssue.notes}</p>
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
                    {viewIssueItems.map((item) => (
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
                    {viewIssueItems.length === 0 && (
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
                  tableName="goods_issues"
                  recordId={viewingIssue.id}
                  fieldLabels={{
                    status: 'Status',
                    issue_date: 'Issue Date',
                    location_id: 'Location',
                    customer_id: 'Customer',
                    sales_order_id: 'Sales Order',
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
        title="Importing Goods Issues"
        totalRows={importTotal}
        processedRows={importProcessed}
        results={importResults}
        isComplete={isImportComplete}
      />
    </div>
  );
};

interface GoodsIssuesTableProps {
  issues: GoodsIssue[];
  onView: (issue: GoodsIssue) => void;
  onEdit: (issue: GoodsIssue) => void;
  onDelete: (id: string) => void;
  onPost: (id: string, locationId: string) => void;
  onReverse: (issue: GoodsIssue) => void;
  isAdmin: boolean;
}

const GoodsIssuesTable = ({ issues, onView, onEdit, onDelete, onPost, onReverse, isAdmin }: GoodsIssuesTableProps) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(issues, 'issue_number', 'desc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {issues.length} issues
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
              label="Issue #"
              sortKey="issue_number"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['issue_number']}
              onFilter={(value) => setFilter('issue_number', value)}
            />
            <SortableTableHead
              label="Date"
              sortKey="issue_date"
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
              label="Customer"
              sortKey="customer.name"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['customer.name']}
              onFilter={(value) => setFilter('customer.name', value)}
            />
            <SortableTableHead
              label="SO"
              sortKey="sales_order.so_number"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['sales_order.so_number']}
              onFilter={(value) => setFilter('sales_order.so_number', value)}
            />
            <SortableTableHead
              label="Outbound Del."
              sortKey="outbound_delivery.delivery_number"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['outbound_delivery.delivery_number']}
              onFilter={(value) => setFilter('outbound_delivery.delivery_number', value)}
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
                {issues.length === 0
                  ? 'No goods issues found. Create one to start issuing inventory.'
                  : 'No issues match your filters'}
              </TableCell>
            </TableRow>
          ) : (
            sortedAndFilteredData.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell className="font-mono">
                  <button
                    type="button"
                    onClick={() => onView(issue)}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    {issue.issue_number}
                  </button>
                </TableCell>
                <TableCell>{format(parseISO(issue.issue_date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{issue.location?.name || '-'}</TableCell>
                <TableCell>{issue.customer?.name || '-'}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{issue.sales_order?.so_number || '-'}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{issue.outbound_delivery?.delivery_number || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(issue.status)}>
                    {issue.status}
                  </Badge>
                </TableCell>
                <TableCell>{(issue as any).goods_issue_items?.[0]?.count ?? 0}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(issue)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {issue.status === 'pending' && (
                          <DropdownMenuItem onClick={() => onPost(issue.id, issue.location_id)}>
                            <Check className="w-4 h-4 mr-2" />
                            Post to Inventory
                          </DropdownMenuItem>
                        )}
                        {isAdmin && issue.status === 'posted' && (
                          <DropdownMenuItem onClick={() => onReverse(issue)}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Attempt Reversal
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onEdit(issue)}
                          disabled={issue.status === 'posted'}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(issue.id)}
                          disabled={issue.status === 'posted'}
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

export default GoodsIssues;
