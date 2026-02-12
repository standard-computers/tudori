import { useState, useEffect } from 'react';
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
import { Pencil, Box, Info, Maximize2, Minimize2 } from 'lucide-react';

interface Area {
  id: string;
  area_id: string;
  name: string;
  description: string | null;
  location_id: string;
  width?: number | null;
  width_uom?: string | null;
  length?: number | null;
  length_uom?: string | null;
  height?: number | null;
  height_uom?: string | null;
  is_production_enabled?: boolean;
  is_goods_receipt_enabled?: boolean;
  is_goods_issue_enabled?: boolean;
}

interface Bin {
  id: string;
  bin_id: string;
  name: string;
  description: string | null;
  capacity: string | null;
}

interface ViewAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: Area | null;
  onEdit: () => void;
  onViewBin?: (bin: any) => void;
}

const ViewAreaDialog = ({ open, onOpenChange, area, onEdit, onViewBin }: ViewAreaDialogProps) => {
  const [activeTab, setActiveTab] = useState('details');
  const [bins, setBins] = useState<Bin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (open && area) {
      setActiveTab('details');
      fetchAreaBins();
    }
  }, [open, area]);

  const fetchAreaBins = async () => {
    if (!area) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('bins')
      .select('id, bin_id, name, description, capacity')
      .eq('area_id', area.id)
      .order('name');

    setIsLoading(false);
    if (error) {
      console.error('Failed to fetch area bins:', error);
      return;
    }
    setBins((data || []) as Bin[]);
  };

  if (!area) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[600px] max-h-[85vh]'}`}>
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
            <span className="font-mono">{area.area_id}</span>
            <span className="text-muted-foreground font-normal">—</span>
            <span>{area.name}</span>
          </DialogTitle>
          <DialogDescription>
            {area.description || 'Area details and bins'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabsList className="mx-6 grid grid-cols-2">
            <TabsTrigger value="details" className="gap-2">
              <Info className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="bins" className="gap-2">
              <Box className="w-4 h-4" />
              Bins
              {bins.length > 0 && (
                <Badge variant="secondary" className="ml-1">{bins.length}</Badge>
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
                      <span className="text-muted-foreground">Area ID:</span>
                      <span className="ml-2 font-mono">{area.area_id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2">{area.name}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Description:</span>
                      <span className="ml-2">{area.description || '—'}</span>
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
                        {area.width ? `${area.width} ${area.width_uom || 'in'}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Length:</span>
                      <span className="ml-2">
                        {area.length ? `${area.length} ${area.length_uom || 'in'}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Height:</span>
                      <span className="ml-2">
                        {area.height ? `${area.height} ${area.height_uom || 'in'}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Controls</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${area.is_goods_receipt_enabled ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>Goods Receipt</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${area.is_goods_issue_enabled ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>Goods Issue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${area.is_production_enabled ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span>Production</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bins" className="mt-0 h-full">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : bins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Box className="w-12 h-12 mb-3 opacity-30" />
                  <p className="font-medium">No bins in this area</p>
                  <p className="text-sm mt-1">Bins will appear here when added to this area</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{bins.length}</strong> bin{bins.length !== 1 ? 's' : ''}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Capacity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bins.map((bin) => (
                        <TableRow key={bin.id}>
                          <TableCell className="font-mono">
                            {onViewBin ? (
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => onViewBin(bin)}
                              >
                                {bin.bin_id}
                              </button>
                            ) : (
                              bin.bin_id
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{bin.name}</TableCell>
                          <TableCell className="text-muted-foreground">{bin.capacity || '—'}</TableCell>
                        </TableRow>
                      ))}
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

export default ViewAreaDialog;
