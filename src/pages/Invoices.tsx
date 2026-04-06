import { useEffect, useState, useMemo } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useReduceAppLoad } from '@/hooks/use-reduce-app-load';
import { AppLoadQueryDialog, QueryField } from '@/components/AppLoadQueryDialog';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useTableSort } from '@/hooks/use-table-sort';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { ArrowLeft, FileText, Plus, Loader2, MoreHorizontal, Trash2, Eye, Search, Maximize2, Minimize2, Paperclip, X, Upload } from 'lucide-react';
import { toast } from '@/lib/toast';
import { format, parseISO } from 'date-fns';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useExcel } from '@/hooks/use-excel';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { ImportProgressDialog, ImportResult } from '@/components/ImportProgressDialog';
import { Input } from '@/components/ui/input';

interface InvoiceAttachment {
  id: string;
  invoice_id: string;
  company_id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  uploaded_by: string | null;
  created_at: string;
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
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Auto-open view dialog when navigated here with openRef state (e.g. from Ledgers)
  useEffect(() => {
    const ref = (location.state as any)?.openRef;
    if (!ref || !invoices.length) return;
    const match = invoices.find(i => i.invoice_number === ref);
    if (match) {
      handleViewClick(match);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state, invoices]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [viewItems, setViewItems] = useState<InvoiceItem[]>([]);
  const [viewAttachments, setViewAttachments] = useState<InvoiceAttachment[]>([]);
  const [isAddAttachmentOpen, setIsAddAttachmentOpen] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  // Import/Export
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportComplete, setIsImportComplete] = useState(false);

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
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowQueryDialog(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
  useTransactionAction('new', handleCreateClick);

  const handleViewClick = async (invoice: Invoice) => {
    setViewingInvoice(invoice);
    
    const { data: items } = await supabase
      .from('invoice_items' as any)
      .select('*, product:products(name, product_id, price)')
      .eq('invoice_id', invoice.id);
    
    setViewItems((items as any) || []);
    await fetchAttachments(invoice.id);
    setIsViewDialogOpen(true);
  };

  const fetchAttachments = async (invoiceId: string) => {
    const { data } = await supabase
      .from('invoice_attachments' as any)
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });
    setViewAttachments((data as any) || []);
  };

