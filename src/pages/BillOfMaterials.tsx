import { useEffect, useState, useRef } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useTableSort } from '@/hooks/use-table-sort';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { BOM_COLUMNS } from '@/config/column-layouts';
import { ColumnToggle } from '@/components/ColumnToggle';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useExcel } from '@/hooks/use-excel';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { ImportProgressDialog, ImportResult } from '@/components/ImportProgressDialog';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { ArrowLeft, Plus, Eye, MoreHorizontal, Pencil, Trash2, X, ClipboardList, GripVertical, Copy, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { toast } from '@/lib/toast';

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
  steps_count?: number;
  total_duration?: number;
}

interface BomItem {
  id?: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  product?: { name: string; product_id: string; unit: string | null };
}

interface BomStepItem {
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
  items?: BomStepItem[];
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
              {isColumnVisible('steps_count') && (
                <SortableTableHead
                  label="Steps"
                  sortKey="steps_count"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['steps_count']}
                  onFilter={(value) => setFilter('steps_count', value)}
                  className="w-20"
                />
              )}
              {isColumnVisible('total_duration') && (
                <SortableTableHead
                  label="Duration"
                  sortKey="total_duration"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['total_duration']}
                  onFilter={(value) => setFilter('total_duration', value)}
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
                  {isColumnVisible('bom_id') && (
                    <TableCell
                      className="font-mono text-sm text-primary cursor-pointer hover:underline"
                      onClick={() => onView(bom)}
                    >
                      {bom.bom_id}
                    </TableCell>
                  )}
                  {isColumnVisible('name') && <TableCell className="font-medium">{bom.name}</TableCell>}
                  {isColumnVisible('product') && <TableCell>{bom.product?.product_id} - {bom.product?.name}</TableCell>}
                  {isColumnVisible('output_quantity') && <TableCell>{bom.output_quantity}</TableCell>}
                  {isColumnVisible('steps_count') && <TableCell>{bom.steps_count ?? 0}</TableCell>}
                  {isColumnVisible('total_duration') && (
                    <TableCell>
                      {bom.total_duration ? `${bom.total_duration} min` : '-'}
                    </TableCell>
                  )}
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

// Sortable Step Row Component
const SortableStepRow = ({
  step,
  index,
  isViewMode,
  isExpanded,
  onToggleExpanded,
  onEdit,
  onRemove,
}: {
  step: BomStep;
  index: number;
  isViewMode: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.step_number.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasItems = step.items && step.items.length > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpanded} asChild>
      <>
        <TableRow
          ref={setNodeRef}
          style={style}
          className={`${hasItems ? 'cursor-pointer hover:bg-muted/50' : ''}`}
          onClick={onToggleExpanded}
        >
          <TableCell className="font-mono text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              {!isViewMode && (
                <button
                  type="button"
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing touch-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground" />
                </button>
              )}
              {isViewMode && <GripVertical className="w-3 h-3 text-muted-foreground/50" />}
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
          <TableCell onClick={(e) => e.stopPropagation()}>
            {hasItems ? (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
                  <span className="text-xs">{step.items!.length} item{step.items!.length !== 1 ? 's' : ''}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
          </TableCell>
          <TableCell>{step.location?.name || '-'}</TableCell>
          <TableCell>{step.bin ? `${step.bin.bin_id} - ${step.bin.name}` : '-'}</TableCell>
          <TableCell>
            {step.estimated_duration_minutes ? `${step.estimated_duration_minutes} min` : '-'}
          </TableCell>
          {!isViewMode && (
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemove}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          )}
        </TableRow>
        <CollapsibleContent asChild>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={isViewMode ? 6 : 7} className="py-2">
              <div className="pl-8">
                <div className="text-xs font-medium text-muted-foreground mb-2">Components Used:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {step.items?.map(item => (
                    <div key={item.product_id} className="flex items-center justify-between bg-background rounded px-3 py-2 border">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{item.product?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{item.product?.product_id}</div>
                      </div>
                      <div className="ml-3 text-right shrink-0">
                        <div className="font-semibold">{item.quantity}</div>
                        <div className="text-xs text-muted-foreground">{item.product?.unit || 'units'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
};

const BillOfMaterials = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [newStep, setNewStep] = useState<{ name: string; description: string; location_id: string; bin_id: string; duration: string; items: { product_id: string; quantity: string }[] }>({
    name: '',
    description: '',
    location_id: '',
    bin_id: '',
    duration: '',
    items: [],
  });
  const [newStepItem, setNewStepItem] = useState<{ product_id: string; quantity: string }>({ product_id: '', quantity: '1' });
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Sensors for step drag and drop
  const stepSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle step reordering
  const handleStepDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setBomSteps((items) => {
        const oldIndex = items.findIndex((item) => item.step_number.toString() === active.id);
        const newIndex = items.findIndex((item) => item.step_number.toString() === over.id);
        
        const reordered = arrayMove(items, oldIndex, newIndex);
        
        // Update step numbers to reflect new order
        return reordered.map((step, index) => ({
          ...step,
          step_number: index + 1,
        }));
      });
    }
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextBomId, setNextBomId] = useState('BOM-0001');
  const [activeTab, setActiveTab] = useState('components');

  const [formData, setFormData] = useState({
    bom_id: '',
    name: '',
    product_id: '',
    output_quantity: 1,
    status: 'active',
    notes: '',
  });

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTotalRows, setImportTotalRows] = useState(0);
  const [importProcessedRows, setImportProcessedRows] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importComplete, setImportComplete] = useState(false);

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

    // Fetch step counts and durations for each BOM
    if (data && data.length > 0) {
      const bomIds = data.map(b => b.id);
      const { data: steps } = await supabase
        .from('bom_steps')
        .select('bom_id, estimated_duration_minutes')
        .in('bom_id', bomIds);

      // Count steps and sum durations per BOM
      const countsMap: Record<string, number> = {};
      const durationsMap: Record<string, number> = {};
      steps?.forEach(s => {
        countsMap[s.bom_id] = (countsMap[s.bom_id] || 0) + 1;
        durationsMap[s.bom_id] = (durationsMap[s.bom_id] || 0) + (s.estimated_duration_minutes || 0);
      });

      // Merge counts and durations into BOMs
      const bomsWithData = data.map(bom => ({
        ...bom,
        steps_count: countsMap[bom.id] || 0,
        total_duration: durationsMap[bom.id] || 0,
      }));
      setBoms(bomsWithData);
    } else {
      setBoms(data || []);
    }
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
      // Fetch step items for each step
      const stepsWithItems = await Promise.all(
        data.map(async (step) => {
          const { data: items } = await supabase
            .from('bom_step_items')
            .select(`
              id,
              product_id,
              quantity,
              notes,
              product:products(product_id, name, unit)
            `)
            .eq('bom_step_id', step.id);
          
          return {
            ...step,
            items: (items || []) as unknown as BomStepItem[],
          };
        })
      );
      setBomSteps(stepsWithItems as unknown as BomStep[]);
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
    setNewStep({ name: '', description: '', location_id: '', bin_id: '', duration: '', items: [] });
    setNewStepItem({ product_id: '', quantity: '1' });
    setEditingStepIndex(null);
    setActiveTab('components');
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Name': '', 'Output Product': '', 'Output Quantity': '', 'Status': '', 'Notes': '' },
    ];
    exportToExcel(templateData, 'bill_of_materials_template.xlsx', 'Bill of Materials', [
      { header: 'Name', key: 'Name', width: 30 },
      { header: 'Output Product', key: 'Output Product', width: 25 },
      { header: 'Output Quantity', key: 'Output Quantity', width: 15 },
      { header: 'Status', key: 'Status', width: 15 },
      { header: 'Notes', key: 'Notes', width: 40 },
    ]);
    toast.success('Template downloaded');
  };

  const handleExport = async () => {
    if (boms.length === 0) {
      toast.info('No bill of materials to export');
      return;
    }
    const exportData = boms.map(b => ({
      'BOM ID': b.bom_id,
      'Name': b.name,
      'Output Product': b.product?.name || '',
      'Output Quantity': b.output_quantity,
      'Status': b.status,
      'Steps': b.steps_count || 0,
      'Duration (min)': b.total_duration || 0,
      'Notes': b.notes || '',
    }));
    await exportToExcel(exportData, 'bill_of_materials.xlsx', 'Bill of Materials');
    toast.success('Bill of materials exported');
  };

  const handleImportBom = async (file: File) => {
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) {
        toast.error('No data found in file');
        return;
      }

      setImportTotalRows(rows.length);
      setImportProcessedRows(0);
      setImportResults([]);
      setImportComplete(false);
      setImportDialogOpen(true);

      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
          const name = row['Name']?.toString().trim();
          if (!name) {
            results.push({ row: rowNum, status: 'error', message: 'Name is required' });
            setImportResults([...results]);
            setImportProcessedRows(i + 1);
            continue;
          }

          const outputProductName = row['Output Product']?.toString().trim();
          if (!outputProductName) {
            results.push({ row: rowNum, status: 'error', message: 'Output Product is required' });
            setImportResults([...results]);
            setImportProcessedRows(i + 1);
            continue;
          }

          const product = products.find(p => p.name.toLowerCase() === outputProductName.toLowerCase());
          if (!product) {
            results.push({ row: rowNum, status: 'error', message: `Product "${outputProductName}" not found` });
            setImportResults([...results]);
            setImportProcessedRows(i + 1);
            continue;
          }

          const outputQty = Number(row['Output Quantity']) || 1;
          const status = row['Status']?.toString().trim().toLowerCase() || 'active';

          const { data: nextId } = await supabase.rpc('get_next_bom_id', {
            p_company_id: companyId,
          });

          const { error: insertError } = await supabase.from('bill_of_materials').insert({
            company_id: companyId!,
            bom_id: nextId || `BOM-${String(i + 1).padStart(4, '0')}`,
            name,
            product_id: product.id,
            output_quantity: outputQty,
            status: ['active', 'draft', 'inactive'].includes(status) ? status : 'active',
            notes: row['Notes']?.toString().trim() || null,
          });

          if (insertError) throw insertError;

          results.push({ row: rowNum, status: 'success', message: `BOM "${name}" created` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed to import' });
        }

        setImportResults([...results]);
        setImportProcessedRows(i + 1);
      }

      setImportComplete(true);
      fetchBoms();
      fetchNextBomId();
    } catch (err: any) {
      toast.error(err.message || 'Failed to read file');
    }
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, bom_id: nextBomId }));
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', handleOpenDialog);
  useTransactionAction('new', handleOpenDialog);

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
    setActiveTab('components');
    setIsDialogOpen(true);
  };

  // Deep link: open the view window for a BOM referenced via ?ref=<bom_id>
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (!ref || boms.length === 0 || isDialogOpen) return;
    const target = boms.find(b => b.bom_id === ref);
    setSearchParams({}, { replace: true });
    if (target) {
      handleView(target);
    } else {
      toast.error(`Bill of Materials ${ref} not found`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, boms]);

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
    setActiveTab('components');
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

  const handleAddStepItem = () => {
    if (!newStepItem.product_id || !newStepItem.quantity) return;
    
    const product = products.find(p => p.id === newStepItem.product_id);
    if (!product) return;

    // Check if component exists in BOM items
    const bomItem = bomItems.find(item => item.product_id === newStepItem.product_id);
    if (!bomItem) {
      toast.error('This product is not in the BOM components list');
      return;
    }

    // Check if already added to this step
    if (newStep.items.some(item => item.product_id === newStepItem.product_id)) {
      toast.error('This component is already added to this step');
      return;
    }

    setNewStep(prev => ({
      ...prev,
      items: [...prev.items, { product_id: newStepItem.product_id, quantity: newStepItem.quantity }],
    }));
    setNewStepItem({ product_id: '', quantity: '1' });
  };

  const handleRemoveStepItem = (productId: string) => {
    setNewStep(prev => ({
      ...prev,
      items: prev.items.filter(item => item.product_id !== productId),
    }));
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

    const location = locations.find(l => l.id === newStep.location_id);
    const bin = allBins.find(b => b.id === newStep.bin_id);

    // Convert step items with product info
    const stepItems: BomStepItem[] = newStep.items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        product_id: item.product_id,
        quantity: parseFloat(item.quantity) || 1,
        notes: null,
        product: product ? {
          product_id: product.product_id,
          name: product.name,
          unit: product.unit,
        } : undefined,
      };
    });

    const newStepData: BomStep = {
      step_number: editingStepIndex !== null ? bomSteps[editingStepIndex].step_number : (bomSteps.length > 0 ? Math.max(...bomSteps.map(s => s.step_number)) + 1 : 1),
      name: newStep.name,
      description: newStep.description || null,
      location_id: newStep.location_id || null,
      bin_id: newStep.bin_id || null,
      estimated_duration_minutes: newStep.duration ? parseInt(newStep.duration) : null,
      location: location ? { name: location.name } : undefined,
      bin: bin ? { name: bin.name, bin_id: bin.bin_id } : undefined,
      items: stepItems,
    };

    if (editingStepIndex !== null) {
      // Update existing step
      const updatedSteps = [...bomSteps];
      updatedSteps[editingStepIndex] = { ...updatedSteps[editingStepIndex], ...newStepData };
      setBomSteps(updatedSteps);
      setEditingStepIndex(null);
      toast.success('Step updated');
    } else {
      // Add new step
      setBomSteps([...bomSteps, newStepData]);
    }
    setNewStep({ name: '', description: '', location_id: '', bin_id: '', duration: '', items: [] });
  };

  const handleEditStep = (index: number) => {
    const step = bomSteps[index];
    setNewStep({
      name: step.name,
      description: step.description || '',
      location_id: step.location_id || '',
      bin_id: step.bin_id || '',
      duration: step.estimated_duration_minutes?.toString() || '',
      items: step.items?.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity.toString(),
      })) || [],
    });
    setEditingStepIndex(index);
  };

  const handleCancelEditStep = () => {
    setNewStep({ name: '', description: '', location_id: '', bin_id: '', duration: '', items: [] });
    setEditingStepIndex(null);
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

          const { data: insertedSteps, error: stepsError } = await supabase
            .from('bom_steps')
            .insert(stepsToInsert)
            .select('id, step_number');

          if (stepsError) throw stepsError;

          // Insert step items for each step
          const allStepItems: { bom_step_id: string; product_id: string; quantity: number; notes: string | null }[] = [];
          insertedSteps?.forEach(insertedStep => {
            const originalStep = bomSteps.find(s => s.step_number === insertedStep.step_number);
            if (originalStep?.items) {
              originalStep.items.forEach(item => {
                allStepItems.push({
                  bom_step_id: insertedStep.id,
                  product_id: item.product_id,
                  quantity: item.quantity,
                  notes: item.notes,
                });
              });
            }
          });

          if (allStepItems.length > 0) {
            const { error: stepItemsError } = await supabase
              .from('bom_step_items')
              .insert(allStepItems);
            if (stepItemsError) throw stepItemsError;
          }
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

          const { data: insertedSteps, error: stepsError } = await supabase
            .from('bom_steps')
            .insert(stepsToInsert)
            .select('id, step_number');

          if (stepsError) throw stepsError;

          // Insert step items for each step
          const allStepItems: { bom_step_id: string; product_id: string; quantity: number; notes: string | null }[] = [];
          insertedSteps?.forEach(insertedStep => {
            const originalStep = bomSteps.find(s => s.step_number === insertedStep.step_number);
            if (originalStep?.items) {
              originalStep.items.forEach(item => {
                allStepItems.push({
                  bom_step_id: insertedStep.id,
                  product_id: item.product_id,
                  quantity: item.quantity,
                  notes: item.notes,
                });
              });
            }
          });

          if (allStepItems.length > 0) {
            const { error: stepItemsError } = await supabase
              .from('bom_step_items')
              .insert(allStepItems);
            if (stepItemsError) throw stepItemsError;
          }
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

  // Step component options - only show components from BOM items
  const stepComponentOptions: SearchableSelectOption[] = bomItems.map(item => ({
    value: item.product_id,
    label: `${item.product?.product_id} - ${item.product?.name}`,
  }));

  // Calculate unaccounted components (components not fully allocated to steps)
  const getUnaccountedComponents = () => {
    const allocatedQuantities: Record<string, number> = {};
    
    // Sum up allocated quantities across all steps
    bomSteps.forEach(step => {
      step.items?.forEach(item => {
        allocatedQuantities[item.product_id] = (allocatedQuantities[item.product_id] || 0) + item.quantity;
      });
    });

    // Also count items pending in the new step form
    newStep.items.forEach(item => {
      allocatedQuantities[item.product_id] = (allocatedQuantities[item.product_id] || 0) + (parseFloat(item.quantity) || 0);
    });

    // Compare with BOM items
    return bomItems.map(bomItem => {
      const allocated = allocatedQuantities[bomItem.product_id] || 0;
      const remaining = bomItem.quantity - allocated;
      return {
        ...bomItem,
        allocated,
        remaining,
      };
    }).filter(item => item.remaining !== 0);
  };

  const unaccountedComponents = getUnaccountedComponents();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
            <ArrowLeft className="w-4 h-4" />
            <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
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
            <ImportExportButtons
              importEnabled={isImportEnabled('bill_of_materials')}
              exportEnabled={isExportEnabled('bill_of_materials')}
              onExport={handleExport}
              onImport={handleImportBom}
              onDownloadTemplate={handleDownloadTemplate}
              entityName="Bill of Materials"
            />
            <Button onClick={handleOpenDialog} size="icon" className="relative">
              <Plus className="w-4 h-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
            </Button>
          </div>
        </div>
      </header>

      <ImportProgressDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Importing Bill of Materials"
        totalRows={importTotalRows}
        processedRows={importProcessedRows}
        results={importResults}
        isComplete={importComplete}
      />

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
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-3xl max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {!isEditing && !isViewMode && (
            <CopyFromIdDialog<{ bom: BillOfMaterial; items: BomItem[]; steps: BomStep[] }>
              idLabel="BoM ID"
              className="absolute right-16 top-4 z-10"
              onFetch={async (bomIdInput) => {
                const { data: bomRow, error: bomErr } = await supabase
                  .from('bill_of_materials')
                  .select('*, product:products(name, product_id)')
                  .eq('company_id', companyId!)
                  .ilike('bom_id', bomIdInput)
                  .maybeSingle();
                if (bomErr || !bomRow) return null;

                const { data: itemRows } = await supabase
                  .from('bom_items')
                  .select('id, product_id, quantity, notes, product:products(product_id, name, unit)')
                  .eq('bom_id', (bomRow as any).id);

                const { data: stepRows } = await supabase
                  .from('bom_steps')
                  .select('id, step_number, name, description, location_id, bin_id, estimated_duration_minutes, location:locations(name), bin:bins(name, bin_id)')
                  .eq('bom_id', (bomRow as any).id)
                  .order('step_number');

                const stepsWithItems: BomStep[] = await Promise.all(
                  (stepRows || []).map(async (step: any) => {
                    const { data: stepItems } = await supabase
                      .from('bom_step_items')
                      .select('id, product_id, quantity, notes, product:products(product_id, name, unit)')
                      .eq('bom_step_id', step.id);
                    return { ...step, items: (stepItems || []) } as BomStep;
                  })
                );

                return {
                  bom: bomRow as unknown as BillOfMaterial,
                  items: (itemRows || []) as unknown as BomItem[],
                  steps: stepsWithItems,
                };
              }}
              onApply={({ bom, items, steps }) => {
                setFormData(prev => ({
                  ...prev,
                  name: `${bom.name} (Copy)`,
                  product_id: bom.product_id,
                  output_quantity: bom.output_quantity,
                  status: bom.status,
                  notes: bom.notes || '',
                }));
                // Strip DB ids so inserts create fresh rows
                setBomItems(items.map(({ id, ...rest }) => rest));
                setBomSteps(steps.map(({ id, ...rest }) => ({
                  ...rest,
                  items: (rest.items || []).map(({ id: _i, ...it }) => it),
                })));
              }}
            />
          )}
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

          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Details section - always visible */}
            <div className="px-6 py-4 space-y-4 shrink-0 border-b">
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

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Standard Widget Assembly"
                    disabled={isViewMode}
                  />
                </div>
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
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className="shrink-0 mx-6 mt-4">
                <TabsTrigger value="components">Components ({bomItems.length})</TabsTrigger>
                <TabsTrigger value="steps">Steps ({bomSteps.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
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
                  {/* Unaccounted Components Summary */}
                  {bomItems.length > 0 && (
                    <div className={`p-3 rounded-md border ${unaccountedComponents.length === 0 ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : unaccountedComponents.some(c => c.remaining > 0) ? 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">Component Allocation</span>
                        {unaccountedComponents.length === 0 ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">All Allocated</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{unaccountedComponents.length} Unaccounted</Badge>
                        )}
                      </div>
                      {unaccountedComponents.length > 0 && (
                        <div className="text-xs space-y-1">
                          {unaccountedComponents.map(item => (
                            <div key={item.product_id} className="flex justify-between items-center">
                              <span>{item.product?.product_id} - {item.product?.name}</span>
                              <span className={item.remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                                {item.remaining > 0 ? `+${item.remaining}` : item.remaining} {item.product?.unit || 'units'} {item.remaining > 0 ? 'unassigned' : 'over-allocated'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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

                      {/* Step Components Section */}
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs">Components Used in This Step</Label>
                        {bomItems.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Add components in the Components tab first</p>
                        ) : (
                          <>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <SearchableSelect
                                  options={stepComponentOptions.filter(opt => !newStep.items.some(i => i.product_id === opt.value))}
                                  value={newStepItem.product_id}
                                  onValueChange={(value) => setNewStepItem(prev => ({ ...prev, product_id: value }))}
                                  placeholder="Select component"
                                />
                              </div>
                              <Input
                                type="number"
                                min={0.01}
                                step={0.01}
                                value={newStepItem.quantity}
                                onChange={(e) => setNewStepItem(prev => ({ ...prev, quantity: e.target.value }))}
                                className="w-20"
                                placeholder="Qty"
                              />
                              <Button type="button" variant="outline" size="icon" onClick={handleAddStepItem} disabled={!newStepItem.product_id}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            {newStep.items.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {newStep.items.map(item => {
                                  const product = products.find(p => p.id === item.product_id);
                                  return (
                                    <Badge key={item.product_id} variant="secondary" className="text-xs flex items-center gap-1">
                                      {product?.product_id}: {item.quantity} {product?.unit || ''}
                                      <button type="button" onClick={() => handleRemoveStepItem(item.product_id)} className="ml-1 hover:text-destructive">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={handleAddStep} className="flex-1">
                          {editingStepIndex !== null ? (
                            <>
                              <Pencil className="w-4 h-4 mr-2" />
                              Update Step
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Add Step
                            </>
                          )}
                        </Button>
                        {editingStepIndex !== null && (
                          <Button type="button" variant="ghost" onClick={handleCancelEditStep}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border rounded-md">
                    <DndContext
                      sensors={stepSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleStepDragEnd}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableCell className="font-medium w-12">#</TableCell>
                            <TableCell className="font-medium">Step</TableCell>
                            <TableCell className="font-medium w-24">Components</TableCell>
                            <TableCell className="font-medium">Location</TableCell>
                            <TableCell className="font-medium">Bin</TableCell>
                            <TableCell className="font-medium w-20">Duration</TableCell>
                            {!isViewMode && <TableCell className="font-medium w-24" />}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bomSteps.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={isViewMode ? 6 : 7} className="text-center py-4 text-muted-foreground">
                                No steps added
                              </TableCell>
                            </TableRow>
                          ) : (
                            <SortableContext
                              items={bomSteps.map(s => s.step_number.toString())}
                              strategy={verticalListSortingStrategy}
                            >
                              {bomSteps.map((step, index) => (
                                <SortableStepRow
                                  key={step.step_number}
                                  step={step}
                                  index={index}
                                  isViewMode={isViewMode}
                                  isExpanded={expandedSteps.has(step.step_number)}
                                  onToggleExpanded={() => {
                                    const hasItems = step.items && step.items.length > 0;
                                    if (!hasItems) return;
                                    setExpandedSteps(prev => {
                                      const next = new Set(prev);
                                      if (next.has(step.step_number)) {
                                        next.delete(step.step_number);
                                      } else {
                                        next.add(step.step_number);
                                      }
                                      return next;
                                    });
                                  }}
                                  onEdit={() => handleEditStep(index)}
                                  onRemove={() => handleRemoveStep(step.step_number)}
                                />
                              ))}
                            </SortableContext>
                          )}
                        </TableBody>
                      </Table>
                    </DndContext>
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
