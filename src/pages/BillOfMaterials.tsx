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
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { ArrowLeft, Plus, Eye, MoreHorizontal, Pencil, Trash2, X, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface BillOfMaterial {
  id: string;
  bom_id: string;
  name: string;
  product_id: string;
  output_quantity: number;
  status: string;
  notes: string | null;
  created_at: string;
  product?: { name: string; product_id: string };
}

interface BomItem {
  id?: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  product?: { name: string; product_id: string; unit: string | null };
}

interface Product {
  id: string;
  product_id: string;
  name: string;
  unit: string | null;
}

const STATUSES = ['active', 'inactive'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const BomTable = ({
  boms,
  onView,
  onEdit,
  onDelete,
}: {
  boms: BillOfMaterial[];
  onView: (bom: BillOfMaterial) => void;
  onEdit: (bom: BillOfMaterial) => void;
  onDelete: (id: string) => void;
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(boms, 'bom_id', 'asc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {boms.length} BOMs
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
                label="BoM ID"
                sortKey="bom_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['bom_id']}
                onFilter={(value) => setFilter('bom_id', value)}
                className="w-32"
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
                label="Output Product"
                sortKey="product.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['product.name']}
                onFilter={(value) => setFilter('product.name', value)}
              />
              <SortableTableHead
                label="Output Qty"
                sortKey="output_quantity"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['output_quantity']}
                onFilter={(value) => setFilter('output_quantity', value)}
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
                className="w-24"
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
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No bills of materials found
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((bom) => (
                <TableRow key={bom.id} className="whitespace-nowrap">
                  <TableCell className="font-mono text-sm">{bom.bom_id}</TableCell>
                  <TableCell className="font-medium">{bom.name}</TableCell>
                  <TableCell>{bom.product?.product_id} - {bom.product?.name}</TableCell>
                  <TableCell>{bom.output_quantity}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(bom.status)}>
                      {bom.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onView(bom)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(bom)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onDelete(bom.id)}
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

const BillOfMaterials = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const formRef = useRef<HTMLFormElement>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [boms, setBoms] = useState<BillOfMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [newItem, setNewItem] = useState<{ product_id: string; quantity: string }>({ product_id: '', quantity: '1' });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextBomId, setNextBomId] = useState('BOM-0001');

  const [formData, setFormData] = useState({
    bom_id: '',
    name: '',
    product_id: '',
    output_quantity: 1,
    status: 'active',
    notes: '',
  });

  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isViewMode ? 'bom/view' : isEditing ? 'bom/edit' : 'bom/new');
    } else {
      setTransaction('bom');
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
      fetchBoms();
      fetchProducts();
      fetchNextBomId();
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

  const fetchBoms = async () => {
    const { data, error } = await supabase
      .from('bill_of_materials')
      .select(`
        *,
        product:products(name, product_id)
      `)
      .eq('company_id', companyId!)
      .order('bom_id', { ascending: true });

    if (error) {
      toast.error('Failed to load bills of materials');
      return;
    }
    setBoms(data || []);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_id, name, unit')
      .eq('company_id', companyId!)
      .eq('status', 'active')
      .order('name');

    if (!error && data) {
      setProducts(data);
    }
  };

  const fetchNextBomId = async () => {
    const { data, error } = await supabase.rpc('get_next_bom_id', {
      p_company_id: companyId!,
    });
    if (!error && data) {
      setNextBomId(data);
    }
  };

  const fetchBomItems = async (bomId: string) => {
    const { data, error } = await supabase
      .from('bom_items')
      .select(`
        id,
        product_id,
        quantity,
        notes,
        product:products(product_id, name, unit)
      `)
      .eq('bom_id', bomId);

    if (!error && data) {
      setBomItems(data as unknown as BomItem[]);
    } else {
      setBomItems([]);
    }
  };

  const resetForm = () => {
    setFormData({
      bom_id: nextBomId,
      name: '',
      product_id: '',
      output_quantity: 1,
      status: 'active',
      notes: '',
    });
    setIsEditing(false);
    setIsViewMode(false);
    setEditingId(null);
    setBomItems([]);
    setNewItem({ product_id: '', quantity: '1' });
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, bom_id: nextBomId }));
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', handleOpenDialog);

  const handleView = async (bom: BillOfMaterial) => {
    setFormData({
      bom_id: bom.bom_id,
      name: bom.name,
      product_id: bom.product_id,
      output_quantity: bom.output_quantity,
      status: bom.status,
      notes: bom.notes || '',
    });
    setIsViewMode(true);
    setIsEditing(false);
    setEditingId(bom.id);
    await fetchBomItems(bom.id);
    setIsDialogOpen(true);
  };

  const handleEdit = async (bom: BillOfMaterial) => {
    setFormData({
      bom_id: bom.bom_id,
      name: bom.name,
      product_id: bom.product_id,
      output_quantity: bom.output_quantity,
      status: bom.status,
      notes: bom.notes || '',
    });
    setIsViewMode(false);
    setIsEditing(true);
    setEditingId(bom.id);
    await fetchBomItems(bom.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('bill_of_materials')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete bill of materials');
      return;
    }
    toast.success('Bill of materials deleted');
    fetchBoms();
  };

  const handleAddItem = () => {
    if (!newItem.product_id || !newItem.quantity) return;
    
    const product = products.find(p => p.id === newItem.product_id);
    if (!product) return;

    // Check if already added
    if (bomItems.some(item => item.product_id === newItem.product_id)) {
      toast.error('This component is already added');
      return;
    }

    setBomItems([...bomItems, {
      product_id: newItem.product_id,
      quantity: parseFloat(newItem.quantity) || 1,
      notes: null,
      product: {
        product_id: product.product_id,
        name: product.name,
        unit: product.unit,
      },
    }]);
    setNewItem({ product_id: '', quantity: '1' });
  };

  const handleRemoveItem = (productId: string) => {
    setBomItems(bomItems.filter(item => item.product_id !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (!formData.product_id) {
      toast.error('Please select an output product');
      return;
    }
    if (bomItems.length === 0) {
      toast.error('Please add at least one component');
      return;
    }

    try {
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('bill_of_materials')
          .update({
            name: formData.name,
            product_id: formData.product_id,
            output_quantity: formData.output_quantity,
            status: formData.status,
            notes: formData.notes || null,
          })
          .eq('id', editingId);

        if (error) throw error;

        // Delete existing items and re-insert
        await supabase
          .from('bom_items')
          .delete()
          .eq('bom_id', editingId);

        const itemsToInsert = bomItems.map(item => ({
          bom_id: editingId,
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes,
        }));

        const { error: itemsError } = await supabase
          .from('bom_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast.success('Bill of materials updated');
      } else {
        const { data, error } = await supabase
          .from('bill_of_materials')
          .insert({
            company_id: companyId!,
            bom_id: formData.bom_id,
            name: formData.name,
            product_id: formData.product_id,
            output_quantity: formData.output_quantity,
            status: formData.status,
            notes: formData.notes || null,
          })
          .select('id')
          .single();

        if (error) throw error;

        const itemsToInsert = bomItems.map(item => ({
          bom_id: data.id,
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes,
        }));

        const { error: itemsError } = await supabase
          .from('bom_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast.success('Bill of materials created');
      }

      setIsDialogOpen(false);
      fetchBoms();
      fetchNextBomId();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save bill of materials');
    }
  };

  // Component options for searchable select
  const componentOptions: SearchableSelectOption[] = products
    .filter(p => p.id !== formData.product_id) // Exclude output product
    .map(p => ({
      value: p.id,
      label: `${p.product_id} - ${p.name}`,
    }));

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
            <ClipboardList className="w-5 h-5 text-amber-500" />
            <h1 className="font-semibold">Bill of Materials</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={handleOpenDialog} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New BoM
            </Button>
          </div>
        </div>
      </header>

      <main>
        <BomTable
          boms={boms}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {isViewMode ? 'View Bill of Materials' : isEditing ? 'Edit Bill of Materials' : 'New Bill of Materials'}
            </DialogTitle>
            <DialogDescription>
              {isViewMode 
                ? 'View BoM details' 
                : isEditing 
                  ? 'Update BoM details' 
                  : 'Define the components needed to produce a product'}
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>BoM ID</Label>
                  <Input value={formData.bom_id} disabled className="bg-muted" />
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
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Standard Widget Assembly"
                  disabled={isViewMode}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Output Product *</Label>
                  <Select
                    value={formData.product_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, product_id: value }))}
                    disabled={isViewMode || isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select output product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.product_id} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Output Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.output_quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, output_quantity: parseInt(e.target.value) || 1 }))}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Components</Label>
                {!isViewMode && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        options={componentOptions}
                        value={newItem.product_id}
                        onValueChange={(value) => setNewItem(prev => ({ ...prev, product_id: value }))}
                        placeholder="Select component product"
                      />
                    </div>
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                      className="w-24"
                      placeholder="Qty"
                    />
                    <Button type="button" variant="outline" onClick={handleAddItem}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell className="font-medium">Component</TableCell>
                        <TableCell className="font-medium w-24">Quantity</TableCell>
                        <TableCell className="font-medium w-24">Unit</TableCell>
                        {!isViewMode && <TableCell className="font-medium w-16" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bomItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isViewMode ? 3 : 4} className="text-center py-4 text-muted-foreground">
                            No components added
                          </TableCell>
                        </TableRow>
                      ) : (
                        bomItems.map(item => (
                          <TableRow key={item.product_id}>
                            <TableCell>
                              {item.product?.product_id} - {item.product?.name}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.product?.unit || '-'}</TableCell>
                            {!isViewMode && (
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.product_id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

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

export default BillOfMaterials;
