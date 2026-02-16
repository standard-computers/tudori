import { useState, useEffect, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useTableSort } from '@/hooks/use-table-sort';
import { Plus, Trash2, Wand2, Loader2, Check, X, Package, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { toast } from '@/lib/toast';

interface SafetyStock {
  id: string;
  product_id: string;
  location_id: string;
  safety_stock_quantity: number;
  product?: { product_id: string; name: string };
  location?: { location_id: string; name: string };
}

interface Product {
  id: string;
  product_id: string;
  name: string;
}

interface Location {
  id: string;
  location_id: string;
  name: string;
  type: string | null;
}

interface SuggestedSafetyStock {
  productId: string;
  productCode: string;
  productName: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  suggestedQuantity: number;
  selected: boolean;
}

interface SafetyStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
}

export const SafetyStockDialog = ({ open, onOpenChange, companyId }: SafetyStockDialogProps) => {
  const [activeTab, setActiveTab] = useState('view');
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [safetyStocks, setSafetyStocks] = useState<SafetyStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // AutoMake state
  const [suggestions, setSuggestions] = useState<SuggestedSafetyStock[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [autoCreateProgress, setAutoCreateProgress] = useState({ current: 0, total: 0 });

  // Sorting for safety stocks table
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    sortedAndFilteredData: sortedSafetyStocks,
  } = useTableSort<SafetyStock>(safetyStocks, 'product', 'asc');

  useEffect(() => {
    if (open && companyId) {
      fetchSafetyStocks();
      fetchProducts();
      fetchLocations();
    }
  }, [open, companyId]);

  const fetchSafetyStocks = async () => {
    if (!companyId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('product_safety_stock')
      .select(`
        id,
        product_id,
        location_id,
        safety_stock_quantity,
        product:products(product_id, name),
        location:locations(location_id, name)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSafetyStocks(data as unknown as SafetyStock[]);
    }
    setIsLoading(false);
  };

  const fetchProducts = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('products')
      .select('id, product_id, name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('product_id');
    setProducts(data || []);
  };

  const fetchLocations = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('locations')
      .select('id, location_id, name, type')
      .eq('company_id', companyId)
      .ilike('status', 'active')
      .order('location_id');
    setLocations(data || []);
  };

  const productOptions: SearchableSelectOption[] = useMemo(() => 
    products.map(p => ({
      value: p.id,
      label: p.name,
      sublabel: p.product_id,
    })), [products]);

  const locationOptions: SearchableSelectOption[] = useMemo(() => 
    locations.map(l => ({
      value: l.id,
      label: l.name,
      sublabel: l.location_id,
    })), [locations]);

  const handleCreate = async () => {
    if (!selectedProductId || !selectedLocationId || !quantity) {
      toast.error('Please fill in all fields');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    // Check for existing record
    const exists = safetyStocks.some(
      ss => ss.product_id === selectedProductId && ss.location_id === selectedLocationId
    );
    if (exists) {
      toast.error('Safety stock record already exists for this product/location');
      return;
    }

    setIsCreating(true);
    const { error } = await supabase
      .from('product_safety_stock')
      .insert({
        product_id: selectedProductId,
        location_id: selectedLocationId,
        safety_stock_quantity: qty,
      });

    if (error) {
      toast.error('Failed to create safety stock');
    } else {
      toast.success('Safety stock created');
      setSelectedProductId('');
      setSelectedLocationId('');
      setQuantity('');
      fetchSafetyStocks();
    }
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('product_safety_stock')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete safety stock');
    } else {
      toast.success('Safety stock deleted');
      fetchSafetyStocks();
    }
  };

  const generateSuggestions = async () => {
    if (!companyId) return;
    setIsGeneratingSuggestions(true);
    setSuggestions([]);

    try {
      // Re-fetch current safety stock records from DB to ensure we have the latest
      const { data: currentSafetyStocks } = await supabase
        .from('product_safety_stock')
        .select('product_id, location_id')
        .order('created_at', { ascending: false });

      const existingPairs = new Set(
        (currentSafetyStocks || []).map((ss: any) => `${ss.product_id}-${ss.location_id}`)
      );

      // Fetch inventory quantities for all product-location combos
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('product_id, location_id, quantity');

      const inventoryMap = new Map<string, number>();
      inventoryData?.forEach((inv: any) => {
        inventoryMap.set(`${inv.product_id}-${inv.location_id}`, inv.quantity || 0);
      });

      // Get products with recent sales activity (last 90 days)
      const { data: salesData } = await supabase
        .from('sales_order_items')
        .select(`
          product_id,
          quantity,
          sales_order:sales_orders(location_id, created_at)
        `)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      // Aggregate demand by product-location
      const demandMap = new Map<string, { productId: string; locationId: string; totalQty: number }>();
      
      salesData?.forEach((item: any) => {
        if (!item.sales_order?.location_id) return;
        const key = `${item.product_id}-${item.sales_order.location_id}`;
        const existing = demandMap.get(key) || {
          productId: item.product_id,
          locationId: item.sales_order.location_id,
          totalQty: 0,
        };
        existing.totalQty += item.quantity || 0;
        demandMap.set(key, existing);
      });

      const newSuggestions: SuggestedSafetyStock[] = [];
      const addedPairs = new Set<string>();

      const addSuggestion = (
        productId: string, locationId: string, qty: number, selected: boolean
      ) => {
        const key = `${productId}-${locationId}`;
        if (existingPairs.has(key) || addedPairs.has(key)) return;
        const product = products.find(p => p.id === productId);
        const location = locations.find(l => l.id === locationId);
        if (!product || !location) return;
        addedPairs.add(key);
        newSuggestions.push({
          productId,
          productCode: product.product_id,
          productName: product.name,
          locationId,
          locationCode: location.location_id,
          locationName: location.name,
          suggestedQuantity: Math.max(1, qty),
          selected,
        });
      };

      // 1. Demand-based suggestions: ~2 weeks of average demand
      for (const [, demand] of demandMap) {
        const avgDaily = demand.totalQty / 90;
        const suggestedQty = Math.ceil(avgDaily * 14);
        if (suggestedQty > 0) {
          addSuggestion(demand.productId, demand.locationId, suggestedQty, true);
        }
      }

      // 2. Location expansion: for products with safety stock at some locations,
      //    suggest safety stock for ALL other locations (any type) that are missing it
      const safetyStocksByProduct = new Map<string, SafetyStock[]>();
      safetyStocks.forEach(ss => {
        if (!safetyStocksByProduct.has(ss.product_id)) safetyStocksByProduct.set(ss.product_id, []);
        safetyStocksByProduct.get(ss.product_id)!.push(ss);
      });

      for (const [productId, productSafetyStocks] of safetyStocksByProduct) {
        // Group existing safety stock quantities by location type for this product
        const qtyByLocationType = new Map<string, { total: number; count: number }>();
        for (const ss of productSafetyStocks) {
          const loc = locations.find(l => l.id === ss.location_id);
          if (!loc) continue;
          const locType = loc.type || 'Other';
          const entry = qtyByLocationType.get(locType) || { total: 0, count: 0 };
          entry.total += ss.safety_stock_quantity;
          entry.count += 1;
          qtyByLocationType.set(locType, entry);
        }

        // Overall average as fallback
        const overallTotal = productSafetyStocks.reduce((sum, ss) => sum + ss.safety_stock_quantity, 0);
        const overallAvg = Math.ceil(overallTotal / productSafetyStocks.length);

        // Suggest for ALL locations that don't have safety stock for this product
        for (const loc of locations) {
          const key = `${productId}-${loc.id}`;
          if (existingPairs.has(key) || addedPairs.has(key)) continue;

          const locType = loc.type || 'Other';
          // Use avg from same location type if available, otherwise fall back to overall avg
          const typeEntry = qtyByLocationType.get(locType);
          const typeAvgQty = typeEntry ? Math.ceil(typeEntry.total / typeEntry.count) : overallAvg;

          // Use inventory quantity if available, otherwise use location-type average
          const currentInventory = inventoryMap.get(key) || 0;
          const suggestedQty = currentInventory > 0
            ? Math.ceil(currentInventory * 0.25)
            : typeAvgQty;

          addSuggestion(productId, loc.id, suggestedQty, true);
        }
      }

      // 3. Inventory-based suggestions: products stocked at locations but without safety stock
      for (const [key, qty] of inventoryMap) {
        if (qty <= 0) continue;
        if (existingPairs.has(key) || addedPairs.has(key)) continue;
        const [productId, locationId] = key.split('-');
        const suggestedQty = Math.ceil(qty * 0.25); // 25% of on-hand as safety stock
        addSuggestion(productId, locationId, suggestedQty, false);
      }

      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate suggestions');
    }
    
    setIsGeneratingSuggestions(false);
  };

  const toggleSuggestionSelection = (index: number) => {
    setSuggestions(prev => prev.map((s, i) => 
      i === index ? { ...s, selected: !s.selected } : s
    ));
  };

  const toggleAllSuggestions = (selected: boolean) => {
    setSuggestions(prev => prev.map(s => ({ ...s, selected })));
  };

  const updateSuggestionQuantity = (index: number, quantity: number) => {
    setSuggestions(prev => prev.map((s, i) => 
      i === index ? { ...s, suggestedQuantity: quantity } : s
    ));
  };

  const selectedSuggestions = suggestions.filter(s => s.selected);

  const handleAutoCreate = async () => {
    if (selectedSuggestions.length === 0) {
      toast.error('No items selected');
      return;
    }

    setIsAutoCreating(true);
    setAutoCreateProgress({ current: 0, total: selectedSuggestions.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedSuggestions.length; i++) {
      const suggestion = selectedSuggestions[i];
      setAutoCreateProgress({ current: i + 1, total: selectedSuggestions.length });

      const { error } = await supabase
        .from('product_safety_stock')
        .insert({
          product_id: suggestion.productId,
          location_id: suggestion.locationId,
          safety_stock_quantity: suggestion.suggestedQuantity,
        });

      if (error) {
        failCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Created ${successCount} safety stock records`);
    }
    if (failCount > 0) {
      toast.error(`Failed to create ${failCount} records`);
    }

    setSuggestions(prev => prev.filter(s => !s.selected));
    fetchSafetyStocks();
    setIsAutoCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[800px] max-h-[85vh]'}`}>
        <button
          type="button"
          onClick={() => setIsMaximized(!isMaximized)}
          className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Safety Stock Management
          </DialogTitle>
          <DialogDescription>
            View, create, and auto-generate safety stock levels for products at locations.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 mx-4">
            <TabsTrigger value="view">View All</TabsTrigger>
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="automake">AutoMake</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto px-4 py-4">
            <TabsContent value="view" className="mt-0 h-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : safetyStocks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No safety stock records</p>
                  <p className="text-sm">Create one manually or use AutoMake</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead
                          label="Product"
                          sortKey="product"
                          currentSortKey={sortConfig.key}
                          currentSortDirection={sortConfig.direction}
                          onSort={handleSort}
                          filterValue={filters['product'] || ''}
                          onFilter={(v) => setFilter('product', v)}
                        />
                        <SortableTableHead
                          label="Location"
                          sortKey="location"
                          currentSortKey={sortConfig.key}
                          currentSortDirection={sortConfig.direction}
                          onSort={handleSort}
                          filterValue={filters['location'] || ''}
                          onFilter={(v) => setFilter('location', v)}
                        />
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSafetyStocks.map((ss) => (
                        <TableRow key={ss.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{ss.product?.name}</p>
                              <p className="text-xs text-muted-foreground">{ss.product?.product_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{ss.location?.name}</p>
                              <p className="text-xs text-muted-foreground">{ss.location?.location_id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {ss.safety_stock_quantity.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(ss.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="create" className="mt-0 space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  Create a safety stock record for a specific product at a location.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <SearchableSelect
                    options={productOptions}
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                    placeholder="Select a product..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location *</Label>
                  <SearchableSelect
                    options={locationOptions}
                    value={selectedLocationId}
                    onValueChange={setSelectedLocationId}
                    placeholder="Select a location..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Safety Stock Quantity *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter minimum stock level"
                  />
                </div>

                <Button 
                  onClick={handleCreate} 
                  disabled={isCreating || !selectedProductId || !selectedLocationId || !quantity}
                  className="w-full"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create Safety Stock
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="automake" className="mt-0 space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-Generate Suggestions</p>
                  <p className="text-xs text-muted-foreground">
                    Analyze sales history to suggest safety stock levels
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={generateSuggestions}
                  disabled={isGeneratingSuggestions}
                >
                  {isGeneratingSuggestions ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>

              {suggestions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wand2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No suggestions yet</p>
                  <p className="text-sm">Click Generate to analyze and create suggestions</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedSuggestions.length === suggestions.length}
                        onCheckedChange={(checked) => toggleAllSuggestions(!!checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedSuggestions.length} of {suggestions.length} selected
                      </span>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead className="w-28 text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suggestions.map((s, index) => (
                          <TableRow key={`${s.productId}-${s.locationId}`}>
                            <TableCell>
                              <Checkbox
                                checked={s.selected}
                                onCheckedChange={() => toggleSuggestionSelection(index)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{s.productName}</p>
                                <p className="text-xs text-muted-foreground">{s.productCode}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{s.locationName}</p>
                                <p className="text-xs text-muted-foreground">{s.locationCode}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                value={s.suggestedQuantity}
                                onChange={(e) => updateSuggestionQuantity(index, parseInt(e.target.value) || 0)}
                                className="w-24 text-right h-8"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {isAutoCreating && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Creating records...</span>
                        <span>{autoCreateProgress.current} / {autoCreateProgress.total}</span>
                      </div>
                      <Progress value={(autoCreateProgress.current / autoCreateProgress.total) * 100} />
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-4 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
            <Kbd className="ml-2">Esc</Kbd>
          </Button>
          {activeTab === 'automake' && selectedSuggestions.length > 0 && (
            <Button onClick={handleAutoCreate} disabled={isAutoCreating}>
              {isAutoCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Create {selectedSuggestions.length} Records
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
