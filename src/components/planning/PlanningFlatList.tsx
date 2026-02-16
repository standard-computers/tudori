import { useEffect, useState, useMemo } from 'react';
import { useShiftSelect } from '@/hooks/use-shift-select';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
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
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { AlertTriangle, ShoppingCart, Factory, FileSpreadsheet, Loader2, Check, X, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { toast } from '@/lib/toast';

interface FlatShortfall {
  key: string; // locationId::productId
  locationId: string;
  locationCode: string;
  locationName: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string | null;
  vendorId: string | null;
  vendorName: string | null;
  unitPrice: number | null;
  totalRequired: number;
  productionRequired: number;
  requisitionDemand: number;
  safetyStock: number;
  currentStock: number;
  shortfall: number;
  salesOrders: string[];
  productionOrders: string[];
  requisitionOrders: string[];
}

interface RequisitionItem {
  locationId: string;
  locationName: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  vendorId: string | null;
  unitPrice: number | null;
}

interface PlanningFlatListProps {
  companyId: string;
  enforceRouteRecords: boolean;
}

export const PlanningFlatList = ({ companyId, enforceRouteRecords }: PlanningFlatListProps) => {
  const [shortfalls, setShortfalls] = useState<FlatShortfall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Requisition dialog
  const [isReqDialogOpen, setIsReqDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [requisitionItems, setRequisitionItems] = useState<RequisitionItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState({ current: 0, total: 0, currentAction: '' });
  const [createResults, setCreateResults] = useState<{ success: string[]; failed: string[] }>({ success: [], failed: [] });

  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    sortedAndFilteredData: sortedShortfalls,
  } = useTableSort<FlatShortfall>(shortfalls, 'shortfall', 'desc');

  // Group requisition items by location+vendor for counting
  const reqGroups = useMemo(() => {
    const groups = new Map<string, RequisitionItem[]>();
    requisitionItems.forEach(item => {
      const key = `${item.locationId}::${item.vendorId || 'none'}`;
      const existing = groups.get(key) || [];
      existing.push(item);
      groups.set(key, existing);
    });
    return groups;
  }, [requisitionItems]);

  useSaveShortcut(() => {
    if (isReqDialogOpen && requisitionItems.length > 0 && !isCreating) {
      handleCreateRequisitions();
    }
  }, isReqDialogOpen);

  useEffect(() => {
    fetchAllShortfalls();
  }, [companyId]);

  const fetchAllShortfalls = async () => {
    setIsLoading(true);
    try {
      // Fetch all locations
      const { data: locationsData } = await supabase
        .from('locations')
        .select('id, location_id, name')
        .eq('company_id', companyId)
        .order('name');

      if (!locationsData || locationsData.length === 0) {
        setShortfalls([]);
        setIsLoading(false);
        return;
      }

      // Fetch all data in parallel
      const [
        { data: salesOrders },
        { data: productionOrders },
        { data: inventoryData },
        { data: safetyStocks },
        { data: outstandingReqs },
        { data: incomingReqs },
      ] = await Promise.all([
        supabase
          .from('sales_orders')
          .select(`id, so_number, location_id, sales_order_items(product_id, quantity, product:products(product_id, name, unit, price, vendor_id, vendor:vendors(name)))`)
          .eq('company_id', companyId)
          .in('status', ['confirmed', 'processing']),
        supabase
          .from('production_orders')
          .select(`id, order_number, location_id, quantity, bom:bill_of_materials(bom_items(product_id, quantity, product:products(product_id, name, unit, price, vendor_id, vendor:vendors(name))))`)
          .eq('company_id', companyId)
          .in('status', ['pending', 'in_progress']),
        supabase
          .from('inventory')
          .select('location_id, product_id, quantity'),
        supabase
          .from('product_safety_stock')
          .select('location_id, product_id, safety_stock_quantity, product:products(product_id, name, unit, price, vendor_id, vendor:vendors(name))'),
        supabase
          .from('requisitions')
          .select('id, requisition_id, location_id, requisition_items(product_id, quantity)')
          .eq('company_id', companyId)
          .in('status', ['draft', 'pending', 'approved']),
        supabase
          .from('requisitions')
          .select('id, requisition_id, source_location_id, requisition_items(product_id, quantity, product:products(product_id, name, unit, price, vendor_id, vendor:vendors(name)))')
          .eq('company_id', companyId)
          .not('source_location_id', 'is', null)
          .in('status', ['draft', 'pending', 'approved']),
      ]);

      // Fetch routes and assignments if enforceRouteRecords
      let routesByDest = new Map<string, { vendorId: string; vendorName: string }>();
      let assignmentsByDestProduct = new Map<string, { vendorId: string | null; vendorName: string | null }>();

      if (enforceRouteRecords) {
        const { data: routes } = await supabase
          .from('routes')
          .select('destination_location_id, source_location_id, source_location:locations!routes_source_location_id_fkey(id, name, location_id)')
          .eq('is_active', true)
          .order('priority', { ascending: true });

        routes?.forEach((route: any) => {
          if (!routesByDest.has(route.destination_location_id) && route.source_location_id) {
            const locName = route.source_location?.name || 'Unknown';
            routesByDest.set(route.destination_location_id, {
              vendorId: `location:${route.source_location_id}`,
              vendorName: `${locName} (Internal)`,
            });
          }
        });

        const { data: assignments } = await supabase
          .from('assignments')
          .select('product_id, destination_location_id, vendor_id, source_location_id, vendor:vendors(name), source_location:locations!assignments_source_location_id_fkey(id, name)')
          .eq('is_active', true)
          .order('priority', { ascending: true });

        assignments?.forEach((a: any) => {
          const key = `${a.destination_location_id}::${a.product_id}`;
          if (!assignmentsByDestProduct.has(key)) {
            if (a.vendor_id) {
              assignmentsByDestProduct.set(key, {
                vendorId: `vendor:${a.vendor_id}`,
                vendorName: a.vendor?.name || null,
              });
            } else if (a.source_location_id) {
              assignmentsByDestProduct.set(key, {
                vendorId: `location:${a.source_location_id}`,
                vendorName: a.source_location?.name ? `${a.source_location.name} (Internal)` : null,
              });
            }
          }
        });
      }

      // Build maps
      const inventoryMap = new Map<string, number>();
      inventoryData?.forEach(inv => {
        const key = `${inv.location_id}::${inv.product_id}`;
        inventoryMap.set(key, (inventoryMap.get(key) || 0) + inv.quantity);
      });

      const safetyMap = new Map<string, number>();
      const safetyProductInfo = new Map<string, any>();
      safetyStocks?.forEach((ss: any) => {
        const key = `${ss.location_id}::${ss.product_id}`;
        safetyMap.set(key, ss.safety_stock_quantity);
        if (ss.product) safetyProductInfo.set(key, ss.product);
      });

      const requisitionedMap = new Map<string, number>();
      outstandingReqs?.forEach((req: any) => {
        if (!req.location_id) return;
        (req.requisition_items as any[])?.forEach((item: any) => {
          const key = `${req.location_id}::${item.product_id}`;
          requisitionedMap.set(key, (requisitionedMap.get(key) || 0) + (item.quantity || 0));
        });
      });

      // Build requirements per location-product
      type Requirement = {
        productId: string;
        productCode: string;
        productName: string;
        unit: string | null;
        vendorId: string | null;
        vendorName: string | null;
        unitPrice: number | null;
        totalRequired: number;
        productionRequired: number;
        requisitionDemand: number;
        safetyStock: number;
        salesOrders: string[];
        productionOrders: string[];
        requisitionOrders: string[];
      };

      const requirementMap = new Map<string, Requirement>();

      const resolveVendor = (locationId: string, productId: string, product: any) => {
        const assignKey = `${locationId}::${productId}`;
        const assignment = assignmentsByDestProduct.get(assignKey);
        if (assignment) return { vendorId: assignment.vendorId, vendorName: assignment.vendorName };
        const routeDefault = routesByDest.get(locationId);
        if (enforceRouteRecords && routeDefault) return { vendorId: routeDefault.vendorId, vendorName: routeDefault.vendorName };
        return { vendorId: product?.vendor_id || null, vendorName: product?.vendor?.name || null };
      };

      const getOrCreate = (locId: string, productId: string, product: any): Requirement => {
        const key = `${locId}::${productId}`;
        if (requirementMap.has(key)) return requirementMap.get(key)!;
        const { vendorId, vendorName } = resolveVendor(locId, productId, product);
        const req: Requirement = {
          productId,
          productCode: product?.product_id || '',
          productName: product?.name || '',
          unit: product?.unit || null,
          vendorId,
          vendorName,
          unitPrice: product?.price || null,
          totalRequired: 0,
          productionRequired: 0,
          requisitionDemand: 0,
          safetyStock: safetyMap.get(key) || 0,
          salesOrders: [],
          productionOrders: [],
          requisitionOrders: [],
        };
        requirementMap.set(key, req);
        return req;
      };

      // Sales order demand
      salesOrders?.forEach((so: any) => {
        (so.sales_order_items as any[])?.forEach((item: any) => {
          if (!item.product || !so.location_id) return;
          const req = getOrCreate(so.location_id, item.product_id, item.product);
          req.totalRequired += item.quantity || 0;
          if (!req.salesOrders.includes(so.so_number)) req.salesOrders.push(so.so_number);
        });
      });

      // Production order demand
      productionOrders?.forEach((po: any) => {
        const bom = po.bom as any;
        if (!bom?.bom_items || !po.location_id) return;
        (bom.bom_items as any[]).forEach((item: any) => {
          if (!item.product) return;
          const req = getOrCreate(po.location_id, item.product_id, item.product);
          const prodQty = (item.quantity || 0) * (po.quantity || 1);
          req.totalRequired += prodQty;
          req.productionRequired += prodQty;
          if (!req.productionOrders.includes(po.order_number)) req.productionOrders.push(po.order_number);
        });
      });

      // Incoming requisition demand (other locations sourcing from here)
      incomingReqs?.forEach((req: any) => {
        if (!req.source_location_id) return;
        ((req.requisition_items || []) as any[]).forEach((item: any) => {
          if (!item.product) return;
          const r = getOrCreate(req.source_location_id, item.product_id, item.product);
          r.totalRequired += item.quantity || 0;
          r.requisitionDemand += item.quantity || 0;
          if (!r.requisitionOrders.includes(req.requisition_id)) r.requisitionOrders.push(req.requisition_id);
        });
      });

      // Add safety stock items not already in requirements
      safetyStocks?.forEach((ss: any) => {
        const key = `${ss.location_id}::${ss.product_id}`;
        if (requirementMap.has(key)) return;
        const currentStock = inventoryMap.get(key) || 0;
        if (currentStock < ss.safety_stock_quantity && ss.product) {
          getOrCreate(ss.location_id, ss.product_id, ss.product);
        }
      });

      // Build location lookup
      const locationLookup = new Map(locationsData.map(l => [l.id, l]));

      // Calculate shortfalls
      const results: FlatShortfall[] = [];
      requirementMap.forEach((req, key) => {
        const [locId] = key.split('::');
        const currentStock = inventoryMap.get(key) || 0;
        const alreadyRequisitioned = requisitionedMap.get(key) || 0;
        const shortfall = req.totalRequired + req.safetyStock - currentStock - alreadyRequisitioned;

        if (shortfall > 0) {
          const loc = locationLookup.get(locId);
          results.push({
            key,
            locationId: locId,
            locationCode: loc?.location_id || '',
            locationName: loc?.name || '',
            productId: req.productId,
            productCode: req.productCode,
            productName: req.productName,
            unit: req.unit,
            vendorId: req.vendorId,
            vendorName: req.vendorName,
            unitPrice: req.unitPrice,
            totalRequired: req.totalRequired,
            productionRequired: req.productionRequired,
            requisitionDemand: req.requisitionDemand,
            safetyStock: req.safetyStock,
            currentStock,
            shortfall,
            salesOrders: req.salesOrders,
            productionOrders: req.productionOrders,
            requisitionOrders: req.requisitionOrders,
          });
        }
      });

      results.sort((a, b) => b.shortfall - a.shortfall);
      setShortfalls(results);
    } catch (error) {
      console.error('Error fetching flat list:', error);
      toast.error('Failed to load requirements');
    } finally {
      setIsLoading(false);
    }
  };

  const flatOrderedIds = useMemo(() => sortedShortfalls.map(s => s.key), [sortedShortfalls]);
  const { handleRowSelect: handleFlatShiftSelect } = useShiftSelect(flatOrderedIds, selectedItems, setSelectedItems);

  const handleSelectAll = () => {
    if (selectedItems.size === sortedShortfalls.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(sortedShortfalls.map(s => s.key)));
    }
  };

  const handleOpenRequisitionDialog = () => {
    const items: RequisitionItem[] = shortfalls
      .filter(s => selectedItems.has(s.key))
      .map(s => ({
        locationId: s.locationId,
        locationName: s.locationName,
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

  const handleUpdateQuantity = (locationId: string, productId: string, quantity: number) => {
    setRequisitionItems(prev =>
      prev.map(item =>
        item.locationId === locationId && item.productId === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const handleCreateRequisitions = async () => {
    if (requisitionItems.length === 0 || isCreating) return;

    // Group by location + vendor
    const groups = new Map<string, RequisitionItem[]>();
    requisitionItems.forEach(item => {
      const key = `${item.locationId}::${item.vendorId || 'none'}`;
      const existing = groups.get(key) || [];
      existing.push(item);
      groups.set(key, existing);
    });

    const total = groups.size;
    setIsCreating(true);
    setCreateProgress({ current: 0, total, currentAction: 'Starting...' });
    setCreateResults({ success: [], failed: [] });

    const successList: string[] = [];
    const failedList: string[] = [];
    let index = 0;

    for (const [groupKey, items] of groups) {
      const [locationId, vendorKey] = groupKey.split('::');
      const vendorId = vendorKey === 'none' ? null : vendorKey;
      const locationName = items[0]?.locationName || 'Location';
      const vendorName = vendorId
        ? shortfalls.find(s => s.vendorId === vendorId)?.vendorName || 'Vendor'
        : 'No Vendor';

      setCreateProgress({
        current: index + 1,
        total,
        currentAction: `Creating requisition for ${locationName} / ${vendorName}...`,
      });

      try {
        const { data: nextId } = await supabase.rpc('get_next_requisition_id', {
          p_company_id: companyId,
        });

        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0);

        let resolvedVendorId: string | null = null;
        let resolvedSourceLocationId: string | null = null;
        if (vendorId) {
          if (vendorId.startsWith('vendor:')) {
            resolvedVendorId = vendorId.replace('vendor:', '');
          } else if (vendorId.startsWith('location:')) {
            resolvedSourceLocationId = vendorId.replace('location:', '');
          } else {
            resolvedVendorId = vendorId;
          }
        }

        const { data: requisition, error: reqError } = await supabase
          .from('requisitions')
          .insert({
            company_id: companyId,
            requisition_id: nextId || `REQ-${Date.now()}`,
            location_id: locationId,
            vendor_id: resolvedVendorId,
            source_location_id: resolvedSourceLocationId,
            total_amount: totalAmount,
            status: 'draft',
            notes: `Auto-generated from Planning (flat list)`,
          })
          .select('id, requisition_id')
          .single();

        if (reqError) throw reqError;

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

        successList.push(`${requisition.requisition_id} (${locationName} / ${vendorName})`);
      } catch (error: any) {
        failedList.push(`${locationName} / ${vendorName}: ${error.message || 'Failed'}`);
      }

      index++;
    }

    setCreateResults({ success: successList, failed: failedList });
    setCreateProgress({ current: total, total, currentAction: 'Completed' });

    setTimeout(() => {
      setIsCreating(false);
      setIsReqDialogOpen(false);
      setSelectedItems(new Set());
      fetchAllShortfalls();
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading all requirements...
      </div>
    );
  }

  if (shortfalls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mb-2 text-primary" />
        <p>No inventory shortfalls across any location</p>
        <p className="text-sm">All requirements are covered by current stock</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-auto h-[calc(100vh-5.75rem)]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedItems.size === sortedShortfalls.length && sortedShortfalls.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <SortableTableHead
                label="Location"
                sortKey="locationName"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['locationName'] || ''}
                onFilter={(value) => setFilter('locationName', value)}
              />
              <SortableTableHead
                label="Product"
                sortKey="productName"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['productName'] || ''}
                onFilter={(value) => setFilter('productName', value)}
              />
              <SortableTableHead
                label="Vendor"
                sortKey="vendorName"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['vendorName'] || ''}
                onFilter={(value) => setFilter('vendorName', value)}
              />
              <SortableTableHead
                label="Required"
                sortKey="totalRequired"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['totalRequired'] || ''}
                onFilter={(value) => setFilter('totalRequired', value)}
                className="w-24 text-right"
              />
              <SortableTableHead
                label="Prod Req"
                sortKey="productionRequired"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['productionRequired'] || ''}
                onFilter={(value) => setFilter('productionRequired', value)}
              />
              <SortableTableHead
                label="Req"
                sortKey="requisitionDemand"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['requisitionDemand'] || ''}
                onFilter={(value) => setFilter('requisitionDemand', value)}
                className="w-24 text-right"
              />
              <SortableTableHead
                label="Safety"
                sortKey="safetyStock"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['safetyStock'] || ''}
                onFilter={(value) => setFilter('safetyStock', value)}
                className="w-24 text-right"
              />
              <SortableTableHead
                label="In Stock"
                sortKey="currentStock"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['currentStock'] || ''}
                onFilter={(value) => setFilter('currentStock', value)}
                className="w-24 text-right"
              />
              <SortableTableHead
                label="Shortfall"
                sortKey="shortfall"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['shortfall'] || ''}
                onFilter={(value) => setFilter('shortfall', value)}
                className="w-24 text-right"
              />
              
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedShortfalls.map((item) => (
              <TableRow key={item.key}>
                <TableCell onClick={(e) => {
                  handleFlatShiftSelect(item.key, !selectedItems.has(item.key), e.shiftKey);
                }}>
                  <Checkbox
                    checked={selectedItems.has(item.key)}
                    onCheckedChange={() => {}}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="font-medium">{item.locationName}</div>
                      <div className="text-xs text-muted-foreground">{item.locationCode}</div>
                    </div>
                  </div>
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
                  {item.productionRequired > 0 ? `${item.productionRequired} ${item.unit || ''}` : '-'}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {item.requisitionDemand > 0 ? `${item.requisitionDemand} ${item.unit || ''}` : '-'}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Requisition Creation Dialog */}
      <Dialog open={isReqDialogOpen} onOpenChange={setIsReqDialogOpen}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-2xl max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader className="shrink-0">
            <DialogTitle>Create Purchase Requisitions</DialogTitle>
            <DialogDescription>
              Review and adjust quantities. Items will be grouped by location and vendor ({reqGroups.size} requisition{reqGroups.size !== 1 ? 's' : ''}).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="w-32">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitionItems.map((item) => (
                  <TableRow key={`${item.locationId}-${item.productId}`}>
                    <TableCell className="text-sm">{item.locationName}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-muted-foreground">{item.productCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.vendorId ? (
                        shortfalls.find(s => s.locationId === item.locationId && s.productId === item.productId)?.vendorName || '-'
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(item.locationId, item.productId, parseInt(e.target.value) || 1)}
                        className="w-24"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="shrink-0 px-6 pb-6">
            <Button onClick={handleCreateRequisitions} disabled={isCreating}>
              {reqGroups.size > 1
                ? `Create ${reqGroups.size} Requisitions`
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
              Creating {createProgress.total} requisition(s) grouped by location and vendor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
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

      {/* Floating action bar when items selected */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 z-30">
          <span className="text-sm text-muted-foreground">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </span>
          <Button onClick={handleOpenRequisitionDialog} size="sm">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Create Requisition{selectedItems.size > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </>
  );
};
