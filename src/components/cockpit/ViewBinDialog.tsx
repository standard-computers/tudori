import { useState, useEffect } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Boxes, Info, Maximize2, Minimize2, Printer } from 'lucide-react';
import { printLocationLabel } from '@/lib/print-label';

interface Bin {
  id: string;
  bin_id: string;
  name: string;
  description: string | null;
  capacity: string | null;
  area_id: string;
  width?: number | null;
  width_uom?: string | null;
  length?: number | null;
  length_uom?: string | null;
  height?: number | null;
  height_uom?: string | null;
  weight_capacity?: number | null;
  weight_capacity_uom?: string | null;
  allow_put_away?: boolean;
  allow_auto_put_away?: boolean;
  allow_picking?: boolean;
  allow_auto_picking?: boolean;
  is_production_enabled?: boolean;
  is_hazardous?: boolean;
}

interface Area {
  id: string;
  area_id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  product_id: string;
  quantity: number;
  min_quantity: number | null;
  max_quantity: number | null;
  pu_id: string | null;
  product?: { name: string; product_id: string; sku: string | null };
  packaging_unit?: { pu_number: string } | null;
}

interface ViewBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bin: Bin | null;
  area: Area | undefined;
  onEdit: () => void;
}

const ViewBinDialog = ({ open, onOpenChange, bin, area, onEdit }: ViewBinDialogProps) => {
  const [activeTab, setActiveTab] = useState('details');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();

  useEffect(() => {
    if (open && bin) {
      setActiveTab('details');
      fetchBinInventory();
    }
  }, [open, bin]);

  const fetchBinInventory = async () => {
    if (!bin) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        id,
        product_id,
        quantity,
        min_quantity,
        max_quantity,
        pu_id,
        product:products(name, product_id, sku),
        packaging_unit:packaging_units(pu_number)
      `)
      .eq('bin_id', bin.id)
      .order('quantity', { ascending: false });
    
    setIsLoading(false);
    if (error) {
      console.error('Failed to fetch bin inventory:', error);
      return;
    }
    setInventory((data || []) as unknown as InventoryItem[]);
  };

  if (!bin) return null;

  const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[600px] max-h-[85vh]'}`}>
        <button
          type="button"
          onClick={() => printLocationLabel('Bin', bin.bin_id, bin.name)}
          className="absolute right-[5.5rem] top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <Printer className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="absolute right-16 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsMaximized(!isMaximized)}
          className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{bin.bin_id}</span>
            <span className="text-muted-foreground font-normal">—</span>
            <span>{bin.name}</span>
          </DialogTitle>
          <DialogDescription>
            {area ? `${area.area_id} - ${area.name}` : 'Storage bin details and inventory'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabsList className="mx-6 grid grid-cols-2">
            <TabsTrigger value="details" className="gap-2">
              <Info className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Boxes className="w-4 h-4" />
              Inventory
              {inventory.length > 0 && (
                <Badge variant="secondary" className="ml-1">{inventory.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
            <TabsContent value="details" className="mt-0 h-full">
              <div className="space-y-6">
                {/* General Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">General</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Bin ID:</span>
                      <span className="ml-2 font-mono">{bin.bin_id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2">{bin.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Capacity:</span>
                      <span className="ml-2">{bin.capacity || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description:</span>
                      <span className="ml-2">{bin.description || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Dimensions</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Width:</span>
                      <span className="ml-2">
                        {bin.width ? `${bin.width} ${bin.width_uom || 'in'}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Length:</span>
                      <span className="ml-2">
                        {bin.length ? `${bin.length} ${bin.length_uom || 'in'}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Height:</span>
                      <span className="ml-2">
                        {bin.height ? `${bin.height} ${bin.height_uom || 'in'}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Weight Capacity:</span>
                      <span className="ml-2">
                        {bin.weight_capacity ? `${bin.weight_capacity} ${bin.weight_capacity_uom || 'lb'}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Controls</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${bin.allow_put_away ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>Put Away</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${bin.allow_auto_put_away ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>Auto Put Away</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${bin.allow_picking ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>Picking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${bin.allow_auto_picking ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>Auto Picking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${bin.is_production_enabled ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>Production</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${bin.is_hazardous ? 'bg-amber-500' : 'bg-muted-foreground/30'}`} />
                      <span>Hazardous Only</span>
                    </div>
                  </div>
                  {bin.is_hazardous && (
                    <div className="mt-4 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg p-3 text-sm">
                      ⚠️ This bin is designated for hazardous materials only.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="mt-0 h-full">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : inventory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Boxes className="w-12 h-12 mb-3 opacity-30" />
                  <p className="font-medium">No inventory in this bin</p>
                  <p className="text-sm mt-1">Products will appear here when stored in this bin</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span><strong className="text-foreground">{inventory.length}</strong> products</span>
                    <span><strong className="text-foreground">{totalQuantity.toLocaleString()}</strong> total units</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>PU</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.map((item) => {
                        const isLow = item.min_quantity !== null && item.quantity < item.min_quantity;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.product?.product_id || '—'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.product?.name || 'Unknown'}
                                {isLow && (
                                  <span className="text-xs bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded">Low</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{item.product?.sku || '—'}</TableCell>
                            <TableCell className="font-mono text-sm text-primary">
                              {item.packaging_unit?.pu_number || '—'}
                            </TableCell>
                            <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ViewBinDialog;
