import { useEffect, useState, useRef } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { ColumnToggle } from '@/components/ColumnToggle';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import { ArrowLeft, Plus, Eye, MoreHorizontal, Pencil, Trash2, X, ClipboardList, GripVertical, Copy } from 'lucide-react';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
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

interface BomStep {
  id?: string;
  step_number: number;
  name: string;
  description: string | null;
  location_id: string | null;
  bin_id: string | null;
  estimated_duration_minutes: number | null;
  location?: { name: string };
  bin?: { name: string; bin_id: string };
}

interface Product {
  id: string;
  product_id: string;
  name: string;
  unit: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface Bin {
  id: string;
  bin_id: string;
  name: string;
  area_id: string;
  is_production_enabled?: boolean;
  area?: { location_id: string };
}

const STATUSES = ['active', 'inactive'];

// Column definitions for Bill of Materials table
const BOM_COLUMNS: ColumnDefinition[] = [
  { key: 'bom_id', label: 'BoM ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'product', label: 'Output Product', defaultVisible: true },
  { key: 'output_quantity', label: 'Output Qty', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

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
  isColumnVisible,
}: {
  boms: BillOfMaterial[];
  onView: (bom: BillOfMaterial) => void;
  onEdit: (bom: BillOfMaterial) => void;
  onDelete: (id: string) => void;
  isColumnVisible: (key: string) => boolean;
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
              {isColumnVisible('bom_id') && (
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
              )}
              {isColumnVisible('name') && (
                <SortableTableHead
                  label="Name"
                  sortKey="name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['name']}
                  onFilter={(value) => setFilter('name', value)}
                />
              )}
              {isColumnVisible('product') && (
                <SortableTableHead
                  label="Output Product"
                  sortKey="product.name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['product.name']}
                  onFilter={(value) => setFilter('product.name', value)}
                />
              )}
              {isColumnVisible('output_quantity') && (
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
              )}
              {isColumnVisible('status') && (
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
              )}
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
                <TableCell colSpan={BOM_COLUMNS.filter(c => isColumnVisible(c.key)).length} className="text-center py-8 text-muted-foreground">
                  No bills of materials found
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((bom) => (
                <TableRow key={bom.id} className="whitespace-nowrap">
                  {isColumnVisible('bom_id') && <TableCell className="font-mono text-sm">{bom.bom_id}</TableCell>}
                  {isColumnVisible('name') && <TableCell className="font-medium">{bom.name}</TableCell>}
                  {isColumnVisible('product') && <TableCell>{bom.product?.product_id} - {bom.product?.name}</TableCell>}
                  {isColumnVisible('output_quantity') && <TableCell>{bom.output_quantity}</TableCell>}
                  {isColumnVisible('status') && (
                    <TableCell>
                      <Badge className={getStatusColor(bom.status)}>
                        {bom.status}
                      </Badge>
                    </TableCell>
                  )}
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
  
  const { visibleColumns, isColumnVisible, toggleColumn, toggleableColumns, resetToDefaults, showAll, hideAll } = useColumnVisibility('bom', BOM_COLUMNS);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [boms, setBoms] = useState<BillOfMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [bomSteps, setBomSteps] = useState<BomStep[]>([]);
  const [newItem, setNewItem] = useState<{ product_id: string; quantity: string }>({ product_id: '', quantity: '1' });
  const [newStep, setNewStep] = useState<{ name: string; description: string; location_id: string; bin_id: string; duration: string }>({
    name: '',
    description: '',
    location_id: '',
    bin_id: '',
    duration: '',
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextBomId, setNextBomId] = useState('BOM-0001');
  const [activeTab, setActiveTab] = useState('details');

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
      fetchLocations();
      fetchAllBins();
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

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, name')
      .eq('company_id', companyId!)
      .order('name');

    if (!error && data) {
      setLocations(data);
    }
  };

  const fetchAllBins = async () => {
    const { data, error } = await supabase
      .from('bins')
      .select(`
        id,
        bin_id,
        name,
        area_id,
        is_production_enabled,
        area:areas(location_id)
      `)
      .order('bin_id');

    if (!error && data) {
      setAllBins(data as unknown as Bin[]);
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

  const fetchBomSteps = async (bomId: string) => {
    const { data, error } = await supabase
      .from('bom_steps')
      .select(`
        id,
        step_number,
        name,
        description,
        location_id,
        bin_id,
        estimated_duration_minutes,
        location:locations(name),
        bin:bins(name, bin_id)
      `)
      .eq('bom_id', bomId)
      .order('step_number');

    if (!error && data) {
      setBomSteps(data as unknown as BomStep[]);
    } else {
      setBomSteps([]);
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
    setBomSteps([]);
    setNewItem({ product_id: '', quantity: '1' });
    setNewStep({ name: '', description: '', location_id: '', bin_id: '', duration: '' });
    setActiveTab('details');
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
    await Promise.all([fetchBomItems(bom.id), fetchBomSteps(bom.id)]);
    setActiveTab('details');
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
    await Promise.all([fetchBomItems(bom.id), fetchBomSteps(bom.id)]);
    setActiveTab('details');
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

  const handleAddStep = () => {
    if (!newStep.name.trim()) {
      toast.error('Please enter a step name');
      return;
    }

    // Validate bin has production enabled if selected
    if (newStep.bin_id) {
      const selectedBin = allBins.find(b => b.id === newStep.bin_id);
      if (selectedBin && !selectedBin.is_production_enabled) {
        toast.error('Selected bin does not have production enabled');
        return;
      }
    }

    const nextStepNumber = bomSteps.length > 0 
      ? Math.max(...bomSteps.map(s => s.step_number)) + 1 
      : 1;

    const location = locations.find(l => l.id === newStep.location_id);
    const bin = allBins.find(b => b.id === newStep.bin_id);

    setBomSteps([...bomSteps, {
      step_number: nextStepNumber,
      name: newStep.name,
      description: newStep.description || null,
      location_id: newStep.location_id || null,
      bin_id: newStep.bin_id || null,
      estimated_duration_minutes: newStep.duration ? parseInt(newStep.duration) : null,
      location: location ? { name: location.name } : undefined,
      bin: bin ? { name: bin.name, bin_id: bin.bin_id } : undefined,
    }]);
    setNewStep({ name: '', description: '', location_id: '', bin_id: '', duration: '' });
  };

  const handleRemoveStep = (stepNumber: number) => {
    const updatedSteps = bomSteps
      .filter(step => step.step_number !== stepNumber)
      .map((step, index) => ({ ...step, step_number: index + 1 }));
    setBomSteps(updatedSteps);
  };

  // Get bins for selected location in step form (production-enabled only)
  const getFilteredBins = (locationId: string) => {
    if (!locationId) return [];
    return allBins.filter(bin => 
      bin.area?.location_id === locationId && 
      bin.is_production_enabled === true
    );
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

        // Delete existing steps and re-insert
        await supabase
          .from('bom_steps')
          .delete()
          .eq('bom_id', editingId);

        if (bomSteps.length > 0) {
          const stepsToInsert = bomSteps.map((step, index) => ({
            bom_id: editingId,
            step_number: index + 1,
            name: step.name,
            description: step.description,
            location_id: step.location_id,
            bin_id: step.bin_id,
            estimated_duration_minutes: step.estimated_duration_minutes,
          }));

          const { error: stepsError } = await supabase
            .from('bom_steps')
            .insert(stepsToInsert);

          if (stepsError) throw stepsError;
        }

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

        if (bomSteps.length > 0) {
          const stepsToInsert = bomSteps.map((step, index) => ({
            bom_id: data.id,
            step_number: index + 1,
            name: step.name,
            description: step.description,
            location_id: step.location_id,
            bin_id: step.bin_id,
            estimated_duration_minutes: step.estimated_duration_minutes,
          }));

          const { error: stepsError } = await supabase
            .from('bom_steps')
            .insert(stepsToInsert);

          if (stepsError) throw stepsError;
        }

        toast.success('Bill of materials created');
      }

      setIsDialogOpen(false);
      fetchBoms();
      fetchNextBomId();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save bill of materials');
    }
  };

  // Output product options for searchable select
  const outputProductOptions: SearchableSelectOption[] = products.map(p => ({
    value: p.id,
    label: `${p.product_id} - ${p.name}`,
  }));

  // Component options for searchable select
  const componentOptions: SearchableSelectOption[] = products
    .filter(p => p.id !== formData.product_id) // Exclude output product
    .map(p => ({
      value: p.id,
      label: `${p.product_id} - ${p.name}`,
    }));

  // Location options for step form
  const locationOptions: SearchableSelectOption[] = locations.map(l => ({
    value: l.id,
    label: l.name,
  }));

  // Bin options based on selected location
  const binOptions: SearchableSelectOption[] = getFilteredBins(newStep.location_id).map(b => ({
    value: b.id,
    label: `${b.bin_id} - ${b.name}`,
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
            <ColumnToggle
              columns={toggleableColumns}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onResetToDefaults={resetToDefaults}
              onShowAll={showAll}
              onHideAll={hideAll}
            />
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
          isColumnVisible={isColumnVisible}
        />
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {isViewMode ? 'View Bill of Materials' : isEditing ? 'Edit Bill of Materials' : 'New Bill of Materials'}
            </DialogTitle>
            <DialogDescription>
              {isViewMode 
                ? 'View BoM details' 
                : isEditing 
                  ? 'Update BoM details' 
                  : 'Define the components and steps needed to produce a product'}
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="shrink-0 mx-6">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="components">Components ({bomItems.length})</TabsTrigger>
                <TabsTrigger value="steps">Steps ({bomSteps.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <TabsContent value="details" className="mt-4 space-y-4">
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
                      <SearchableSelect
                        options={outputProductOptions}
                        value={formData.product_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, product_id: value }))}
                        placeholder="Select output product"
                        disabled={isViewMode || isEditing}
                      />
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

                </TabsContent>

                <TabsContent value="components" className="mt-4 space-y-4">
                  {!isViewMode && (
                    <div className="space-y-2">
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
                      <div className="flex justify-end">
                        <CopyFromIdDialog<BomItem[]>
                          onFetch={async (productId: string) => {
                            // Find product by product_id
                            const product = products.find(p => p.product_id.toLowerCase() === productId.toLowerCase());
                            if (!product) {
                              toast.error(`Product not found with ID: ${productId}`);
                              return null;
                            }

                            // Fetch product components
                            const { data: components, error } = await supabase
                              .from('product_components')
                              .select(`
                                component_product_id,
                                quantity,
                                component:products!product_components_component_product_id_fkey(id, product_id, name, unit)
                              `)
                              .eq('parent_product_id', product.id);

                            if (error) {
                              console.error('Error fetching product components:', error);
                              return null;
                            }

                            if (!components || components.length === 0) {
                              toast.error(`Product ${productId} has no components defined`);
                              return null;
                            }

                            // Map to BomItem format
                            const bomItemsFromProduct: BomItem[] = components.map((comp: any) => ({
                              product_id: comp.component_product_id,
                              quantity: comp.quantity,
                              notes: null,
                              product: comp.component ? {
                                product_id: comp.component.product_id,
                                name: comp.component.name,
                                unit: comp.component.unit,
                              } : undefined,
                            }));

                            return bomItemsFromProduct;
                          }}
                          onApply={(copiedItems) => {
                            // Merge with existing items, avoiding duplicates
                            setBomItems(prev => {
                              const existingIds = new Set(prev.map(item => item.product_id));
                              const newItems = copiedItems.filter(item => !existingIds.has(item.product_id));
                              if (newItems.length < copiedItems.length) {
                                toast.info(`${copiedItems.length - newItems.length} duplicate component(s) skipped`);
                              }
                              return [...prev, ...newItems];
                            });
                          }}
                          idLabel="Product ID"
                        />
                      </div>
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
                </TabsContent>

                <TabsContent value="steps" className="mt-4 space-y-4">
                  {!isViewMode && (
                    <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Step Name *</Label>
                          <Input
                            value={newStep.name}
                            onChange={(e) => setNewStep(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Assemble base unit"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Duration (min)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={newStep.duration}
                            onChange={(e) => setNewStep(prev => ({ ...prev, duration: e.target.value }))}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={newStep.description}
                          onChange={(e) => setNewStep(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Optional step description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Location</Label>
                          <SearchableSelect
                            options={locationOptions}
                            value={newStep.location_id}
                            onValueChange={(value) => setNewStep(prev => ({ ...prev, location_id: value, bin_id: '' }))}
                            placeholder="Select location"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Bin</Label>
                          <SearchableSelect
                            options={binOptions}
                            value={newStep.bin_id}
                            onValueChange={(value) => setNewStep(prev => ({ ...prev, bin_id: value }))}
                            placeholder={
                              newStep.location_id 
                                ? (binOptions.length > 0 ? "Select production bin" : "No production bins available")
                                : "Select location first"
                            }
                            disabled={!newStep.location_id}
                          />
                        </div>
                      </div>
                      <Button type="button" variant="outline" onClick={handleAddStep} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Step
                      </Button>
                    </div>
                  )}

                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell className="font-medium w-12">#</TableCell>
                          <TableCell className="font-medium">Step</TableCell>
                          <TableCell className="font-medium">Location</TableCell>
                          <TableCell className="font-medium">Bin</TableCell>
                          <TableCell className="font-medium w-20">Duration</TableCell>
                          {!isViewMode && <TableCell className="font-medium w-16" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bomSteps.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isViewMode ? 5 : 6} className="text-center py-4 text-muted-foreground">
                              No steps added
                            </TableCell>
                          </TableRow>
                        ) : (
                          bomSteps.map(step => (
                            <TableRow key={step.step_number}>
                              <TableCell className="font-mono text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-muted-foreground/50" />
                                  {step.step_number}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{step.name}</div>
                                  {step.description && (
                                    <div className="text-sm text-muted-foreground">{step.description}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{step.location?.name || '-'}</TableCell>
                              <TableCell>{step.bin ? `${step.bin.bin_id} - ${step.bin.name}` : '-'}</TableCell>
                              <TableCell>
                                {step.estimated_duration_minutes ? `${step.estimated_duration_minutes} min` : '-'}
                              </TableCell>
                              {!isViewMode && (
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveStep(step.step_number)}
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
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      disabled={isViewMode}
                      rows={6}
                      placeholder="Add any additional notes about this Bill of Materials..."
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {!isViewMode && (
              <DialogFooter className="shrink-0 px-6 pb-6">
                <Button type="submit">
                  {isEditing ? 'Update' : 'Create'}
                  <Kbd>⌘S</Kbd>
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
