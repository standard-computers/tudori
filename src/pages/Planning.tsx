import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
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
import { SortableTableHead } from '@/components/SortableTableHead';
import { useTableSort } from '@/hooks/use-table-sort';
import { ArrowLeft, MapPin, ShoppingCart, Factory, AlertTriangle, FileSpreadsheet, ChevronRight, Loader2, Check, X, Shield } from 'lucide-react';
import { SafetyStockDialog } from '@/components/planning/SafetyStockDialog';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { toast } from 'sonner';

interface LocationSummary {
  id: string;
  location_id: string;
  name: string;
  salesOrderCount: number;
  productionOrderCount: number;
  shortfallCount: number;
}

interface SalesOrderItem {
  orderId: string;
  orderNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  quantityOrdered: number;
}

interface ProductionRequirement {
  orderId: string;
  orderNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  quantityRequired: number;
}

interface InventoryShortfall {
  productId: string;
  productCode: string;
  productName: string;
  unit: string | null;
  vendorId: string | null;
  vendorName: string | null;
  unitPrice: number | null;
  totalRequired: number;
  safetyStock: number;
  currentStock: number;
  shortfall: number;
  salesOrders: string[];
  productionOrders: string[];
}

interface RequisitionItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  vendorId: string | null;
  unitPrice: number | null;
}

