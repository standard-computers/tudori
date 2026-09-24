import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { Check, ChevronsUpDown, Percent, X } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { toast } from '@/lib/toast';

interface Rate {
  id: string;
  rate_id: string;
  name: string;
  rate: number;
  rate_type: string;
  description: string | null;
}

interface POSRatesTabProps {
  locationId: string;
  companyId: string;
  onSaved: () => void;
}

const POSRatesTab = ({ locationId, companyId, onSaved }: POSRatesTabProps) => {
  const [allRates, setAllRates] = useState<Rate[]>([]);
  const [selectedRateIds, setSelectedRateIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (locationId) fetchData();
  }, [locationId]);

  const fetchData = async () => {
    setLoading(true);
    const [ratesRes, assignedRes] = await Promise.all([
      supabase
        .from('tax_rates')
        .select('id, rate_id, name, rate, rate_type, description')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('pos_location_rates')
        .select('rate_id')
        .eq('location_id', locationId),
    ]);

    if (ratesRes.data) setAllRates(ratesRes.data);
    if (assignedRes.data) {
      setSelectedRateIds(new Set(assignedRes.data.map((r) => r.rate_id)));
    }
    setLoading(false);
  };

  const toggleRate = (rateId: string) => {
    setSelectedRateIds((prev) => {
      const next = new Set(prev);
      if (next.has(rateId)) next.delete(rateId);
      else next.add(rateId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('pos_location_rates').delete().eq('location_id', locationId);
      if (selectedRateIds.size > 0) {
        const rows = Array.from(selectedRateIds).map((rate_id) => ({
          location_id: locationId,
          rate_id,
        }));
        const { error } = await supabase.from('pos_location_rates').insert(rows);
        if (error) throw error;
      }
      toast.success('Rate assignments saved');
      onSaved();
    } catch {
      toast.error('Failed to save rate assignments');
    } finally {
      setSaving(false);
    }
  };

  const formatRate = (rate: Rate) => {
    if (rate.rate_type === 'flat') return `$${Number(rate.rate).toFixed(2)}`;
    return `${Number(rate.rate).toFixed(2)}%`;
  };

  const selectedRates = allRates.filter((r) => selectedRateIds.has(r.id));

  return (
    <div className="space-y-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={loading}
          >
            <span className="text-muted-foreground">
              {loading
                ? 'Loading...'
                : `${selectedRateIds.size} of ${allRates.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[70]" align="start">
          <Command>
            <CommandInput placeholder="Search rates..." />
            <CommandList>
              <CommandEmpty>
                <div className="flex flex-col items-center py-4 text-muted-foreground">
                  <Percent className="w-6 h-6 mb-2" />
                  <p className="text-sm">No rates found</p>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {allRates.map((rate) => {
                  const isSelected = selectedRateIds.has(rate.id);
                  return (
                    <CommandItem
                      key={rate.id}
                      value={`${rate.name} ${rate.rate_id} ${rate.description ?? ''}`}
                      onSelect={() => toggleRate(rate.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{rate.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {rate.rate_id}
                          {rate.description ? ` · ${rate.description}` : ''}
                        </p>
                      </div>
                      <span className="ml-2 text-sm font-medium shrink-0">
                        {formatRate(rate)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedRates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRates.map((rate) => (
            <Badge key={rate.id} variant="secondary" className="gap-1 pr-1">
              <span>
                {rate.name} · {formatRate(rate)}
              </span>
              <button
                type="button"
                onClick={() => toggleRate(rate.id)}
                className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remove ${rate.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default POSRatesTab;
