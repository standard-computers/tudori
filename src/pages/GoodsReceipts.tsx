import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useVendorSources } from '@/hooks/use-vendor-sources';
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
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { ArrowLeft, Plus, PackagePlus, Pencil, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

const RECEIPT_STATUSES = ['pending', 'posted', 'cancelled'];

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
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextReceiptNumber, setNextReceiptNumber] = useState('GR-0001');
  const [activeTab, setActiveTab] = useState('details');
  const [receiptItems, setReceiptItems] = useState<GoodsReceiptItem[]>([]);
  const [newItemProductId, setNewItemProductId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);

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
        purchase_order:purchase_orders(po_number)
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
    // Get items for this receipt
    const { data: items } = await supabase
      .from('goods_receipt_items' as any)
      .select('*')
      .eq('goods_receipt_id', receiptId);

    if (!items || items.length === 0) {
      toast.error('Cannot post receipt with no items');
      return;
    }

    // Add each item to inventory
    for (const item of items as any[]) {
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('location_id', locationId)
        .eq('product_id', item.product_id)
        .is('bin_id', item.bin_id || null)
        .maybeSingle();

      if (existingInventory) {
        await supabase
          .from('inventory')
          .update({ 
            quantity: existingInventory.quantity + item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingInventory.id);
      } else {
        await supabase
          .from('inventory')
          .insert({
            location_id: locationId,
            product_id: item.product_id,
            quantity: item.quantity,
            bin_id: item.bin_id || null
          });
      }
    }

    // Update receipt status to posted
    await supabase
      .from('goods_receipts' as any)
      .update({ status: 'posted' })
      .eq('id', receiptId);

    toast.success('Receipt posted - inventory updated');
    fetchReceipts();
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

  const handleEdit = (receipt: GoodsReceipt) => {
    setFormData({
      receipt_number: receipt.receipt_number,
      location_id: receipt.location_id,
      vendor_id: receipt.vendor_id || '',
      receipt_date: receipt.receipt_date,
      status: receipt.status,
      notes: receipt.notes || '',
    });
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

    if (!formData.location_id) {
      toast.error('Please select a location');
      return;
    }

    const payload = {
      location_id: formData.location_id,
      vendor_id: formData.vendor_id || null,
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

      // Switch to editing mode to add items
      setEditingId((data as any).id);
      setIsEditing(true);
      setActiveTab('items');
      toast.success('Goods receipt created - add items');
      fetchReceipts();
      fetchNextReceiptNumber();
      return;
    }

    setIsDialogOpen(false);
    fetchReceipts();
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <PackagePlus className="w-7 h-7 text-emerald-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Goods Receipts</h1>
              </div>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Receipt
                  <Kbd>N</Kbd>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>{isEditing ? 'Edit Goods Receipt' : 'New Goods Receipt'}</DialogTitle>
                  <DialogDescription>
                    {isEditing ? 'Update the goods receipt details.' : 'Create a new goods receipt to add inventory.'}
                  </DialogDescription>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="items" disabled={!isEditing}>Items</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details">
                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 py-4">
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
                        <Label htmlFor="vendor_id">Vendor</Label>
                        <SearchableSelect
                          options={vendorOptions}
                          value={formData.vendor_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, vendor_id: value }))}
                          placeholder="Select vendor (optional)"
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-mono">{receipt.receipt_number}</TableCell>
                  <TableCell>{format(new Date(receipt.receipt_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell>{receipt.location?.name || '-'}</TableCell>
                  <TableCell>{receipt.vendor?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(receipt.status)}>
                      {receipt.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {receipt.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePostReceipt(receipt.id, receipt.location_id)}
                          title="Post to inventory"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(receipt)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(receipt.id)}
                        disabled={receipt.status === 'posted'}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {receipts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No goods receipts found. Create one to start receiving inventory.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default GoodsReceipts;
