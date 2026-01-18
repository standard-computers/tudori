import { useEffect, useState, useMemo } from 'react';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { ArrowLeft, FileSpreadsheet, Plus, Play, Trash2, Eye, Loader2, MoreHorizontal, ShoppingCart } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { toast } from 'sonner';

interface Requisition {
  id: string;
  requisition_id: string;
  status: string;
  location_id: string | null;
  vendor_id: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  location?: { name: string } | null;
  vendor?: { name: string } | null;
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
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Use vendor sources hook for combined vendors + DC/warehouse locations
  const { vendorOptions, parseVendorValue } = useVendorSources(companyId);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // View dialog state
  const [viewRequisition, setViewRequisition] = useState<Requisition | null>(null);
  const [viewItems, setViewItems] = useState<RequisitionItem[]>([]);

  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction('req/new');
    } else if (isViewDialogOpen) {
      setTransaction('req/view');
    } else if (isRunDialogOpen) {
      setTransaction('req/run');
    } else {
      setTransaction('req');
    }
  }, [isDialogOpen, isViewDialogOpen, isRunDialogOpen, setTransaction]);
  
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
        location:locations(name),
        vendor:vendors(name)
      `)
      .eq('company_id', companyId)
      .order('requisition_id', { ascending: false });

    if (error) {
      console.error('Error fetching requisitions:', error);
      toast.error('Failed to load requisitions');
      return;
    }

    setRequisitions(data || []);
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
      .select('id, name, product_id, price, vendor_id')
      .eq('company_id', companyId)
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
      // Get next requisition ID
      const { data: nextId } = await supabase.rpc('get_next_requisition_id', {
        p_company_id: companyId,
      });

      // Calculate total amount
      const totalAmount = suggestedItems.reduce((sum, item) => {
        return sum + (item.product.price || 0) * item.quantity;
      }, 0);

      // Determine vendor_id: if "all vendors" but single item, use item's vendor
      let effectiveVendorId = runFormData.vendor_id || null;
      if (!effectiveVendorId && suggestedItems.length === 1 && suggestedItems[0].product.vendor_id) {
        effectiveVendorId = `vendor:${suggestedItems[0].product.vendor_id}`;
      }

      // Create requisition
      const { data: requisition, error: reqError } = await supabase
        .from('requisitions')
        .insert({
          company_id: companyId,
          requisition_id: nextId,
          status: 'draft',
          location_id: runFormData.location_id || null,
          vendor_id: effectiveVendorId,
          total_amount: totalAmount,
          notes: `Auto-generated requisition for ${locations.find(l => l.id === runFormData.location_id)?.name || 'location'}`,
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // Create requisition items
      const itemsToInsert = suggestedItems.map(item => ({
        requisition_id: requisition.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
      }));

      const { error: itemsError } = await supabase
        .from('requisition_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(`Requisition ${nextId} created with ${suggestedItems.length} items`);
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
    
    // Fetch items for this requisition
    const { data: items } = await supabase
      .from('requisition_items')
      .select(`
        *,
        product:products(name, price)
      `)
      .eq('requisition_id', requisition.id);

    setViewItems(items || []);
    setIsViewDialogOpen(true);
  };

  const handleDeleteRequisition = async (id: string) => {
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

      // Get next PO number
      const { data: poNumber, error: poNumError } = await supabase.rpc('get_next_po_number', {
        p_company_id: companyId,
      });

      if (poNumError) throw poNumError;

      // Calculate totals
      const subtotal = reqItems.reduce((sum, item) => {
        return sum + (item.unit_price || item.product?.price || 0) * item.quantity;
      }, 0);
      const taxAmount = subtotal * 0.1;
      const totalAmount = subtotal + taxAmount;

      // Parse vendor_id from requisition (handles 'vendor:uuid' format)
      const parsedVendor = requisition.vendor_id ? parseVendorValue(requisition.vendor_id) : null;
      const poVendorId = parsedVendor?.type === 'vendor' ? parsedVendor.id : null;

      // Create purchase order
      const { data: newPO, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          company_id: companyId,
          po_number: poNumber,
          status: 'draft',
          vendor_id: poVendorId,
          location_id: requisition.location_id,
          requisition_id: requisition.id,
          subtotal,
          tax_amount: taxAmount,
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

      // Update requisition status to 'ordered'
      const { error: updateError } = await supabase
        .from('requisitions')
        .update({ status: 'ordered' })
        .eq('id', requisition.id);

      if (updateError) throw updateError;

      toast.success(`Requisition ${requisition.requisition_id} converted to ${poNumber}`);
      fetchRequisitions();
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
                <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-display font-bold text-foreground">Requisitions</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          />
        )}
      </main>

      {/* Run Dialog */}
      <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Run Purchase Requisition</DialogTitle>
            <DialogDescription>
              Generate a purchase requisition by selecting a destination location and optionally filtering by vendor
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
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

          <DialogFooter>
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
                'Create Requisition'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Requisition {viewRequisition?.requisition_id}</DialogTitle>
            <DialogDescription>
              View requisition details and update status
            </DialogDescription>
          </DialogHeader>
          
          {viewRequisition && (
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
                  <p className="mt-1">{viewRequisition.location?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="mt-1">{viewRequisition.vendor?.name || 'All Vendors'}</p>
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
function RequisitionsTable({
  requisitions,
  onViewRequisition,
  onConvertToPO,
  onDeleteRequisition,
}: {
  requisitions: Requisition[];
  onViewRequisition: (requisition: Requisition) => void;
  onConvertToPO: (requisition: Requisition) => void;
  onDeleteRequisition: (id: string) => void;
}) {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(requisitions, 'requisition_id', 'desc');

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
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
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
                sortKey="location.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['location.name']}
                onFilter={(v) => setFilter('location.name', v)}
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
                label="Total"
                sortKey="total_amount"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                className="text-right"
                filterable={false}
              />
              <SortableTableHead
                label="Created"
                sortKey="created_at"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
              />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="font-mono">{req.requisition_id}</TableCell>
                <TableCell>
                  <Badge className={`${statusColors[req.status]} text-white`}>
                    {req.status}
                  </Badge>
                </TableCell>
                <TableCell>{req.location?.name || '-'}</TableCell>
                <TableCell>{req.vendor?.name || 'All Vendors'}</TableCell>
                <TableCell className="text-right font-mono">
                  ${req.total_amount?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell>
                  {new Date(req.created_at).toLocaleDateString()}
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
