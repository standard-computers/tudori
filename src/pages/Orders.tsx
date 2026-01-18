import { useEffect, useState } from 'react';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { ArrowLeft, ShoppingCart, Plus, Eye, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  vendor_id: string | null;
  location_id: string | null;
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
  requisition?: { requisition_id: string } | null;
  tax_rate?: { name: string; rate: number } | null;
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
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // View dialog state
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [viewItems, setViewItems] = useState<PurchaseOrderItem[]>([]);
  
  // Create dialog form state
  const [formData, setFormData] = useState({
    vendor_id: '',
    location_id: '',
    tax_rate_id: '',
    notes: '',
  });
  const [orderItems, setOrderItems] = useState<{ product_id: string; quantity: number; unit_price: number }[]>([]);

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
      fetchVendors();
      fetchProducts();
      fetchTaxRates();
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
        location:locations(name),
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

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name, vendor_id')
      .eq('company_id', companyId)
      .order('name');
    setVendors(data || []);
  };

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
    
    // Set default tax rate in form
    const defaultRate = data?.find(r => r.is_default);
    if (defaultRate) {
      setFormData(prev => ({ ...prev, tax_rate_id: defaultRate.id }));
    }
  };

  const handleCreateClick = () => {
    const defaultRate = taxRates.find(r => r.is_default);
    setFormData({ vendor_id: '', location_id: '', tax_rate_id: defaultRate?.id || '', notes: '' });
    setOrderItems([]);
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

  const getSelectedTaxRate = () => {
    return taxRates.find(r => r.id === formData.tax_rate_id)?.rate || 0;
  };

  const calculateTax = () => {
    return calculateTotal() * (getSelectedTaxRate() / 100);
  };

  const calculateGrandTotal = () => {
    return calculateTotal() + calculateTax();
  };

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

    setIsSubmitting(true);

    try {
      // Get next PO number
      const { data: poNumber } = await supabase.rpc('get_next_po_number', {
        p_company_id: companyId,
      });

      const subtotal = calculateTotal();
      const taxRate = getSelectedTaxRate();
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      // Create purchase order
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          company_id: companyId,
          po_number: poNumber,
          status: 'draft',
          vendor_id: formData.vendor_id || null,
          location_id: formData.location_id || null,
          tax_rate_id: formData.tax_rate_id || null,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

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
    setIsViewDialogOpen(true);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('purchase_orders')
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

  // Filter products by selected vendor
  const filteredProducts = formData.vendor_id
    ? products.filter(p => p.vendor_id === formData.vendor_id)
    : products;

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
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
                          onClick={() => handleViewOrder(order)}
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
                              onClick={() => handleDeleteOrder(order.id)}
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
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor *</Label>
                <Select
                  value={formData.vendor_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, vendor_id: value });
                    // Clear items when vendor changes
                    setOrderItems([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Ship To Location</Label>
                <Select
                  value={formData.location_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, location_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No location</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax Rate</Label>
                <Select
                  value={formData.tax_rate_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, tax_rate_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tax rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No tax</SelectItem>
                    {taxRates.map((rate) => (
                      <SelectItem key={rate.id} value={rate.id}>
                        {rate.name} ({rate.rate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Order notes..."
                  rows={2}
                />
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-2">
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
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => updateOrderItem(index, 'product_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} (${p.price?.toFixed(2) || '0.00'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  
                  <div className="border-t pt-2 mt-4">
                    <div className="flex justify-end gap-8 text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono">${calculateTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end gap-8 text-sm">
                      <span className="text-muted-foreground">
                        Tax ({getSelectedTaxRate()}%):
                      </span>
                      <span className="font-mono">${calculateTax().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end gap-8 text-base font-semibold">
                      <span>Total:</span>
                      <span className="font-mono">${calculateGrandTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Order
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
              <div className="grid grid-cols-2 gap-4">
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
                  <Label className="text-muted-foreground">Order Date</Label>
                  <p className="mt-1">{new Date(viewOrder.order_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="mt-1">{viewOrder.vendor?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ship To</Label>
                  <p className="mt-1">{viewOrder.location?.name || '-'}</p>
                </div>
                {viewOrder.requisition && (
                  <div>
                    <Label className="text-muted-foreground">From Requisition</Label>
                    <p className="mt-1">{viewOrder.requisition.requisition_id}</p>
                  </div>
                )}
              </div>

              {viewOrder.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1 text-sm">{viewOrder.notes}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Items</Label>
                <div className="mt-2 rounded-lg border overflow-hidden">
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
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-end gap-8 text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono">${Number(viewOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-mono">${Number(viewOrder.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 text-base font-semibold">
                  <span>Total:</span>
                  <span className="font-mono">${Number(viewOrder.total_amount || 0).toFixed(2)}</span>
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

export default Orders;