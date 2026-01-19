import { useEffect, useState, useMemo } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/SortableTableHead';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { SearchableSelect, SearchableSelectOption } from '@/components/SearchableSelect';
import { ArrowLeft, FileText, Plus, Loader2, MoreHorizontal, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  invoice_number: string;
  account_id: string;
  purchase_order_id: string | null;
  sales_order_id: string | null;
  ledger_id: string | null;
  invoice_date: string;
  due_date: string | null;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  account?: { name: string; account_id: string } | null;
  purchase_order?: { po_number: string; total_amount: number; ledger_id: string | null } | null;
  sales_order?: { so_number: string; total_amount: number; ledger_id: string | null } | null;
  ledger?: { name: string } | null;
}

interface Account {
  id: string;
  name: string;
  account_id: string;
  type: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  total_amount: number;
  ledger_id: string | null;
  status: string;
}

interface SalesOrder {
  id: string;
  so_number: string;
  total_amount: number;
  ledger_id: string | null;
  status: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500',
  pending: 'bg-yellow-500',
  paid: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const Invoices = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    account_id: '',
    reference_type: 'purchase_order' as 'purchase_order' | 'sales_order',
    purchase_order_id: '',
    sales_order_id: '',
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '',
    amount: '',
    notes: '',
  });

  const { sortConfig, sortedAndFilteredData, handleSort } = useTableSort<Invoice>(invoices);

  useEffect(() => {
    if (isCreateDialogOpen) {
      setTransaction('inv/new');
    } else if (isViewDialogOpen) {
      setTransaction('inv/view');
    } else {
      setTransaction('inv');
    }
  }, [isCreateDialogOpen, isViewDialogOpen, setTransaction]);

  useSaveShortcut(() => {
    if (isCreateDialogOpen && !isSubmitting) {
      handleCreate();
    }
  }, isCreateDialogOpen);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchInvoices();
      fetchAccounts();
      fetchPurchaseOrders();
      fetchSalesOrders();
    }
  }, [companyId]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);
    }
    setLoading(false);
  };

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices' as any)
      .select(`
        *,
        account:accounts(name, account_id),
        purchase_order:purchase_orders(po_number, total_amount, ledger_id),
        sales_order:sales_orders(so_number, total_amount, ledger_id),
        ledger:ledgers(name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
      return;
    }

    setInvoices((data as any) || []);
  };

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts' as any)
      .select('id, name, account_id, type')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setAccounts((data as any) || []);
  };

  const fetchPurchaseOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('id, po_number, total_amount, ledger_id, status')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setPurchaseOrders(data || []);
  };

  const fetchSalesOrders = async () => {
    const { data } = await supabase
      .from('sales_orders' as any)
      .select('id, so_number, total_amount, ledger_id, status')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setSalesOrders((data as any) || []);
  };

  const accountOptions: SearchableSelectOption[] = useMemo(() => {
    return accounts.map((a) => ({
      value: a.id,
      label: a.name,
      sublabel: `${a.account_id} • ${a.type}`,
    }));
  }, [accounts]);

  const poOptions: SearchableSelectOption[] = useMemo(() => {
    return purchaseOrders.map((po) => ({
      value: po.id,
      label: po.po_number,
      sublabel: `$${po.total_amount?.toFixed(2) || '0.00'} • ${po.status}`,
    }));
  }, [purchaseOrders]);

  const soOptions: SearchableSelectOption[] = useMemo(() => {
    return salesOrders.map((so) => ({
      value: so.id,
      label: so.so_number,
      sublabel: `$${so.total_amount?.toFixed(2) || '0.00'} • ${so.status}`,
    }));
  }, [salesOrders]);

  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return sortedAndFilteredData;
    const query = searchQuery.toLowerCase();
    return sortedAndFilteredData.filter(
      (invoice) =>
        invoice.invoice_number.toLowerCase().includes(query) ||
        invoice.account?.name?.toLowerCase().includes(query) ||
        invoice.purchase_order?.po_number?.toLowerCase().includes(query) ||
        invoice.sales_order?.so_number?.toLowerCase().includes(query)
    );
  }, [sortedAndFilteredData, searchQuery]);

  const handleCreateClick = () => {
    setFormData({
      account_id: '',
      reference_type: 'purchase_order',
      purchase_order_id: '',
      sales_order_id: '',
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: '',
      amount: '',
      notes: '',
    });
    setIsCreateDialogOpen(true);
  };

  useKeyboardShortcut('n', handleCreateClick);

  const handleViewClick = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  // Auto-fill amount when PO/SO is selected
  useEffect(() => {
    if (formData.reference_type === 'purchase_order' && formData.purchase_order_id) {
      const po = purchaseOrders.find((p) => p.id === formData.purchase_order_id);
      if (po) {
        setFormData((prev) => ({ ...prev, amount: po.total_amount?.toString() || '' }));
      }
    } else if (formData.reference_type === 'sales_order' && formData.sales_order_id) {
      const so = salesOrders.find((s) => s.id === formData.sales_order_id);
      if (so) {
        setFormData((prev) => ({ ...prev, amount: so.total_amount?.toString() || '' }));
      }
    }
  }, [formData.purchase_order_id, formData.sales_order_id, formData.reference_type, purchaseOrders, salesOrders]);

  const handleCreate = async () => {
    if (!formData.account_id) {
      toast.error('Please select an account');
      return;
    }

    const hasReference =
      (formData.reference_type === 'purchase_order' && formData.purchase_order_id) ||
      (formData.reference_type === 'sales_order' && formData.sales_order_id);

    if (!hasReference) {
      toast.error('Please select a Purchase Order or Sales Order');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: invoiceNumber } = await supabase.rpc('get_next_invoice_number', {
        p_company_id: companyId,
      });

      const amount = parseFloat(formData.amount);
      let ledgerId: string | null = null;

      // Determine ledger from the referenced order
      if (formData.reference_type === 'purchase_order' && formData.purchase_order_id) {
        const po = purchaseOrders.find((p) => p.id === formData.purchase_order_id);
        ledgerId = po?.ledger_id || null;
      } else if (formData.reference_type === 'sales_order' && formData.sales_order_id) {
        const so = salesOrders.find((s) => s.id === formData.sales_order_id);
        ledgerId = so?.ledger_id || null;
      }

      // Create the invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices' as any)
        .insert({
          company_id: companyId,
          invoice_number: invoiceNumber,
          account_id: formData.account_id,
          purchase_order_id: formData.reference_type === 'purchase_order' ? formData.purchase_order_id : null,
          sales_order_id: formData.reference_type === 'sales_order' ? formData.sales_order_id : null,
          ledger_id: ledgerId,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          amount,
          status: 'pending',
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create ledger transaction
      // SO reference = positive adjustment (income)
      // PO reference = negative adjustment (expense)
      if (ledgerId) {
        const transactionAmount = formData.reference_type === 'sales_order' ? amount : -amount;
        const referenceNumber =
          formData.reference_type === 'purchase_order'
            ? purchaseOrders.find((p) => p.id === formData.purchase_order_id)?.po_number
            : salesOrders.find((s) => s.id === formData.sales_order_id)?.so_number;

        const { error: txError } = await supabase.from('ledger_transactions' as any).insert({
          ledger_id: ledgerId,
          transaction_type: 'invoice',
          reference_id: (invoice as any).id,
          reference_number: invoiceNumber,
          amount: transactionAmount,
          description: `Invoice ${invoiceNumber} for ${referenceNumber}`,
        });

        if (txError) {
          console.error('Error creating ledger transaction:', txError);
        }
      }

      toast.success('Invoice created successfully');
      setIsCreateDialogOpen(false);
      fetchInvoices();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice "${invoice.invoice_number}"?`)) {
      return;
    }

    try {
      // Delete associated ledger transaction first
      if (invoice.ledger_id) {
        await supabase
          .from('ledger_transactions' as any)
          .delete()
          .eq('reference_id', invoice.id)
          .eq('transaction_type', 'invoice');
      }

      const { error } = await supabase
        .from('invoices' as any)
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success('Invoice deleted successfully');
      fetchInvoices();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast.error(error.message || 'Failed to delete invoice');
    }
  };

  const handleStatusChange = async (invoice: Invoice, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('invoices' as any)
        .update({ status: newStatus })
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success('Invoice status updated');
      fetchInvoices();
    } catch (error: any) {
      console.error('Error updating invoice status:', error);
      toast.error(error.message || 'Failed to update status');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <FileText className="h-6 w-6 text-cyan-500" />
            <h1 className="text-2xl font-bold">Invoices</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
            <Kbd className="ml-2">N</Kbd>
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label="Invoice #"
                  sortKey="invoice_number"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <TableHead>Account</TableHead>
                <TableHead>Reference</TableHead>
                <SortableTableHead
                  label="Date"
                  sortKey="invoice_date"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <SortableTableHead
                  label="Amount"
                  sortKey="amount"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <SortableTableHead
                  label="Status"
                  sortKey="status"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No invoices found. Create your first invoice to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.account?.name}</TableCell>
                    <TableCell>
                      {invoice.purchase_order?.po_number && (
                        <Badge variant="outline">PO: {invoice.purchase_order.po_number}</Badge>
                      )}
                      {invoice.sales_order?.so_number && (
                        <Badge variant="outline">SO: {invoice.sales_order.so_number}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="font-mono">
                      ${invoice.amount?.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status] || 'bg-slate-500'}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handleViewClick(invoice)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          {invoice.status !== 'paid' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(invoice, 'paid')}>
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== 'cancelled' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(invoice, 'cancelled')}>
                              Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(invoice)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Create a new invoice linked to a PO or SO.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Account *</Label>
              <SearchableSelect
                options={accountOptions}
                value={formData.account_id}
                onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                placeholder="Select account..."
              />
            </div>

            <div>
              <Label>Reference Type *</Label>
              <Select
                value={formData.reference_type}
                onValueChange={(value: 'purchase_order' | 'sales_order') =>
                  setFormData({
                    ...formData,
                    reference_type: value,
                    purchase_order_id: '',
                    sales_order_id: '',
                    amount: '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="purchase_order">Purchase Order (PO)</SelectItem>
                  <SelectItem value="sales_order">Sales Order (SO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.reference_type === 'purchase_order' && (
              <div>
                <Label>Purchase Order *</Label>
                <SearchableSelect
                  options={poOptions}
                  value={formData.purchase_order_id}
                  onValueChange={(value) => setFormData({ ...formData, purchase_order_id: value })}
                  placeholder="Select PO..."
                />
              </div>
            )}

            {formData.reference_type === 'sales_order' && (
              <div>
                <Label>Sales Order *</Label>
                <SearchableSelect
                  options={soOptions}
                  value={formData.sales_order_id}
                  onValueChange={(value) => setFormData({ ...formData, sales_order_id: value })}
                  placeholder="Select SO..."
                />
              </div>
            )}

            <div>
              <Label>Invoice Date *</Label>
              <Input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
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
                placeholder="Optional notes"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice {viewingInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>Invoice details</DialogDescription>
          </DialogHeader>

          {viewingInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Account</Label>
                  <p className="font-medium">{viewingInvoice.account?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={statusColors[viewingInvoice.status] || 'bg-slate-500'}>
                    {viewingInvoice.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Invoice Date</Label>
                  <p>{format(new Date(viewingInvoice.invoice_date), 'MMM d, yyyy')}</p>
                </div>
                {viewingInvoice.due_date && (
                  <div>
                    <Label className="text-muted-foreground">Due Date</Label>
                    <p>{format(new Date(viewingInvoice.due_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-muted-foreground">Reference</Label>
                <p>
                  {viewingInvoice.purchase_order?.po_number && `PO: ${viewingInvoice.purchase_order.po_number}`}
                  {viewingInvoice.sales_order?.so_number && `SO: ${viewingInvoice.sales_order.so_number}`}
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground">Amount</Label>
                <p className="text-2xl font-bold">${viewingInvoice.amount?.toFixed(2)}</p>
              </div>

              {viewingInvoice.ledger && (
                <div>
                  <Label className="text-muted-foreground">Ledger</Label>
                  <p>{viewingInvoice.ledger.name}</p>
                </div>
              )}

              {viewingInvoice.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{viewingInvoice.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
