import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText } from 'lucide-react';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';
import { getInventoryLedgerId } from '@/lib/inventory-account';

interface PurchaseOrderWithInvoiceStatus {
  id: string;
  po_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  ledger_id: string | null;
  vendor?: { name: string; vendor_id: string; payment_terms: number | null } | null;
  location?: { name: string; location_id: string } | null;
  invoiced_amount: number;
  remaining_amount: number;
}

interface AutoMakeInvoicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountLocationId: string;
  companyId: string;
  onSuccess?: () => void;
}

export const AutoMakeInvoicesDialog = ({
  open,
  onOpenChange,
  accountId,
  accountLocationId,
  companyId,
  onSuccess,
}: AutoMakeInvoicesDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithInvoiceStatus[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (open && accountLocationId && companyId) {
      fetchPurchaseOrders();
      setSelectedIds(new Set());
      setProgress(null);
    }
  }, [open, accountLocationId, companyId]);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      // Fetch POs where bill_to_location_id matches the account's location
      const { data: posData, error: posError } = await supabase
        .from('purchase_orders')
        .select(`
          id, po_number, status, total_amount, subtotal, tax_amount, ledger_id,
          vendor:vendors(name, vendor_id, payment_terms),
          location:locations!purchase_orders_location_id_fkey(name, location_id)
        `)
        .eq('company_id', companyId)
        .eq('bill_to_location_id', accountLocationId)
        .in('status', ['confirmed', 'shipped', 'delivered', 'pending', 'draft', 'sent'])
        .order('created_at', { ascending: false });

      if (posError) throw posError;

      // For each PO, check existing invoices
      const posWithStatus: PurchaseOrderWithInvoiceStatus[] = [];

      for (const po of (posData || [])) {
        const { data: invoices } = await supabase
          .from('invoices' as any)
          .select('amount')
          .eq('purchase_order_id', po.id)
          .neq('status', 'cancelled');

        const invoicedAmount = (invoices || []).reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
        const remaining = (po.total_amount || 0) - invoicedAmount;

        if (remaining > 0) {
          posWithStatus.push({
            ...po,
            vendor: po.vendor as any,
            location: po.location as any,
            invoiced_amount: invoicedAmount,
            remaining_amount: remaining,
          });
        }
      }

      setPurchaseOrders(posWithStatus);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === purchaseOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(purchaseOrders.map(po => po.id)));
    }
  };

  const selectedPOs = useMemo(() => {
    return purchaseOrders.filter(po => selectedIds.has(po.id));
  }, [purchaseOrders, selectedIds]);

  const handleCreate = async () => {
    if (selectedPOs.length === 0) {
      toast.error('Please select at least one purchase order');
      return;
    }

    setIsCreating(true);
    setProgress({ current: 0, total: selectedPOs.length });
    let created = 0;

    try {
      // Resolve the account's own ledger first — it supersedes the PO ledger
      const { data: acctData } = await supabase
        .from('accounts' as any)
        .select('ledger_id')
        .eq('id', accountId)
        .maybeSingle();
      const accountLedgerId = (acctData as any)?.ledger_id || null;

      // Fallback to the account location's inventory ledger
      let fallbackLedgerId: string | null = accountLedgerId;
      if (!fallbackLedgerId && accountLocationId) {
        fallbackLedgerId = await getInventoryLedgerId(accountLocationId, companyId);
      }

      for (const po of selectedPOs) {
        const ledgerId = accountLedgerId || po.ledger_id || fallbackLedgerId;
        setProgress({ current: created + 1, total: selectedPOs.length });

        // Get next invoice number
        const { data: invoiceNumber } = await supabase.rpc('get_next_invoice_number', {
          p_company_id: companyId,
        });

        // Calculate due date from vendor payment terms
        const terms = po.vendor?.payment_terms ?? 30;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + terms);

        // Create invoice for remaining amount
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices' as any)
          .insert({
            company_id: companyId,
            invoice_number: invoiceNumber,
            account_id: accountId,
            purchase_order_id: po.id,
            ledger_id: po.ledger_id,
            invoice_date: format(new Date(), 'yyyy-MM-dd'),
            due_date: format(dueDate, 'yyyy-MM-dd'),
            subtotal: po.remaining_amount,
            tax_amount: 0,
            amount: po.remaining_amount,
            status: 'pending',
            notes: `Auto-generated invoice for ${po.po_number}`,
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Fetch PO items to create invoice items
        const { data: poItems } = await supabase
          .from('purchase_order_items')
          .select('product_id, quantity, unit_price, total_price')
          .eq('purchase_order_id', po.id);

        if (poItems && poItems.length > 0) {
          const invoiceItems = poItems.map((item: any) => ({
            invoice_id: (invoice as any).id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price || 0,
            total_price: item.total_price || (item.quantity * (item.unit_price || 0)),
          }));

          await supabase.from('invoice_items' as any).insert(invoiceItems);
        }

        // Copy tax rates from PO
        const { data: poTaxRates } = await supabase
          .from('purchase_order_tax_rates' as any)
          .select('tax_rate_id')
          .eq('purchase_order_id', po.id);

        if (poTaxRates && poTaxRates.length > 0) {
          // Recalculate tax based on remaining amount
          for (const ptr of poTaxRates as any[]) {
            const { data: taxRate } = await supabase
              .from('tax_rates')
              .select('rate, rate_type')
              .eq('id', ptr.tax_rate_id)
              .single();

            if (taxRate) {
              const taxAmount = taxRate.rate_type === 'percent'
                ? po.remaining_amount * (taxRate.rate / 100)
                : taxRate.rate;

              await supabase.from('invoice_tax_rates' as any).insert({
                invoice_id: (invoice as any).id,
                tax_rate_id: ptr.tax_rate_id,
                tax_amount: taxAmount,
              });
            }
          }
        }

        // Create ledger transaction if ledger exists
        if (po.ledger_id) {
          await supabase.from('ledger_transactions' as any).insert({
            ledger_id: po.ledger_id,
            transaction_type: 'invoice',
            reference_id: (invoice as any).id,
            reference_number: invoiceNumber,
            amount: -po.remaining_amount,
            description: `Invoice ${invoiceNumber} for ${po.po_number}`,
            transaction_date: format(new Date(), 'yyyy-MM-dd'),
          });
        }

        created++;

        // Small delay to prevent race conditions
        await new Promise(r => setTimeout(r, 200));
      }

      toast.success(`Created ${created} invoice${created !== 1 ? 's' : ''}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating invoices:', error);
      toast.error(error.message || `Failed after creating ${created} invoices`);
    } finally {
      setIsCreating(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>AutoMake Invoices</DialogTitle>
          <DialogDescription>
            Purchase orders billed to this account's location that have not been fully invoiced.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-2" />
              <p>No uninvoiced purchase orders found for this location.</p>
            </div>
          ) : (
            <>
              {progress && (
                <div className="mb-4 p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Creating invoice {progress.current} of {progress.total}...
                  </p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === purchaseOrders.length && purchaseOrders.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>PO #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Ship To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map(po => (
                    <TableRow key={po.id} className="cursor-pointer" onClick={() => toggleSelect(po.id)}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(po.id)}
                          onCheckedChange={() => toggleSelect(po.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{po.po_number}</TableCell>
                      <TableCell>{po.vendor?.name || '-'}</TableCell>
                      <TableCell>
                        {po.location ? `${po.location.location_id} - ${po.location.name}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{po.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">${po.total_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${po.invoiced_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">${po.remaining_amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 px-6 sticky bottom-0 pt-4">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} of {purchaseOrders.length} selected
              {selectedPOs.length > 0 && (
                <span className="ml-2 font-medium">
                  (${selectedPOs.reduce((sum, po) => sum + po.remaining_amount, 0).toFixed(2)} total)
                </span>
              )}
            </p>
            <Button onClick={handleCreate} disabled={isCreating || selectedIds.size === 0}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create {selectedIds.size} Invoice{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
