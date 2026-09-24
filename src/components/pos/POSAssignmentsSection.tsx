import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserMinus } from 'lucide-react';
import { toast } from '@/lib/toast';

interface Props {
  locationId: string;
  onSaved: () => void;
}

interface Assignment {
  id: string;
  pos_number: number;
  user_id: string;
  employee_id: string | null;
  name?: string;
}

const POSAssignmentsSection = ({ locationId, onSaved }: Props) => {
  const [count, setCount] = useState<string>('1');
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const load = async () => {
    const [{ data: loc }, { data: asg }] = await Promise.all([
      supabase.from('locations').select('pos_count').eq('id', locationId).maybeSingle(),
      supabase.from('pos_assignments').select('id, pos_number, user_id').eq('location_id', locationId).order('pos_number'),
    ]);
    setCount(String(loc?.pos_count ?? 1));
    const rows = (asg || []) as Assignment[];
    const ids = rows.map(r => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', ids);
      rows.forEach(r => {
        const p = profs?.find(x => x.user_id === r.user_id);
        r.name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'User';
      });
    }
    setAssignments(rows);
  };

  useEffect(() => { load(); }, [locationId]);

  const saveCount = async () => {
    const n = Math.max(1, Math.floor(Number(count) || 1));
    setCount(String(n));
    const { error } = await supabase.from('locations').update({ pos_count: n }).eq('id', locationId);
    if (error) { toast.error('Failed to save POS count'); return; }
    toast.success('POS count saved');
    onSaved();
  };

  const unassign = async (id: string) => {
    const { error } = await supabase.from('pos_assignments').delete().eq('id', id);
    if (error) { toast.error('Failed to unassign POS'); return; }
    toast.success('POS unassigned');
    load();
    onSaved();
  };

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="pos-count" className="text-sm font-medium">POS Count</Label>
        <Input
          id="pos-count"
          type="number"
          min={1}
          step={1}
          className="w-24 h-8"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          onBlur={saveCount}
          onKeyDown={(e) => e.key === 'Enter' && saveCount()}
        />
      </div>
      {assignments.length > 0 && (
        <div className="space-y-1">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span>POS {a.pos_number} — {a.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Unassign" onClick={() => unassign(a.id)}>
                <UserMinus className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default POSAssignmentsSection;
