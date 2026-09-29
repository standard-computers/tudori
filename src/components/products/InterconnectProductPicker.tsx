import { useEffect, useState } from 'react';
import { Plug } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';

export interface InterconnectProduct {
  interconnect_uuid: string;
  interconnect_code: string;
  vendor_id: string;
  vendor_name: string;
  source_product_id: string;
  product_code: string;
  name: string;
  description: string | null;
  link: string | null;
  category: string | null;
  price: number | null;
  unit: string | null;
  is_batched: boolean | null;
  min_shelf_life_days: number | null;
  keep_inventory: boolean | null;
  is_consumable: boolean | null;
  width: number | null;
  length: number | null;
  height: number | null;
  weight: number | null;
  width_uom: string | null;
  length_uom: string | null;
  height_uom: string | null;
  weight_uom: string | null;
  transport_time_days: number | null;
  manufacture_time_days: number | null;
  lead_time_days: number | null;
  hazardous: boolean | null;
  serialized: boolean | null;
  is_pos_available: boolean | null;
  uoms: { name: string; abbreviation: string | null; conversion_factor: number; lower_uom: string | null }[];
}

interface Props {
  companyId?: string | null;
  onSelect: (p: InterconnectProduct) => void;
}

export function InterconnectProductPicker({ companyId, onSelect }: Props) {
  const [items, setItems] = useState<InterconnectProduct[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [{ data }, { data: used }] = await Promise.all([
        supabase.rpc('list_interconnect_products' as any),
        supabase.from('products').select('interconnect_product_id').eq('company_id', companyId).not('interconnect_product_id', 'is', null),
      ]);
      const usedIds = new Set((used || []).map((p: any) => p.interconnect_product_id));
      setItems(((data as InterconnectProduct[]) || []).filter(p => !usedIds.has(p.source_product_id)));
    })();
  }, [companyId]);

  if (items.length === 0) return null;

  const groups = items.reduce<Record<string, InterconnectProduct[]>>((acc, p) => {
    (acc[p.vendor_name] ||= []).push(p);
    return acc;
  }, {});

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Select from interconnected vendor products"
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <Plug className="h-4 w-4" />
          <span className="sr-only">Select from interconnected vendor products</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-[70]" align="end">
        <Command>
          <CommandInput placeholder="Search interconnect products..." />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            {Object.entries(groups).map(([vendor, list]) => (
              <CommandGroup key={vendor} heading={vendor}>
                {list.map(p => (
                  <CommandItem
                    key={p.source_product_id}
                    value={`${vendor} ${p.name} ${p.product_code}`}
                    onSelect={() => { onSelect(p); setOpen(false); }}
                  >
                    <div className="flex flex-col">
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{p.product_code}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
