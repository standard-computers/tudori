import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { ArrowLeft, Plus, Package, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  product_id: string;
  vendor_id: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  unit: string | null;
  vendors?: { name: string } | null;
}

interface Vendor {
  id: string;
  vendor_id: string;
  name: string;
}

const PRODUCT_CATEGORIES = ['Raw Materials', 'Components', 'Finished Goods', 'Packaging', 'Equipment', 'Supplies', 'Services'];
const PRODUCT_UNITS = ['each', 'box', 'case', 'pallet', 'kg', 'lb', 'liter', 'gallon', 'meter', 'foot'];

const Products = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextProductId, setNextProductId] = useState('0001');
  const [formData, setFormData] = useState({
    product_id: '',
    vendor_id: '',
    sku: '',
    name: '',
    description: '',
    category: '',
    price: '',
    unit: 'each',
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
      fetchProducts();
      fetchVendors();
      fetchNextProductId();
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

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*, vendors(name)')
      .eq('company_id', companyId!)
      .order('product_id');

    if (error) {
      toast.error('Failed to load products');
      return;
    }

    setProducts(data || []);
  };

  const fetchVendors = async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('id, vendor_id, name')
      .eq('company_id', companyId!)
      .order('name');

    if (error) {
      console.error('Failed to load vendors:', error);
      return;
    }

    setVendors(data || []);
  };

  const fetchNextProductId = async () => {
    const { data, error } = await supabase.rpc('get_next_product_id', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextProductId(data);
    }
  };

  const resetForm = () => {
    setFormData({
      product_id: nextProductId,
      vendor_id: '',
      sku: '',
      name: '',
      description: '',
      category: '',
      price: '',
      unit: 'each',
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, product_id: nextProductId }));
    setIsDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setFormData({
      product_id: product.product_id,
      vendor_id: product.vendor_id || '',
      sku: product.sku || '',
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      price: product.price?.toString() || '',
      unit: product.unit || 'each',
    });
    setIsEditing(true);
    setEditingId(product.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete product');
      return;
    }

    toast.success('Product deleted');
    fetchProducts();
    fetchNextProductId();
  };

  const isProductIdInUse = products.some(p => p.product_id === formData.product_id && (!isEditing || p.id !== editingId));
  const isSkuInUse = formData.sku && products.some(p => p.sku === formData.sku && (!isEditing || p.id !== editingId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && editingId) {
      const { error } = await supabase
        .from('products')
        .update({
          vendor_id: formData.vendor_id || null,
          sku: formData.sku || null,
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          price: formData.price ? parseFloat(formData.price) : null,
          unit: formData.unit || null,
        })
        .eq('id', editingId);

      if (error) {
        toast.error('Failed to update product');
        return;
      }

      toast.success('Product updated');
    } else {
      const { error } = await supabase
        .from('products')
        .insert({
          company_id: companyId!,
          product_id: formData.product_id,
          vendor_id: formData.vendor_id || null,
          sku: formData.sku || null,
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          price: formData.price ? parseFloat(formData.price) : null,
          unit: formData.unit || null,
        });

      if (error) {
        toast.error('Failed to create product');
        return;
      }

      toast.success('Product created');
    }

    setIsDialogOpen(false);
    fetchProducts();
    fetchNextProductId();
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
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-display font-bold text-foreground">Products</h1>
              </div>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Product' : 'Add Product'}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? 'Update product details.' : 'Add a new product to your catalog.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="product_id">Product ID</Label>
                        <Input
                          id="product_id"
                          value={formData.product_id}
                          onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                          disabled={isEditing}
                          className={`${isEditing ? 'bg-muted' : ''} ${!isEditing && isProductIdInUse ? 'border-destructive border-2' : ''}`}
                          required
                        />
                        {!isEditing && isProductIdInUse && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            This ID is already in use
                          </p>
                        )}
                        {!isEditing && !isProductIdInUse && formData.product_id && (
                          <p className="text-sm text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            ID cannot be changed after creation
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sku">SKU</Label>
                        <Input
                          id="sku"
                          value={formData.sku}
                          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                          placeholder="ABC-12345"
                          className={isSkuInUse ? 'border-destructive border-2' : ''}
                        />
                        {isSkuInUse && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            This SKU is already in use
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Widget Pro 3000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vendor_id">Vendor (Supplier)</Label>
                      <Select
                        value={formData.vendor_id || "none"}
                        onValueChange={(value) => setFormData({ ...formData, vendor_id: value === "none" ? "" : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vendor..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name} ({vendor.vendor_id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category..." />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit">Unit</Label>
                        <Select
                          value={formData.unit}
                          onValueChange={(value) => setFormData({ ...formData, unit: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Product description..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isProductIdInUse || !!isSkuInUse}
                    >
                      {isEditing ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first product to get started.
            </p>
            <Button onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm">{product.product_id}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku || '-'}</TableCell>
                    <TableCell>{product.category || '-'}</TableCell>
                    <TableCell>{product.vendors?.name || '-'}</TableCell>
                    <TableCell className="text-right">
                      {product.price ? `$${product.price.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

export default Products;