const Planning = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSummary | null>(null);
  const [shortfalls, setShortfalls] = useState<InventoryShortfall[]>([]);
  const [isLoadingShortfalls, setIsLoadingShortfalls] = useState(false);

  // Requisition creation state
  const [isReqDialogOpen, setIsReqDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [requisitionItems, setRequisitionItems] = useState<RequisitionItem[]>([]);

  // Progress state for bulk creation
  const [isCreating, setIsCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState({ current: 0, total: 0, currentAction: '' });
  const [createResults, setCreateResults] = useState<{ success: string[]; failed: string[] }>({ success: [], failed: [] });

  // Safety stock dialog state
  const [isSafetyDialogOpen, setIsSafetyDialogOpen] = useState(false);

  // Calculate number of requisitions that will be created (grouped by vendor)
  const vendorGroups = useMemo(() => {
    const groups = new Map<string | null, RequisitionItem[]>();
    requisitionItems.forEach(item => {
      const vendorKey = item.vendorId || null;
      const existing = groups.get(vendorKey) || [];
      existing.push(item);
      groups.set(vendorKey, existing);
    });
    return groups;
  }, [requisitionItems]);

  // Sorting and filtering for locations table
  const {
    sortConfig: locationsSortConfig,
    filters: locationsFilters,
    handleSort: handleLocationsSort,
    setFilter: setLocationsFilter,
    sortedAndFilteredData: sortedLocations,
  } = useTableSort<LocationSummary>(locations, 'name', 'asc');

  // Sorting and filtering for shortfalls table
  const {
    sortConfig: shortfallsSortConfig,
    filters: shortfallsFilters,
    handleSort: handleShortfallsSort,
    setFilter: setShortfallsFilter,
    sortedAndFilteredData: sortedShortfalls,
  } = useTableSort<InventoryShortfall>(shortfalls, 'shortfall', 'desc');

  // Keyboard shortcut for save (CTRL+S / CMD+S)
  useSaveShortcut(() => {
    if (isReqDialogOpen && requisitionItems.length > 0 && !isCreating) {
      handleCreateRequisition();
    }
  }, isReqDialogOpen);

  useEffect(() => {
    if (selectedLocation) {
      setTransaction('plan/loc');
    } else {
      setTransaction('plan');
    }
  }, [selectedLocation, setTransaction]);

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
      fetchLocationSummaries();
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

  const fetchLocationSummaries = async () => {
    // Get all locations
    const { data: locationsData, error: locationsError } = await supabase
      .from('locations')
      .select('id, location_id, name')
      .eq('company_id', companyId!)
      .order('name');

    if (locationsError || !locationsData) {
      toast.error('Failed to load locations');
      return;
    }

    // Get sales orders counts (confirmed + processing)
    const { data: salesOrders } = await supabase
      .from('sales_orders')
      .select('id, location_id')
      .eq('company_id', companyId!)
      .in('status', ['confirmed', 'processing']);

    // Get production orders counts (pending + in_progress)
    const { data: productionOrders } = await supabase
      .from('production_orders')
      .select('id, location_id')
      .eq('company_id', companyId!)
      .in('status', ['pending', 'in_progress']);

    // Get safety stock items per location to check for shortfalls
    const { data: safetyStocks } = await supabase
      .from('product_safety_stock')
      .select('location_id, product_id, safety_stock_quantity');

    // Get inventory levels to compare with safety stock
    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('location_id, product_id, quantity');

    // Build inventory map by location and product
    const inventoryByLocProduct = new Map<string, number>();
    inventoryData?.forEach(inv => {
      const key = `${inv.location_id}-${inv.product_id}`;
      inventoryByLocProduct.set(key, (inventoryByLocProduct.get(key) || 0) + inv.quantity);
    });

    // Check which locations have safety stock shortfalls
    const locationsWithSafetyShortfall = new Set<string>();
    safetyStocks?.forEach(ss => {
      const key = `${ss.location_id}-${ss.product_id}`;
      const currentStock = inventoryByLocProduct.get(key) || 0;
      if (currentStock < ss.safety_stock_quantity) {
        locationsWithSafetyShortfall.add(ss.location_id);
      }
    });

    // Build summaries
    const summaries: LocationSummary[] = locationsData.map(loc => {
      const soCount = salesOrders?.filter(so => so.location_id === loc.id).length || 0;
      const poCount = productionOrders?.filter(po => po.location_id === loc.id).length || 0;
      return {
        ...loc,
        salesOrderCount: soCount,
        productionOrderCount: poCount,
        shortfallCount: 0, // Will be calculated when drilling in
      };
    });

    // Filter to show locations with outstanding orders OR safety stock shortfalls
    const activeSummaries = summaries.filter(s => 
      s.salesOrderCount > 0 || s.productionOrderCount > 0 || locationsWithSafetyShortfall.has(s.id)
    );
    setLocations(activeSummaries);
  };

  const fetchShortfallsForLocation = async (locationId: string) => {
    setIsLoadingShortfalls(true);
    
    try {
      // Get sales order items for this location
      const { data: salesOrderItems } = await supabase
        .from('sales_orders')
        .select(`
          id,
          so_number,
          sales_order_items(
            product_id,
            quantity,
            product:products(product_id, name, unit, price, vendor_id, vendor:vendors(name))
          )
        `)
        .eq('company_id', companyId!)
        .eq('location_id', locationId)
        .in('status', ['confirmed', 'processing']);

      // Get production order requirements for this location
      const { data: productionOrders } = await supabase
        .from('production_orders')
        .select(`
          id,
          order_number,
          quantity,
          bom:bill_of_materials(
            bom_items(
              product_id,
              quantity,
              product:products(product_id, name, unit, price, vendor_id, vendor:vendors(name))
            )
          )
        `)
        .eq('company_id', companyId!)
        .eq('location_id', locationId)
        .in('status', ['pending', 'in_progress']);

      // Get current inventory at this location
      const { data: inventory } = await supabase
        .from('inventory')
        .select('product_id, quantity')
        .eq('location_id', locationId);

      // Get outstanding requisitions for this location (draft, pending, approved - not yet converted to PO)
      const { data: outstandingReqs } = await supabase
        .from('requisitions')
        .select(`
          id,
          requisition_id,
          requisition_items(product_id, quantity)
        `)
        .eq('company_id', companyId!)
        .eq('location_id', locationId)
        .in('status', ['draft', 'pending', 'approved']);

      // Build a map of already requisitioned quantities
      const requisitionedMap = new Map<string, number>();
      outstandingReqs?.forEach(req => {
        (req.requisition_items as any[])?.forEach(item => {
          const current = requisitionedMap.get(item.product_id) || 0;
          requisitionedMap.set(item.product_id, current + item.quantity);
        });
      });

      // Build requirement map
      const requirementMap = new Map<string, {
        productId: string;
        productCode: string;
        productName: string;
        unit: string | null;
        vendorId: string | null;
        vendorName: string | null;
        unitPrice: number | null;
        totalRequired: number;
        safetyStock: number;
        salesOrders: string[];
        productionOrders: string[];
      }>();

      // Get safety stock levels for this location
      const { data: safetyStocks } = await supabase
        .from('product_safety_stock')
        .select('product_id, safety_stock_quantity')
        .eq('location_id', locationId);

      const safetyStockMap = new Map<string, number>();
      safetyStocks?.forEach(ss => {
        safetyStockMap.set(ss.product_id, ss.safety_stock_quantity);
      });

      // Add sales order requirements
      salesOrderItems?.forEach(so => {
        (so.sales_order_items as any[])?.forEach(item => {
          const product = item.product;
          if (!product) return;
          
          const existing = requirementMap.get(item.product_id) || {
            productId: item.product_id,
            productCode: product.product_id,
            productName: product.name,
            unit: product.unit,
            vendorId: product.vendor_id,
            vendorName: product.vendor?.name || null,
            unitPrice: product.price || null,
            totalRequired: 0,
            safetyStock: safetyStockMap.get(item.product_id) || 0,
            salesOrders: [],
            productionOrders: [],
          };
          
          existing.totalRequired += item.quantity;
          if (!existing.salesOrders.includes(so.so_number)) {
            existing.salesOrders.push(so.so_number);
          }
          requirementMap.set(item.product_id, existing);
        });
      });

      // Add production order requirements (from BOM items)
      productionOrders?.forEach(po => {
        const bom = po.bom as any;
        if (!bom?.bom_items) return;
        
        (bom.bom_items as any[]).forEach(item => {
          const product = item.product;
          if (!product) return;
          
          const existing = requirementMap.get(item.product_id) || {
            productId: item.product_id,
            productCode: product.product_id,
            productName: product.name,
            unit: product.unit,
            vendorId: product.vendor_id,
            vendorName: product.vendor?.name || null,
            unitPrice: product.price || null,
            totalRequired: 0,
            safetyStock: safetyStockMap.get(item.product_id) || 0,
            salesOrders: [],
            productionOrders: [],
          };
          
          // Multiply BOM item quantity by production order quantity (batches)
          existing.totalRequired += item.quantity * po.quantity;
          if (!existing.productionOrders.includes(po.order_number)) {
            existing.productionOrders.push(po.order_number);
          }
          requirementMap.set(item.product_id, existing);
        });
      });

      // Build inventory map
      const inventoryMap = new Map<string, number>();
      inventory?.forEach(inv => {
        const current = inventoryMap.get(inv.product_id) || 0;
        inventoryMap.set(inv.product_id, current + inv.quantity);
      });

      // Add safety stock items that aren't already in the requirement map
      // This handles products with safety stock but no outstanding orders
      const { data: safetyStockProducts } = await supabase
        .from('product_safety_stock')
        .select(`
          product_id,
          safety_stock_quantity,
          product:products(product_id, name, unit, price, vendor_id, vendor:vendors(name))
        `)
        .eq('location_id', locationId);

      safetyStockProducts?.forEach(ss => {
        const product = ss.product as any;
        if (!product || requirementMap.has(ss.product_id)) return;
        
        // Only add if there's a potential shortfall (current stock < safety stock)
        const currentStock = inventoryMap.get(ss.product_id) || 0;
        if (currentStock < ss.safety_stock_quantity) {
          requirementMap.set(ss.product_id, {
            productId: ss.product_id,
            productCode: product.product_id,
            productName: product.name,
            unit: product.unit,
            vendorId: product.vendor_id,
            vendorName: product.vendor?.name || null,
            unitPrice: product.price || null,
            totalRequired: 0,
            safetyStock: ss.safety_stock_quantity,
            salesOrders: [],
            productionOrders: [],
          });
        }
      });

      // Calculate shortfalls (including safety stock, minus already requisitioned)
      const shortfallList: InventoryShortfall[] = [];
      requirementMap.forEach((req) => {
        const currentStock = inventoryMap.get(req.productId) || 0;
        const alreadyRequisitioned = requisitionedMap.get(req.productId) || 0;
        // Shortfall = required + safety stock - current stock - already requisitioned
        const shortfall = req.totalRequired + req.safetyStock - currentStock - alreadyRequisitioned;
        
        if (shortfall > 0) {
          shortfallList.push({
            ...req,
            currentStock,
            shortfall,
          });
        }
      });

      // Sort by shortfall descending
      shortfallList.sort((a, b) => b.shortfall - a.shortfall);
      setShortfalls(shortfallList);
    } catch (error) {
      toast.error('Failed to calculate shortfalls');
    } finally {
      setIsLoadingShortfalls(false);
    }
  };

  const handleLocationClick = async (location: LocationSummary) => {
    setSelectedLocation(location);
    await fetchShortfallsForLocation(location.id);
  };

  const handleBack = () => {
    if (selectedLocation) {
      setSelectedLocation(null);
      setShortfalls([]);
      setSelectedItems(new Set());
    } else {
      navigate('/dashboard');
    }
  };

  const handleToggleItem = (productId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === shortfalls.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(shortfalls.map(s => s.productId)));
    }
  };

  const handleOpenRequisitionDialog = () => {
    const items: RequisitionItem[] = shortfalls
      .filter(s => selectedItems.has(s.productId))
      .map(s => ({
        productId: s.productId,
        productCode: s.productCode,
        productName: s.productName,
        quantity: s.shortfall,
        vendorId: s.vendorId,
        unitPrice: s.unitPrice,
      }));
    
    setRequisitionItems(items);
    setIsReqDialogOpen(true);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setRequisitionItems(prev => 
      prev.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleCreateRequisition = async () => {
    if (requisitionItems.length === 0 || isCreating) return;

    // Group items by vendor
    const itemsByVendor = new Map<string | null, RequisitionItem[]>();
    requisitionItems.forEach(item => {
      const vendorKey = item.vendorId || null;
      const existing = itemsByVendor.get(vendorKey) || [];
      existing.push(item);
      itemsByVendor.set(vendorKey, existing);
    });

    const total = itemsByVendor.size;
    const showProgress = total > 1;

    if (showProgress) {
      setIsCreating(true);
      setCreateProgress({ current: 0, total, currentAction: 'Starting...' });
      setCreateResults({ success: [], failed: [] });
    }

    const successList: string[] = [];
    const failedList: string[] = [];

    let index = 0;
    for (const [vendorId, items] of itemsByVendor) {
      const vendorName = vendorId 
        ? shortfalls.find(s => s.vendorId === vendorId)?.vendorName || 'Vendor'
        : 'No Vendor';

      if (showProgress) {
        setCreateProgress({
          current: index + 1,
          total,
          currentAction: `Creating requisition for ${vendorName}...`,
        });
      }

      try {
        // Get next requisition ID
        const { data: nextId } = await supabase.rpc('get_next_requisition_id', {
          p_company_id: companyId!,
        });

        // Calculate total amount for this requisition
        const totalAmount = items.reduce((sum, item) => {
          return sum + (item.quantity * (item.unitPrice || 0));
        }, 0);

        // Create the requisition with vendor_id and total_amount
        const { data: requisition, error: reqError } = await supabase
          .from('requisitions')
          .insert({
            company_id: companyId!,
            requisition_id: nextId || `REQ-${Date.now()}`,
            location_id: selectedLocation!.id,
            vendor_id: vendorId,
            total_amount: totalAmount,
            status: 'draft',
            notes: `Auto-generated from Planning for ${selectedLocation!.name}`,
          })
          .select('id, requisition_id')
          .single();

        if (reqError) throw reqError;

        // Add requisition items
        const itemsToInsert = items.map(item => ({
          requisition_id: requisition.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        }));

        const { error: itemsError } = await supabase
          .from('requisition_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        successList.push(`${requisition.requisition_id} (${vendorName})`);
      } catch (error: any) {
        failedList.push(`${vendorName}: ${error.message || 'Failed'}`);
      }

      index++;
    }

    if (showProgress) {
      setCreateResults({ success: successList, failed: failedList });
      setCreateProgress({ current: total, total, currentAction: 'Completed' });
      
      // Brief delay to show completion, then close
      setTimeout(() => {
        setIsCreating(false);
        setIsReqDialogOpen(false);
        setSelectedItems(new Set());
        fetchShortfallsForLocation(selectedLocation!.id);
      }, 1500);
    } else {
      // Single requisition - use toast
      if (successList.length > 0) {
        toast.success(`Requisition created: ${successList[0]}`);
      }
      if (failedList.length > 0) {
        toast.error(failedList[0]);
      }
      setIsReqDialogOpen(false);
      setSelectedItems(new Set());
      await fetchShortfallsForLocation(selectedLocation!.id);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background sticky top-0 z-20">
        <div className="h-16 flex items-center px-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">
              {selectedLocation ? selectedLocation.name : 'Planning'}
            </h1>
            {selectedLocation && (
              <Badge variant="outline" className="ml-2">
                {shortfalls.length} shortfall{shortfalls.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSafetyDialogOpen(true)}>
              <Shield className="w-4 h-4 mr-2" />
              Safety
            </Button>
            {selectedLocation && selectedItems.size > 0 && (
              <Button onClick={handleOpenRequisitionDialog} size="sm">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Create Requisition ({selectedItems.size})
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {!selectedLocation ? (
          // Location list view
          <div className="overflow-auto h-[calc(100vh-5.75rem)]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <SortableTableHead
                    label="Location"
                    sortKey="name"
                    currentSortKey={locationsSortConfig.key}
                    currentSortDirection={locationsSortConfig.direction}
                    onSort={handleLocationsSort}
                    filterValue={locationsFilters['name'] || ''}
                    onFilter={(value) => setLocationsFilter('name', value)}
                  />
                  <SortableTableHead
                    label="Sales Orders"
                    sortKey="salesOrderCount"
                    currentSortKey={locationsSortConfig.key}
                    currentSortDirection={locationsSortConfig.direction}
                    onSort={handleLocationsSort}
                    filterValue={locationsFilters['salesOrderCount'] || ''}
                    onFilter={(value) => setLocationsFilter('salesOrderCount', value)}
                    className="w-40 text-center"
                  />
                  <SortableTableHead
                    label="Production Orders"
                    sortKey="productionOrderCount"
                    currentSortKey={locationsSortConfig.key}
                    currentSortDirection={locationsSortConfig.direction}
                    onSort={handleLocationsSort}
                    filterValue={locationsFilters['productionOrderCount'] || ''}
                    onFilter={(value) => setLocationsFilter('productionOrderCount', value)}
                    className="w-40 text-center"
                  />
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No locations with outstanding orders
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedLocations.map((location) => (
                    <TableRow 
                      key={location.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleLocationClick(location)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{location.name}</div>
                            <div className="text-sm text-muted-foreground">{location.location_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {location.salesOrderCount > 0 ? (
                          <Badge variant="secondary" className="gap-1">
                            <ShoppingCart className="w-3 h-3" />
                            {location.salesOrderCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {location.productionOrderCount > 0 ? (
                          <Badge variant="secondary" className="gap-1">
                            <Factory className="w-3 h-3" />
                            {location.productionOrderCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          // Shortfall detail view
          <div className="overflow-auto h-[calc(100vh-5.75rem)]">
            {isLoadingShortfalls ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading requirements...
              </div>
            ) : shortfalls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mb-2 text-green-500" />
                <p>No inventory shortfalls at this location</p>
                <p className="text-sm">All requirements are covered by current stock</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.size === shortfalls.length && shortfalls.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <SortableTableHead
                      label="Product"
                      sortKey="productName"
                      currentSortKey={shortfallsSortConfig.key}
                      currentSortDirection={shortfallsSortConfig.direction}
                      onSort={handleShortfallsSort}
                      filterValue={shortfallsFilters['productName'] || ''}
                      onFilter={(value) => setShortfallsFilter('productName', value)}
                    />
                    <SortableTableHead
                      label="Vendor"
                      sortKey="vendorName"
                      currentSortKey={shortfallsSortConfig.key}
                      currentSortDirection={shortfallsSortConfig.direction}
                      onSort={handleShortfallsSort}
                      filterValue={shortfallsFilters['vendorName'] || ''}
                      onFilter={(value) => setShortfallsFilter('vendorName', value)}
                    />
                    <SortableTableHead
                      label="Required"
                      sortKey="totalRequired"
                      currentSortKey={shortfallsSortConfig.key}
                      currentSortDirection={shortfallsSortConfig.direction}
                      onSort={handleShortfallsSort}
                      filterValue={shortfallsFilters['totalRequired'] || ''}
                      onFilter={(value) => setShortfallsFilter('totalRequired', value)}
                      className="w-24 text-right"
                    />
                    <SortableTableHead
                      label="Safety"
                      sortKey="safetyStock"
                      currentSortKey={shortfallsSortConfig.key}
                      currentSortDirection={shortfallsSortConfig.direction}
                      onSort={handleShortfallsSort}
                      filterValue={shortfallsFilters['safetyStock'] || ''}
                      onFilter={(value) => setShortfallsFilter('safetyStock', value)}
                      className="w-24 text-right"
                    />
                    <SortableTableHead
                      label="In Stock"
                      sortKey="currentStock"
                      currentSortKey={shortfallsSortConfig.key}
                      currentSortDirection={shortfallsSortConfig.direction}
                      onSort={handleShortfallsSort}
                      filterValue={shortfallsFilters['currentStock'] || ''}
                      onFilter={(value) => setShortfallsFilter('currentStock', value)}
                      className="w-24 text-right"
                    />
                    <SortableTableHead
                      label="Shortfall"
                      sortKey="shortfall"
                      currentSortKey={shortfallsSortConfig.key}
                      currentSortDirection={shortfallsSortConfig.direction}
                      onSort={handleShortfallsSort}
                      filterValue={shortfallsFilters['shortfall'] || ''}
                      onFilter={(value) => setShortfallsFilter('shortfall', value)}
                      className="w-24 text-right"
                    />
                    <TableHead>Source Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedShortfalls.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(item.productId)}
                          onCheckedChange={() => handleToggleItem(item.productId)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-sm text-muted-foreground">{item.productCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.vendorName || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.totalRequired} {item.unit || ''}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.safetyStock > 0 ? item.safetyStock : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.currentStock} {item.unit || ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive" className="font-mono">
                          -{item.shortfall}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.salesOrders.map(so => (
                            <Badge key={so} variant="outline" className="text-xs">
                              <ShoppingCart className="w-3 h-3 mr-1" />
                              {so}
                            </Badge>
                          ))}
                          {item.productionOrders.map(po => (
                            <Badge key={po} variant="outline" className="text-xs">
                              <Factory className="w-3 h-3 mr-1" />
                              {po}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </main>

      {/* Requisition Creation Dialog */}
      <Dialog open={isReqDialogOpen} onOpenChange={setIsReqDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Create Purchase Requisition</DialogTitle>
            <DialogDescription>
              Review and adjust quantities for the requisition at {selectedLocation?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="w-32">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitionItems.map((item) => (
                  <TableRow key={item.productId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-muted-foreground">{item.productCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.vendorId ? (
                        shortfalls.find(s => s.productId === item.productId)?.vendorName || '-'
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value) || 1)}
                        className="w-24"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="shrink-0 px-6 pb-6">
            <Button onClick={handleCreateRequisition} disabled={isCreating}>
              {vendorGroups.size > 1 
                ? `Create ${vendorGroups.size} Requisitions`
                : 'Create Requisition'
              }
              <Kbd>⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Creation Progress Dialog */}
      <Dialog open={isCreating} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Creating Requisitions</DialogTitle>
            <DialogDescription>
              Creating {createProgress.total} requisition(s) grouped by vendor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono">{createProgress.current} / {createProgress.total}</span>
              </div>
              <Progress value={createProgress.total > 0 ? (createProgress.current / createProgress.total) * 100 : 0} className="h-2" />
            </div>
            
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {createProgress.currentAction !== 'Completed' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 text-primary" />
              )}
              <span>{createProgress.currentAction}</span>
            </div>

            {createResults.success.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Created</Label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {createResults.success.map((item, i) => (
                    <div key={i} className="text-xs font-mono flex items-center gap-2 text-primary">
                      <Check className="w-3 h-3" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {createResults.failed.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Failed</Label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {createResults.failed.map((item, i) => (
                    <div key={i} className="text-xs font-mono flex items-center gap-2 text-destructive">
                      <X className="w-3 h-3" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SafetyStockDialog
        open={isSafetyDialogOpen}
        onOpenChange={setIsSafetyDialogOpen}
        companyId={companyId}
      />
    </div>
  );
};

export default Planning;
