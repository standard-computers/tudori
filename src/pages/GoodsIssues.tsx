import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { postGoodsIssue } from '@/lib/inventory-posting';
import { useTableSort } from '@/hooks/use-table-sort';
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
import { ArrowLeft, Plus, PackageMinus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface GoodsIssue {
  id: string;
  issue_number: string;
  location_id: string;
  customer_id: string | null;
  sales_order_id: string | null;
  issue_date: string;
  status: string;
  notes: string | null;
  location?: { name: string } | null;
  customer?: { name: string } | null;
  sales_order?: { so_number: string } | null;
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

const ISSUE_STATUSES = ['pending', 'posted', 'cancelled'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'posted': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextIssueNumber, setNextIssueNumber] = useState('GI-0001');
  const [activeTab, setActiveTab] = useState('details');
  const [issueItems, setIssueItems] = useState<GoodsIssueItem[]>([]);
  const [newItemProductId, setNewItemProductId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);

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
    }
  };

  const fetchIssues = async () => {
    const { data, error } = await supabase
      .from('goods_issues' as any)
      .select(`
        *,
        location:locations(name),
        customer:customers(name),
        sales_order:sales_orders(so_number)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

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
                <PackageMinus className="w-7 h-7 text-orange-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Goods Issues</h1>
              </div>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Issue
                  <Kbd>N</Kbd>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Done
                        </Button>
                      </DialogFooter>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <GoodsIssuesTable
        issues={issues}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPost={handlePostIssue}
      />
    </div>
  );
};

interface GoodsIssuesTableProps {
  issues: GoodsIssue[];
  onEdit: (issue: GoodsIssue) => void;
  onDelete: (id: string) => void;
  onPost: (id: string, locationId: string) => void;
}

const GoodsIssuesTable = ({ issues, onEdit, onDelete, onPost }: GoodsIssuesTableProps) => {
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
              label="Status"
              sortKey="status"
              currentSortKey={sortConfig.key}
              currentSortDirection={sortConfig.direction}
              onSort={handleSort}
              filterValue={filters['status']}
              onFilter={(value) => setFilter('status', value)}
            />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAndFilteredData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {issues.length === 0
                  ? 'No goods issues found. Create one to start issuing inventory.'
                  : 'No issues match your filters'}
              </TableCell>
            </TableRow>
          ) : (
            sortedAndFilteredData.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell className="font-mono">{issue.issue_number}</TableCell>
                <TableCell>{format(new Date(issue.issue_date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{issue.location?.name || '-'}</TableCell>
                <TableCell>{issue.customer?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(issue.status)}>
                    {issue.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {issue.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onPost(issue.id, issue.location_id)}
                        title="Post to inventory"
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onEdit(issue)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(issue.id)}
                      disabled={issue.status === 'posted'}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
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
