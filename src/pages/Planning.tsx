import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ArrowLeft, MapPin, ShoppingCart, Factory, AlertTriangle, FileSpreadsheet, ChevronRight } from 'lucide-react';
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
    if (requisitionItems.length === 0) return;

    try {
      // Group items by vendor
      const itemsByVendor = new Map<string | null, RequisitionItem[]>();
      requisitionItems.forEach(item => {
        const vendorKey = item.vendorId || null;
        const existing = itemsByVendor.get(vendorKey) || [];
        existing.push(item);
        itemsByVendor.set(vendorKey, existing);
      });

      const createdReqs: string[] = [];

      // Create a separate requisition for each vendor
      for (const [vendorId, items] of itemsByVendor) {
        // Get next requisition ID
        const { data: nextId } = await supabase.rpc('get_next_requisition_id', {
          p_company_id: companyId!,
        });

        const vendorName = vendorId 
          ? shortfalls.find(s => s.vendorId === vendorId)?.vendorName || 'Vendor'
          : 'No Vendor';

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

        createdReqs.push(requisition.requisition_id);
      }

      if (createdReqs.length === 1) {
        toast.success(`Requisition ${createdReqs[0]} created with ${requisitionItems.length} items`);
      } else {
        toast.success(`Created ${createdReqs.length} requisitions: ${createdReqs.join(', ')}`);
      }

      
      setIsReqDialogOpen(false);
      setSelectedItems(new Set());
      
      // Refresh shortfalls
      await fetchShortfallsForLocation(selectedLocation!.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create requisition');
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
          {selectedLocation && selectedItems.size > 0 && (
            <div className="ml-auto">
              <Button onClick={handleOpenRequisitionDialog} size="sm">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Create Requisition ({selectedItems.size})
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {!selectedLocation ? (
          // Location list view
          <div className="overflow-auto h-[calc(100vh-5.75rem)]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="w-40 text-center">Sales Orders</TableHead>
                  <TableHead className="w-40 text-center">Production Orders</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No locations with outstanding orders
                    </TableCell>
                  </TableRow>
                ) : (
                  locations.map((location) => (
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
                        checked={selectedItems.size === shortfalls.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="w-24 text-right">Required</TableHead>
                    <TableHead className="w-24 text-right">Safety</TableHead>
                    <TableHead className="w-24 text-right">In Stock</TableHead>
                    <TableHead className="w-24 text-right">Shortfall</TableHead>
                    <TableHead>Source Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortfalls.map((item) => (
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
            <Button onClick={handleCreateRequisition}>
              Create Requisition
              <Kbd>⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Planning;
