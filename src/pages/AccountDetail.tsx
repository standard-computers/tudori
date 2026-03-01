import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useTableSort } from '@/hooks/use-table-sort';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { CreateInvoiceDialog } from '@/components/invoices/CreateInvoiceDialog';
import { AutoMakeInvoicesDialog } from '@/components/accounts/AutoMakeInvoicesDialog';
import { CreateCreditMemoDialog } from '@/components/accounts/CreateCreditMemoDialog';
import { CreateDebitMemoDialog } from '@/components/accounts/CreateDebitMemoDialog';
import { ArrowLeft, Users, Loader2, FileText, MoreHorizontal, DollarSign, Plus, Minus, Wand2, Eye, Maximize2, Minimize2, StickyNote } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from '@/lib/toast';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useMaximizedState } from '@/hooks/use-maximize-preference';

interface Account {
  id: string;
  account_id: string;
  name: string;
  type: string;
  customer_id: string | null;
  vendor_id: string | null;
  location_id: string | null;
  ledger_id: string | null;
  account_manager_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
  location?: { name: string; location_id: string } | null;
}

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
  purchase_order?: { 
    po_number: string;
    vendor?: { name: string; vendor_id: string } | null;
    location?: { name: string; location_id: string } | null;
  } | null;
  sales_order?: { 
    so_number: string;
    customer?: { name: string; customer_id: string } | null;
    location?: { name: string; location_id: string } | null;
  } | null;
  ledger?: { name: string } | null;
}

interface Payment {
  id: string;
  payment_number: string;
  account_id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  processed_by: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  invoice?: { invoice_number: string } | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500',
  pending: 'bg-yellow-500',
  paid: 'bg-green-500',
  cancelled: 'bg-red-500',
  completed: 'bg-green-500',
};

const AccountDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Dialog states
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [canCreateInvoice, setCanCreateInvoice] = useState(false);
  const [isAutoMakeDialogOpen, setIsAutoMakeDialogOpen] = useState(false);
  const [isCreateCreditMemoDialogOpen, setIsCreateCreditMemoDialogOpen] = useState(false);
  const [isCreateDebitMemoDialogOpen, setIsCreateDebitMemoDialogOpen] = useState(false);
  const [memoInvoiceId, setMemoInvoiceId] = useState<string | undefined>(undefined);
  const [isViewInvoiceDialogOpen, setIsViewInvoiceDialogOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);

  // Inventory account: ledger transactions
  interface LedgerTransaction {
    id: string;
    ledger_id: string;
    transaction_type: string;
    reference_id: string | null;
    reference_number: string | null;
    amount: number;
    description: string | null;
    transaction_date: string;
    created_at: string;
  }
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[]>([]);
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const { sortConfig: txSortConfig, sortedAndFilteredData: sortedTransactions, handleSort: handleTxSort } = useTableSort<LedgerTransaction>(ledgerTransactions);

  const { sortConfig, sortedAndFilteredData, handleSort } = useTableSort<Invoice>(invoices);
  const { sortConfig: paymentSortConfig, sortedAndFilteredData: sortedPayments, handleSort: handlePaymentSort } = useTableSort<Payment>(payments);

  useKeyboardShortcut('n', () => {
    if (canCreateInvoice) setIsCreateInvoiceDialogOpen(true);
  }, canCreateInvoice);

  useKeyboardShortcut('F1', () => navigate(-1));

  useEffect(() => {
    setTransaction('acc/view');
    return () => setTransaction('acc');
  }, [setTransaction]);

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
    if (user && id && companyId) {
      fetchAccountAndInvoices();
    }
  }, [user, id, companyId]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('company_id', profile.company_id);
      
      const hasAdminRole = roles?.some(r => r.role === 'admin' || r.role === 'it' || r.role === 'owner');
      if (hasAdminRole) {
        setCanCreateInvoice(true);
      }
    }
  };

  const fetchAccountAndInvoices = async () => {
    setLoading(true);
    try {
      // Fetch account details
      const { data: accountData, error: accountError } = await supabase
        .from('accounts' as any)
        .select(`
          *,
          customer:customers(name),
          vendor:vendors(name),
          location:locations(name, location_id)
        `)
        .eq('id', id)
        .single();

      if (accountError) throw accountError;
      setAccount(accountData as any);
      
      if ((accountData as any).account_manager_id === user?.id) {
        setCanCreateInvoice(true);
      }

      // Fetch ledger transactions for any account that has a ledger linked
      let resolvedLedgerId = (accountData as any).ledger_id;
      if (!resolvedLedgerId && ((accountData as any).type === 'inventory' || (accountData as any).type === 'location') && (accountData as any).location_id) {
        const { getInventoryLedgerId } = await import('@/lib/inventory-account');
        resolvedLedgerId = await getInventoryLedgerId((accountData as any).location_id, companyId || undefined);
      }
      if (resolvedLedgerId) {
        const { data: txData } = await supabase
          .from('ledger_transactions' as any)
          .select('*')
          .eq('ledger_id', resolvedLedgerId)
          .order('transaction_date', { ascending: false });
        setLedgerTransactions((txData as any) || []);
      }

      // Fetch invoices for this account
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices' as any)
        .select(`
          *,
          purchase_order:purchase_orders(po_number, vendor:vendors(name, vendor_id), location:locations!purchase_orders_location_id_fkey(name, location_id)),
          sales_order:sales_orders(so_number, customer:customers(name, customer_id), location:locations!sales_orders_location_id_fkey(name, location_id)),
          ledger:ledgers(name)
        `)
        .eq('account_id', id)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices((invoicesData as any) || []);

      // Fetch payments for this account
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments' as any)
        .select(`
          *,
          invoice:invoices(invoice_number)
        `)
        .eq('account_id', id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments((paymentsData as any) || []);
    } catch (error) {
      console.error('Error fetching account details:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearchQuery) return sortedAndFilteredData;
    const query = invoiceSearchQuery.toLowerCase();
    return sortedAndFilteredData.filter(
      (invoice) =>
        invoice.invoice_number.toLowerCase().includes(query) ||
        invoice.status.toLowerCase().includes(query) ||
        invoice.purchase_order?.po_number?.toLowerCase().includes(query) ||
        invoice.sales_order?.so_number?.toLowerCase().includes(query)
    );
  }, [sortedAndFilteredData, invoiceSearchQuery]);

  const filteredPayments = useMemo(() => {
    if (!paymentSearchQuery) return sortedPayments;
    const query = paymentSearchQuery.toLowerCase();
    return sortedPayments.filter(
      (payment) =>
        payment.payment_number.toLowerCase().includes(query) ||
        payment.status.toLowerCase().includes(query) ||
        payment.invoice?.invoice_number?.toLowerCase().includes(query)
    );
  }, [sortedPayments, paymentSearchQuery]);

  const totalAmount = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + inv.amount, 0);
  }, [invoices]);

  const outstandingAmount = useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + inv.amount, 0);
  }, [invoices]);

  const handleAcceptPayment = async () => {
    if (!selectedInvoice || !companyId) return;
    setIsSubmitting(true);

    try {
      // Generate payment number
      const { data: paymentNumber } = await supabase.rpc('get_next_payment_number', { p_company_id: companyId });

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments' as any)
        .insert({
          payment_number: paymentNumber,
          company_id: companyId,
          account_id: selectedInvoice.account_id,
          invoice_id: selectedInvoice.id,
          amount: selectedInvoice.amount,
          payment_date: new Date().toISOString().split('T')[0],
          processed_by: user?.id,
          status: 'completed',
        } as any);

      if (paymentError) throw paymentError;

      // Update invoice status to paid
      const { error } = await supabase
        .from('invoices' as any)
        .update({ status: 'paid' })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      // Post payment to ledger - prefer invoice's ledger, fallback to account's ledger
      let paymentLedgerId = selectedInvoice.ledger_id || account?.ledger_id || null;
      if (!paymentLedgerId && account?.location_id && companyId) {
        const { getInventoryLedgerId } = await import('@/lib/inventory-account');
        paymentLedgerId = await getInventoryLedgerId(account.location_id, companyId);
      }
      if (paymentLedgerId) {
        const { error: ledgerError } = await supabase.from('ledger_transactions' as any).insert({
          ledger_id: paymentLedgerId,
          transaction_type: 'payment',
          reference_id: selectedInvoice.id,
          reference_number: paymentNumber,
          amount: Math.abs(selectedInvoice.amount),
          description: `Payment ${paymentNumber} for Invoice ${selectedInvoice.invoice_number}`,
          transaction_date: new Date().toISOString().split('T')[0],
        } as any);
        if (ledgerError) {
          console.error('Ledger transaction error:', ledgerError);
          throw new Error(`Ledger posting failed: ${ledgerError.message}`);
        }
      } else {
        console.warn('No ledger found for payment - invoice ledger_id:', selectedInvoice.ledger_id, 'account ledger_id:', account?.ledger_id);
      }

      toast.success('Payment accepted successfully');
      setIsPaymentDialogOpen(false);
      setSelectedInvoice(null);
      fetchAccountAndInvoices();
    } catch (error: any) {
      console.error('Error accepting payment:', error);
      toast.error(error.message || 'Failed to accept payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentDialogOpen(true);
  };

  const openCreditMemoDialog = (invoice: Invoice) => {
    setMemoInvoiceId(invoice.id);
    setIsCreateCreditMemoDialogOpen(true);
  };

  const openDebitMemoDialog = (invoice: Invoice) => {
    setMemoInvoiceId(invoice.id);
    setIsCreateDebitMemoDialogOpen(true);
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setIsViewInvoiceDialogOpen(true);
    
    const { data: items } = await supabase
      .from('invoice_items' as any)
      .select('*, product:products(name, product_id)')
      .eq('invoice_id', invoice.id)
      .order('created_at');
    
    setViewItems((items as any) || []);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Account not found</p>
          <Button onClick={() => navigate('/accounts')}>Back to Accounts</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div>
        <div className="px-4 pr-16 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/accounts')} className="relative">
              <ArrowLeft className="h-5 w-5" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
            </Button>
            <Users className="h-6 w-6 text-indigo-500" />
            <div>
              <h1 className="text-2xl font-bold">{account.name}</h1>
              <p className="text-sm text-muted-foreground font-mono">{account.account_id}</p>
            </div>
          </div>
          {canCreateInvoice && (
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="relative" onClick={() => setIsNotesDialogOpen(true)} title="View Notes">
                <StickyNote className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="relative" onClick={() => setIsCreateCreditMemoDialogOpen(true)}>
                <Minus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="relative" onClick={() => setIsCreateDebitMemoDialogOpen(true)}>
                <Plus className="h-4 w-4 text-destructive" />
              </Button>
              {account.location_id && (
                <Button size="icon" variant="outline" className="relative" onClick={() => setIsAutoMakeDialogOpen(true)}>
                  <Wand2 className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" className="relative" onClick={() => setIsCreateInvoiceDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6">
        {/* Account Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="text-sm font-medium capitalize">{account.type}</p>
          </div>
          <div className="border rounded-lg p-4 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Linked To</p>
            <p className="text-sm font-medium">
              {account.type === 'customer' && account.customer?.name}
              {account.type === 'vendor' && account.vendor?.name}
              {(account.type === 'location' || account.type === 'inventory') && account.location?.name}
              {!account.customer?.name && !account.vendor?.name && !account.location?.name && '-'}
            </p>
          </div>
          <div className="border rounded-lg p-4 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Total Invoiced</p>
            <p className="text-sm font-medium">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="border rounded-lg p-4 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-sm font-medium text-yellow-600">${outstandingAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions">Transactions ({payments.length + invoices.length})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Transactions</h2>
              </div>
              <Input
                placeholder="Search transactions..."
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const paymentRows = payments.map(p => ({
                    id: `pay-${p.id}`,
                    date: p.payment_date,
                    type: 'payment',
                    reference: p.payment_number,
                    description: p.invoice?.invoice_number ? `Payment for Invoice ${p.invoice.invoice_number}` : (p.notes || 'Payment'),
                    amount: p.amount,
                    invoiceId: p.invoice_id || null,
                  }));
                  const invoiceRows = invoices.map(inv => ({
                    id: `inv-${inv.id}`,
                    date: inv.invoice_date,
                    type: 'invoice',
                    reference: inv.invoice_number,
                    description: inv.purchase_order?.po_number ? `Invoice for PO ${inv.purchase_order.po_number}` : inv.notes || 'Invoice',
                    amount: -inv.amount,
                    invoiceId: inv.id,
                  }));

                  const allRows = [...paymentRows, ...invoiceRows];
                  const query = txSearchQuery.toLowerCase();
                  const filteredRows = query
                    ? allRows.filter(r =>
                        r.type.toLowerCase().includes(query) ||
                        (r.reference || '').toLowerCase().includes(query) ||
                        (r.description || '').toLowerCase().includes(query)
                      )
                    : allRows;

                  // Build groups: each invoice + its payments form a group
                  const groupMap = new Map<string, typeof allRows>();
                  const ungrouped: typeof allRows = [];
                  for (const row of filteredRows) {
                    if (row.type === 'invoice') {
                      const key = row.invoiceId!;
                      if (!groupMap.has(key)) groupMap.set(key, []);
                      groupMap.get(key)!.push(row);
                    } else if (row.invoiceId && groupMap.has(row.invoiceId)) {
                      groupMap.get(row.invoiceId)!.push(row);
                    } else {
                      ungrouped.push(row);
                    }
                  }

                  type TxRow = typeof allRows[0];
                  type Group = { rows: TxRow[]; subtotal: number; groupDate: string };
                  const groups: Group[] = [];
                  for (const rows of groupMap.values()) {
                    const s = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    groups.push({ rows: s, subtotal: s.reduce((acc, r) => acc + r.amount, 0), groupDate: s[0].date });
                  }
                  for (const row of ungrouped) {
                    groups.push({ rows: [row], subtotal: row.amount, groupDate: row.date });
                  }
                  groups.sort((a, b) => new Date(b.groupDate).getTime() - new Date(a.groupDate).getTime());

                  if (groups.length === 0) return (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  );

                  return groups.flatMap((group, gi) => {
                    const rowEls = group.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{format(parseISO(row.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{row.type.replace(/_/g, ' ')}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.reference || '-'}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{row.description || '-'}</TableCell>
                        <TableCell className={`font-medium ${row.amount < 0 ? 'text-destructive' : ''}`}>
                          {row.amount < 0 ? '-' : ''}${Math.abs(row.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ));
                    const subtotalEl = group.rows.length > 1 ? (
                      <TableRow key={`sub-${gi}`} className="bg-muted/40 border-t border-border/60">
                        <TableCell colSpan={4} className="text-right text-xs text-muted-foreground font-medium uppercase tracking-wide pr-4">
                          Group Subtotal
                        </TableCell>
                        <TableCell className={`font-semibold text-sm ${group.subtotal < 0 ? 'text-destructive' : 'text-foreground'}`}>
                          {group.subtotal < 0 ? '-' : ''}${Math.abs(group.subtotal).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ) : null;
                    return subtotalEl ? [...rowEls, subtotalEl] : rowEls;
                  });
                })()}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="invoices">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Invoices</h2>
              </div>
              <Input
                placeholder="Search invoices..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Invoice #" sortKey="invoice_number" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
                  <SortableTableHead label="Date" sortKey="invoice_date" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
                  <TableHead>Reference</TableHead>
                  <TableHead>Pay To</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Location ID</TableHead>
                  <SortableTableHead label="Amount" sortKey="amount" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
                  <TableHead>Ledger</TableHead>
                  <SortableTableHead label="Status" sortKey="status" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
                  <SortableTableHead label="Due Date" sortKey="due_date" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No invoices found for this account.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono">
                        <button onClick={() => handleViewInvoice(invoice)} className="text-primary hover:underline cursor-pointer">
                          {invoice.invoice_number}
                        </button>
                      </TableCell>
                      <TableCell>{format(parseISO(invoice.invoice_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {invoice.purchase_order && <Badge variant="outline">PO: {invoice.purchase_order.po_number}</Badge>}
                        {invoice.sales_order && <Badge variant="outline">SO: {invoice.sales_order.so_number}</Badge>}
                      </TableCell>
                      <TableCell>
                        {invoice.purchase_order?.vendor && (
                          <div>
                            <p className="font-medium">{invoice.purchase_order.vendor.name}</p>
                            <p className="text-xs text-muted-foreground">{invoice.purchase_order.vendor.vendor_id}</p>
                          </div>
                        )}
                        {invoice.sales_order?.customer && (
                          <div>
                            <p className="font-medium">{invoice.sales_order.customer.name}</p>
                            <p className="text-xs text-muted-foreground">{invoice.sales_order.customer.customer_id}</p>
                          </div>
                        )}
                        {!invoice.purchase_order?.vendor && !invoice.sales_order?.customer && '-'}
                      </TableCell>
                      <TableCell>
                        {invoice.purchase_order?.location?.name || invoice.sales_order?.location?.name || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {invoice.purchase_order?.location?.location_id || invoice.sales_order?.location?.location_id || '-'}
                      </TableCell>
                      <TableCell className="font-medium">${invoice.amount.toFixed(2)}</TableCell>
                      <TableCell>{invoice.ledger?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[invoice.status]} text-white`}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invoice.due_date ? format(parseISO(invoice.due_date), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleViewInvoice(invoice)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                              <DropdownMenuItem onClick={() => openPaymentDialog(invoice)}>
                                <DollarSign className="h-4 w-4 mr-2" />
                                Accept Payment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openCreditMemoDialog(invoice)}>
                              <Minus className="h-4 w-4 mr-2" />
                              Add Credit Memo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDebitMemoDialog(invoice)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Debit Memo
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="payments">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Payments</h2>
              </div>
              <Input
                placeholder="Search payments..."
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Payment #" sortKey="payment_number" currentSortKey={paymentSortConfig.key} currentSortDirection={paymentSortConfig.direction} onSort={handlePaymentSort} filterable={false} />
                  <SortableTableHead label="Date" sortKey="payment_date" currentSortKey={paymentSortConfig.key} currentSortDirection={paymentSortConfig.direction} onSort={handlePaymentSort} filterable={false} />
                  <TableHead>Invoice</TableHead>
                  <SortableTableHead label="Amount" sortKey="amount" currentSortKey={paymentSortConfig.key} currentSortDirection={paymentSortConfig.direction} onSort={handlePaymentSort} filterable={false} />
                  <SortableTableHead label="Status" sortKey="status" currentSortKey={paymentSortConfig.key} currentSortDirection={paymentSortConfig.direction} onSort={handlePaymentSort} filterable={false} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No payments found for this account.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono">{payment.payment_number}</TableCell>
                      <TableCell>{format(parseISO(payment.payment_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-mono">{payment.invoice?.invoice_number || '-'}</TableCell>
                      <TableCell className="font-medium">${Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[payment.status] || 'bg-slate-500'} text-white`}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>

      {/* Accept Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accept Payment</DialogTitle>
            <DialogDescription>
              Review the payment details below before confirming.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-3 px-6">
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Invoice</span>
                  <span className="font-mono font-medium">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Account</span>
                  <span className="font-medium">{account?.name}</span>
                </div>
                {selectedInvoice.purchase_order?.vendor && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pay To</span>
                    <span className="font-medium">{selectedInvoice.purchase_order.vendor.name}</span>
                  </div>
                )}
                {selectedInvoice.sales_order?.customer && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Customer</span>
                    <span className="font-medium">{selectedInvoice.sales_order.customer.name}</span>
                  </div>
                )}
                {(selectedInvoice.purchase_order?.location || selectedInvoice.sales_order?.location) && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Location</span>
                    <span className="font-medium">
                      {selectedInvoice.purchase_order?.location?.name || selectedInvoice.sales_order?.location?.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Invoice Date</span>
                   <span className="font-medium">{format(parseISO(selectedInvoice.invoice_date), 'MMM d, yyyy')}</span>
                 </div>
                 {selectedInvoice.due_date && (
                   <div className="flex justify-between">
                     <span className="text-sm text-muted-foreground">Due Date</span>
                     <span className="font-medium">{format(parseISO(selectedInvoice.due_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {selectedInvoice.ledger?.name && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ledger</span>
                    <span className="font-medium">{selectedInvoice.ledger.name}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-sm font-medium">Payment Amount</span>
                  <span className="text-lg font-semibold">${selectedInvoice.amount.toFixed(2)}</span>
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Processed By</span>
                  <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Payment Date</span>
                  <span className="font-medium">{format(new Date(), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sticky bottom-0 pt-4">
            <Button onClick={handleAcceptPayment} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accept Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <CreateInvoiceDialog
        open={isCreateInvoiceDialogOpen}
        onOpenChange={setIsCreateInvoiceDialogOpen}
        defaultAccountId={account.id}
        onSuccess={fetchAccountAndInvoices}
      />

      {account.location_id && companyId && (
        <AutoMakeInvoicesDialog
          open={isAutoMakeDialogOpen}
          onOpenChange={setIsAutoMakeDialogOpen}
          accountId={account.id}
          accountLocationId={account.location_id}
          companyId={companyId}
          onSuccess={fetchAccountAndInvoices}
        />
      )}

      {companyId && (
        <>
           <CreateCreditMemoDialog
            open={isCreateCreditMemoDialogOpen}
            onOpenChange={(open) => {
              setIsCreateCreditMemoDialogOpen(open);
              if (!open) setMemoInvoiceId(undefined);
            }}
            companyId={companyId}
            defaultAccountId={account.id}
            defaultInvoiceId={memoInvoiceId}
            onSuccess={fetchAccountAndInvoices}
          />
          <CreateDebitMemoDialog
            open={isCreateDebitMemoDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDebitMemoDialogOpen(open);
              if (!open) setMemoInvoiceId(undefined);
            }}
            companyId={companyId}
            defaultAccountId={account.id}
            defaultInvoiceId={memoInvoiceId}
            onSuccess={fetchAccountAndInvoices}
          />
        </>
      )}

      {/* View Invoice Dialog */}
      <Dialog open={isViewInvoiceDialogOpen} onOpenChange={setIsViewInvoiceDialogOpen}>
        <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'max-w-3xl max-h-[90vh]'}`}>
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader>
            <DialogTitle>Invoice {viewingInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>Invoice details and line items</DialogDescription>
          </DialogHeader>

          {viewingInvoice && (
            <Tabs defaultValue="details" className="flex-1">
              <TabsList className="mx-6">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">Line Items</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="px-6 pb-4">
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Account</Label>
                      <p className="font-medium">{account?.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge className={`${statusColors[viewingInvoice.status] || 'bg-slate-500'} text-white`}>
                        {viewingInvoice.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Invoice Date</Label>
                      <p>{format(parseISO(viewingInvoice.invoice_date), 'MMM d, yyyy')}</p>
                    </div>
                    {viewingInvoice.due_date && (
                      <div>
                        <Label className="text-muted-foreground">Due Date</Label>
                        <p>{format(parseISO(viewingInvoice.due_date), 'MMM d, yyyy')}</p>
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

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label className="text-muted-foreground">Amount</Label>
                      <p className="text-2xl font-bold font-mono">${viewingInvoice.amount?.toFixed(2)}</p>
                    </div>
                  </div>

                  {viewingInvoice.ledger?.name && (
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
              </TabsContent>

              <TabsContent value="items" className="px-6 pb-4">
                <div className="pt-4">
                  {viewItems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No line items for this invoice.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewItems.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product?.name}</p>
                                <p className="text-sm text-muted-foreground">{item.product?.product_id}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right font-mono">${(item.unit_price || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">${(item.total_price || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewInvoiceDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Account Notes
            </DialogTitle>
            <DialogDescription>{account.name} ({account.account_id})</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            {account.notes ? (
              <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes on this account.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountDetail;