  const handleAddAttachment = async () => {
    if (!attachmentFile || !attachmentName.trim() || !viewingInvoice || !companyId) return;
    setAttachmentUploading(true);
    try {
      const ext = attachmentFile.name.split('.').pop() || 'bin';
      const filePath = `${companyId}/${viewingInvoice.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('invoice-attachments')
        .upload(filePath, attachmentFile);
      if (uploadError) throw uploadError;

      const { error: insertError } = await (supabase.from('invoice_attachments' as any) as any).insert({
        invoice_id: viewingInvoice.id,
        company_id: companyId,
        name: attachmentName.trim(),
        file_path: filePath,
        file_size: attachmentFile.size,
        content_type: attachmentFile.type,
        uploaded_by: user?.id,
      });
      if (insertError) throw insertError;

      toast.success('Attachment added');
      setAttachmentName('');
      setAttachmentFile(null);
      setIsAddAttachmentOpen(false);
      await fetchAttachments(viewingInvoice.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload attachment');
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleDeleteAttachment = async (att: InvoiceAttachment) => {
    try {
      await supabase.storage.from('invoice-attachments').remove([att.file_path]);
      await (supabase.from('invoice_attachments' as any) as any).delete().eq('id', att.id);
      toast.success('Attachment deleted');
      if (viewingInvoice) await fetchAttachments(viewingInvoice.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete attachment');
    }
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

  // --- Import/Export handlers ---
  const handleDownloadTemplate = () => {
    exportToExcel([], 'invoices_template.xlsx', 'Invoices', [
      { header: 'Account', key: 'Account', width: 20 },
      { header: 'Invoice Date', key: 'Invoice Date', width: 15 },
      { header: 'Due Date', key: 'Due Date', width: 15 },
      { header: 'Amount', key: 'Amount', width: 15 },
      { header: 'Notes', key: 'Notes', width: 30 },
    ]);
  };

  const handleExport = () => {
    const exportData = sortedAndFilteredData.map(inv => ({
      'Invoice #': inv.invoice_number,
      'Account': inv.account?.name || '',
      'Pay To': inv.purchase_order?.vendor?.name || inv.sales_order?.customer?.name || '',
      'Reference': inv.purchase_order?.po_number ? `PO: ${inv.purchase_order.po_number}` : inv.sales_order?.so_number ? `SO: ${inv.sales_order.so_number}` : '',
      'Invoice Date': inv.invoice_date ? format(parseISO(inv.invoice_date), 'yyyy-MM-dd') : '',
      'Due Date': inv.due_date ? format(parseISO(inv.due_date), 'yyyy-MM-dd') : '',
      'Subtotal': inv.subtotal,
      'Tax': inv.tax_amount,
      'Amount': inv.amount,
      'Status': inv.status,
      'Notes': inv.notes || '',
    }));
    exportToExcel(exportData, 'invoices.xlsx', 'Invoices');
  };

  const handleImport = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) {
        toast.error('No data found in file');
        return;
      }

      // Fetch accounts for matching
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name, account_id')
        .eq('company_id', companyId);

      setImportResults([]);
      setImportTotal(rows.length);
      setImportProcessed(0);
      setIsImportComplete(false);
      setIsImportDialogOpen(true);

      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
          const accountName = row['Account']?.toString().trim();
          if (!accountName) {
            results.push({ row: rowNum, status: 'error', message: 'Account is required' });
            setImportResults([...results]);
            setImportProcessed(i + 1);
            continue;
          }

          const account = (accounts || []).find(a => a.name.toLowerCase() === accountName.toLowerCase());
          if (!account) {
            results.push({ row: rowNum, status: 'error', message: `Account "${accountName}" not found` });
            setImportResults([...results]);
            setImportProcessed(i + 1);
            continue;
          }

          const amount = Number(row['Amount']) || 0;
          const invoiceDate = row['Invoice Date']?.toString().trim() || new Date().toISOString().split('T')[0];
          const dueDate = row['Due Date']?.toString().trim() || null;
          const notes = row['Notes']?.toString().trim() || null;

          const { data: nextId } = await supabase.rpc('get_next_invoice_number', {
            p_company_id: companyId,
          });

          const { error: insertError } = await (supabase.from('invoices' as any) as any).insert({
            company_id: companyId,
            invoice_number: nextId || `INV-${String(i + 1).padStart(4, '0')}`,
            account_id: account.id,
            invoice_date: invoiceDate,
            due_date: dueDate,
            subtotal: amount,
            tax_amount: 0,
            amount,
            status: 'draft',
            notes,
          });

          if (insertError) throw insertError;
          results.push({ row: rowNum, status: 'success', message: `Invoice created for account "${accountName}"` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed to create invoice' });
        }

        setImportResults([...results]);
        setImportProcessed(i + 1);
      }

      setIsImportComplete(true);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to read file');
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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <AppLoadQueryDialog
        open={showQueryDialog}
        onClose={() => setShowQueryDialog(false)}
        onQuery={handleQueryDialogSearch}
        onLoadAll={handleQueryDialogLoadAll}
        fields={invoiceQueryFields}
        title="Load Invoices"
        loading={queryLoading}
      />
      <div>
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
              <ArrowLeft className="h-5 w-5" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
            </Button>
            <FileText className="h-6 w-6 text-cyan-500" />
            <h1 className="text-2xl font-bold">Invoices</h1>
          </div>
          <div className="flex items-center gap-2 pr-12">
            <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => setShowQueryDialog(true)} title="Search invoices">
              <Search className="w-4 h-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">⌘F</Kbd>
            </Button>
            <ImportExportButtons
              importEnabled={isImportEnabled('invoice')}
              exportEnabled={isExportEnabled('invoice')}
              onImport={handleImport}
              onExport={handleExport}
              onDownloadTemplate={handleDownloadTemplate}
              entityName="Invoices"
            />
            <Button onClick={handleCreateClick} size="icon" className="relative">
              <Plus className="h-4 w-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
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
                <TableHead>Account</TableHead>
                <TableHead>Pay To ID</TableHead>
                <TableHead>Pay To Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Location ID</TableHead>
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
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No invoices found. Create your first invoice to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredData.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">
                      <button
                        onClick={() => handleViewClick(invoice)}
                        className="text-primary hover:underline cursor-pointer"
                      >
                        {invoice.invoice_number}
                      </button>
                    </TableCell>
                    <TableCell>{invoice.account?.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {invoice.purchase_order?.vendor?.vendor_id || invoice.sales_order?.customer?.customer_id || '-'}
                    </TableCell>
                    <TableCell>
                      {invoice.purchase_order?.vendor?.name || invoice.sales_order?.customer?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {invoice.purchase_order?.location?.name || invoice.sales_order?.location?.name || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {invoice.purchase_order?.location?.location_id || invoice.sales_order?.location?.location_id || '-'}
                    </TableCell>
                    <TableCell>
                      {invoice.purchase_order?.po_number && (
                        <Badge variant="outline">PO: {invoice.purchase_order.po_number}</Badge>
                      )}
                      {invoice.sales_order?.so_number && (
                        <Badge variant="outline">SO: {invoice.sales_order.so_number}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(parseISO(invoice.invoice_date), 'MMM d, yyyy')}</TableCell>
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
            onClick={() => setIsAddAttachmentOpen(true)}
            className="absolute right-16 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
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
                <TabsTrigger value="attachments">Attachments ({viewAttachments.length})</TabsTrigger>
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

              <TabsContent value="attachments" className="px-6 pb-4">
                <div className="pt-4 space-y-2">
                  {viewAttachments.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No attachments. Click the <Paperclip className="inline h-4 w-4" /> button to add one.
                    </div>
                  ) : (
                    viewAttachments.map((att) => {
                      const { data: urlData } = supabase.storage.from('invoice-attachments').getPublicUrl(att.file_path);
                      return (
                        <div key={att.id} className="flex items-center justify-between border rounded-md p-3">
                          <div className="min-w-0 flex-1">
                            <a href={urlData.publicUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline truncate block">
                              {att.name}
                            </a>
                            <p className="text-xs text-muted-foreground">
                              {att.content_type} • {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ''} • {format(parseISO(att.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteAttachment(att)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })
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

      {/* Add Attachment Dialog */}
      <Dialog open={isAddAttachmentOpen} onOpenChange={setIsAddAttachmentOpen}>
        <DialogContent className="max-w-md z-[60]">
          <DialogHeader>
            <DialogTitle>Add Attachment</DialogTitle>
            <DialogDescription>Upload a file and give it a name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="e.g. Signed copy"
              />
            </div>
            <div>
              <Label>File</Label>
              <div className="mt-1">
                <label className="flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate">{attachmentFile ? attachmentFile.name : 'Choose file...'}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setAttachmentFile(f);
                        if (!attachmentName) setAttachmentName(f.name.replace(/\.[^.]+$/, ''));
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddAttachmentOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAttachment} disabled={!attachmentFile || !attachmentName.trim() || attachmentUploading}>
              {attachmentUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Importing Invoices"
        totalRows={importTotal}
        processedRows={importProcessed}
        results={importResults}
        isComplete={isImportComplete}
      />
    </div>
  );
};

export default Invoices;
