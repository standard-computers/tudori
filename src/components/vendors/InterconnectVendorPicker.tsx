import { useEffect, useState } from 'react';
import { Plug } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';

export interface InterconnectPartner {
  interconnect_uuid: string;
  interconnect_code: string;
  interconnect_name: string;
  partner_company_id: string;
  name: string;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

interface Props {
  companyId?: string;
  currentId?: string | null;
  onSelect: (p: InterconnectPartner) => void;
}

export function InterconnectVendorPicker({ companyId, currentId, onSelect }: Props) {
  const [partners, setPartners] = useState<InterconnectPartner[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [{ data }, { data: used }] = await Promise.all([
        supabase.rpc('list_interconnect_partners' as any),
        supabase.from('vendors').select('interconnect_id').eq('company_id', companyId).not('interconnect_id', 'is', null),
      ]);
      const usedIds = new Set((used || []).map((v: any) => v.interconnect_id));
      setPartners(((data as InterconnectPartner[]) || []).filter(p => !usedIds.has(p.interconnect_uuid) || p.interconnect_uuid === currentId));
    })();
  }, [companyId]);

  if (partners.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Select from interconnected companies"
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <Plug className="h-4 w-4" />
          <span className="sr-only">Select from interconnected companies</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 z-[70]" align="end">
        <Command>
          <CommandInput placeholder="Search interconnects..." />
          <CommandList>
            <CommandEmpty>No companies found.</CommandEmpty>
            <CommandGroup heading="Interconnected companies">
              {partners.map(p => (
                <CommandItem
                  key={p.interconnect_uuid}
                  value={`${p.name} ${p.interconnect_code}`}
                  onSelect={() => { onSelect(p); setOpen(false); }}
                >
                  <div className="flex flex-col">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.interconnect_code}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
