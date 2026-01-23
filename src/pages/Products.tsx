import { useEffect, useState, useMemo, useRef } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useVendorSources } from '@/hooks/use-vendor-sources';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ArrowLeft, Plus, Package, Pencil, Trash2, AlertCircle, X, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
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
  is_batched: boolean;
  min_shelf_life_days: number | null;
  keep_inventory: boolean;
  vendors?: { name: string } | null;
}

interface ProductUom {
  id?: string;
  name: string;
  abbreviation: string;
  conversion_factor: string;
}

interface ProductComponent {
  id?: string;
  component_product_id: string;
  quantity: string;
  product?: {
    product_id: string;
    name: string;
    price: number | null;
    unit: string | null;
  };
}

interface Vendor {
  id: string;
  vendor_id: string;
  name: string;
}

const PRODUCT_CATEGORIES = ['Raw Materials', 'Components', 'Finished Goods', 'Packaging', 'Equipment', 'Supplies', 'Services'];
const PRODUCT_UNITS = ['each', 'box', 'case', 'pallet', 'kg', 'lb', 'liter', 'gallon', 'meter', 'foot', 'roll', 'bag', 'bundle', 'sheet'];

// Separated table component with sorting/filtering
const ProductTable = ({
  products,
  onEdit,
  onDelete,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(products, 'product_id', 'asc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {products.length} products
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
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                label="ID"
                sortKey="product_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['product_id']}
                onFilter={(value) => setFilter('product_id', value)}
                className="w-24"
              />
              <SortableTableHead
                label="Name"
                sortKey="name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['name']}
                onFilter={(value) => setFilter('name', value)}
              />
              <SortableTableHead
                label="SKU"
                sortKey="sku"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['sku']}
                onFilter={(value) => setFilter('sku', value)}
              />
              <SortableTableHead
                label="Category"
                sortKey="category"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['category']}
                onFilter={(value) => setFilter('category', value)}
              />
              <SortableTableHead
                label="Vendor"
                sortKey="vendors.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['vendors.name']}
                onFilter={(value) => setFilter('vendors.name', value)}
              />
              <SortableTableHead
                label="Price"
                sortKey="price"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['price']}
                onFilter={(value) => setFilter('price', value)}
                className="text-right"
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
                  No products match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((product) => (
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
                        onClick={() => onEdit(product)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(product.id)}
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
    </div>
  );
};

