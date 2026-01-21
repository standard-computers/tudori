import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useTableSort } from '@/hooks/use-table-sort';
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
import { ArrowLeft, Warehouse, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

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

// Separated table component with sorting/filtering
const InventoryTable = ({
  inventory,
}: {
  inventory: InventoryItem[];
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(inventory, 'product.product_id', 'asc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
              <SortableTableHead
                label="Product Name"
                sortKey="product.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['product.name']}
                onFilter={(value) => setFilter('product.name', value)}
              />
              <SortableTableHead
                label="SKU"
                sortKey="product.sku"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['product.sku']}
                onFilter={(value) => setFilter('product.sku', value)}
              />
              <SortableTableHead
                label="Category"
                sortKey="product.category"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['product.category']}
                onFilter={(value) => setFilter('product.category', value)}
              />
              <SortableTableHead
                label="Area"
                sortKey="bin.area.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['bin.area.name']}
                onFilter={(value) => setFilter('bin.area.name', value)}
              />
              <SortableTableHead
                label="Bin"
                sortKey="bin.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['bin.name']}
                onFilter={(value) => setFilter('bin.name', value)}
              />
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
              <SortableTableHead
                label="Unit"
                sortKey="product.unit"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['product.unit']}
                onFilter={(value) => setFilter('product.unit', value)}
              />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No inventory items match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((item) => {
                const isLow = item.min_quantity !== null && item.quantity < item.min_quantity;
                const isHigh = item.max_quantity !== null && item.quantity > item.max_quantity;
                
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.product?.product_id || '-'}</TableCell>
                    <TableCell className="font-medium">{item.product?.name || '-'}</TableCell>
                    <TableCell>{item.product?.sku || '-'}</TableCell>
                    <TableCell>{item.product?.category || '-'}</TableCell>
                    <TableCell>{item.bin?.area?.name || '-'}</TableCell>
                    <TableCell>{item.bin?.name || '-'}</TableCell>
                    <TableCell className="text-right">
                      <span className={isLow ? 'text-destructive font-medium' : isHigh ? 'text-warning font-medium' : ''}>
                        {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell>{item.product?.unit || 'each'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.min_quantity ?? '-'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.max_quantity ?? '-'}</TableCell>
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
        product:products(id, product_id, name, sku, category, unit),
        bin:bins(id, bin_id, name, area:areas(id, area_id, name))
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
      <div className="border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-blue-500" />
              <h1 className="text-xl font-semibold">Inventory</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
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
      </div>

      <div className="p-6">
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
            <div className="flex items-center gap-6 text-sm text-muted-foreground pb-2 border-b">
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

            {inventory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No inventory at this location
              </div>
            ) : (
              <InventoryTable inventory={inventory} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
