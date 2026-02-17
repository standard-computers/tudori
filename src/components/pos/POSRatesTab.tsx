import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Percent } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredRates = allRates.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.rate_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allFilteredSelected =
    filteredRates.length > 0 &&
    filteredRates.every((r) => selectedRateIds.has(r.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedRateIds((prev) => {
        const next = new Set(prev);
        filteredRates.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRateIds((prev) => {
        const next = new Set(prev);
        filteredRates.forEach((r) => next.add(r.id));
        return next;
      });
    }
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

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search rates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{selectedRateIds.size} of {allRates.length} selected</span>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {allFilteredSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
            {filteredRates.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Percent className="w-8 h-8 mb-2" />
                <p className="text-sm">No rates found</p>
              </div>
            ) : (
              filteredRates.map((rate) => (
                <label
                  key={rate.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedRateIds.has(rate.id)}
                    onCheckedChange={() => toggleRate(rate.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rate.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {rate.rate_id} · {formatRate(rate)}
                      {rate.description ? ` · ${rate.description}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0">{formatRate(rate)}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default POSRatesTab;
