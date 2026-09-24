import { useEffect, useState, useRef, useMemo } from 'react';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useTableSort } from '@/hooks/use-table-sort';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Kbd } from '@/components/ui/kbd';
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
  TableHead,
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
import { ArrowLeft, Plus, Eye, MoreHorizontal, Pencil, Trash2, X, Factory, MapPin, Clock, Check, Play, PlayCircle, CheckCircle, Maximize2, Minimize2, User, Printer, Copy } from 'lucide-react';
import { printProductionOrder } from '@/lib/print-production-order';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';
import { format, parseISO } from 'date-fns';
import { StepByStepProductionDialog } from '@/components/production/StepByStepProductionDialog';
import { createProductionGoodsIssue, createProductionGoodsReceipt } from '@/lib/production-posting';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useExcel } from '@/hooks/use-excel';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { ImportProgressDialog, ImportResult } from '@/components/ImportProgressDialog';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { PRODUCTION_ORDER_COLUMNS } from '@/config/column-layouts';
import { ColumnToggle } from '@/components/ColumnToggle';


interface ProductionOrder {
  id: string;
  order_number: string;
  bom_id: string | null;
  product_id: string;
  location_id: string;
  quantity: number;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  notes: string | null;
  assigned_employee_id: string | null;
  created_at: string;
  product?: { name: string; product_id: string };
  location?: { name: string; location_id: string };
  bom?: { name: string; bom_id: string; output_quantity: number };
  assigned_employee?: { id: string; employee_id: string; first_name: string; last_name: string } | null;
  total_duration?: number; // Total estimated minutes from BOM steps
}

interface BillOfMaterial {
  id: string;
  bom_id: string;
  name: string;
  product_id: string;
  output_quantity: number;
  product?: { name: string; product_id: string };
}

interface Location {
  id: string;
  location_id: string;
  name: string;
  is_production_enabled: boolean;
}

interface BomItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: { name: string; product_id: string };
}

interface LocationEmployee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
}

interface InventoryRecord {
  id: string;
  product_id: string;
  quantity: number;
  bin_id: string | null;
  product?: { name: string; product_id: string };
  bin?: { name: string; bin_id: string } | null;
}

