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
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states
  const [searchQuery, setSearchQuery] = useState('');
  const [canCreateInvoice, setCanCreateInvoice] = useState(false);
  const [isAutoMakeDialogOpen, setIsAutoMakeDialogOpen] = useState(false);
  const [isCreateCreditMemoDialogOpen, setIsCreateCreditMemoDialogOpen] = useState(false);
  const [isCreateDebitMemoDialogOpen, setIsCreateDebitMemoDialogOpen] = useState(false);
  const [memoInvoiceId, setMemoInvoiceId] = useState<string | undefined>(undefined);

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
                  <span className="font-medium">{format(new Date(selectedInvoice.invoice_date), 'MMM d, yyyy')}</span>
                </div>
                {selectedInvoice.due_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Due Date</span>
                    <span className="font-medium">{format(new Date(selectedInvoice.due_date), 'MMM d, yyyy')}</span>
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
    </div>
  );
};

export default AccountDetail;
