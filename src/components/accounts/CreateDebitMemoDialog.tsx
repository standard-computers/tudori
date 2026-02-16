import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import { MemoItemsEditor, MemoItem } from '@/components/accounts/MemoItemsEditor';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface CreateDebitMemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  defaultAccountId?: string;
  defaultInvoiceId?: string;
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

interface Product {
  id: string;
  name: string;
  product_id: string;
  base_price?: number;
}

export const CreateDebitMemoDialog = ({
  open,
  onOpenChange,
  companyId,
  defaultAccountId,
  defaultInvoiceId,
  onSuccess,
}: CreateDebitMemoDialogProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<MemoItem[]>([]);
  const [formData, setFormData] = useState({
    account_id: '',
    invoice_id: '',
    ledger_id: '',
    notes: '',
  });

  const totalFromItems = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [items]);

  useEffect(() => {
    if (open && companyId) {
      setFormData({
        account_id: defaultAccountId || '',
        invoice_id: defaultInvoiceId || '',
        ledger_id: '',
        notes: '',
      });
      setItems([]);
      fetchAccounts();
      fetchInvoices();
      fetchLedgers();
      fetchProducts();
    }
  }, [open, companyId, defaultAccountId, defaultInvoiceId]);

  // Auto-fill ledger when defaultInvoiceId is set and invoices are loaded
  useEffect(() => {
    if (defaultInvoiceId && invoices.length > 0) {
      const inv = invoices.find((i) => i.id === defaultInvoiceId);
      if (inv?.ledger_id) {
        setFormData((prev) => ({ ...prev, ledger_id: inv.ledger_id || prev.ledger_id }));
      }
    }
  }, [defaultInvoiceId, invoices]);

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

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products' as any)
      .select('id, name, product_id, base_price')
      .eq('company_id', companyId)
      .order('name');
    setProducts((data as any) || []);
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

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    const invalidItems = items.filter((i) => !i.product_id || i.quantity <= 0 || i.unit_price <= 0);
    if (invalidItems.length > 0) {
      toast.error('Please fill in all item fields correctly');
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
          amount: totalFromItems,
          notes: formData.notes || null,
          status: 'applied',
        })
        .select()
        .single();

      if (memoError) throw memoError;

      // Insert memo items
      const memoItems = items.map((item) => ({
        debit_memo_id: (memo as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes || null,
      }));

      await supabase.from('debit_memo_items' as any).insert(memoItems);

      // Create ledger transaction
      await supabase.from('ledger_transactions' as any).insert({
        ledger_id: ledgerId,
        transaction_type: 'debit_memo',
        reference_id: (memo as any).id,
        reference_number: memoNumber,
        amount: totalFromItems,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Debit Memo</DialogTitle>
          <DialogDescription>Create a debit memo to increase the amount owed on an account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6">
          <div className="grid grid-cols-2 gap-4">
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

          <MemoItemsEditor
            items={items}
            onItemsChange={setItems}
            products={products}
          />

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Reason for debit memo..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 pt-4">
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Debit Memo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
