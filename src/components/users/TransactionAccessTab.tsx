import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/lib/toast';
import { TRANSACTION_CODES } from '@/config/transaction-codes';

interface TransactionAccessTabProps {
  userId: string;
  companyId: string;
  readOnly?: boolean;
}

interface AccessRecord {
  transaction_code: string;
  has_access: boolean;
}

export const TransactionAccessTab = ({ userId, companyId, readOnly = false }: TransactionAccessTabProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAccess();
  }, [userId, companyId]);

  const fetchAccess = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('user_transaction_access')
      .select('transaction_code, has_access')
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error fetching transaction access:', error);
      setLoading(false);
      return;
    }

    // Build access map from existing records
    const map: Record<string, boolean> = {};
    TRANSACTION_CODES.forEach(tc => {
      const record = data?.find((d: AccessRecord) => d.transaction_code === tc.code);
      map[tc.code] = record?.has_access ?? true; // Default to true if no record exists
    });
    
    setAccessMap(map);
    setLoading(false);
  };

  const handleToggle = (code: string) => {
    if (readOnly) return;
    setAccessMap(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  const handleSelectAll = () => {
    if (readOnly) return;
    const newMap: Record<string, boolean> = {};
    TRANSACTION_CODES.forEach(tc => {
      newMap[tc.code] = true;
    });
    setAccessMap(newMap);
  };

  const handleSelectNone = () => {
    if (readOnly) return;
    const newMap: Record<string, boolean> = {};
    TRANSACTION_CODES.forEach(tc => {
      newMap[tc.code] = false;
    });
    setAccessMap(newMap);
  };

  const handleSave = async () => {
    setSaving(true);

    // Upsert all access records
    const records = TRANSACTION_CODES.map(tc => ({
      user_id: userId,
      company_id: companyId,
      transaction_code: tc.code,
      has_access: accessMap[tc.code] ?? true,
    }));

    // Delete existing records and insert new ones
    const { error: deleteError } = await supabase
      .from('user_transaction_access')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (deleteError) {
      toast.error('Failed to update access: ' + deleteError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('user_transaction_access')
      .insert(records);

    if (insertError) {
      toast.error('Failed to save access: ' + insertError.message);
      setSaving(false);
      return;
    }

    toast.success('Transaction access updated');
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectNone}>
              Select None
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Access
          </Button>
        </div>
      )}
      
      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
        {TRANSACTION_CODES.map(tc => (
          <div
            key={tc.code}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              accessMap[tc.code] ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'
            } ${!readOnly ? 'cursor-pointer hover:border-primary/40' : ''}`}
            onClick={() => handleToggle(tc.code)}
          >
            <Checkbox
              id={tc.code}
              checked={accessMap[tc.code]}
              disabled={readOnly}
              onCheckedChange={() => handleToggle(tc.code)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex-1 min-w-0">
              <Label htmlFor={tc.code} className="font-medium cursor-pointer">
                {tc.name}
              </Label>
              <p className="text-xs text-muted-foreground truncate">{tc.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
