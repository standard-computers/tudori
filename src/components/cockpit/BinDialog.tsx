import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
import { Switch } from '@/components/ui/switch';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { ChevronsUpDown, Check, Plus, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface Area {
  id: string;
  area_id: string;
  name: string;
  is_production_enabled?: boolean;
}

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

interface BinProduct {
  id: string;
  bin_id: string;
  product_id: string;
  max_quantity: number;
  product?: { name: string; product_id: string };
}

interface Product {
  id: string;
  product_id: string;
  name: string;
}

interface BinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBin: Bin | null;
  areas: Area[];
  getNextBinId: (areaId: string) => string;
  onSaved: () => void;
  companyId: string | null;
  onDelete?: (id: string) => void;
}

export interface BinDialogRef {
  submit: () => void;
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

const BinDialog = forwardRef<BinDialogRef, BinDialogProps>(
  ({ open, onOpenChange, editingBin, areas, getNextBinId, onSaved, companyId, onDelete }, ref) => {
    const [formData, setFormData] = useState({
      bin_id: '',
      name: '',
      description: '',
      capacity: '',
      area_id: '',
      width: '',
      width_uom: 'in',
      length: '',
      length_uom: 'in',
      height: '',
      height_uom: 'in',
      weight_capacity: '',
      weight_capacity_uom: 'lb',
      allow_put_away: true,
      allow_auto_put_away: true,
      allow_picking: true,
      allow_auto_picking: true,
      is_production_enabled: false,
      is_hazardous: false,
    });

    const [binProducts, setBinProducts] = useState<BinProduct[]>([]);
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [newProductQty, setNewProductQty] = useState<string>('');
    const [activeTab, setActiveTab] = useState('general');
    const [isMaximized, setIsMaximized] = useMaximizedState();

    useEffect(() => {
      if (open) {
        if (editingBin) {
          setFormData({
            bin_id: editingBin.bin_id,
            name: editingBin.name,
            description: editingBin.description || '',
            capacity: editingBin.capacity || '',
            area_id: editingBin.area_id,
            width: editingBin.width?.toString() || '',
            width_uom: editingBin.width_uom || 'in',
            length: editingBin.length?.toString() || '',
            length_uom: editingBin.length_uom || 'in',
            height: editingBin.height?.toString() || '',
            height_uom: editingBin.height_uom || 'in',
            weight_capacity: editingBin.weight_capacity?.toString() || '',
            weight_capacity_uom: editingBin.weight_capacity_uom || 'lb',
            allow_put_away: editingBin.allow_put_away ?? true,
            allow_auto_put_away: editingBin.allow_auto_put_away ?? true,
            allow_picking: editingBin.allow_picking ?? true,
            allow_auto_picking: editingBin.allow_auto_picking ?? true,
            is_production_enabled: editingBin.is_production_enabled ?? false,
            is_hazardous: editingBin.is_hazardous ?? false,
          });
          fetchBinProducts(editingBin.id);
        } else {
          const defaultAreaId = areas[0]?.id || '';
          setFormData({
            bin_id: defaultAreaId ? getNextBinId(defaultAreaId) : '',
            name: '',
            description: '',
            capacity: '',
            area_id: defaultAreaId,
            width: '',
            width_uom: 'in',
            length: '',
            length_uom: 'in',
            height: '',
            height_uom: 'in',
            weight_capacity: '',
            weight_capacity_uom: 'lb',
            allow_put_away: true,
            allow_auto_put_away: true,
            allow_picking: true,
            allow_auto_picking: true,
            is_production_enabled: false,
            is_hazardous: false,
          });
          setBinProducts([]);
        }
        setActiveTab('general');
        fetchProducts();
      }
    }, [open, editingBin, areas]);

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

    const fetchBinProducts = async (binId: string) => {
      const { data } = await supabase
        .from('bin_products')
        .select('id, bin_id, product_id, max_quantity, product:products(name, product_id)')
        .eq('bin_id', binId);
      setBinProducts((data as unknown as BinProduct[]) || []);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!formData.area_id) {
        toast.error('Please select an area');
        return;
      }

      const binData = {
        name: formData.name,
        description: formData.description || null,
        capacity: formData.capacity || null,
        width: formData.width ? parseFloat(formData.width) : null,
        width_uom: formData.width_uom,
        length: formData.length ? parseFloat(formData.length) : null,
        length_uom: formData.length_uom,
        height: formData.height ? parseFloat(formData.height) : null,
        height_uom: formData.height_uom,
        weight_capacity: formData.weight_capacity ? parseFloat(formData.weight_capacity) : null,
        weight_capacity_uom: formData.weight_capacity_uom,
        allow_put_away: formData.allow_put_away,
        allow_auto_put_away: formData.allow_auto_put_away,
        allow_picking: formData.allow_picking,
        allow_auto_picking: formData.allow_auto_picking,
        is_production_enabled: formData.is_production_enabled,
        is_hazardous: formData.is_hazardous,
      };

      if (editingBin) {
        const { error } = await supabase
          .from('bins')
          .update(binData)
          .eq('id', editingBin.id);
        if (error) {
          toast.error('Failed to update bin');
          return;
        }
        toast.success('Bin updated');
      } else {
        const { error } = await supabase
          .from('bins')
          .insert({ ...binData, area_id: formData.area_id, bin_id: formData.bin_id });
        if (error) {
          toast.error('Failed to create bin');
          return;
        }
        toast.success('Bin created');
      }
      onOpenChange(false);
      onSaved();
    };

    useImperativeHandle(ref, () => ({
      submit: () => handleSubmit(),
    }));

    const handleAddProduct = async () => {
      if (!editingBin || !selectedProductId) {
        toast.error('Save the bin first to add product restrictions');
        return;
      }
      const qty = parseInt(newProductQty) || 0;
      const { error } = await supabase
        .from('bin_products')
        .insert({ bin_id: editingBin.id, product_id: selectedProductId, max_quantity: qty });
      if (error) {
        if (error.code === '23505') {
          toast.error('Product already added to this bin');
        } else {
          toast.error('Failed to add product restriction');
        }
        return;
      }
      toast.success('Product restriction added');
      setSelectedProductId('');
      setNewProductQty('');
      fetchBinProducts(editingBin.id);
    };

    const handleRemoveProduct = async (id: string) => {
      const { error } = await supabase.from('bin_products').delete().eq('id', id);
      if (error) {
        toast.error('Failed to remove product restriction');
        return;
      }
      toast.success('Product restriction removed');
      if (editingBin) fetchBinProducts(editingBin.id);
    };

    const fetchBinForCopy = async (binId: string): Promise<Bin | null> => {
      const { data } = await supabase
        .from('bins')
        .select('*')
        .eq('bin_id', binId)
        .maybeSingle();
      return data;
    };

    const applyBinCopy = (data: Bin) => {
      setFormData((prev) => ({
        ...prev,
        name: data.name,
        description: data.description || '',
        capacity: data.capacity || '',
        width: data.width?.toString() || '',
        width_uom: data.width_uom || 'in',
        length: data.length?.toString() || '',
        length_uom: data.length_uom || 'in',
        height: data.height?.toString() || '',
        height_uom: data.height_uom || 'in',
        weight_capacity: data.weight_capacity?.toString() || '',
        weight_capacity_uom: data.weight_capacity_uom || 'lb',
        allow_put_away: data.allow_put_away ?? true,
        allow_auto_put_away: data.allow_auto_put_away ?? true,
        allow_picking: data.allow_picking ?? true,
        allow_auto_picking: data.allow_auto_picking ?? true,
        is_production_enabled: data.is_production_enabled ?? false,
        is_hazardous: data.is_hazardous ?? false,
      }));
    };

    const calculateVolume = () => {
      const w = parseFloat(formData.width) || 0;
      const l = parseFloat(formData.length) || 0;
      const h = parseFloat(formData.height) || 0;
      if (w && l && h) return (w * l * h).toFixed(2);
      return '—';
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[520px] max-h-[85vh]'}`}>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <DialogHeader>
              <DialogTitle>{editingBin ? 'Edit Bin' : 'Add Bin'}</DialogTitle>
              <DialogDescription>
                {editingBin ? 'Update bin details.' : 'Create a new storage bin.'}
              </DialogDescription>
            </DialogHeader>

            {!editingBin && (
              <div className="absolute right-16 top-4 z-10">
                <CopyFromIdDialog<Bin>
                  onFetch={fetchBinForCopy}
                  onApply={applyBinCopy}
                  idLabel="Bin ID"
                />
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 overflow-hidden flex flex-col mt-4">
              <TabsList className="mx-6 grid grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                <TabsTrigger value="controls">Controls</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                <TabsContent value="general" className="space-y-4 mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="bin_area">Area *</Label>
                    <Select
                      value={formData.area_id}
                      onValueChange={(value) => {
                        setFormData({
                          ...formData,
                          area_id: value,
                          bin_id: editingBin ? formData.bin_id : getNextBinId(value),
                        });
                      }}
                      disabled={!!editingBin}
                    >
                      <SelectTrigger className={editingBin ? 'bg-muted' : ''}>
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
                  <div className="space-y-2">
                    <Label htmlFor="bin_id">Bin ID</Label>
                    <Input
                      id="bin_id"
                      value={formData.bin_id}
                      onChange={(e) => setFormData({ ...formData, bin_id: e.target.value })}
                      disabled={!!editingBin}
                      className={editingBin ? 'bg-muted' : ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bin_name">Name *</Label>
                    <Input
                      id="bin_name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Shelf A1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bin_description">Description</Label>
                    <Input
                      id="bin_description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bin_capacity">Capacity</Label>
                    <Input
                      id="bin_capacity"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      placeholder="e.g., 100 units"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="dimensions" className="space-y-4 mt-0">
                  <div className="bg-muted/50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-muted-foreground">
                      Enter bin physical dimensions for space planning.
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
                          value={formData.width}
                          onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                          placeholder="0"
                          className="flex-1"
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-20 justify-between px-2">
                              {formData.width_uom}
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
                                      onSelect={() => setFormData({ ...formData, width_uom: uom.value })}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", formData.width_uom === uom.value ? "opacity-100" : "opacity-0")} />
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
                          value={formData.length}
                          onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                          placeholder="0"
                          className="flex-1"
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-20 justify-between px-2">
                              {formData.length_uom}
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
                                      onSelect={() => setFormData({ ...formData, length_uom: uom.value })}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", formData.length_uom === uom.value ? "opacity-100" : "opacity-0")} />
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
                          value={formData.height}
                          onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                          placeholder="0"
                          className="flex-1"
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-20 justify-between px-2">
                              {formData.height_uom}
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
                                      onSelect={() => setFormData({ ...formData, height_uom: uom.value })}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", formData.height_uom === uom.value ? "opacity-100" : "opacity-0")} />
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
                          value={formData.weight_capacity}
                          onChange={(e) => setFormData({ ...formData, weight_capacity: e.target.value })}
                          placeholder="0"
                          className="flex-1"
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-20 justify-between px-2">
                              {formData.weight_capacity_uom}
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
                                      onSelect={() => setFormData({ ...formData, weight_capacity_uom: uom.value })}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", formData.weight_capacity_uom === uom.value ? "opacity-100" : "opacity-0")} />
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
                          <span className="ml-2 font-mono">{calculateVolume()} {formData.width_uom}³</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="controls" className="space-y-4 mt-0">
                  <div className="bg-muted/50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-muted-foreground">
                      Control what operations are allowed for this bin.
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
                              Enable manual put away operations to this bin
                            </p>
                          </div>
                          <Switch
                            id="allow_put_away"
                            checked={formData.allow_put_away}
                            onCheckedChange={(checked) => 
                              setFormData({ ...formData, allow_put_away: checked })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="allow_auto_put_away">Allow Auto Put Away</Label>
                            <p className="text-xs text-muted-foreground">
                              Include this bin in automatic put away suggestions
                            </p>
                          </div>
                          <Switch
                            id="allow_auto_put_away"
                            checked={formData.allow_auto_put_away}
                            onCheckedChange={(checked) => 
                              setFormData({ ...formData, allow_auto_put_away: checked })
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
                              Enable manual picking operations from this bin
                            </p>
                          </div>
                          <Switch
                            id="allow_picking"
                            checked={formData.allow_picking}
                            onCheckedChange={(checked) => 
                              setFormData({ ...formData, allow_picking: checked })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="allow_auto_picking">Allow Auto Picking</Label>
                            <p className="text-xs text-muted-foreground">
                              Include this bin in automatic picking suggestions
                            </p>
                          </div>
                          <Switch
                            id="allow_auto_picking"
                            checked={formData.allow_auto_picking}
                            onCheckedChange={(checked) => 
                              setFormData({ ...formData, allow_auto_picking: checked })
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
                              Enable production operations in this bin
                            </p>
                          </div>
                          <Switch
                            id="is_production_enabled"
                            checked={formData.is_production_enabled}
                            onCheckedChange={(checked) => {
                              const parentArea = areas.find(a => a.id === formData.area_id);
                              if (checked && !parentArea?.is_production_enabled) {
                                toast.error('Cannot enable production: parent area does not allow production');
                                return;
                              }
                              setFormData({ ...formData, is_production_enabled: checked });
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
                              Only products marked as hazardous may be placed in this bin
                            </p>
                          </div>
                          <Switch
                            id="is_hazardous"
                            checked={formData.is_hazardous}
                            onCheckedChange={(checked) => 
                              setFormData({ ...formData, is_hazardous: checked })
                            }
                          />
                        </div>
                        {formData.is_hazardous && (
                          <div className="bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg p-3 text-sm">
                            ⚠️ This bin is designated for hazardous materials only. Non-hazardous products cannot be stored here.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="products" className="space-y-4 mt-0">
                  <div className="bg-muted/50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-muted-foreground">
                      {editingBin
                        ? 'Restrict this bin to only hold specific products at specified max quantities.'
                        : 'Save the bin first to add product restrictions.'}
                    </p>
                  </div>

                  {editingBin && (
                    <>
                      <div className="flex gap-2">
                        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select a product..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProducts
                              .filter((p) => !binProducts.some((bp) => bp.product_id === p.id))
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

                      {binProducts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No product restrictions</p>
                          <p className="text-sm">This bin can hold any product</p>
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
                            {binProducts.map((bp) => (
                              <TableRow key={bp.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{bp.product?.name}</p>
                                    <p className="text-xs text-muted-foreground">{bp.product?.product_id}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">{bp.max_quantity || '∞'}</TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleRemoveProduct(bp.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="shrink-0 px-6 py-4 border-t">
              {editingBin && onDelete && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => {
                    onDelete(editingBin.id);
                    onOpenChange(false);
                  }}
                  className="mr-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button type="submit">
                {editingBin ? 'Save Changes' : 'Create'}
                <Kbd className="ml-2">⌘S</Kbd>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);

BinDialog.displayName = 'BinDialog';

export default BinDialog;
