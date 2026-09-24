import { useEffect, useState, useMemo } from 'react';
import { useShiftSelect } from '@/hooks/use-shift-select';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useTableSort } from '@/hooks/use-table-sort';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { INVENTORY_COLUMNS } from '@/config/column-layouts';
import { ColumnToggle } from '@/components/ColumnToggle';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/SortableTableHead';
import { ArrowLeft, Warehouse, X, ClipboardList, RefreshCw, Download, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { toast } from '@/lib/toast';
import { InventoryCountDialog } from '@/components/inventory/InventoryCountDialog';
import { InventoryDetailDialog } from '@/components/InventoryDetailDialog';
import { useExcel } from '@/hooks/use-excel';
import { Checkbox } from '@/components/ui/checkbox';
import { printInventoryLabels, LabelItem } from '@/lib/print-label';

interface Location {
  id: string;
  location_id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  quantity: number;
  min_quantity: number | null;
  max_quantity: number | null;
  notes: string | null;
  last_counted_at: string | null;
  product: {
    id: string;
    product_id: string;
    name: string;
    sku: string | null;
    category: string | null;
    unit: string | null;
  } | null;
  bin: {
    id: string;
    bin_id: string;
    name: string;
    area: {
      id: string;
      area_id: string;
      name: string;
    } | null;
  } | null;
}


// Column definitions for Inventory table

// Separated table component with sorting/filtering
const InventoryTable = ({
  inventory,
  isColumnVisible,
  onRowClick,
  selectedIds,
  onSelectionChange,
  onToggleSelectAll,
}: {
  inventory: InventoryItem[];
  isColumnVisible: (key: string) => boolean;
  onRowClick: (item: InventoryItem) => void;
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onToggleSelectAll: (checked: boolean) => void;
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(inventory, 'product.product_id', 'asc');

  const orderedIds = useMemo(() => sortedAndFilteredData.map(i => i.id), [sortedAndFilteredData]);
  const { handleRowSelect } = useShiftSelect(orderedIds, selectedIds, onSelectionChange);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const visibleColumnCount = INVENTORY_COLUMNS.filter(c => isColumnVisible(c.key)).length + 1;
  const allFilteredSelected = sortedAndFilteredData.length > 0 && sortedAndFilteredData.every(i => selectedIds.has(i.id));

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {inventory.length} items
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
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={(checked) => onToggleSelectAll(!!checked)}
                  aria-label="Select all"
                />
              </TableHead>
              {isColumnVisible('product_id') && (
                <SortableTableHead
                  label="Product ID"
                  sortKey="product.product_id"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['product.product_id']}
                  onFilter={(value) => setFilter('product.product_id', value)}
                  className="w-28"
                />
              )}
              {isColumnVisible('product_name') && (
                <SortableTableHead
                  label="Product Name"
                  sortKey="product.name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['product.name']}
                  onFilter={(value) => setFilter('product.name', value)}
                />
              )}
              {isColumnVisible('sku') && (
                <SortableTableHead
                  label="SKU"
                  sortKey="product.sku"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['product.sku']}
                  onFilter={(value) => setFilter('product.sku', value)}
                />
              )}
              {isColumnVisible('category') && (
                <SortableTableHead
                  label="Category"
                  sortKey="product.category"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['product.category']}
                  onFilter={(value) => setFilter('product.category', value)}
                />
              )}
              {isColumnVisible('area') && (
                <SortableTableHead
                  label="Area"
                  sortKey="bin.area.name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['bin.area.name']}
                  onFilter={(value) => setFilter('bin.area.name', value)}
                />
              )}
              {isColumnVisible('bin') && (
                <SortableTableHead
                  label="Bin"
                  sortKey="bin.name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['bin.name']}
                  onFilter={(value) => setFilter('bin.name', value)}
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
                  className="text-right"
                />
              )}
              {isColumnVisible('unit') && (
                <SortableTableHead
                  label="Unit"
                  sortKey="product.unit"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['product.unit']}
                  onFilter={(value) => setFilter('product.unit', value)}
                />
              )}
              {isColumnVisible('min') && (
                <SortableTableHead
                  label="Min"
                  sortKey="min_quantity"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['min_quantity']}
                  onFilter={(value) => setFilter('min_quantity', value)}
                  className="text-right"
                />
              )}
              {isColumnVisible('max') && (
                <SortableTableHead
                  label="Max"
                  sortKey="max_quantity"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['max_quantity']}
                  onFilter={(value) => setFilter('max_quantity', value)}
                  className="text-right"
                />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="text-center py-8 text-muted-foreground">
                  No inventory items match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((item) => {
                const isLow = item.min_quantity !== null && item.quantity < item.min_quantity;
                const isHigh = item.max_quantity !== null && item.quantity > item.max_quantity;
                
                return (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => onRowClick(item)}>
                    <TableCell onClick={(e) => {
                      e.stopPropagation();
                      handleRowSelect(item.id, !selectedIds.has(item.id), e.shiftKey);
                    }}>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => {}}
                        aria-label={`Select ${item.product?.name}`}
                      />
                    </TableCell>
                    {isColumnVisible('product_id') && (
                      <TableCell className="font-mono text-sm">{item.product?.product_id || '-'}</TableCell>
                    )}
                    {isColumnVisible('product_name') && (
                      <TableCell className="font-medium">{item.product?.name || '-'}</TableCell>
                    )}
                    {isColumnVisible('sku') && (
                      <TableCell>{item.product?.sku || '-'}</TableCell>
                    )}
                    {isColumnVisible('category') && (
                      <TableCell>{item.product?.category || '-'}</TableCell>
                    )}
                    {isColumnVisible('area') && (
                      <TableCell>{item.bin?.area?.name || '-'}</TableCell>
                    )}
                    {isColumnVisible('bin') && (
                      <TableCell>{item.bin?.name || '-'}</TableCell>
                    )}
                    {isColumnVisible('quantity') && (
                      <TableCell className="text-right">
                        <span className={isLow ? 'text-destructive font-medium' : isHigh ? 'text-warning font-medium' : ''}>
                          {item.quantity}
                        </span>
                      </TableCell>
                    )}
                    {isColumnVisible('unit') && (
                      <TableCell>{item.product?.unit || 'each'}</TableCell>
                    )}
                    {isColumnVisible('min') && (
                      <TableCell className="text-right text-muted-foreground">{item.min_quantity ?? '-'}</TableCell>
                    )}
                    {isColumnVisible('max') && (
                      <TableCell className="text-right text-muted-foreground">{item.max_quantity ?? '-'}</TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const Inventory = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCountDialogOpen, setIsCountDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { exportToExcel } = useExcel();
  // Column visibility
  const {
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    resetToDefaults,
    showAll,
    hideAll,
  } = useColumnVisibility('inventory', INVENTORY_COLUMNS);

  useEffect(() => {
    setTransaction('inv');
  }, [setTransaction]);

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
      fetchLocations();
    }
  }, [companyId]);

  useEffect(() => {
    if (selectedLocationId) {
      fetchInventory();
    } else {
      setInventory([]);
    }
  }, [selectedLocationId]);

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

  const fetchLocations = async () => {
    // Get locations the user has access to
    const { data: locationUsers } = await supabase
      .from('location_users')
      .select('location_id')
      .eq('user_id', user!.id);

    const accessibleLocationIds = locationUsers?.map(lu => lu.location_id) || [];

    const { data, error } = await supabase
      .from('locations')
      .select('id, location_id, name')
      .eq('company_id', companyId!)
      .order('name');

    if (error) {
      toast.error('Failed to load locations');
      return;
    }

    // Filter to only accessible locations if user has specific assignments
    const filteredLocations = accessibleLocationIds.length > 0
      ? (data || []).filter(loc => accessibleLocationIds.includes(loc.id))
      : data || [];

    setLocations(filteredLocations);

    // Auto-select first location if available
    if (filteredLocations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(filteredLocations[0].id);
    }
  };

  const fetchInventory = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        id,
        quantity,
        min_quantity,
        max_quantity,
        notes,
        last_counted_at,
        product:products(id, product_id, name, sku, category, unit, company_id),
        bin:bins(id, bin_id, name, area:areas(id, area_id, name)),
        packaging_unit:packaging_units(pu_number)
      `)
      .eq('location_id', selectedLocationId)
      .order('quantity', { ascending: false });

    setIsLoading(false);

    if (error) {
      toast.error('Failed to load inventory');
      console.error('Inventory fetch error:', error);
      return;
    }

    setInventory(data as unknown as InventoryItem[] || []);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueProducts = new Set(inventory.map(item => item.product?.id)).size;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
              <ArrowLeft className="h-4 w-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
            </Button>
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-blue-500" />
              <h1 className="text-xl font-semibold">Inventory</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ColumnToggle
              columns={INVENTORY_COLUMNS}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onResetToDefaults={resetToDefaults}
              onShowAll={showAll}
              onHideAll={hideAll}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => { if (selectedLocationId) fetchInventory(); }}
              disabled={!selectedLocationId || isLoading}
              title="Refresh inventory"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCountDialogOpen(true)}
              disabled={!selectedLocationId}
            >
              <ClipboardList className="h-4 w-4 mr-1" />
              Count
            </Button>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name} ({location.location_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="px-0">
        {!selectedLocationId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a location to view inventory
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="flex items-center justify-between pb-2 border-b px-4">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground">{selectedLocation?.name}</strong>
                </span>
                <span>
                  <strong className="text-foreground">{inventory.length}</strong> inventory records
                </span>
                <span>
                  <strong className="text-foreground">{uniqueProducts}</strong> unique products
                </span>
                <span>
                  <strong className="text-foreground">{totalQuantity.toLocaleString()}</strong> total units
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const items: LabelItem[] = inventory
                        .filter(i => selectedIds.has(i.id))
                        .map(item => ({
                          productId: item.product?.product_id || '',
                          productName: item.product?.name || '',
                          sku: item.product?.sku || null,
                          bin: item.bin?.name || null,
                          area: item.bin?.area?.name || null,
                          quantity: item.quantity,
                          puNumber: (item as any).packaging_unit?.pu_number || null,
                        }));
                      printInventoryLabels(items);
                      toast.success(`Printing ${items.length} label(s)`);
                    }}
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Print Labels ({selectedIds.size})
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rows = inventory.map(item => ({
                      'Product ID': item.product?.product_id || '',
                      'Product Name': item.product?.name || '',
                      'SKU': item.product?.sku || '',
                      'Category': item.product?.category || '',
                      'Area': item.bin?.area?.name || '',
                      'Bin': item.bin?.name || '',
                      'Quantity': item.quantity,
                      'Unit': item.product?.unit || '',
                      'Min': item.min_quantity ?? '',
                      'Max': item.max_quantity ?? '',
                    }));
                    exportToExcel(rows, `inventory-${selectedLocation?.name || 'export'}`);
                    toast.success('Inventory exported');
                  }}
                  disabled={inventory.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>

            {inventory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No inventory at this location
              </div>
            ) : (
              <InventoryTable
                inventory={inventory}
                isColumnVisible={isColumnVisible}
                onRowClick={(item) => {
                  setSelectedItem(item);
                  setIsDetailOpen(true);
                }}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onToggleSelectAll={(checked) => {
                  if (checked) {
                    setSelectedIds(new Set(inventory.map(i => i.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
              />
            )}
          </div>
        )}
      </div>

      <InventoryCountDialog
        open={isCountDialogOpen}
        onOpenChange={setIsCountDialogOpen}
        companyId={companyId}
        locationId={selectedLocationId}
        locationName={selectedLocation?.name || ''}
        inventory={inventory}
      />

      <InventoryDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        item={selectedItem as any}
        locationId={selectedLocationId}
        onUpdated={fetchInventory}
      />
    </div>
  );
};

export default Inventory;
