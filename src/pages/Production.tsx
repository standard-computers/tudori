import { useEffect, useState, useRef } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SortableTableHead } from '@/components/SortableTableHead';
import { ArrowLeft, Plus, Eye, MoreHorizontal, Pencil, Trash2, X, Factory } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ProductionOrder {
  id: string;
  order_number: string;
  product_id: string;
  location_id: string;
  quantity: number;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
  product?: { name: string; product_id: string };
  location?: { name: string; location_id: string };
}

interface Product {
  id: string;
  product_id: string;
  name: string;
  has_components?: boolean;
}

interface Location {
  id: string;
  location_id: string;
  name: string;
  is_production_enabled: boolean;
}

interface ProductComponent {
  id: string;
  component_product_id: string;
  quantity: number;
  component?: { name: string; product_id: string };
}

const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const ProductionOrderTable = ({
  orders,
  onView,
  onEdit,
  onDelete,
}: {
  orders: ProductionOrder[];
  onView: (order: ProductionOrder) => void;
  onEdit: (order: ProductionOrder) => void;
  onDelete: (id: string) => void;
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(orders, 'order_number', 'desc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {orders.length} orders
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
      <div className="overflow-auto h-[calc(100vh-5.75rem)]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <SortableTableHead
                label="Order #"
                sortKey="order_number"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['order_number']}
                onFilter={(value) => setFilter('order_number', value)}
                className="w-32"
              />
              <SortableTableHead
                label="Product"
                sortKey="product.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['product.name']}
                onFilter={(value) => setFilter('product.name', value)}
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
                label="Quantity"
                sortKey="quantity"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['quantity']}
                onFilter={(value) => setFilter('quantity', value)}
                className="w-24"
              />
              <SortableTableHead
                label="Status"
                sortKey="status"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['status']}
                onFilter={(value) => setFilter('status', value)}
                className="w-32"
              />
              <SortableTableHead
                label="Scheduled"
                sortKey="scheduled_date"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['scheduled_date']}
                onFilter={(value) => setFilter('scheduled_date', value)}
                className="w-32"
              />
              <SortableTableHead
                label="Actions"
                sortKey=""
                currentSortKey=""
                currentSortDirection={null}
                onSort={() => {}}
                filterable={false}
                className="w-24"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No production orders found
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((order) => (
                <TableRow key={order.id} className="whitespace-nowrap">
                  <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                  <TableCell>{order.product?.name || '-'}</TableCell>
                  <TableCell>{order.location?.name || '-'}</TableCell>
                  <TableCell>{order.quantity}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.scheduled_date ? format(new Date(order.scheduled_date), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onView(order)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(order)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onDelete(order.id)}
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
    </div>
  );
};

