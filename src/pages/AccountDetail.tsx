import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useTableSort } from '@/hooks/use-table-sort';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { CreateInvoiceDialog } from '@/components/invoices/CreateInvoiceDialog';
import { AutoMakeInvoicesDialog } from '@/components/accounts/AutoMakeInvoicesDialog';
import { ArrowLeft, Users, Loader2, FileText, MoreHorizontal, DollarSign, Plus, Minus, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/lib/toast';
import { Kbd } from '@/components/ui/kbd';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';

interface Account {
  id: string;
  account_id: string;
  name: string;
  type: string;
  customer_id: string | null;
  vendor_id: string | null;
  location_id: string | null;
  account_manager_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
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

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500',
  pending: 'bg-yellow-500',
  paid: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const AccountDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Dialog states
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCreditMemoDialogOpen, setIsCreditMemoDialogOpen] = useState(false);
  const [isDebitMemoDialogOpen, setIsDebitMemoDialogOpen] = useState(false);
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states
  const [memoAmount, setMemoAmount] = useState('');
  const [memoNotes, setMemoNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [canCreateInvoice, setCanCreateInvoice] = useState(false);
  const [isAutoMakeDialogOpen, setIsAutoMakeDialogOpen] = useState(false);

  const { sortConfig, sortedAndFilteredData, handleSort } = useTableSort<Invoice>(invoices);

  useKeyboardShortcut('n', () => {
    if (canCreateInvoice) setIsCreateInvoiceDialogOpen(true);
  }, canCreateInvoice);

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
      // Check if user has admin or IT role
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
          vendor:vendors(name)
        `)
        .eq('id', id)
        .single();

      if (accountError) throw accountError;
      setAccount(accountData as any);
      
      // Check if current user is the account manager
      if ((accountData as any).account_manager_id === user?.id) {
        setCanCreateInvoice(true);
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
    } catch (error) {
      console.error('Error fetching account details:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return sortedAndFilteredData;
    const query = searchQuery.toLowerCase();
    return sortedAndFilteredData.filter(
      (invoice) =>
        invoice.invoice_number.toLowerCase().includes(query) ||
        invoice.status.toLowerCase().includes(query) ||
        invoice.purchase_order?.po_number?.toLowerCase().includes(query) ||
        invoice.sales_order?.so_number?.toLowerCase().includes(query)
    );
  }, [sortedAndFilteredData, searchQuery]);

  const totalAmount = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + inv.amount, 0);
  }, [invoices]);

  const outstandingAmount = useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + inv.amount, 0);
  }, [invoices]);

  const handleAcceptPayment = async () => {
    if (!selectedInvoice) return;
    setIsSubmitting(true);

    try {
      // Update invoice status to paid
      const { error } = await supabase
        .from('invoices' as any)
        .update({ status: 'paid' })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

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

  const handleCreditMemo = async () => {
    if (!selectedInvoice || !memoAmount) {
      toast.error('Please enter an amount');
      return;
    }

    const amount = parseFloat(memoAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a ledger transaction for the credit memo (negative for AR, positive for AP)
      // Credit memo reduces what's owed
      if (selectedInvoice.ledger_id) {
        const transactionAmount = selectedInvoice.sales_order_id ? -amount : amount;
        
        await supabase.from('ledger_transactions' as any).insert({
          ledger_id: selectedInvoice.ledger_id,
          transaction_type: 'credit_memo',
          reference_id: selectedInvoice.id,
          reference_number: selectedInvoice.invoice_number,
          amount: transactionAmount,
          description: memoNotes || `Credit memo for invoice ${selectedInvoice.invoice_number}`,
          transaction_date: new Date().toISOString().split('T')[0],
        });
      }

      // Update invoice amount
      const newAmount = Math.max(0, selectedInvoice.amount - amount);
      await supabase
        .from('invoices' as any)
        .update({ 
          amount: newAmount,
          status: newAmount === 0 ? 'paid' : selectedInvoice.status
        })
        .eq('id', selectedInvoice.id);

      toast.success('Credit memo applied successfully');
      setIsCreditMemoDialogOpen(false);
      setSelectedInvoice(null);
      setMemoAmount('');
      setMemoNotes('');
      fetchAccountAndInvoices();
    } catch (error: any) {
      console.error('Error applying credit memo:', error);
      toast.error(error.message || 'Failed to apply credit memo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDebitMemo = async () => {
    if (!selectedInvoice || !memoAmount) {
      toast.error('Please enter an amount');
      return;
    }

    const amount = parseFloat(memoAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a ledger transaction for the debit memo (positive for AR, negative for AP)
      // Debit memo increases what's owed
      if (selectedInvoice.ledger_id) {
        const transactionAmount = selectedInvoice.sales_order_id ? amount : -amount;
        
        await supabase.from('ledger_transactions' as any).insert({
          ledger_id: selectedInvoice.ledger_id,
          transaction_type: 'debit_memo',
          reference_id: selectedInvoice.id,
          reference_number: selectedInvoice.invoice_number,
          amount: transactionAmount,
          description: memoNotes || `Debit memo for invoice ${selectedInvoice.invoice_number}`,
          transaction_date: new Date().toISOString().split('T')[0],
        });
      }

      // Update invoice amount
      const newAmount = selectedInvoice.amount + amount;
      await supabase
        .from('invoices' as any)
        .update({ 
          amount: newAmount,
          status: selectedInvoice.status === 'paid' ? 'pending' : selectedInvoice.status
        })
        .eq('id', selectedInvoice.id);

      toast.success('Debit memo applied successfully');
      setIsDebitMemoDialogOpen(false);
      setSelectedInvoice(null);
      setMemoAmount('');
      setMemoNotes('');
      fetchAccountAndInvoices();
    } catch (error: any) {
      console.error('Error applying debit memo:', error);
      toast.error(error.message || 'Failed to apply debit memo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentDialogOpen(true);
  };

  const openCreditMemoDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setMemoAmount('');
    setMemoNotes('');
    setIsCreditMemoDialogOpen(true);
  };

  const openDebitMemoDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setMemoAmount('');
    setMemoNotes('');
    setIsDebitMemoDialogOpen(true);
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
    <div className="min-h-screen bg-background">
      <div>
        <div className="px-4 pr-16 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/accounts')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Users className="h-6 w-6 text-indigo-500" />
            <div>
              <h1 className="text-2xl font-bold">{account.name}</h1>
              <p className="text-sm text-muted-foreground font-mono">{account.account_id}</p>
            </div>
          </div>
          {canCreateInvoice && (
            <div className="flex items-center gap-2">
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

      <div className="container mx-auto px-4 py-6">
        {/* Account Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="text-lg font-medium capitalize">{account.type}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Linked To</p>
            <p className="text-lg font-medium">
              {account.type === 'customer' && account.customer?.name}
              {account.type === 'vendor' && account.vendor?.name}
              {!account.customer?.name && !account.vendor?.name && '-'}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Invoiced</p>
            <p className="text-lg font-medium">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-lg font-medium text-yellow-600">${outstandingAmount.toFixed(2)}</p>
          </div>
        </div>

        {account.description && (
          <div className="border rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p>{account.description}</p>
          </div>
        )}

        {/* Invoices Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Invoices ({invoices.length})</h2>
          </div>
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div>
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
                <SortableTableHead
                  label="Date"
                  sortKey="invoice_date"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <TableHead>Reference</TableHead>
                <TableHead>Pay To</TableHead>
                <TableHead>Location</TableHead>
                <SortableTableHead
                  label="Amount"
                  sortKey="amount"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <TableHead>Ledger</TableHead>
                <SortableTableHead
                  label="Status"
                  sortKey="status"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <SortableTableHead
                  label="Due Date"
                  sortKey="due_date"
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
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No invoices found for this account.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {invoice.purchase_order && (
                        <Badge variant="outline">PO: {invoice.purchase_order.po_number}</Badge>
                      )}
                      {invoice.sales_order && (
                        <Badge variant="outline">SO: {invoice.sales_order.so_number}</Badge>
                      )}
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
                      {invoice.purchase_order?.location && (
                        <div>
                          <p className="font-medium">{invoice.purchase_order.location.name}</p>
                          <p className="text-xs text-muted-foreground">{invoice.purchase_order.location.location_id}</p>
                        </div>
                      )}
                      {invoice.sales_order?.location && (
                        <div>
                          <p className="font-medium">{invoice.sales_order.location.name}</p>
                          <p className="text-xs text-muted-foreground">{invoice.sales_order.location.location_id}</p>
                        </div>
                      )}
                      {!invoice.purchase_order?.location && !invoice.sales_order?.location && '-'}
                    </TableCell>
                    <TableCell className="font-medium">${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>{invoice.ledger?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[invoice.status]} text-white`}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.due_date
                        ? format(new Date(invoice.due_date), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
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
        </div>
      </div>

      {/* Accept Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accept Payment</DialogTitle>
            <DialogDescription>
              Mark invoice {selectedInvoice?.invoice_number} as paid.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 px-6">
              <div className="border rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Amount</span>
                  <span className="font-medium">${selectedInvoice.amount.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                This will mark the invoice as fully paid.
              </p>
            </div>
          )}

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAcceptPayment} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accept Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Memo Dialog */}
      <Dialog open={isCreditMemoDialogOpen} onOpenChange={setIsCreditMemoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Credit Memo</DialogTitle>
            <DialogDescription>
              Apply a credit to invoice {selectedInvoice?.invoice_number}. This will reduce the amount owed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6">
            {selectedInvoice && (
              <div className="border rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Invoice Amount</span>
                  <span className="font-medium">${selectedInvoice.amount.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div>
              <Label>Credit Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={memoAmount}
                onChange={(e) => setMemoAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={memoNotes}
                onChange={(e) => setMemoNotes(e.target.value)}
                placeholder="Reason for credit memo..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCreditMemoDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreditMemo} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apply Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debit Memo Dialog */}
      <Dialog open={isDebitMemoDialogOpen} onOpenChange={setIsDebitMemoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Debit Memo</DialogTitle>
            <DialogDescription>
              Apply a debit to invoice {selectedInvoice?.invoice_number}. This will increase the amount owed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6">
            {selectedInvoice && (
              <div className="border rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Invoice Amount</span>
                  <span className="font-medium">${selectedInvoice.amount.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div>
              <Label>Debit Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={memoAmount}
                onChange={(e) => setMemoAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={memoNotes}
                onChange={(e) => setMemoNotes(e.target.value)}
                placeholder="Reason for debit memo..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDebitMemoDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDebitMemo} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apply Debit
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
    </div>
  );
};

export default AccountDetail;
