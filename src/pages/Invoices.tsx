import { useEffect, useState, useMemo } from 'react';
import { useReduceAppLoad } from '@/hooks/use-reduce-app-load';
import { AppLoadQueryDialog, QueryField } from '@/components/AppLoadQueryDialog';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Kbd } from '@/components/ui/kbd';
import { CreateInvoiceDialog } from '@/components/invoices/CreateInvoiceDialog';
import { ArrowLeft, FileText, Plus, Loader2, MoreHorizontal, Trash2, Eye, Search, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from '@/lib/toast';
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
  subtotal: number;
  tax_amount: number;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  account?: { name: string; account_id: string } | null;
  purchase_order?: { 
    po_number: string; 
    total_amount: number; 
    ledger_id: string | null;
    vendor?: { name: string; vendor_id: string } | null;
    location?: { name: string; location_id: string } | null;
  } | null;
  sales_order?: { 
    so_number: string; 
    total_amount: number; 
    ledger_id: string | null;
    customer?: { name: string; customer_id: string } | null;
    location?: { name: string; location_id: string } | null;
  } | null;
  ledger?: { name: string } | null;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  pu_id: string | null;
  notes: string | null;
  product?: { name: string; product_id: string; price: number | null } | null;
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
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [viewItems, setViewItems] = useState<InvoiceItem[]>([]);

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

  const { reduceAppLoad, loading: reduceAppLoadLoading } = useReduceAppLoad();
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);

  const invoiceQueryFields: QueryField[] = [
    { key: 'invoice_number', label: 'Invoice Number' },
    { key: 'status', label: 'Status' },
    { key: 'invoice_date', label: 'Invoice Date', type: 'date' },
  ];

  useEffect(() => {
    if (companyId && !reduceAppLoadLoading) {
      if (reduceAppLoad) {
        setShowQueryDialog(true);
      } else {
        fetchInvoices();
      }
    }
  }, [companyId, reduceAppLoad, reduceAppLoadLoading]);

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

  const fetchInvoices = async (filters?: Record<string, string>) => {
    let query = supabase
      .from('invoices' as any)
      .select(`
        *,
        account:accounts(name, account_id),
        purchase_order:purchase_orders(po_number, total_amount, ledger_id, vendor:vendors(name, vendor_id), location:locations!purchase_orders_location_id_fkey(name, location_id)),
        sales_order:sales_orders(so_number, total_amount, ledger_id, customer:customers(name, customer_id), location:locations!sales_orders_location_id_fkey(name, location_id)),
        ledger:ledgers(name)
      `)
      .eq('company_id', companyId);

    if (filters?.invoice_number) query = query.ilike('invoice_number', `%${filters.invoice_number}%`);
    if (filters?.status) query = query.ilike('status', `%${filters.status}%`);
    if (filters?.invoice_date) query = query.eq('invoice_date', filters.invoice_date);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
      return;
    }

    setInvoices((data as any) || []);
  };

  const handleQueryDialogSearch = async (filters: Record<string, string>) => {
    setQueryLoading(true);
    await fetchInvoices(filters);
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const handleQueryDialogLoadAll = async () => {
    setQueryLoading(true);
    await fetchInvoices();
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const handleCreateClick = () => {
    setIsCreateDialogOpen(true);
  };

  useKeyboardShortcut('n', handleCreateClick);

  const handleViewClick = async (invoice: Invoice) => {
    setViewingInvoice(invoice);
    
    const { data: items } = await supabase
      .from('invoice_items' as any)
      .select('*, product:products(name, product_id, price)')
      .eq('invoice_id', invoice.id);
    
    setViewItems((items as any) || []);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice "${invoice.invoice_number}"?`)) {
      return;
    }

    try {
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
      <AppLoadQueryDialog
        open={showQueryDialog}
        onClose={() => setShowQueryDialog(false)}
        onQuery={handleQueryDialogSearch}
        onLoadAll={handleQueryDialogLoadAll}
        fields={invoiceQueryFields}
        title="Load Invoices"
        loading={queryLoading}
      />
      <div className="border-b">
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <FileText className="h-6 w-6 text-cyan-500" />
            <h1 className="text-2xl font-bold">Invoices</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQueryDialog(true)} title="Search invoices">
              <Search className="w-4 h-4" />
            </Button>
            <Button onClick={handleCreateClick}>
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
              <Kbd className="ml-2">N</Kbd>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
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
                <TableHead>Pay To</TableHead>
                <TableHead>Location</TableHead>
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
              {sortedAndFilteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No invoices found. Create your first invoice to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredData.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.account?.name}</TableCell>
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

      {/* Create Invoice Dialog */}
      <CreateInvoiceDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={fetchInvoices}
      />

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
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

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <Label className="text-muted-foreground">Subtotal</Label>
                      <p className="text-lg font-mono">${(viewingInvoice.subtotal || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Tax</Label>
                      <p className="text-lg font-mono">${(viewingInvoice.tax_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Total</Label>
                      <p className="text-2xl font-bold font-mono">${viewingInvoice.amount?.toFixed(2)}</p>
                    </div>
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
                        {viewItems.map((item) => (
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