const Production = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const formRef = useRef<HTMLFormElement>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [components, setComponents] = useState<ProductComponent[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextOrderNumber, setNextOrderNumber] = useState('PRO-0001');

  const [formData, setFormData] = useState({
    order_number: '',
    product_id: '',
    location_id: '',
    quantity: 1,
    status: 'pending',
    scheduled_date: '',
    notes: '',
  });

  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isViewMode ? 'pro/view' : isEditing ? 'pro/edit' : 'pro/new');
    } else {
      setTransaction('pro');
    }
  }, [isDialogOpen, isViewMode, isEditing, setTransaction]);

  useSaveShortcut(() => {
    if (isDialogOpen && !isViewMode && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen && !isViewMode);

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
      fetchOrders();
      fetchProducts();
      fetchLocations();
      fetchNextOrderNumber();
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

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('production_orders')
      .select(`
        *,
        product:products(name, product_id),
        location:locations(name, location_id)
      `)
      .eq('company_id', companyId!)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load production orders');
      return;
    }
    setOrders(data || []);
  };

  const fetchProducts = async () => {
    // Get products that have components
    const { data: componentsData } = await supabase
      .from('product_components')
      .select('parent_product_id');
    
    const productIdsWithComponents = new Set(componentsData?.map(c => c.parent_product_id) || []);

    const { data, error } = await supabase
      .from('products')
      .select('id, product_id, name')
      .eq('company_id', companyId!)
      .eq('status', 'Active')
      .order('name');

    if (!error && data) {
      setProducts(data.map(p => ({
        ...p,
        has_components: productIdsWithComponents.has(p.id)
      })));
    }
  };

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, location_id, name, is_production_enabled')
      .eq('company_id', companyId!)
      .eq('is_production_enabled', true)
      .order('name');

    if (!error && data) {
      setLocations(data);
    }
  };

  const fetchNextOrderNumber = async () => {
    const { data, error } = await supabase.rpc('get_next_production_order_number', {
      p_company_id: companyId!,
    });
    if (!error && data) {
      setNextOrderNumber(data);
    }
  };

  const fetchProductComponents = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_components')
      .select(`
        id,
        component_product_id,
        quantity,
        component:products!product_components_component_product_id_fkey(name, product_id)
      `)
      .eq('parent_product_id', productId);

    if (!error && data) {
      setComponents(data as unknown as ProductComponent[]);
    } else {
      setComponents([]);
    }
  };

  const resetForm = () => {
    setFormData({
      order_number: nextOrderNumber,
      product_id: '',
      location_id: '',
      quantity: 1,
      status: 'pending',
      scheduled_date: '',
      notes: '',
    });
    setIsEditing(false);
    setIsViewMode(false);
    setEditingId(null);
    setComponents([]);
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, order_number: nextOrderNumber }));
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', handleOpenDialog);

  const handleView = async (order: ProductionOrder) => {
    setFormData({
      order_number: order.order_number,
      product_id: order.product_id,
      location_id: order.location_id,
      quantity: order.quantity,
      status: order.status,
      scheduled_date: order.scheduled_date || '',
      notes: order.notes || '',
    });
    setIsViewMode(true);
    setIsEditing(false);
    setEditingId(order.id);
    await fetchProductComponents(order.product_id);
    setIsDialogOpen(true);
  };

  const handleEdit = async (order: ProductionOrder) => {
    setFormData({
      order_number: order.order_number,
      product_id: order.product_id,
      location_id: order.location_id,
      quantity: order.quantity,
      status: order.status,
      scheduled_date: order.scheduled_date || '',
      notes: order.notes || '',
    });
    setIsViewMode(false);
    setIsEditing(true);
    setEditingId(order.id);
    await fetchProductComponents(order.product_id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('production_orders')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete production order');
      return;
    }
    toast.success('Production order deleted');
    fetchOrders();
  };

  const handleProductChange = async (productId: string) => {
    setFormData(prev => ({ ...prev, product_id: productId }));
    await fetchProductComponents(productId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product_id) {
      toast.error('Please select a product');
      return;
    }
    if (!formData.location_id) {
      toast.error('Please select a production location');
      return;
    }

    try {
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('production_orders')
          .update({
            product_id: formData.product_id,
            location_id: formData.location_id,
            quantity: formData.quantity,
            status: formData.status,
            scheduled_date: formData.scheduled_date || null,
            notes: formData.notes || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Production order updated');
      } else {
        const { error } = await supabase
          .from('production_orders')
          .insert({
            company_id: companyId!,
            order_number: formData.order_number,
            product_id: formData.product_id,
            location_id: formData.location_id,
            quantity: formData.quantity,
            status: formData.status,
            scheduled_date: formData.scheduled_date || null,
            notes: formData.notes || null,
          });

        if (error) throw error;
        toast.success('Production order created');
      }

      setIsDialogOpen(false);
      fetchOrders();
      fetchNextOrderNumber();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save production order');
    }
  };

  // Filter products to only show those with components
  const productsWithComponents = products.filter(p => p.has_components);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-indigo-500" />
            <h1 className="font-semibold">Production</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={handleOpenDialog} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Order
            </Button>
          </div>
        </div>
      </header>

      <main>
        <ProductionOrderTable
          orders={orders}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {isViewMode ? 'View Production Order' : isEditing ? 'Edit Production Order' : 'New Production Order'}
            </DialogTitle>
            <DialogDescription>
              {isViewMode 
                ? 'View production order details' 
                : isEditing 
                  ? 'Update production order details' 
                  : 'Create a new production order for a product with components'}
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Number</Label>
                  <Input value={formData.order_number} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                    disabled={isViewMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(status => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product *</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={handleProductChange}
                  disabled={isViewMode || isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product with components" />
                  </SelectTrigger>
                  <SelectContent>
                    {productsWithComponents.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No products with components found
                      </SelectItem>
                    ) : (
                      productsWithComponents.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.product_id} - {product.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Production Location *</Label>
                <Select
                  value={formData.location_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value }))}
                  disabled={isViewMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a production-enabled location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No production-enabled locations found
                      </SelectItem>
                    ) : (
                      locations.map(location => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.location_id} - {location.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    disabled={isViewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              {components.length > 0 && (
                <div className="space-y-2">
                  <Label>Required Components</Label>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell className="font-medium">Component</TableCell>
                          <TableCell className="font-medium w-32">Per Unit</TableCell>
                          <TableCell className="font-medium w-32">Total Required</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {components.map(comp => (
                          <TableRow key={comp.id}>
                            <TableCell>
                              {comp.component?.product_id} - {comp.component?.name}
                            </TableCell>
                            <TableCell>{comp.quantity}</TableCell>
                            <TableCell className="font-medium">
                              {comp.quantity * formData.quantity}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  disabled={isViewMode}
                  rows={3}
                />
              </div>
            </div>

            {!isViewMode && (
              <DialogFooter className="shrink-0">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Production;