// Format duration in hours and minutes
const formatDuration = (minutes: number | undefined | null): string => {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

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
  onStart,
  onStartForeground,
  onConfirm,
  onCompleteForeground,
  onAssignEmployee,
  onPrint,
  isColumnVisible,
}: {
  orders: ProductionOrder[];
  onView: (order: ProductionOrder) => void;
  onEdit: (order: ProductionOrder) => void;
  onDelete: (id: string) => void;
  onStart: (order: ProductionOrder) => void;
  onStartForeground: (order: ProductionOrder) => void;
  onConfirm: (order: ProductionOrder) => void;
  onCompleteForeground: (order: ProductionOrder) => void;
  onAssignEmployee: (order: ProductionOrder) => void;
  onPrint: (order: ProductionOrder) => void;
  isColumnVisible: (key: string) => boolean;
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
  const visibleColCount = PRODUCTION_ORDER_COLUMNS.filter((c) => isColumnVisible(c.key)).length;

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
              {isColumnVisible('order_number') && (
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
              )}
              {isColumnVisible('bom_id') && (
              <SortableTableHead
                label="BoM ID"
                sortKey="bom.bom_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['bom.bom_id']}
                onFilter={(value) => setFilter('bom.bom_id', value)}
                className="w-28"
              />
              )}
              {isColumnVisible('bom_name') && (
              <SortableTableHead
                label="BoM"
                sortKey="bom.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['bom.name']}
                onFilter={(value) => setFilter('bom.name', value)}
              />
              )}
              {isColumnVisible('product_id') && (
              <SortableTableHead
                label="Output Product ID"
                sortKey="product.product_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['product.product_id']}
                onFilter={(value) => setFilter('product.product_id', value)}
                className="w-32"
              />
              )}
              {isColumnVisible('product_name') && (
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
              {isColumnVisible('quantity') && (
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
                className="w-32"
              />
              )}
              {isColumnVisible('duration') && (
              <SortableTableHead
                label="Duration"
                sortKey="total_duration"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['total_duration']}
                onFilter={(value) => setFilter('total_duration', value)}
                className="w-28"
              />
              )}
              {isColumnVisible('assigned_to') && (
              <SortableTableHead
                label="Assigned To"
                sortKey="assigned_employee.last_name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['assigned_employee.last_name']}
                onFilter={(value) => setFilter('assigned_employee.last_name', value)}
              />
              )}
              {isColumnVisible('scheduled') && (
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
                <TableCell colSpan={visibleColCount} className="text-center py-8 text-muted-foreground">
                  No production orders found
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((order) => (
                <TableRow key={order.id} className="whitespace-nowrap">
                  {isColumnVisible('order_number') && (
                  <TableCell
                    className="font-mono text-sm text-primary cursor-pointer hover:underline"
                    onClick={() => onView(order)}
                  >
                    {order.order_number}
                  </TableCell>
                  )}
                  {isColumnVisible('bom_id') && (
                  <TableCell className="font-mono text-sm">
                    {order.bom?.bom_id ? (
                      <Link
                        to={`/bill-of-materials?ref=${encodeURIComponent(order.bom.bom_id)}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.bom.bom_id}
                      </Link>
                    ) : '-'}
                  </TableCell>
                  )}
                  {isColumnVisible('bom_name') && (
                  <TableCell>
                    {order.bom ? (
                      <Link
                        to={`/bill-of-materials?ref=${encodeURIComponent(order.bom.bom_id)}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.bom.name}
                      </Link>
                    ) : '-'}
                  </TableCell>
                  )}
                  {isColumnVisible('product_id') && (
                  <TableCell className="font-mono text-sm">
                    {order.product?.product_id ? (
                      <Link
                        to={`/products?ref=${encodeURIComponent(order.product.product_id)}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.product.product_id}
                      </Link>
                    ) : '-'}
                  </TableCell>
                  )}
                  {isColumnVisible('product_name') && (
                  <TableCell>{order.product?.name || '-'}</TableCell>
                  )}
                  {isColumnVisible('quantity') && (
                  <TableCell>{order.quantity}</TableCell>
                  )}
                  {isColumnVisible('status') && (
                  <TableCell>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  )}
                  {isColumnVisible('duration') && (
                  <TableCell>
                    {order.total_duration ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(order.total_duration)}</span>
                      </div>
                    ) : '-'}
                  </TableCell>
                  )}
                  {isColumnVisible('assigned_to') && (
                  <TableCell>
                    {order.assigned_employee 
                      ? `${order.assigned_employee.first_name} ${order.assigned_employee.last_name}`
                      : '-'}
                  </TableCell>
                  )}
                  {isColumnVisible('scheduled') && (
                  <TableCell>
                    {order.scheduled_date ? format(parseISO(order.scheduled_date), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onView(order)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Print production order" onClick={() => onPrint(order)}>
                        <Printer className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {order.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => onStart(order)}>
                                <Play className="w-4 h-4 mr-2" />
                                Start
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onStartForeground(order)}>
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Start in Foreground
                              </DropdownMenuItem>
                            </>
                          )}
                          {order.status === 'in_progress' && (
                            <>
                              <DropdownMenuItem onClick={() => onAssignEmployee(order)}>
                                <User className="w-4 h-4 mr-2" />
                                Assign Employee
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onConfirm(order)}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Confirm
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onCompleteForeground(order)}>
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Complete in Foreground
                              </DropdownMenuItem>
                            </>
                          )}
                          {order.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => onEdit(order)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setDeleteTarget(order)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
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
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [boms, setBoms] = useState<BillOfMaterial[]>([]);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [locationInventory, setLocationInventory] = useState<InventoryRecord[]>([]);
  const [bomDurations, setBomDurations] = useState<Record<string, number>>({});

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextOrderNumber, setNextOrderNumber] = useState('PRO-0001');
  const [deleteTarget, setDeleteTarget] = useState<ProductionOrder | null>(null);
  const [foregroundOrder, setForegroundOrder] = useState<ProductionOrder | null>(null);
  const [isForegroundDialogOpen, setIsForegroundDialogOpen] = useState(false);
  const [locationEmployees, setLocationEmployees] = useState<LocationEmployee[]>([]);
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [copyFromId, setCopyFromId] = useState('');
  const [copyFromLoading, setCopyFromLoading] = useState(false);

  // Import/Export
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportComplete, setIsImportComplete] = useState(false);

  // Column visibility
  const {
    isColumnVisible,
    toggleColumn,
    resetToDefaults,
    showAll,
    hideAll,
    visibleColumns,
  } = useColumnVisibility('production_orders', PRODUCTION_ORDER_COLUMNS);

  const [formData, setFormData] = useState({
    order_number: '',
    bom_id: '',
    location_id: '',
    quantity: 1,
    status: 'pending',
    scheduled_date: '',
    notes: '',
    assigned_employee_id: '',
  });

  // Filter orders by selected location
  const filteredOrders = selectedLocationId 
    ? orders.filter(o => o.location_id === selectedLocationId)
    : orders;

  // Get production-enabled locations
  const productionLocations = allLocations.filter(l => l.is_production_enabled);

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
      fetchLocations();
      fetchBoms();
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
        location:locations(name, location_id),
        bom:bill_of_materials(name, bom_id, output_quantity),
        assigned_employee:employees!production_orders_assigned_employee_id_fkey(id, employee_id, first_name, last_name)
      `)
      .eq('company_id', companyId!)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load production orders');
      return;
    }

    // Fetch bom_steps durations for all unique bom_ids
    const bomIds = [...new Set((data || []).filter(o => o.bom_id).map(o => o.bom_id))];
    if (bomIds.length > 0) {
      const { data: stepsData } = await supabase
        .from('bom_steps')
        .select('bom_id, estimated_duration_minutes')
        .in('bom_id', bomIds);

      // Sum durations by bom_id
      const durations: Record<string, number> = {};
      (stepsData || []).forEach(step => {
        if (step.bom_id && step.estimated_duration_minutes) {
          durations[step.bom_id] = (durations[step.bom_id] || 0) + step.estimated_duration_minutes;
        }
      });
      setBomDurations(durations);

      // Add durations to orders (BOM duration × quantity)
      const ordersWithDuration = (data || []).map(order => ({
        ...order,
        total_duration: order.bom_id ? (durations[order.bom_id] || 0) * order.quantity : 0,
      }));
      setOrders(ordersWithDuration);
    } else {
      setOrders(data || []);
    }
  };

  const fetchBoms = async () => {
    const { data, error } = await supabase
      .from('bill_of_materials')
      .select(`
        id,
        bom_id,
        name,
        product_id,
        output_quantity,
        product:products(name, product_id)
      `)
      .eq('company_id', companyId!)
      .eq('status', 'active')
      .order('name');

    if (!error && data) {
      setBoms(data as unknown as BillOfMaterial[]);
    }
  };

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, location_id, name, is_production_enabled')
      .eq('company_id', companyId!)
      .order('name');

    if (!error && data) {
      setAllLocations(data);
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

  const fetchBomItems = async (bomId: string) => {
    const { data, error } = await supabase
      .from('bom_items')
      .select(`
        id,
        product_id,
        quantity,
        product:products(name, product_id)
      `)
      .eq('bom_id', bomId);

    if (!error && data) {
      setBomItems(data as unknown as BomItem[]);
    } else {
      setBomItems([]);
    }
  };

  // Fetch inventory for selected production location
  const fetchLocationInventory = async (locationId: string) => {
    const { data } = await supabase
      .from('inventory')
      .select(`
        id,
        product_id,
        quantity,
        bin_id,
        product:products(name, product_id),
        bin:bins(name, bin_id)
      `)
      .eq('location_id', locationId)
      .gt('quantity', 0)
      .order('product_id');
    setLocationInventory((data as any) || []);
  };

  // Fetch employees belonging to a location via location_users
  const fetchLocationEmployees = async (locationId: string) => {
    // Get user_ids assigned to this location
    const { data: locationUsers } = await supabase
      .from('location_users')
      .select('user_id')
      .eq('location_id', locationId);

    if (!locationUsers || locationUsers.length === 0) {
      setLocationEmployees([]);
      return;
    }

    const userIds = locationUsers.map(lu => lu.user_id);
    
    // Get employees linked to these users
    const { data: employees } = await supabase
      .from('employees')
      .select('id, employee_id, first_name, last_name')
      .in('user_id', userIds)
      .eq('status', 'active')
      .order('last_name');

    setLocationEmployees(employees || []);
  };

  // Effect to fetch inventory and employees when location changes in dialog
  useEffect(() => {
    if (isDialogOpen && formData.location_id) {
      fetchLocationInventory(formData.location_id);
      fetchLocationEmployees(formData.location_id);
    } else {
      setLocationInventory([]);
      setLocationEmployees([]);
    }
  }, [isDialogOpen, formData.location_id]);

  // Calculate availability for BOM items
  const itemAvailability = useMemo(() => {
    const availability: Record<string, { available: number; required: number; sufficient: boolean }> = {};
    
    // Aggregate inventory by product
    const inventoryByProduct: Record<string, number> = {};
    locationInventory.forEach(inv => {
      inventoryByProduct[inv.product_id] = (inventoryByProduct[inv.product_id] || 0) + inv.quantity;
    });
    
    // Check each BOM item
    bomItems.forEach(item => {
      if (item.product_id) {
        const available = inventoryByProduct[item.product_id] || 0;
        const required = item.quantity * formData.quantity;
        availability[item.product_id] = {
          available,
          required,
          sufficient: available >= required,
        };
      }
    });
    
    return availability;
  }, [locationInventory, bomItems, formData.quantity]);

  // Check if any BOM item has stock issues
  const hasStockIssue = useMemo(() => {
    return Object.values(itemAvailability).some(a => !a.sufficient);
  }, [itemAvailability]);

  const resetForm = () => {
    setFormData({
      order_number: nextOrderNumber,
      bom_id: '',
      location_id: selectedLocationId,
      quantity: 1,
      status: 'pending',
      scheduled_date: '',
      notes: '',
      assigned_employee_id: '',
    });
    setIsEditing(false);
    setIsViewMode(false);
    setIsAssignMode(false);
    setEditingId(null);
    setBomItems([]);
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ 
      ...prev, 
      order_number: nextOrderNumber,
      location_id: selectedLocationId,
    }));
    setIsDialogOpen(true);
  };

  useKeyboardShortcut('n', handleOpenDialog);
  useTransactionAction('new', handleOpenDialog);

  const handleView = async (order: ProductionOrder) => {
    setFormData({
      order_number: order.order_number,
      bom_id: order.bom_id || '',
      location_id: order.location_id,
      quantity: order.quantity,
      status: order.status,
      scheduled_date: order.scheduled_date || '',
      notes: order.notes || '',
      assigned_employee_id: order.assigned_employee_id || '',
    });
    setIsViewMode(true);
    setIsEditing(false);
    setEditingId(order.id);
    if (order.bom_id) {
      await fetchBomItems(order.bom_id);
    }
    setIsDialogOpen(true);
  };

  const handlePrintOrder = async (order: ProductionOrder) => {
    let components: { productId: string; productName: string; quantity: number }[] = [];
    if (order.bom_id) {
      const { data } = await supabase
        .from('bom_items')
        .select('id, product_id, quantity, product:products(name, product_id)')
        .eq('bom_id', order.bom_id);
      const outputQty = order.bom?.output_quantity || 1;
      const multiplier = outputQty > 0 ? order.quantity / outputQty : 1;
      components = ((data as unknown as BomItem[]) || []).map((item) => ({
        productId: item.product?.product_id || '',
        productName: item.product?.name || '',
        quantity: Math.round(item.quantity * multiplier * 1000) / 1000,
      }));
    }

    printProductionOrder({
      orderNumber: order.order_number,
      status: order.status,
      bomId: order.bom?.bom_id || null,
      bomName: order.bom?.name || null,
      outputProductId: order.product?.product_id || null,
      outputProductName: order.product?.name || null,
      quantity: order.quantity,
      locationName: order.location?.name || null,
      scheduledDate: order.scheduled_date ? format(parseISO(order.scheduled_date), 'MMM d, yyyy') : null,
      completedDate: order.completed_date ? format(parseISO(order.completed_date), 'MMM d, yyyy') : null,
      assignedTo: order.assigned_employee
        ? `${order.assigned_employee.first_name} ${order.assigned_employee.last_name}`
        : null,
      duration: order.total_duration ? formatDuration(order.total_duration) : null,
      notes: order.notes || null,
      components,
    });
  };

  const handleEdit = async (order: ProductionOrder) => {
    setFormData({
      order_number: order.order_number,
      bom_id: order.bom_id || '',
      location_id: order.location_id,
      quantity: order.quantity,
      status: order.status,
      scheduled_date: order.scheduled_date || '',
      notes: order.notes || '',
      assigned_employee_id: order.assigned_employee_id || '',
    });
    setIsViewMode(false);
    setIsEditing(true);
    setEditingId(order.id);
    if (order.bom_id) {
      await fetchBomItems(order.bom_id);
    }
    setIsDialogOpen(true);
  };

  const handleAssignEmployee = async (order: ProductionOrder) => {
    setFormData({
      order_number: order.order_number,
      bom_id: order.bom_id || '',
      location_id: order.location_id,
      quantity: order.quantity,
      status: order.status,
      scheduled_date: order.scheduled_date || '',
      notes: order.notes || '',
      assigned_employee_id: order.assigned_employee_id || '',
    });
    setIsViewMode(false);
    setIsEditing(true);
    setIsAssignMode(true);
    setEditingId(order.id);
    if (order.bom_id) {
      await fetchBomItems(order.bom_id);
    }
    setIsDialogOpen(true);
  };

  const handleCopyFromView = async () => {
    const order = orders.find(o => o.id === editingId);
    if (!order) return;
    try {
      const { data: nextId, error: idError } = await supabase.rpc('get_next_production_order_number', {
        p_company_id: companyId!,
      });
      if (idError) throw idError;

      setFormData({
        order_number: nextId || nextOrderNumber,
        bom_id: order.bom_id || '',
        location_id: order.location_id,
        quantity: order.quantity,
        status: 'pending',
        scheduled_date: order.scheduled_date || '',
        notes: order.notes || '',
        assigned_employee_id: '',
      });
      setIsViewMode(false);
      setIsEditing(false);
      setIsAssignMode(false);
      setEditingId(null);
      if (order.bom_id) {
        await fetchBomItems(order.bom_id);
      }
      toast.success(`New order pre-filled from ${order.order_number}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to copy production order');
    }
  };

  const handleCopyFromId = async () => {
    const lookup = copyFromId.trim();
    if (!lookup) return;
    setCopyFromLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .eq('company_id', companyId!)
        .ilike('order_number', lookup)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error(`Production order "${lookup}" not found`);
        return;
      }

      setFormData(prev => ({
        ...prev,
        bom_id: data.bom_id || '',
        location_id: data.location_id,
        quantity: data.quantity,
        scheduled_date: data.scheduled_date || '',
        notes: data.notes || '',
        assigned_employee_id: '',
      }));
      if (data.bom_id) {
        await fetchBomItems(data.bom_id);
      }
      toast.success(`Copied details from ${data.order_number}`);
      setCopyFromId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to load production order');
    } finally {
      setCopyFromLoading(false);
    }
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

  const handleStart = async (order: ProductionOrder) => {
    const { error } = await supabase
      .from('production_orders')
      .update({ status: 'in_progress' })
      .eq('id', order.id);

    if (error) {
      toast.error('Failed to start production order');
      return;
    }
    toast.success('Production order started');
    fetchOrders();
  };

  const handleStartForeground = (order: ProductionOrder) => {
    if (!order.bom_id) {
      toast.error('This order has no Bill of Materials assigned');
      return;
    }
    // Update status to in_progress if pending
    if (order.status === 'pending') {
      supabase
        .from('production_orders')
        .update({ status: 'in_progress' })
        .eq('id', order.id)
        .then(() => fetchOrders());
    }
    setForegroundOrder(order);
    setIsForegroundDialogOpen(true);
  };

  const handleForegroundComplete = () => {
    setForegroundOrder(null);
    fetchOrders();
  };

  const handleConfirm = async (order: ProductionOrder) => {
    if (!order.bom_id) {
      toast.error('This order has no Bill of Materials assigned');
      return;
    }

    try {
      // Fetch all steps for this BOM
      const { data: stepsData, error: stepsError } = await supabase
        .from('bom_steps')
        .select(`
          id,
          bin_id,
          step_number
        `)
        .eq('bom_id', order.bom_id)
        .order('step_number');

      if (stepsError) throw stepsError;
      if (!stepsData || stepsData.length === 0) {
        // No steps, just complete
        await supabase
          .from('production_orders')
          .update({ 
            status: 'completed',
            completed_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', order.id);
        toast.success('Production order completed!');
        fetchOrders();
        return;
      }

      // Get completed steps
      const { data: orderData } = await supabase
        .from('production_orders')
        .select('completed_step_ids')
        .eq('id', order.id)
        .single();

      const completedStepIds = new Set(orderData?.completed_step_ids || []);
      const remainingSteps = stepsData.filter(s => !completedStepIds.has(s.id));

      // Fetch step items for remaining steps
      const stepIds = remainingSteps.map(s => s.id);
      const { data: stepItemsData } = await supabase
        .from('bom_step_items')
        .select('bom_step_id, product_id, quantity')
        .in('bom_step_id', stepIds);

      // Process each remaining step
      for (const step of remainingSteps) {
        const items = (stepItemsData || []).filter(i => i.bom_step_id === step.id);
        
        if (step.bin_id && items.length > 0) {
          for (const item of items) {
            const requiredQty = item.quantity * order.quantity;
            
            const { data: invRecords } = await supabase
              .from('inventory')
              .select('id, quantity')
              .eq('bin_id', step.bin_id)
              .eq('product_id', item.product_id)
              .gt('quantity', 0)
              .order('quantity', { ascending: false });

            if (!invRecords || invRecords.length === 0) {
              toast.error(`Insufficient inventory for step ${step.step_number}. Use "Complete in Foreground" to see details.`);
              return;
            }

            // Check total available
            const totalAvailable = invRecords.reduce((sum, inv) => sum + inv.quantity, 0);
            if (totalAvailable < requiredQty) {
              toast.error(`Insufficient inventory for step ${step.step_number}. Use "Complete in Foreground" to see details.`);
              return;
            }

            // Deduct from inventory
            let remainingToDeduct = requiredQty;
            for (const inv of invRecords) {
              if (remainingToDeduct <= 0) break;
              
              const deductAmount = Math.min(inv.quantity, remainingToDeduct);
              const newQuantity = inv.quantity - deductAmount;
              
              if (newQuantity === 0) {
                await supabase.from('inventory').delete().eq('id', inv.id);
              } else {
                await supabase
                  .from('inventory')
                  .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
                  .eq('id', inv.id);
              }
              
              remainingToDeduct -= deductAmount;
            }
          }

          // Create Goods Issue for this step's consumed components
          await createProductionGoodsIssue({
            companyId: companyId!,
            locationId: order.location_id,
            orderId: order.id,
            orderNumber: order.order_number,
            items: items.map(item => ({
              productId: item.product_id,
              quantity: item.quantity * order.quantity,
              binId: step.bin_id,
            })),
          });
        }
        
        // Mark step as completed
        completedStepIds.add(step.id);
      }

      // Create Goods Receipt for finished goods
      const { data: bom } = await supabase
        .from('bill_of_materials')
        .select('product_id, output_quantity')
        .eq('id', order.bom_id)
        .single();

      if (bom) {
        const totalOutputQty = bom.output_quantity * order.quantity;
        // Place finished goods in the first step's bin (component bin)
        const firstStep = stepsData[0];
        const targetBinId = firstStep?.bin_id || null;

        await createProductionGoodsReceipt({
          companyId: companyId!,
          locationId: order.location_id,
          orderId: order.id,
          orderNumber: order.order_number,
          productId: bom.product_id,
          quantity: totalOutputQty,
          binId: targetBinId,
        });

        // Add to inventory
        if (targetBinId) {
          const { data: existingInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('product_id', bom.product_id)
            .eq('bin_id', targetBinId)
            .eq('location_id', order.location_id)
            .maybeSingle();

          if (existingInv) {
            await supabase
              .from('inventory')
              .update({ quantity: existingInv.quantity + totalOutputQty, updated_at: new Date().toISOString() })
              .eq('id', existingInv.id);
          } else {
            await supabase
              .from('inventory')
              .insert({ product_id: bom.product_id, location_id: order.location_id, bin_id: targetBinId, quantity: totalOutputQty });
          }
        } else {
          const { data: existingInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('product_id', bom.product_id)
            .eq('location_id', order.location_id)
            .is('bin_id', null)
            .maybeSingle();

          if (existingInv) {
            await supabase
              .from('inventory')
              .update({ quantity: existingInv.quantity + totalOutputQty, updated_at: new Date().toISOString() })
              .eq('id', existingInv.id);
          } else {
            await supabase
              .from('inventory')
              .insert({ product_id: bom.product_id, location_id: order.location_id, quantity: totalOutputQty });
          }
        }

        // Create ledger transaction for output value
        const { data: product } = await supabase
          .from('products')
          .select('price, name')
          .eq('id', bom.product_id)
          .single();

        const totalValue = totalOutputQty * (product?.price || 0);
        if (totalValue > 0) {
          const { getInventoryLedgerId } = await import('@/lib/inventory-account');
          const resolvedLedgerId = await getInventoryLedgerId(order.location_id, companyId!);

          if (resolvedLedgerId) {
            await supabase
              .from('ledger_transactions')
              .insert({
                ledger_id: resolvedLedgerId,
                transaction_type: 'production_output',
                reference_id: order.id,
                reference_number: order.order_number,
                amount: totalValue,
                description: `Production output: ${product?.name} x${totalOutputQty} from ${order.order_number}`,
                transaction_date: new Date().toISOString(),
              });
          }
        }
      }

      // Update order as completed
      await supabase
        .from('production_orders')
        .update({ 
          status: 'completed',
          completed_date: new Date().toISOString().split('T')[0],
          completed_step_ids: Array.from(completedStepIds),
        })
        .eq('id', order.id);

      toast.success('Production order completed!');
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm production order');
      console.error(error);
    }
  };

  const handleCompleteForeground = (order: ProductionOrder) => {
    if (!order.bom_id) {
      toast.error('This order has no Bill of Materials assigned');
      return;
    }
    setForegroundOrder(order);
    setIsForegroundDialogOpen(true);
  };

  const handleBomChange = async (bomId: string) => {
    setFormData(prev => ({ ...prev, bom_id: bomId }));
    await fetchBomItems(bomId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bom_id) {
      toast.error('Please select a Bill of Materials');
      return;
    }
    if (!formData.location_id) {
      toast.error('Please select a production location');
      return;
    }

    const selectedBom = boms.find(b => b.id === formData.bom_id);
    if (!selectedBom) {
      toast.error('Invalid BoM selected');
      return;
    }

    try {
      if (isAssignMode && editingId) {
        const { error } = await supabase
          .from('production_orders')
          .update({
            assigned_employee_id: formData.assigned_employee_id || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Employee assigned successfully');
      } else if (isEditing && editingId) {
        const { error } = await supabase
          .from('production_orders')
          .update({
            bom_id: formData.bom_id,
            product_id: selectedBom.product_id,
            location_id: formData.location_id,
            quantity: formData.quantity,
            status: formData.status,
            scheduled_date: formData.scheduled_date || null,
            notes: formData.notes || null,
            assigned_employee_id: formData.assigned_employee_id || null,
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
            bom_id: formData.bom_id,
            product_id: selectedBom.product_id,
            location_id: formData.location_id,
            quantity: formData.quantity,
            status: formData.status,
            scheduled_date: formData.scheduled_date || null,
            notes: formData.notes || null,
            assigned_employee_id: formData.assigned_employee_id || null,
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

  // Get selected BoM details
  const selectedBom = boms.find(b => b.id === formData.bom_id);

  // --- Import/Export handlers ---
  const handleDownloadTemplate = () => {
    exportToExcel([], 'production_orders_template.xlsx', 'Production Orders', [
      { header: 'BOM Name', key: 'BOM Name', width: 25 },
      { header: 'Location', key: 'Location', width: 20 },
      { header: 'Quantity', key: 'Quantity', width: 12 },
      { header: 'Scheduled Date', key: 'Scheduled Date', width: 18 },
      { header: 'Notes', key: 'Notes', width: 30 },
    ]);
  };

  const handleExport = () => {
    const exportData = filteredOrders.map(o => ({
      'Order #': o.order_number,
      'BOM': o.bom?.name || '',
      'Output Product': o.product?.name || '',
      'Quantity': o.quantity,
      'Status': o.status,
      'Duration': formatDuration(o.total_duration),
      'Assigned To': o.assigned_employee ? `${o.assigned_employee.first_name} ${o.assigned_employee.last_name}` : '',
      'Location': o.location?.name || '',
      'Scheduled Date': o.scheduled_date ? format(parseISO(o.scheduled_date), 'yyyy-MM-dd') : '',
      'Notes': o.notes || '',
    }));
    exportToExcel(exportData, 'production_orders.xlsx', 'Production Orders');
  };

  const handleImport = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) {
        toast.error('No data found in file');
        return;
      }

      setImportResults([]);
      setImportTotal(rows.length);
      setImportProcessed(0);
      setIsImportComplete(false);
      setIsImportDialogOpen(true);

      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
          const bomName = row['BOM Name']?.toString().trim();
          if (!bomName) {
            results.push({ row: rowNum, status: 'error', message: 'BOM Name is required' });
            setImportResults([...results]);
            setImportProcessed(i + 1);
            continue;
          }

          const bom = boms.find(b => b.name.toLowerCase() === bomName.toLowerCase());
          if (!bom) {
            results.push({ row: rowNum, status: 'error', message: `BOM "${bomName}" not found` });
            setImportResults([...results]);
            setImportProcessed(i + 1);
            continue;
          }

          const locationName = row['Location']?.toString().trim();
          if (!locationName) {
            results.push({ row: rowNum, status: 'error', message: 'Location is required' });
            setImportResults([...results]);
            setImportProcessed(i + 1);
            continue;
          }

          const location = productionLocations.find(l => l.name.toLowerCase() === locationName.toLowerCase());
          if (!location) {
            results.push({ row: rowNum, status: 'error', message: `Production location "${locationName}" not found` });
            setImportResults([...results]);
            setImportProcessed(i + 1);
            continue;
          }

          const quantity = Number(row['Quantity']) || 1;
          const scheduledDate = row['Scheduled Date']?.toString().trim() || null;
          const notes = row['Notes']?.toString().trim() || null;

          const { data: nextId } = await supabase.rpc('get_next_production_order_number', {
            p_company_id: companyId,
          });

          const { error: insertError } = await supabase
            .from('production_orders')
            .insert({
              company_id: companyId,
              order_number: nextId || `PRO-${String(i + 1).padStart(4, '0')}`,
              bom_id: bom.id,
              product_id: bom.product_id,
              location_id: location.id,
              quantity,
              status: 'pending',
              scheduled_date: scheduledDate,
              notes,
            });

          if (insertError) throw insertError;
          results.push({ row: rowNum, status: 'success', message: `Order created for BOM "${bomName}"` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed to create order' });
        }

        setImportResults([...results]);
        setImportProcessed(i + 1);
      }

      setIsImportComplete(true);
      fetchOrders();
      fetchNextOrderNumber();
    } catch (err: any) {
      toast.error(err.message || 'Failed to read file');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-4 pr-16">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
            <ArrowLeft className="w-4 h-4" />
            <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
          </Button>
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-indigo-500" />
            <h1 className="font-semibold">Production Orders</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <Select
                value={selectedLocationId || '__all__'}
                onValueChange={(value) => setSelectedLocationId(value === '__all__' ? '' : value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Locations</SelectItem>
                  {productionLocations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ColumnToggle
              columns={PRODUCTION_ORDER_COLUMNS}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onResetToDefaults={resetToDefaults}
              onShowAll={showAll}
              onHideAll={hideAll}
            />
            <ImportExportButtons
              importEnabled={isImportEnabled('production_order')}
              exportEnabled={isExportEnabled('production_order')}
              onImport={handleImport}
              onExport={handleExport}
              onDownloadTemplate={handleDownloadTemplate}
              entityName="Production Orders"
            />
            <Button onClick={handleOpenDialog} size="icon" className="relative">
              <Plus className="w-4 h-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <ProductionOrderTable
          orders={filteredOrders}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStart={handleStart}
          onStartForeground={handleStartForeground}
          onConfirm={handleConfirm}
          onCompleteForeground={handleCompleteForeground}
          onAssignEmployee={handleAssignEmployee}
          onPrint={handlePrintOrder}
          isColumnVisible={isColumnVisible}
        />
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-2xl max-h-[85vh]'}`}>
          {isViewMode && editingId && (
            <button
              type="button"
              onClick={handleCopyFromView}
              title="Copy this order into a new production order"
              className="absolute right-[4.5rem] top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          {!isViewMode && !isEditing && !isAssignMode && (
            <CopyFromIdDialog<any>
              idLabel="Order ID"
              className="absolute right-[4.5rem] top-4 z-10"
              onFetch={async (lookup) => {
                const { data } = await supabase
                  .from('production_orders')
                  .select('*')
                  .eq('company_id', companyId!)
                  .ilike('order_number', lookup)
                  .maybeSingle();
                return data || null;
              }}
              onApply={(data) => {
                setFormData(prev => ({
                  ...prev,
                  bom_id: data.bom_id || '',
                  location_id: data.location_id,
                  quantity: data.quantity,
                  scheduled_date: data.scheduled_date || '',
                  notes: data.notes || '',
                  assigned_employee_id: '',
                }));
                if (data.bom_id) fetchBomItems(data.bom_id);
              }}
            />
          )}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {isAssignMode ? 'Assign Employee' : isViewMode ? 'View Production Order' : isEditing ? 'Edit Production Order' : 'New Production Order'}
            </DialogTitle>
            <DialogDescription>
              {isAssignMode
                ? 'Assign an employee to this production order'
                : isViewMode 
                  ? 'View production order details' 
                  : isEditing 
                    ? 'Update production order details' 
                    : 'Create a new production order from a Bill of Materials'}
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <Tabs defaultValue="details" className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="shrink-0 mx-6">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="availability" className="relative">
                  Availability
                  {hasStockIssue && bomItems.length > 0 && formData.location_id && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      !
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <TabsContent value="details" className="mt-4 space-y-4">
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
                        disabled={isViewMode || isAssignMode}
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
                    <Label>Bill of Materials *</Label>
                    <Select
                      value={formData.bom_id}
                      onValueChange={handleBomChange}
                      disabled={isViewMode || isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Bill of Materials" />
                      </SelectTrigger>
                      <SelectContent>
                        {boms.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            No active BOMs found
                          </SelectItem>
                        ) : (
                          boms.map(bom => (
                            <SelectItem key={bom.id} value={bom.id}>
                              {bom.bom_id} - {bom.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedBom && (
                    <div className="p-3 bg-muted rounded-md space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Output:</span> {selectedBom.product?.product_id} - {selectedBom.product?.name}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Yields:</span> {selectedBom.output_quantity} per batch
                      </p>
                      {bomDurations[selectedBom.id] && (
                        <p className="text-sm flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className="font-medium">Est. Duration:</span> {formatDuration(bomDurations[selectedBom.id])}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Production Location *</Label>
                    <Select
                      value={formData.location_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value, assigned_employee_id: '' }))}
                      disabled={isViewMode || isAssignMode}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a production-enabled location" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionLocations.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            No production-enabled locations found
                          </SelectItem>
                        ) : (
                          productionLocations.map(location => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.location_id} - {location.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Assigned Employee</Label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Unassigned' },
                        ...locationEmployees.map(emp => ({
                          value: emp.id,
                          label: `${emp.employee_id} - ${emp.first_name} ${emp.last_name}`,
                        })),
                      ]}
                      value={formData.assigned_employee_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_employee_id: value }))}
                      placeholder={formData.location_id ? "Select an employee" : "Select a location first"}
                      disabled={isViewMode || !formData.location_id}
                    />
                    {formData.location_id && locationEmployees.length === 0 && (
                      <p className="text-xs text-muted-foreground">No employees assigned to this location</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Batches to Produce</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        disabled={isViewMode || isAssignMode}
                      />
                      {selectedBom && (
                        <p className="text-xs text-muted-foreground">
                          Total output: {formData.quantity * selectedBom.output_quantity} units
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Scheduled Date</Label>
                      <Input
                        type="date"
                        value={formData.scheduled_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                        disabled={isViewMode || isAssignMode}
                      />
                    </div>
                  </div>

                  {bomItems.length > 0 && (
                    <div className="space-y-2">
                      <Label>Required Components</Label>
                      <div className="border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableCell className="font-medium">Component</TableCell>
                              <TableCell className="font-medium w-32">Per Batch</TableCell>
                              <TableCell className="font-medium w-32">Total Required</TableCell>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bomItems.map(item => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  {item.product?.product_id} - {item.product?.name}
                                </TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell className="font-medium">
                                  {item.quantity * formData.quantity}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="availability" className="mt-4 space-y-4">
                  {!formData.location_id ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                      Select a production location to view component availability
                    </p>
                  ) : bomItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                      Select a Bill of Materials to see component availability
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead className="text-right">Required</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bomItems.map(item => {
                          const availability = itemAvailability[item.product_id];
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <span className="font-medium">{item.product?.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">{item.product?.product_id}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">{availability?.required || 0}</TableCell>
                              <TableCell className="text-right font-mono">{availability?.available || 0}</TableCell>
                              <TableCell className="text-right">
                                {availability?.sufficient ? (
                                  <Badge variant="default" className="bg-primary text-primary-foreground">
                                    <Check className="w-3 h-3 mr-1" />
                                    In Stock
                                  </Badge>
                                ) : (availability?.available || 0) > 0 ? (
                                  <Badge variant="secondary" className="bg-accent text-accent-foreground">
                                    Partial ({availability?.available})
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <X className="w-3 h-3 mr-1" />
                                    Out of Stock
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      disabled={isViewMode || isAssignMode}
                      rows={6}
                      placeholder="Add any additional notes about this production order..."
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="shrink-0 px-6 pb-6">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const order = orders.find((o) => o.id === editingId);
                    if (order) handlePrintOrder(order);
                  }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              )}
              {!isViewMode && (
                <Button type="submit">
                  {isEditing ? 'Update' : 'Create'}
                  <Kbd>⌘S</Kbd>
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Step-by-step production dialog */}
      {foregroundOrder && companyId && (
        <StepByStepProductionDialog
          open={isForegroundDialogOpen}
          onOpenChange={setIsForegroundDialogOpen}
          orderId={foregroundOrder.id}
          orderNumber={foregroundOrder.order_number}
          bomId={foregroundOrder.bom_id || ''}
          locationId={foregroundOrder.location_id}
          quantity={foregroundOrder.quantity}
          companyId={companyId}
          onComplete={handleForegroundComplete}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Production Order"
        description={`Are you sure you want to delete production order ${deleteTarget?.order_number ?? ''}? This action cannot be undone.`}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      <ImportProgressDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Importing Production Orders"
        totalRows={importTotal}
        processedRows={importProcessed}
        results={importResults}
        isComplete={isImportComplete}
      />
    </div>
  );
};

export default Production;
