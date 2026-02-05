import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronsUpDown, Check, Plus, Trash2, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Area {
  id: string;
  area_id: string;
  name: string;
   is_production_enabled?: boolean;
}

interface Product {
  id: string;
  product_id: string;
  name: string;
}

interface ProductRestriction {
  product_id: string;
  product_name: string;
  product_display_id: string;
  max_quantity: number;
}

interface AutoMakeBinsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Area[];
  companyId: string | null;
  onCreated: () => void;
}

const DIMENSION_UOMS = [
  { value: 'in', label: 'in - Inches' },
  { value: 'ft', label: 'ft - Feet' },
  { value: 'cm', label: 'cm - Centimeters' },
  { value: 'm', label: 'm - Meters' },
  { value: 'mm', label: 'mm - Millimeters' },
  { value: 'yd', label: 'yd - Yards' },
];

const WEIGHT_UOMS = [
  { value: 'lb', label: 'lb - Pounds' },
  { value: 'oz', label: 'oz - Ounces' },
  { value: 'kg', label: 'kg - Kilograms' },
  { value: 'g', label: 'g - Grams' },
  { value: 'ton', label: 'ton - Tons' },
];

const AutoMakeBinsDialog = ({
  open,
  onOpenChange,
  areas,
  companyId,
  onCreated,
}: AutoMakeBinsDialogProps) => {
  const [activeTab, setActiveTab] = useState('general');
  const [isCreating, setIsCreating] = useState(false);

  // General settings
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [binIdTemplate, setBinIdTemplate] = useState('@-B-#');
  const [binNameTemplate, setBinNameTemplate] = useState('Bin #');
  const [startingNumber, setStartingNumber] = useState('1');

  // Dimensions
  const [dimensions, setDimensions] = useState({
    width: '',
    width_uom: 'in',
    length: '',
    length_uom: 'in',
    height: '',
    height_uom: 'in',
    weight_capacity: '',
    weight_capacity_uom: 'lb',
  });

  // Product restrictions
  const [productRestrictions, setProductRestrictions] = useState<ProductRestriction[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newProductQty, setNewProductQty] = useState('');
 
   // Controls
   const [controls, setControls] = useState({
     allow_put_away: true,
     allow_auto_put_away: true,
     allow_picking: true,
     allow_auto_picking: true,
     is_production_enabled: false,
     is_hazardous: false,
   });

  useEffect(() => {
    if (open) {
      setActiveTab('general');
      setSelectedAreaId(areas[0]?.id || '');
      setQuantity('1');
      setBinIdTemplate('@-B-#');
      setBinNameTemplate('Bin #');
      setStartingNumber('1');
      setDimensions({
        width: '',
        width_uom: 'in',
        length: '',
        length_uom: 'in',
        height: '',
        height_uom: 'in',
        weight_capacity: '',
        weight_capacity_uom: 'lb',
      });
      setProductRestrictions([]);
       setControls({
         allow_put_away: true,
         allow_auto_put_away: true,
         allow_picking: true,
         allow_auto_picking: true,
         is_production_enabled: false,
         is_hazardous: false,
       });
      fetchProducts();
    }
  }, [open, areas]);

  const fetchProducts = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('products')
      .select('id, product_id, name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('product_id');
    setAvailableProducts(data || []);
  };

  const getSelectedArea = () => areas.find((a) => a.id === selectedAreaId);

  const applyTemplate = (template: string, areaId: string, number: number): string => {
    return template
      .replace(/@/g, areaId)
      .replace(/#/g, number.toString().padStart(2, '0'));
  };

  const getPreview = () => {
    const area = getSelectedArea();
    if (!area || !quantity) return [];

    const qty = parseInt(quantity) || 0;
    const start = parseInt(startingNumber) || 1;
    const previews: { bin_id: string; name: string }[] = [];

    for (let i = 0; i < Math.min(qty, 5); i++) {
      const num = start + i;
      previews.push({
        bin_id: applyTemplate(binIdTemplate, area.area_id, num),
        name: applyTemplate(binNameTemplate, area.area_id, num),
      });
    }

    return previews;
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const product = availableProducts.find((p) => p.id === selectedProductId);
    if (!product) return;

    if (productRestrictions.some((pr) => pr.product_id === selectedProductId)) {
      toast.error('Product already added');
      return;
    }

    setProductRestrictions((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product_display_id: product.product_id,
        max_quantity: parseInt(newProductQty) || 0,
      },
    ]);
    setSelectedProductId('');
    setNewProductQty('');
  };

  const handleRemoveProduct = (productId: string) => {
    setProductRestrictions((prev) => prev.filter((pr) => pr.product_id !== productId));
  };

  const handleCreate = async () => {
    const area = getSelectedArea();
    if (!area) {
      toast.error('Please select an area');
      return;
    }

    const qty = parseInt(quantity) || 0;
    if (qty < 1 || qty > 100) {
      toast.error('Quantity must be between 1 and 100');
      return;
    }

    setIsCreating(true);
    const start = parseInt(startingNumber) || 1;

    try {
      const binsToCreate = [];
      for (let i = 0; i < qty; i++) {
        const num = start + i;
        binsToCreate.push({
          area_id: area.id,
          bin_id: applyTemplate(binIdTemplate, area.area_id, num),
          name: applyTemplate(binNameTemplate, area.area_id, num),
          description: null,
          capacity: null,
          width: dimensions.width ? parseFloat(dimensions.width) : null,
          width_uom: dimensions.width_uom,
          length: dimensions.length ? parseFloat(dimensions.length) : null,
          length_uom: dimensions.length_uom,
          height: dimensions.height ? parseFloat(dimensions.height) : null,
          height_uom: dimensions.height_uom,
          weight_capacity: dimensions.weight_capacity ? parseFloat(dimensions.weight_capacity) : null,
          weight_capacity_uom: dimensions.weight_capacity_uom,
           allow_put_away: controls.allow_put_away,
           allow_auto_put_away: controls.allow_auto_put_away,
           allow_picking: controls.allow_picking,
           allow_auto_picking: controls.allow_auto_picking,
           is_production_enabled: controls.is_production_enabled,
           is_hazardous: controls.is_hazardous,
        });
      }

      const { data: createdBins, error: binError } = await supabase
        .from('bins')
        .insert(binsToCreate)
        .select('id');

      if (binError) {
        console.error('Failed to create bins:', binError);
        if (binError.code === '23505') {
          toast.error('Duplicate bin ID detected. Adjust template or starting number.');
        } else {
          toast.error('Failed to create bins');
        }
        setIsCreating(false);
        return;
      }

      // Add product restrictions if any
      if (productRestrictions.length > 0 && createdBins && createdBins.length > 0) {
        const binProductInserts = [];
        for (const bin of createdBins) {
          for (const pr of productRestrictions) {
            binProductInserts.push({
              bin_id: bin.id,
              product_id: pr.product_id,
              max_quantity: pr.max_quantity,
            });
          }
        }

        const { error: bpError } = await supabase.from('bin_products').insert(binProductInserts);
        if (bpError) {
          console.error('Failed to add product restrictions:', bpError);
          toast.warning(`Bins created but failed to add product restrictions: ${bpError.message}`);
        }
      }

      toast.success(`Created ${qty} bins successfully`);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      console.error('AutoMake error:', err);
      toast.error('An error occurred while creating bins');
    } finally {
      setIsCreating(false);
    }
  };

  const calculateVolume = () => {
    const w = parseFloat(dimensions.width) || 0;
    const l = parseFloat(dimensions.length) || 0;
    const h = parseFloat(dimensions.height) || 0;
    if (w && l && h) return (w * l * h).toFixed(2);
    return '—';
  };

  const previewItems = getPreview();
  const totalQty = parseInt(quantity) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            AutoMake Bins
          </DialogTitle>
          <DialogDescription>
            Bulk create bins with templated IDs and names. Use @ for area ID and # for bin number.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col mt-2">
           <TabsList className="mx-6 grid grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
             <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto px-6 py-4">
            <TabsContent value="general" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Area *</Label>
                <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.area_id} - {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Number of bins"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Starting Number</Label>
                  <Input
                    type="number"
                    min="1"
                    value={startingNumber}
                    onChange={(e) => setStartingNumber(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bin ID Template</Label>
                <Input
                  value={binIdTemplate}
                  onChange={(e) => setBinIdTemplate(e.target.value)}
                  placeholder="@-B-#"
                />
                <p className="text-xs text-muted-foreground">@ = Area ID, # = Bin number (zero-padded)</p>
              </div>

              <div className="space-y-2">
                <Label>Bin Name Template</Label>
                <Input
                  value={binNameTemplate}
                  onChange={(e) => setBinNameTemplate(e.target.value)}
                  placeholder="Bin #"
                />
              </div>

              {/* Preview */}
              <div className="border rounded-md p-3 bg-muted/30">
                <p className="text-sm font-medium mb-2">Preview (first {Math.min(totalQty, 5)} of {totalQty})</p>
                {previewItems.length > 0 ? (
                  <div className="space-y-1 text-sm font-mono">
                    {previewItems.map((item, idx) => (
                      <div key={idx} className="flex gap-4">
                        <span className="text-muted-foreground">ID:</span>
                        <span>{item.bin_id}</span>
                        <span className="text-muted-foreground ml-2">Name:</span>
                        <span>{item.name}</span>
                      </div>
                    ))}
                    {totalQty > 5 && (
                      <p className="text-muted-foreground text-xs mt-1">... and {totalQty - 5} more</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select an area to see preview</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="dimensions" className="space-y-4 mt-0">
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-muted-foreground">
                  Set dimensions to apply to all created bins.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Width */}
                <div className="space-y-2">
                  <Label>Width</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={dimensions.width}
                      onChange={(e) => setDimensions({ ...dimensions, width: e.target.value })}
                      placeholder="0"
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-20 justify-between px-2">
                          {dimensions.width_uom}
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[180px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search UoM..." />
                          <CommandList>
                            <CommandEmpty>No UoM found.</CommandEmpty>
                            <CommandGroup>
                              {DIMENSION_UOMS.map((uom) => (
                                <CommandItem
                                  key={uom.value}
                                  value={uom.value}
                                  onSelect={() => setDimensions({ ...dimensions, width_uom: uom.value })}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", dimensions.width_uom === uom.value ? "opacity-100" : "opacity-0")} />
                                  {uom.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Length */}
                <div className="space-y-2">
                  <Label>Length</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={dimensions.length}
                      onChange={(e) => setDimensions({ ...dimensions, length: e.target.value })}
                      placeholder="0"
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-20 justify-between px-2">
                          {dimensions.length_uom}
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[180px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search UoM..." />
                          <CommandList>
                            <CommandEmpty>No UoM found.</CommandEmpty>
                            <CommandGroup>
                              {DIMENSION_UOMS.map((uom) => (
                                <CommandItem
                                  key={uom.value}
                                  value={uom.value}
                                  onSelect={() => setDimensions({ ...dimensions, length_uom: uom.value })}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", dimensions.length_uom === uom.value ? "opacity-100" : "opacity-0")} />
                                  {uom.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Height */}
                <div className="space-y-2">
                  <Label>Height</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={dimensions.height}
                      onChange={(e) => setDimensions({ ...dimensions, height: e.target.value })}
                      placeholder="0"
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-20 justify-between px-2">
                          {dimensions.height_uom}
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[180px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search UoM..." />
                          <CommandList>
                            <CommandEmpty>No UoM found.</CommandEmpty>
                            <CommandGroup>
                              {DIMENSION_UOMS.map((uom) => (
                                <CommandItem
                                  key={uom.value}
                                  value={uom.value}
                                  onSelect={() => setDimensions({ ...dimensions, height_uom: uom.value })}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", dimensions.height_uom === uom.value ? "opacity-100" : "opacity-0")} />
                                  {uom.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Weight Capacity */}
                <div className="space-y-2">
                  <Label>Weight Capacity</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={dimensions.weight_capacity}
                      onChange={(e) => setDimensions({ ...dimensions, weight_capacity: e.target.value })}
                      placeholder="0"
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-20 justify-between px-2">
                          {dimensions.weight_capacity_uom}
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[180px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search UoM..." />
                          <CommandList>
                            <CommandEmpty>No UoM found.</CommandEmpty>
                            <CommandGroup>
                              {WEIGHT_UOMS.map((uom) => (
                                <CommandItem
                                  key={uom.value}
                                  value={uom.value}
                                  onSelect={() => setDimensions({ ...dimensions, weight_capacity_uom: uom.value })}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", dimensions.weight_capacity_uom === uom.value ? "opacity-100" : "opacity-0")} />
                                  {uom.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Calculated Volume */}
              <div className="border-t pt-4 mt-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2">Calculated Values</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Volume:</span>
                      <span className="ml-2 font-mono">{calculateVolume()} {dimensions.width_uom}³</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

             <TabsContent value="controls" className="space-y-4 mt-0">
               <div className="bg-muted/50 rounded-lg p-3 mb-4">
                 <p className="text-sm text-muted-foreground">
                   Control what operations are allowed for all created bins.
                 </p>
               </div>
 
               <div className="space-y-6">
                 <div className="space-y-4">
                   <h4 className="font-medium text-sm">Put Away</h4>
                   <div className="space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="space-y-0.5">
                         <Label htmlFor="allow_put_away">Allow Put Away</Label>
                         <p className="text-xs text-muted-foreground">
                           Enable manual put away operations to these bins
                         </p>
                       </div>
                       <Switch
                         id="allow_put_away"
                         checked={controls.allow_put_away}
                         onCheckedChange={(checked) => 
                           setControls({ ...controls, allow_put_away: checked })
                         }
                       />
                     </div>
                     <div className="flex items-center justify-between">
                       <div className="space-y-0.5">
                         <Label htmlFor="allow_auto_put_away">Allow Auto Put Away</Label>
                         <p className="text-xs text-muted-foreground">
                           Include these bins in automatic put away suggestions
                         </p>
                       </div>
                       <Switch
                         id="allow_auto_put_away"
                         checked={controls.allow_auto_put_away}
                         onCheckedChange={(checked) => 
                           setControls({ ...controls, allow_auto_put_away: checked })
                         }
                       />
                     </div>
                   </div>
                 </div>
 
                 <div className="border-t pt-4 space-y-4">
                   <h4 className="font-medium text-sm">Picking</h4>
                   <div className="space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="space-y-0.5">
                         <Label htmlFor="allow_picking">Allow Picking</Label>
                         <p className="text-xs text-muted-foreground">
                           Enable manual picking operations from these bins
                         </p>
                       </div>
                       <Switch
                         id="allow_picking"
                         checked={controls.allow_picking}
                         onCheckedChange={(checked) => 
                           setControls({ ...controls, allow_picking: checked })
                         }
                       />
                     </div>
                     <div className="flex items-center justify-between">
                       <div className="space-y-0.5">
                         <Label htmlFor="allow_auto_picking">Allow Auto Picking</Label>
                         <p className="text-xs text-muted-foreground">
                           Include these bins in automatic picking suggestions
                         </p>
                       </div>
                       <Switch
                         id="allow_auto_picking"
                         checked={controls.allow_auto_picking}
                         onCheckedChange={(checked) => 
                           setControls({ ...controls, allow_auto_picking: checked })
                         }
                       />
                     </div>
                   </div>
                 </div>
 
                 <div className="border-t pt-4 space-y-4">
                   <h4 className="font-medium text-sm">Production</h4>
                   <div className="space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="space-y-0.5">
                         <Label htmlFor="is_production_enabled">Allow Production</Label>
                         <p className="text-xs text-muted-foreground">
                           Enable production operations in these bins
                         </p>
                       </div>
                       <Switch
                         id="is_production_enabled"
                         checked={controls.is_production_enabled}
                         onCheckedChange={(checked) => {
                           const parentArea = areas.find(a => a.id === selectedAreaId);
                           if (checked && !parentArea?.is_production_enabled) {
                             toast.error('Cannot enable production: parent area does not allow production');
                             return;
                           }
                           setControls({ ...controls, is_production_enabled: checked });
                         }}
                       />
                     </div>
                   </div>
                 </div>
 
                 <div className="border-t pt-4 space-y-4">
                   <h4 className="font-medium text-sm">Hazardous Materials</h4>
                   <div className="space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="space-y-0.5">
                         <Label htmlFor="is_hazardous">Hazardous Only</Label>
                         <p className="text-xs text-muted-foreground">
                           Only hazardous products may be placed in these bins
                         </p>
                       </div>
                       <Switch
                         id="is_hazardous"
                         checked={controls.is_hazardous}
                         onCheckedChange={(checked) => 
                           setControls({ ...controls, is_hazardous: checked })
                         }
                       />
                     </div>
                     {controls.is_hazardous && (
                       <div className="bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg p-3 text-sm">
                         ⚠️ These bins will be designated for hazardous materials only.
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             </TabsContent>
 
            <TabsContent value="products" className="space-y-4 mt-0">
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-muted-foreground">
                  Add product restrictions that will be applied to all created bins.
                </p>
              </div>

              <div className="flex gap-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts
                      .filter((p) => !productRestrictions.some((pr) => pr.product_id === p.id))
                      .map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.product_id} - {product.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={newProductQty}
                  onChange={(e) => setNewProductQty(e.target.value)}
                  placeholder="Max Qty"
                  className="w-24"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddProduct}
                  disabled={!selectedProductId}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {productRestrictions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No product restrictions</p>
                  <p className="text-sm">Created bins will accept any product</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Max Qty</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productRestrictions.map((pr) => (
                      <TableRow key={pr.product_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{pr.product_name}</p>
                            <p className="text-xs text-muted-foreground">{pr.product_display_id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{pr.max_quantity || '∞'}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveProduct(pr.product_id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
            <Kbd>Esc</Kbd>
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !selectedAreaId || !quantity}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create {quantity || 0} Bins
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutoMakeBinsDialog;
