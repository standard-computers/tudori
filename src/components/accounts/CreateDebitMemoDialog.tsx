import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface CreateDebitMemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  defaultAccountId?: string;
  onSuccess?: () => void;
}

interface Account {
  id: string;
  name: string;
  account_id: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  ledger_id: string | null;
  account_id: string;
}

interface Ledger {
  id: string;
  name: string;
}

export const CreateDebitMemoDialog = ({
  open,
  onOpenChange,
  companyId,
  defaultAccountId,
  onSuccess,
}: CreateDebitMemoDialogProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    account_id: '',
    invoice_id: '',
    ledger_id: '',
    amount: '',
    notes: '',
  });

  useEffect(() => {
    if (open && companyId) {
      setFormData({
        account_id: defaultAccountId || '',
        invoice_id: '',
        ledger_id: '',
        amount: '',
        notes: '',
      });
      fetchAccounts();
      fetchInvoices();
      fetchLedgers();
    }
  }, [open, companyId, defaultAccountId]);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts' as any)
      .select('id, name, account_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setAccounts((data as any) || []);
  };

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from('invoices' as any)
      .select('id, invoice_number, amount, ledger_id, account_id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setInvoices((data as any) || []);
  };

  const fetchLedgers = async () => {
    const { data } = await supabase
      .from('ledgers' as any)
      .select('id, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setLedgers((data as any) || []);
  };

  const accountOptions: SearchableSelectOption[] = useMemo(() => {
    return accounts.map((a) => ({
      value: a.id,
      label: a.name,
      sublabel: a.account_id,
    }));
  }, [accounts]);

  const filteredInvoices = useMemo(() => {
    if (!formData.account_id) return invoices;
    return invoices.filter((inv) => inv.account_id === formData.account_id);
  }, [invoices, formData.account_id]);

  const invoiceOptions: SearchableSelectOption[] = useMemo(() => {
    return filteredInvoices.map((inv) => ({
      value: inv.id,
      label: inv.invoice_number,
      sublabel: `$${inv.amount.toFixed(2)}`,
    }));
  }, [filteredInvoices]);

  const ledgerOptions: SearchableSelectOption[] = useMemo(() => {
    return ledgers.map((l) => ({
      value: l.id,
      label: l.name,
    }));
  }, [ledgers]);

  const handleCreate = async () => {
    if (!formData.account_id) {
      toast.error('Please select an account');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const selectedInvoice = invoices.find((inv) => inv.id === formData.invoice_id);
    const ledgerId = selectedInvoice?.ledger_id || formData.ledger_id;

    if (!ledgerId) {
      toast.error('Please select an invoice or ledger');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: memoNumber } = await supabase.rpc('get_next_debit_memo_number', {
        p_company_id: companyId,
      });

      const { data: memo, error: memoError } = await supabase
        .from('debit_memos' as any)
        .insert({
          company_id: companyId,
          memo_number: memoNumber,
          account_id: formData.account_id,
          invoice_id: formData.invoice_id || null,
          ledger_id: ledgerId,
          amount,
          notes: formData.notes || null,
          status: 'applied',
        })
        .select()
        .single();

      if (memoError) throw memoError;

      await supabase.from('ledger_transactions' as any).insert({
        ledger_id: ledgerId,
        transaction_type: 'debit_memo',
        reference_id: (memo as any).id,
        reference_number: memoNumber,
        amount: amount,
        description: formData.notes || `Debit memo ${memoNumber}`,
        transaction_date: new Date().toISOString().split('T')[0],
      });

      toast.success('Debit memo created successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating debit memo:', error);
      toast.error(error.message || 'Failed to create debit memo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Debit Memo</DialogTitle>
          <DialogDescription>Create a debit memo to increase the amount owed on an account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6">
          <div>
            <Label>Account *</Label>
            <SearchableSelect
              options={accountOptions}
              value={formData.account_id}
              onValueChange={(value) => setFormData({ ...formData, account_id: value, invoice_id: '' })}
              placeholder="Select account"
            />
          </div>

          <div>
            <Label>Invoice (Optional)</Label>
            <SearchableSelect
              options={invoiceOptions}
              value={formData.invoice_id}
              onValueChange={(value) => {
                const inv = invoices.find((i) => i.id === value);
                setFormData({
                  ...formData,
                  invoice_id: value,
                  ledger_id: inv?.ledger_id || formData.ledger_id,
                });
              }}
              placeholder="Select invoice"
            />
          </div>

          {!formData.invoice_id && (
            <div>
              <Label>Ledger *</Label>
              <SearchableSelect
                options={ledgerOptions}
                value={formData.ledger_id}
                onValueChange={(value) => setFormData({ ...formData, ledger_id: value })}
                placeholder="Select ledger"
              />
            </div>
          )}

          <div>
            <Label>Amount *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Reason for debit memo..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Debit Memo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
