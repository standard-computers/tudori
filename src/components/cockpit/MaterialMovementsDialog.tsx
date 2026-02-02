import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Maximize2, Minimize2, Search, Package } from 'lucide-react';

interface MaterialMovement {
  id: string;
  movement_id: string;
  product_id: string;
  pu_id: string | null;
  bin_id: string | null;
  quantity: number;
  movement_type: string;
  source_bin_id: string | null;
  destination_bin_id: string | null;
  reference_type: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  product?: { name: string; product_id: string } | null;
  packaging_unit?: { pu_number: string } | null;
  bin?: { bin_id: string; name: string } | null;
  source_bin?: { bin_id: string; name: string } | null;
  destination_bin?: { bin_id: string; name: string } | null;
}

interface MaterialMovementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  locationName: string;
}

const movementTypeConfig: Record<string, { label: string; icon: typeof ArrowDownToLine; color: string }> = {
  receipt: { label: 'Receipt', icon: ArrowDownToLine, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  issue: { label: 'Issue', icon: ArrowUpFromLine, color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  move_in: { label: 'Move In', icon: ArrowDownToLine, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  move_out: { label: 'Move Out', icon: ArrowUpFromLine, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  adjustment: { label: 'Adjustment', icon: ArrowLeftRight, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  transfer: { label: 'Transfer', icon: ArrowLeftRight, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
};

const MaterialMovementsDialog = ({
  open,
  onOpenChange,
  locationId,
  locationName,
}: MaterialMovementsDialogProps) => {
  const [movements, setMovements] = useState<MaterialMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open && locationId) {
      fetchMovements();
    }
  }, [open, locationId]);

  const fetchMovements = async () => {
    if (!locationId) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('material_movements')
      .select(`
        id,
        movement_id,
        product_id,
        pu_id,
        bin_id,
        quantity,
        movement_type,
        source_bin_id,
        destination_bin_id,
        reference_type,
        reference_number,
        notes,
        created_at,
        product:products(name, product_id),
        packaging_unit:packaging_units(pu_number),
        bin:bins!material_movements_bin_id_fkey(bin_id, name),
        source_bin:bins!material_movements_source_bin_id_fkey(bin_id, name),
        destination_bin:bins!material_movements_destination_bin_id_fkey(bin_id, name)
      `)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(500);

    setIsLoading(false);
    
    if (error) {
      console.error('Failed to fetch material movements:', error);
      return;
    }
    
    setMovements((data || []) as unknown as MaterialMovement[]);
  };

  const filteredMovements = movements.filter(m => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      m.movement_id?.toLowerCase().includes(searchLower) ||
      m.product?.product_id?.toLowerCase().includes(searchLower) ||
      m.product?.name?.toLowerCase().includes(searchLower) ||
      m.packaging_unit?.pu_number?.toLowerCase().includes(searchLower) ||
      m.reference_number?.toLowerCase().includes(searchLower) ||
      m.bin?.bin_id?.toLowerCase().includes(searchLower) ||
      m.source_bin?.bin_id?.toLowerCase().includes(searchLower) ||
      m.destination_bin?.bin_id?.toLowerCase().includes(searchLower)
    );
  });

  const getMovementTypeDisplay = (type: string) => {
    const config = movementTypeConfig[type] || { label: type, icon: ArrowLeftRight, color: 'bg-muted text-muted-foreground' };
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getBinDisplay = (movement: MaterialMovement) => {
    if (movement.movement_type === 'transfer' || movement.movement_type === 'move_in' || movement.movement_type === 'move_out') {
      const from = movement.source_bin?.bin_id || '—';
      const to = movement.destination_bin?.bin_id || movement.bin?.bin_id || '—';
      return (
        <span className="text-sm">
          <span className="font-mono">{from}</span>
          <span className="text-muted-foreground mx-1">→</span>
          <span className="font-mono">{to}</span>
        </span>
      );
    }
    return <span className="font-mono">{movement.bin?.bin_id || '—'}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`flex flex-col overflow-hidden transition-all duration-200 ${
          isMaximized 
            ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' 
            : 'sm:max-w-[900px] max-h-[85vh]'
        }`}
      >
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
            Material Flow
          </DialogTitle>
          <DialogDescription>
            Movement history for {locationName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by product, PU, bin, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filteredMovements.length} movements</Badge>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">No material movements recorded</p>
              <p className="text-sm mt-1">Movements will appear here as inventory changes occur</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MF #</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>PU #</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="font-mono text-sm">{movement.movement_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(movement.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{getMovementTypeDisplay(movement.movement_type)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm">{movement.product?.product_id}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {movement.product?.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-primary">
                        {movement.packaging_unit?.pu_number || '—'}
                      </TableCell>
                      <TableCell>{getBinDisplay(movement)}</TableCell>
                      <TableCell className="text-right font-medium">{movement.quantity}</TableCell>
                      <TableCell className="text-sm">
                        {movement.reference_number ? (
                          <span className="font-mono text-muted-foreground">{movement.reference_number}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialMovementsDialog;