const Products = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const formRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextProductId, setNextProductId] = useState('0001');
  const [activeTab, setActiveTab] = useState('general');
  const [uoms, setUoms] = useState<ProductUom[]>([]);
  const [newUom, setNewUom] = useState<ProductUom>({ name: '', abbreviation: '', conversion_factor: '1' });
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [newComponent, setNewComponent] = useState<{ product_id: string; quantity: string }>({ product_id: '', quantity: '1' });
  const [availableComponents, setAvailableComponents] = useState<SearchableSelectOption[]>([]);
  const [formData, setFormData] = useState({
    product_id: '',
    vendor_id: '',
    sku: '',
    name: '',
    description: '',
    category: '',
    price: '',
    unit: 'each',
    is_batched: false,
    min_shelf_life_days: '',
    keep_inventory: true,
  });

  // Use vendor sources hook
  const { plainVendorOptions } = useVendorSources(companyId);

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? 'prod/edit' : 'prod/new');
    } else {
      setTransaction('prod');
    }
  }, [isDialogOpen, isEditing, setTransaction]);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

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

  // fetchVendors removed - using useVendorSources hook instead

  const fetchNextProductId = async () => {
    const { data, error } = await supabase.rpc('get_next_product_id', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextProductId(data);
    }
  };

  const fetchProductUoms = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_uoms')
      .select('*')
      .eq('product_id', productId)
      .order('name');

    if (error) {
      console.error('Failed to load UOMs:', error);
      return;
    }

    setUoms(data?.map(u => ({
      id: u.id,
      name: u.name,
      abbreviation: u.abbreviation || '',
      conversion_factor: u.conversion_factor?.toString() || '1',
    })) || []);
  };

  const fetchProductComponents = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_components')
      .select('id, component_product_id, quantity, component_product:products!product_components_component_product_id_fkey(product_id, name, price, unit)')
      .eq('parent_product_id', productId);

    if (error) {
      console.error('Failed to load components:', error);
      return;
    }

    setComponents(data?.map(c => ({
      id: c.id,
      component_product_id: c.component_product_id,
      quantity: c.quantity?.toString() || '1',
      product: c.component_product as ProductComponent['product'],
    })) || []);
  };

  const fetchAvailableComponents = async (excludeProductId?: string) => {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_id, name')
      .eq('company_id', companyId!)
      .neq('category', 'Finished Goods')
      .order('name');

    if (error) {
      console.error('Failed to load available components:', error);
      return;
    }

    const options = data
      ?.filter(p => p.id !== excludeProductId)
      .map(p => ({
        value: p.id,
        label: p.name,
        sublabel: p.product_id,
      })) || [];
    
    setAvailableComponents(options);
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
      is_batched: false,
      min_shelf_life_days: '',
      keep_inventory: true,
    });
    setUoms([]);
    setNewUom({ name: '', abbreviation: '', conversion_factor: '1' });
    setComponents([]);
    setNewComponent({ product_id: '', quantity: '1' });
    setActiveTab('general');
    setIsEditing(false);
    setEditingId(null);
  };

  const handleOpenDialog = async () => {
    resetForm();
    setFormData(prev => ({ ...prev, product_id: nextProductId }));
    await fetchAvailableComponents();
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new product
  useKeyboardShortcut('n', handleOpenDialog);

  const handleEdit = async (product: Product) => {
    setFormData({
      product_id: product.product_id,
      vendor_id: product.vendor_id || '',
      sku: product.sku || '',
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      price: product.price?.toString() || '',
      unit: product.unit || 'each',
      is_batched: product.is_batched || false,
      min_shelf_life_days: product.min_shelf_life_days?.toString() || '',
      keep_inventory: product.keep_inventory ?? true,
    });
    setIsEditing(true);
    setEditingId(product.id);
    setActiveTab('general');
    await Promise.all([
      fetchProductUoms(product.id),
      fetchProductComponents(product.id),
      fetchAvailableComponents(product.id),
    ]);
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

  const handleAddUom = () => {
    if (!newUom.name.trim()) {
      toast.error('UOM name is required');
      return;
    }
    if (uoms.some(u => u.name.toLowerCase() === newUom.name.toLowerCase())) {
      toast.error('This UOM already exists');
      return;
    }
    setUoms([...uoms, { ...newUom }]);
    setNewUom({ name: '', abbreviation: '', conversion_factor: '1' });
  };

  const handleRemoveUom = (index: number) => {
    setUoms(uoms.filter((_, i) => i !== index));
  };

  const handleAddComponent = async () => {
    if (!newComponent.product_id) {
      toast.error('Please select a component product');
      return;
    }
    if (components.some(c => c.component_product_id === newComponent.product_id)) {
      toast.error('This component is already added');
      return;
    }

    // Fetch the product details
    const { data: productData } = await supabase
      .from('products')
      .select('product_id, name, price, unit')
      .eq('id', newComponent.product_id)
      .single();

    if (productData) {
      setComponents([...components, {
        component_product_id: newComponent.product_id,
        quantity: newComponent.quantity || '1',
        product: productData,
      }]);
    }
    setNewComponent({ product_id: '', quantity: '1' });
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleAdoptPrice = () => {
    const total = components.reduce((sum, comp) => {
      const qty = parseFloat(comp.quantity) || 0;
      const price = comp.product?.price || 0;
      return sum + (qty * price);
    }, 0);
    setFormData(prev => ({ ...prev, price: total.toFixed(2) }));
    toast.success(`Price updated to $${total.toFixed(2)}`);
  };

  const calculateComponentsTotal = () => {
    return components.reduce((sum, comp) => {
      const qty = parseFloat(comp.quantity) || 0;
      const price = comp.product?.price || 0;
      return sum + (qty * price);
    }, 0);
  };

  const isProductIdInUse = products.some(p => p.product_id === formData.product_id && (!isEditing || p.id !== editingId));
  const isSkuInUse = formData.sku && products.some(p => p.sku === formData.sku && (!isEditing || p.id !== editingId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let productId = editingId;

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
          is_batched: formData.is_batched,
          min_shelf_life_days: formData.is_batched && formData.min_shelf_life_days ? parseInt(formData.min_shelf_life_days) : null,
          keep_inventory: formData.keep_inventory,
        })
        .eq('id', editingId);

      if (error) {
        toast.error('Failed to update product');
        return;
      }
    } else {
      const { data, error } = await supabase
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
          is_batched: formData.is_batched,
          min_shelf_life_days: formData.is_batched && formData.min_shelf_life_days ? parseInt(formData.min_shelf_life_days) : null,
          keep_inventory: formData.keep_inventory,
        })
        .select('id')
        .single();

      if (error || !data) {
        toast.error('Failed to create product');
        return;
      }

      productId = data.id;
    }

    // Save UOMs
    if (productId) {
      // Delete existing UOMs and re-insert
      await supabase.from('product_uoms').delete().eq('product_id', productId);
      
      if (uoms.length > 0) {
        const uomInserts = uoms.map(u => ({
          product_id: productId,
          name: u.name,
          abbreviation: u.abbreviation || null,
          conversion_factor: parseFloat(u.conversion_factor) || 1,
        }));

        const { error: uomError } = await supabase
          .from('product_uoms')
          .insert(uomInserts);

        if (uomError) {
          console.error('Failed to save UOMs:', uomError);
          toast.error('Product saved but failed to save some UOMs');
        }
      }

      // Save Components (only for Finished Goods)
      if (formData.category === 'Finished Goods') {
        await supabase.from('product_components').delete().eq('parent_product_id', productId);
        
        if (components.length > 0) {
          const componentInserts = components.map(c => ({
            parent_product_id: productId,
            component_product_id: c.component_product_id,
            quantity: parseFloat(c.quantity) || 1,
          }));

          const { error: compError } = await supabase
            .from('product_components')
            .insert(componentInserts);

          if (compError) {
            console.error('Failed to save components:', compError);
            toast.error('Product saved but failed to save some components');
          }
        }
      }
    }

    toast.success(isEditing ? 'Product updated' : 'Product created');
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
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Package className="w-7 h-7 text-amber-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Products</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ImportExportButtons
                importEnabled={isImportEnabled('product')}
                exportEnabled={isExportEnabled('product')}
                entityName="Products"
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                    <Kbd>N</Kbd>
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                {!isEditing && (
                  <CopyFromIdDialog<Product>
                    idLabel="Product ID"
                    onFetch={async (id) => {
                      const { data } = await supabase
                        .from('products')
                        .select('*, vendors(name)')
                        .eq('company_id', companyId!)
                        .eq('product_id', id)
                        .maybeSingle();
                      return data;
                    }}
                    onApply={async (product) => {
                      setFormData(prev => ({
                        ...prev,
                        vendor_id: product.vendor_id || '',
                        sku: '', // Don't copy SKU as it should be unique
                        name: product.name,
                        description: product.description || '',
                        category: product.category || '',
                        price: product.price?.toString() || '',
                        unit: product.unit || 'each',
                        is_batched: product.is_batched || false,
                        min_shelf_life_days: product.min_shelf_life_days?.toString() || '',
                        keep_inventory: product.keep_inventory ?? true,
                      }));
                      
                      // Also copy components if this is a Finished Goods product
                      if (product.category === 'Finished Goods') {
                        const { data: componentData } = await supabase
                          .from('product_components')
                          .select('component_product_id, quantity, component_product:products!product_components_component_product_id_fkey(product_id, name, price, unit)')
                          .eq('parent_product_id', product.id);
                        
                        if (componentData && componentData.length > 0) {
                          setComponents(componentData.map(c => ({
                            component_product_id: c.component_product_id,
                            quantity: c.quantity?.toString() || '1',
                            product: c.component_product as ProductComponent['product'],
                          })));
                          toast.success(`Copied ${componentData.length} component(s)`);
                        }
                      }
                    }}
                  />
                )}
                <form ref={formRef} onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Product' : 'Add Product'}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? 'Update product details.' : 'Add a new product to your catalog.'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                    <TabsList className={`grid w-full ${formData.category === 'Finished Goods' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      <TabsTrigger value="general">General</TabsTrigger>
                      <TabsTrigger value="uom">Units of Measure</TabsTrigger>
                      {formData.category === 'Finished Goods' && (
                        <TabsTrigger value="components">Components</TabsTrigger>
                      )}
                      <TabsTrigger value="controls">Controls</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="general" className="space-y-4 mt-4">
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
                        <SearchableSelect
                          options={plainVendorOptions}
                          value={formData.vendor_id}
                          onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                          placeholder="Select a vendor..."
                          allowClear
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="category">Category</Label>
                          <Select
                            value={formData.category || "none"}
                            onValueChange={(value) => setFormData({ ...formData, category: value === "none" ? "" : value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {PRODUCT_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unit">Base Unit of Measure</Label>
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
                        <Label htmlFor="price">Price (per {formData.unit})</Label>
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
                    </TabsContent>
                    
                    <TabsContent value="uom" className="space-y-4 mt-4">
                      <div className="bg-muted/50 rounded-lg p-4 mb-4">
                        <p className="text-sm text-muted-foreground">
                          <strong>Base Unit:</strong> {formData.unit}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Add additional units of measure and specify how many base units ({formData.unit}) are in each.
                        </p>
                      </div>
                      
                      {uoms.length > 0 && (
                        <div className="border rounded-lg overflow-hidden mb-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Abbrev.</TableHead>
                                <TableHead>Conversion</TableHead>
                                <TableHead className="w-16"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {uoms.map((uom, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{uom.name}</TableCell>
                                  <TableCell>{uom.abbreviation || '-'}</TableCell>
                                  <TableCell>
                                    1 {uom.name} = {uom.conversion_factor} {formData.unit}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveUom(index)}
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      
                      <div className="border rounded-lg p-4 space-y-4">
                        <h4 className="font-medium text-sm">Add Unit of Measure</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="uom_name" className="text-xs">Name *</Label>
                            <Input
                              id="uom_name"
                              value={newUom.name}
                              onChange={(e) => setNewUom({ ...newUom, name: e.target.value })}
                              placeholder="e.g., Pallet"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="uom_abbrev" className="text-xs">Abbreviation</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between font-normal"
                                >
                                  {newUom.abbreviation || "Select..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[200px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search UOM..." />
                                  <CommandList>
                                    <CommandEmpty>No UOM found.</CommandEmpty>
                                    <CommandGroup>
                                      {[
                                        { value: 'EA', label: 'EA - Each' },
                                        { value: 'PC', label: 'PC - Piece' },
                                        { value: 'CS', label: 'CS - Case' },
                                        { value: 'CTN', label: 'CTN - Carton' },
                                        { value: 'BX', label: 'BX - Box' },
                                        { value: 'PK', label: 'PK - Pack' },
                                        { value: 'PLA', label: 'PLA - Pallet' },
                                        { value: 'DZ', label: 'DZ - Dozen' },
                                        { value: 'KG', label: 'KG - Kilogram' },
                                        { value: 'LB', label: 'LB - Pound' },
                                        { value: 'OZ', label: 'OZ - Ounce' },
                                        { value: 'G', label: 'G - Gram' },
                                        { value: 'L', label: 'L - Liter' },
                                        { value: 'ML', label: 'ML - Milliliter' },
                                        { value: 'GAL', label: 'GAL - Gallon' },
                                        { value: 'QT', label: 'QT - Quart' },
                                        { value: 'FT', label: 'FT - Foot' },
                                        { value: 'IN', label: 'IN - Inch' },
                                        { value: 'M', label: 'M - Meter' },
                                        { value: 'CM', label: 'CM - Centimeter' },
                                        { value: 'RL', label: 'RL - Roll' },
                                        { value: 'SET', label: 'SET - Set' },
                                        { value: 'BAG', label: 'BAG - Bag' },
                                        { value: 'BTL', label: 'BTL - Bottle' },
                                        { value: 'CAN', label: 'CAN - Can' },
                                        { value: 'JAR', label: 'JAR - Jar' },
                                        { value: 'TUB', label: 'TUB - Tub' },
                                        { value: 'BDL', label: 'BDL - Bundle' },
                                        { value: 'PR', label: 'PR - Pair' },
                                      ].map((uom) => (
                                        <CommandItem
                                          key={uom.value}
                                          value={uom.label}
                                          onSelect={() => setNewUom({ ...newUom, abbreviation: uom.value })}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              newUom.abbreviation === uom.value ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {uom.label}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="uom_factor" className="text-xs">Base units per UOM *</Label>
                            <Input
                              id="uom_factor"
                              type="number"
                              step="0.0001"
                              min="0.0001"
                              value={newUom.conversion_factor}
                              onChange={(e) => setNewUom({ ...newUom, conversion_factor: e.target.value })}
                              placeholder="e.g., 48"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {newUom.name && newUom.conversion_factor ? (
                            <>1 {newUom.name} = {newUom.conversion_factor} {formData.unit}</>
                          ) : (
                            <>Example: 1 Pallet = 48 each</>
                          )}
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddUom}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add UOM
                        </Button>
                      </div>
                    </TabsContent>
                    
                    {formData.category === 'Finished Goods' && (
                      <TabsContent value="components" className="space-y-4 mt-4">
                        <div className="bg-muted/50 rounded-lg p-4 mb-4">
                          <p className="text-sm text-muted-foreground">
                            Add component products that make up this finished good.
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Use "Adopt Price" to calculate the total cost based on component quantities and prices.
                          </p>
                        </div>
                        
                        {components.length > 0 && (
                          <div className="border rounded-lg overflow-hidden mb-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product ID</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Unit Price</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="w-16"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {components.map((comp, index) => {
                                  const qty = parseFloat(comp.quantity) || 0;
                                  const price = comp.product?.price || 0;
                                  const lineTotal = qty * price;
                                  return (
                                    <TableRow key={index}>
                                      <TableCell className="font-mono text-sm">{comp.product?.product_id || '-'}</TableCell>
                                      <TableCell className="font-medium">{comp.product?.name || '-'}</TableCell>
                                      <TableCell className="text-right">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0.01"
                                          value={comp.quantity}
                                          onChange={(e) => {
                                            const updated = [...components];
                                            updated[index] = { ...updated[index], quantity: e.target.value };
                                            setComponents(updated);
                                          }}
                                          className="w-20 text-right ml-auto"
                                        />
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {price ? `$${price.toFixed(2)}` : '-'}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        ${lineTotal.toFixed(2)}
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleRemoveComponent(index)}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                <TableRow className="bg-muted/50">
                                  <TableCell colSpan={4} className="text-right font-medium">
                                    Total:
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    ${calculateComponentsTotal().toFixed(2)}
                                  </TableCell>
                                  <TableCell></TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        
                        <div className="border rounded-lg p-4 space-y-4">
                          <h4 className="font-medium text-sm">Add Component</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="component_product" className="text-xs">Product *</Label>
                              <SearchableSelect
                                options={availableComponents.filter(
                                  opt => !components.some(c => c.component_product_id === opt.value)
                                )}
                                value={newComponent.product_id}
                                onValueChange={(value) => setNewComponent({ ...newComponent, product_id: value })}
                                placeholder="Select component product..."
                                allowClear
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="component_qty" className="text-xs">Quantity *</Label>
                              <Input
                                id="component_qty"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={newComponent.quantity}
                                onChange={(e) => setNewComponent({ ...newComponent, quantity: e.target.value })}
                                placeholder="e.g., 2"
                              />
                            </div>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={handleAddComponent}>
                            <Plus className="w-4 h-4 mr-1" />
                            Add Component
                          </Button>
                        </div>
                        
                        {components.length > 0 && (
                          <div className="flex justify-end">
                            <Button type="button" variant="secondary" onClick={handleAdoptPrice}>
                              Adopt Price (${calculateComponentsTotal().toFixed(2)})
                            </Button>
                          </div>
                        )}
                      </TabsContent>
                    )}
                    
                    <TabsContent value="controls" className="space-y-4 mt-4">
                      <div className="bg-muted/50 rounded-lg p-4 mb-4">
                        <p className="text-sm text-muted-foreground">
                          Configure batch management and shelf life tracking for this product.
                        </p>
                      </div>
                      
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="keep_inventory" className="text-base">Keep Inventory</Label>
                            <p className="text-sm text-muted-foreground">
                              Track this product in inventory when received
                            </p>
                          </div>
                          <Switch
                            id="keep_inventory"
                            checked={formData.keep_inventory}
                            onCheckedChange={(checked) => setFormData({ ...formData, keep_inventory: checked })}
                          />
                        </div>
                        
                        {!formData.keep_inventory && (
                          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                            When disabled, receiving this product will not create a Goods Receipt or add to inventory. The delivery/PO will simply be marked as delivered.
                          </p>
                        )}
                      </div>
                      
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="is_batched" className="text-base">Batched</Label>
                            <p className="text-sm text-muted-foreground">
                              Enable batch tracking for this product
                            </p>
                          </div>
                          <Switch
                            id="is_batched"
                            checked={formData.is_batched}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_batched: checked })}
                          />
                        </div>
                        
                        {formData.is_batched && (
                          <div className="pt-4 border-t space-y-2">
                            <Label htmlFor="min_shelf_life_days">Minimum Shelf Life (days)</Label>
                            <Input
                              id="min_shelf_life_days"
                              type="number"
                              min="0"
                              step="1"
                              value={formData.min_shelf_life_days}
                              onChange={(e) => setFormData({ ...formData, min_shelf_life_days: e.target.value })}
                              placeholder="e.g., 30"
                              className="w-40"
                            />
                            <p className="text-xs text-muted-foreground">
                              The minimum number of days of remaining shelf life required for this product.
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isProductIdInUse || !!isSkuInUse}
                    >
                      {isEditing ? 'Update' : 'Create'}
                      <Kbd className="ml-2">⌘S</Kbd>
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        </div>
      </header>

      <main className="flex-1">
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
          <ProductTable
            products={products}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
};

export default Products;
