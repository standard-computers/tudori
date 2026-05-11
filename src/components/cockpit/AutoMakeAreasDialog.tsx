import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { Wand2, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface SuggestedArea {
  key: string;
  name: string;
  description: string;
  is_goods_receipt_enabled: boolean;
  is_goods_issue_enabled: boolean;
  is_production_enabled: boolean;
}

const SUGGESTIONS: SuggestedArea[] = [
  { key: 'inbound', name: 'Inbound', description: 'Incoming shipments and receiving area', is_goods_receipt_enabled: true, is_goods_issue_enabled: false, is_production_enabled: false },
  { key: 'outbound', name: 'Outbound', description: 'Shipping and outgoing orders', is_goods_receipt_enabled: false, is_goods_issue_enabled: true, is_production_enabled: false },
  { key: 'storage', name: 'Storage', description: 'General product storage', is_goods_receipt_enabled: false, is_goods_issue_enabled: false, is_production_enabled: false },
  { key: 'staging', name: 'Staging', description: 'Pre-shipment staging area', is_goods_receipt_enabled: false, is_goods_issue_enabled: true, is_production_enabled: false },
  { key: 'returns', name: 'Returns', description: 'Customer returns and RMA processing', is_goods_receipt_enabled: true, is_goods_issue_enabled: false, is_production_enabled: false },
  { key: 'quarantine', name: 'Quarantine', description: 'Quality hold and damaged goods', is_goods_receipt_enabled: false, is_goods_issue_enabled: false, is_production_enabled: false },
  { key: 'production', name: 'Production', description: 'Manufacturing and assembly area', is_goods_receipt_enabled: false, is_goods_issue_enabled: false, is_production_enabled: true },
  { key: 'packing', name: 'Packing', description: 'Order packing stations', is_goods_receipt_enabled: false, is_goods_issue_enabled: true, is_production_enabled: false },
  { key: 'cross_dock', name: 'Cross-Dock', description: 'Direct receive-to-ship transfer area', is_goods_receipt_enabled: true, is_goods_issue_enabled: true, is_production_enabled: false },
  { key: 'cold_storage', name: 'Cold Storage', description: 'Temperature-controlled storage', is_goods_receipt_enabled: false, is_goods_issue_enabled: false, is_production_enabled: false },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  existingAreaIds: string[]; // existing area_id codes to avoid collision
  existingNames: string[];
  onCreated: () => void;
}

const AutoMakeAreasDialog = ({ open, onOpenChange, locationId, existingAreaIds, existingNames, onCreated }: Props) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      // Pre-select common ones not already present
      const existingLower = new Set(existingNames.map(n => n.toLowerCase()));
      const preset = new Set<string>();
      ['inbound', 'outbound', 'storage'].forEach(k => {
        const s = SUGGESTIONS.find(x => x.key === k);
        if (s && !existingLower.has(s.name.toLowerCase())) preset.add(k);
      });
      setSelected(preset);
    }
  }, [open]);

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const nextAreaId = (existing: string[]) => {
    const nums = existing.map(id => parseInt(id.replace(/\D/g, '') || '0', 10));
    const max = nums.length ? Math.max(...nums) : 0;
    return (n: number) => `A${String(max + n).padStart(3, '0')}`;
  };

  const handleCreate = async () => {
    if (!locationId) {
      toast.error('No location selected');
      return;
    }
    const items = SUGGESTIONS.filter(s => selected.has(s.key));
    if (items.length === 0) {
      toast.error('Select at least one area');
      return;
    }
    setIsCreating(true);
    const idGen = nextAreaId(existingAreaIds);
    const rows = items.map((s, i) => ({
      location_id: locationId,
      area_id: idGen(i + 1),
      name: s.name,
      description: s.description,
      is_goods_receipt_enabled: s.is_goods_receipt_enabled,
      is_goods_issue_enabled: s.is_goods_issue_enabled,
      is_production_enabled: s.is_production_enabled,
    }));
    const { error } = await supabase.from('areas').insert(rows);
    setIsCreating(false);
    if (error) {
      console.error('AutoMake areas error:', error);
      toast.error('Failed to create areas');
      return;
    }
    toast.success(`Created ${rows.length} area${rows.length !== 1 ? 's' : ''}`);
    onOpenChange(false);
    onCreated();
  };

  const existingLower = new Set(existingNames.map(n => n.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            AutoMake Areas
          </DialogTitle>
          <DialogDescription>
            Select common warehouse areas to create at this location.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-2">
            {SUGGESTIONS.map(s => {
              const exists = existingLower.has(s.name.toLowerCase());
              return (
                <label
                  key={s.key}
                  className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                    exists ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
                  }`}
                >
                  <Checkbox
                    checked={selected.has(s.key)}
                    onCheckedChange={() => !exists && toggle(s.key)}
                    disabled={exists}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {exists && <span className="text-xs text-muted-foreground">(already exists)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {s.is_goods_receipt_enabled && <span>• GR</span>}
                      {s.is_goods_issue_enabled && <span>• GI</span>}
                      {s.is_production_enabled && <span>• Production</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || selected.size === 0}>
            {isCreating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
            ) : (
              <>Create {selected.size} Area{selected.size !== 1 ? 's' : ''}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutoMakeAreasDialog;
