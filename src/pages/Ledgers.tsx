import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { ColumnToggle } from '@/components/ColumnToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Kbd } from '@/components/ui/kbd';
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
import { ArrowLeft, BookOpen, Plus, MoreHorizontal, Trash2, Pencil, Eye, Loader2, TrendingDown, TrendingUp, Scale, Wand2, Maximize2, Minimize2, ExternalLink, Download } from 'lucide-react';
import { AutoMakeLedgersDialog } from '@/components/ledgers/AutoMakeLedgersDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { toast } from '@/lib/toast';
import { format, parseISO } from 'date-fns';
import { Database } from '@/integrations/supabase/types';
import { useTableSort, ColumnFilterConfig } from '@/hooks/use-table-sort';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useExcel } from '@/hooks/use-excel';
import { ImportExportButtons } from '@/components/ImportExportButtons';
import { ImportProgressDialog, ImportResult } from '@/components/ImportProgressDialog';

// Maps document types to their route for navigation
const DOC_TYPE_ROUTE: Record<string, string> = {
  sales_order:    '/sales-orders',
  purchase_order: '/orders',
  invoice:        '/invoices',
  goods_receipt:  '/goods-receipts',
  goods_issue:    '/goods-issues',
  credit_memo:    '/credit-memos',
  debit_memo:     '/debit-memos',
};

interface DocIdConfig {
  document_type: string;
  prefix: string | null;
}

type AppRole = Database['public']['Enums']['app_role'];

interface Ledger {
  id: string;
  ledger_id: string;
  name: string;
  location_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  location?: { name: string } | null;
  computed_balance?: number; // Computed from transactions
  transaction_count?: number; // Number of transactions
}

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

interface Location {
  id: string;
  name: string;
  location_id: string;
}

// Column definitions for Ledgers table
const LEDGER_COLUMNS: ColumnDefinition[] = [
  { key: 'ledger_id', label: 'ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'location', label: 'Location', defaultVisible: true },
  { key: 'balance', label: 'Balance', defaultVisible: true },
  { key: 'is_active', label: 'Active', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

const Ledgers = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<AppRole | null>(null);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAutoMakeOpen, setIsAutoMakeOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // View dialog
  const [viewingLedger, setViewingLedger] = useState<Ledger | null>(null);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[]>([]);
  
  // Transaction detail dialog
  const [viewingTransaction, setViewingTransaction] = useState<LedgerTransaction | null>(null);
  const [isDeleteTxDialogOpen, setIsDeleteTxDialogOpen] = useState(false);
  const [isDeletingTx, setIsDeletingTx] = useState(false);
  const [isAdjustingOff, setIsAdjustingOff] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [docIdConfigs, setDocIdConfigs] = useState<DocIdConfig[]>([]);

  // Add adjustment dialog state
  const [isAddAdjustmentOpen, setIsAddAdjustmentOpen] = useState(false);
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    transaction_type: 'adjustment',
    amount: '',
    description: '',
    reference_number: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  
  // Maximize states
  const [isCreateMaximized, setIsCreateMaximized] = useMaximizedState();
  const [isViewMaximized, setIsViewMaximized] = useMaximizedState();
  const [isTxDetailMaximized, setIsTxDetailMaximized] = useMaximizedState();
  
  // Form state
  const [formData, setFormData] = useState({
    ledger_id: '',
    name: '',
    location_id: '',
    notes: '',
    is_active: true,
  });
  
  const formRef = useRef<HTMLFormElement>(null);

  // Import/Export
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportComplete, setIsImportComplete] = useState(false);

  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'it';

  // Flatten transactions for sorting/filtering
  const flatTransactions = useMemo(() => ledgerTransactions.map(tx => {
    let dateStr = '';
    let timeStr = '';
    try { dateStr = format(parseISO(tx.transaction_date), 'MMM d, yyyy'); } catch { dateStr = tx.transaction_date || ''; }
    try { timeStr = format(new Date(tx.created_at), 'h:mm a'); } catch { timeStr = tx.created_at || ''; }
    return {
      ...tx,
      _date: dateStr,
      _time: timeStr,
      _type: getTransactionTypeLabel(tx.transaction_type),
      _reference: tx.reference_number || '',
      _description: tx.description || '',
      _amount: tx.amount,
    };
  }), [ledgerTransactions]);

  const {
    sortConfig: txSortConfig,
    handleSort: handleTxSort,
    sortedAndFilteredData: sortedTransactions,
    getFilterConfig: getTxFilterConfig,
    setFilter: setTxFilter,
  } = useTableSort(flatTransactions);

  const handleTxFilterConfig = (key: string, config: ColumnFilterConfig | null) => {
    if (config === null) {
      setTxFilter(key, '');
    } else {
      setTxFilter(key, config);
    }
  };

  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? 'ldgr/edit' : 'ldgr/new');
    } else if (viewingLedger) {
      setTransaction('ldgr/view');
    } else {
      setTransaction('ldgr');
    }
  }, [isDialogOpen, isEditing, viewingLedger, setTransaction]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyAndData();
    }
  }, [user]);

  const fetchCompanyAndData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!profile?.company_id) {
        navigate('/complete-profile');
        return;
      }

      setCompanyId(profile.company_id);
      
      // Fetch user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('company_id', profile.company_id)
        .single();

      setCurrentUserRole(roleData?.role || null);

      await Promise.all([
        fetchLedgers(profile.company_id),
        fetchLocations(profile.company_id),
        fetchDocIdConfigs(profile.company_id),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgers = async (cId: string) => {
    const { data, error } = await supabase
      .from('ledgers' as any)
      .select(`
        *,
        location:locations(name)
      `)
      .eq('company_id', cId)
      .order('ledger_id', { ascending: true });

    if (error) {
      console.error('Error fetching ledgers:', error);
      toast.error('Failed to load ledgers');
      return;
    }

    // Fetch transactions to compute balances
    const { data: allTransactions } = await supabase
      .from('ledger_transactions' as any)
      .select('ledger_id, amount');

    const ledgersWithBalance = ((data as any) || []).map((ledger: any) => {
      const transactions = (allTransactions || []).filter((t: any) => t.ledger_id === ledger.id);
      const computed_balance = transactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const transaction_count = transactions.length;
      return { ...ledger, computed_balance, transaction_count };
    });

    setLedgers(ledgersWithBalance);
  };

  const fetchLocations = async (cId: string) => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, location_id')
      .eq('company_id', cId)
      .order('name');
    setLocations(data || []);
  };

  const fetchDocIdConfigs = async (cId: string) => {
    const { data } = await supabase
      .from('document_id_config')
      .select('document_type, prefix')
      .eq('company_id', cId);
    setDocIdConfigs((data as DocIdConfig[]) || []);
  };

  // Given a reference_number string, determine the document type and fetch the doc
  const resolveReferenceDocType = useCallback((refNumber: string): string | null => {
    if (!refNumber) return null;
    // Default prefix-to-type mappings (fallback if no config)
    const defaultMappings: Record<string, string> = {
      'SO-':   'sales_order',
      'PO-':   'purchase_order',
      'INV-':  'invoice',
      'GR-':   'goods_receipt',
      'GI-':   'goods_issue',
      'CM-':   'credit_memo',
      'DM-':   'debit_memo',
    };
    // First try doc_id_config prefixes
    for (const cfg of docIdConfigs) {
      if (cfg.prefix && refNumber.startsWith(cfg.prefix) && DOC_TYPE_ROUTE[cfg.document_type]) {
        return cfg.document_type;
      }
    }
    // Fallback to default mappings
    for (const [prefix, docType] of Object.entries(defaultMappings)) {
      if (refNumber.toUpperCase().startsWith(prefix)) {
        return docType;
      }
    }
    return null;
  }, [docIdConfigs]);

  const handleReferenceClick = useCallback((e: React.MouseEvent, refNumber: string) => {
    e.stopPropagation();
    if (!refNumber) return;

    const docType = resolveReferenceDocType(refNumber);
    const route = docType ? DOC_TYPE_ROUTE[docType] : null;
    if (!route) {
      toast.error('Cannot resolve document type for this reference');
      return;
    }

    navigate(route, { state: { openRef: refNumber } });
  }, [navigate, resolveReferenceDocType]);

  const fetchLedgerTransactions = async (ledgerId: string) => {
    setLoadingTransactions(true);
    const { data, error } = await supabase
      .from('ledger_transactions' as any)
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } else {
      setLedgerTransactions((data as any) || []);
    }
    setLoadingTransactions(false);
  };

  const openCreateDialog = async () => {
    if (!companyId) return;
    
    const { data: nextId } = await supabase.rpc('get_next_ledger_id' as any, {
      p_company_id: companyId,
    });

    setFormData({
      ledger_id: nextId || '0001',
      name: '',
      location_id: '',
      notes: '',
      is_active: true,
    });
    setIsEditing(false);
    setEditingLedgerId(null);
    setActiveTab('general');
    setIsDialogOpen(true);
  };

  const openEditDialog = (ledger: Ledger) => {
    setFormData({
      ledger_id: ledger.ledger_id,
      name: ledger.name,
      location_id: ledger.location_id || '',
      notes: ledger.notes || '',
      is_active: ledger.is_active,
    });
    setIsEditing(true);
    setEditingLedgerId(ledger.id);
    setActiveTab('general');
    setIsDialogOpen(true);
  };

  const openViewDialog = async (ledger: Ledger) => {
    setViewingLedger(ledger);
    await fetchLedgerTransactions(ledger.id);
  };

  useKeyboardShortcut('n', openCreateDialog, isAdmin);
  useTransactionAction('new', openCreateDialog, isAdmin);
  
  useSaveShortcut(() => {
    if (isDialogOpen && !isSubmitting) {
      formRef.current?.requestSubmit();
    }
  }, isDialogOpen);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    if (!formData.name.trim()) {
      toast.error('Please enter a ledger name');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && editingLedgerId) {
        const { error } = await supabase
          .from('ledgers' as any)
          .update({
            name: formData.name,
            location_id: formData.location_id || null,
            notes: formData.notes || null,
            is_active: formData.is_active,
          })
          .eq('id', editingLedgerId);

        if (error) throw error;
        toast.success('Ledger updated successfully');
      } else {
        const { error } = await supabase
          .from('ledgers' as any)
          .insert({
            company_id: companyId,
            ledger_id: formData.ledger_id,
            name: formData.name,
            location_id: formData.location_id || null,
            notes: formData.notes || null,
            is_active: formData.is_active,
          });

        if (error) throw error;
        toast.success('Ledger created successfully');
      }

      setIsDialogOpen(false);
      await fetchLedgers(companyId);
    } catch (error: any) {
      console.error('Error saving ledger:', error);
      toast.error(error.message || 'Failed to save ledger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ledger: Ledger) => {
    if (!confirm(`Are you sure you want to delete ledger "${ledger.name}"? This will also delete all associated transactions.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ledgers' as any)
        .delete()
        .eq('id', ledger.id);

      if (error) throw error;
      toast.success('Ledger deleted');
      await fetchLedgers(companyId!);
    } catch (error: any) {
      console.error('Error deleting ledger:', error);
      toast.error(error.message || 'Failed to delete ledger');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      purchase_order: 'Purchase Order',
      invoice: 'Invoice',
      sales_order: 'Sales Order',
      payment: 'Payment',
      adjustment: 'Adjustment',
    };
    return labels[type] || type;
  };

  const handleDeleteTransaction = async () => {
    if (!viewingTransaction || !viewingLedger) return;
    
    // Capture values before any state changes
    const txId = viewingTransaction.id;
    const ledgerId = viewingLedger.id;
    
    setIsDeletingTx(true);
    try {
      // Delete the transaction
      const { error: txError } = await supabase
        .from('ledger_transactions' as any)
        .delete()
        .eq('id', txId);
      
      if (txError) throw txError;

      // Refresh transactions list
      const { data: updatedTransactions } = await supabase
        .from('ledger_transactions' as any)
        .select('*')
        .eq('ledger_id', ledgerId)
        .order('transaction_date', { ascending: false });
      
      setLedgerTransactions((updatedTransactions as any) || []);
      
      // Compute new balance from remaining transactions
      const newBalance = (updatedTransactions || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      
      // Update the viewing ledger with the new computed balance
      setViewingLedger(prev => prev ? { ...prev, computed_balance: newBalance } : null);
      
      // Refresh main ledgers list
      await fetchLedgers(companyId!);

      toast.success('Transaction deleted');
      
      // Close dialogs after data is refreshed
      setViewingTransaction(null);
      setIsDeleteTxDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error(error.message || 'Failed to delete transaction');
    } finally {
      setIsDeletingTx(false);
    }
  };

  const handleAdjustOff = async () => {
    if (!viewingTransaction || !viewingLedger) return;
    
    setIsAdjustingOff(true);
    try {
      // Create a negating transaction
      const adjustmentAmount = -viewingTransaction.amount;
      const { error: txError } = await supabase
        .from('ledger_transactions' as any)
        .insert({
          ledger_id: viewingLedger.id,
          transaction_type: 'adjustment',
          amount: adjustmentAmount,
          description: `Adjustment to offset transaction: ${viewingTransaction.reference_number || viewingTransaction.id.slice(0, 8)}`,
          reference_number: `ADJ-${viewingTransaction.reference_number || viewingTransaction.id.slice(0, 8)}`,
          transaction_date: new Date().toISOString(),
        });
      
      if (txError) throw txError;

      toast.success('Adjustment transaction created');
      setViewingTransaction(null);
      
      // Refresh data and recompute balance
      await fetchLedgerTransactions(viewingLedger.id);
      await fetchLedgers(companyId!);
      
      // Compute new balance from updated transactions
      const { data: updatedTxs } = await supabase
        .from('ledger_transactions' as any)
        .select('amount')
        .eq('ledger_id', viewingLedger.id);
      const newBalance = (updatedTxs || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      setViewingLedger(prev => prev ? { ...prev, computed_balance: newBalance } : null);
    } catch (error: any) {
      console.error('Error creating adjustment:', error);
      toast.error(error.message || 'Failed to create adjustment');
    } finally {
      setIsAdjustingOff(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!viewingLedger || !adjustmentForm.amount) {
      toast.error('Please enter an amount');
      return;
    }

    const amount = parseFloat(adjustmentForm.amount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Please enter a valid non-zero amount');
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
      const { error } = await supabase
        .from('ledger_transactions' as any)
        .insert({
          ledger_id: viewingLedger.id,
          transaction_type: adjustmentForm.transaction_type,
          amount,
          description: adjustmentForm.description || null,
          reference_number: adjustmentForm.reference_number || null,
          transaction_date: adjustmentForm.transaction_date || new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Transaction added');
      setIsAddAdjustmentOpen(false);
      setAdjustmentForm({
        transaction_type: 'adjustment',
        amount: '',
        description: '',
        reference_number: '',
        transaction_date: new Date().toISOString().split('T')[0],
      });

      // Refresh
      await fetchLedgerTransactions(viewingLedger.id);
      await fetchLedgers(companyId!);

      const { data: updatedTxs } = await supabase
        .from('ledger_transactions' as any)
        .select('amount')
        .eq('ledger_id', viewingLedger.id);
      const newBalance = (updatedTxs || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      setViewingLedger(prev => prev ? { ...prev, computed_balance: newBalance } : null);
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      toast.error(error.message || 'Failed to add transaction');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  // --- Import/Export handlers ---
  const handleDownloadTemplate = () => {
    exportToExcel([], 'ledgers_template.xlsx', 'Ledgers', [
      { header: 'Name', key: 'Name', width: 25 },
      { header: 'Location', key: 'Location', width: 20 },
      { header: 'Notes', key: 'Notes', width: 30 },
    ]);
  };

  const handleExportLedgers = () => {
    const exportData = ledgers.map(l => ({
      'Ledger ID': l.ledger_id,
      'Name': l.name,
      'Location': l.location?.name || '',
      'Balance': l.computed_balance ?? 0,
      'Active': l.is_active ? 'Yes' : 'No',
      'Notes': l.notes || '',
    }));
    exportToExcel(exportData, 'ledgers.xlsx', 'Ledgers');
  };

  const handleExportTransactions = () => {
    if (!viewingLedger || ledgerTransactions.length === 0) return;
    const exportData = ledgerTransactions.map(tx => ({
      'Date': format(parseISO(tx.transaction_date), 'MMM d, yyyy'),
      'Time': format(new Date(tx.created_at), 'h:mm a'),
      'Type': getTransactionTypeLabel(tx.transaction_type),
      'Reference': tx.reference_number || '',
      'Description': tx.description || '',
      'Amount': tx.amount,
    }));
    exportToExcel(exportData, `transactions_${viewingLedger.ledger_id}.xlsx`, 'Transactions');
  };

  const handleImportLedgers = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) { toast.error('No data found in file'); return; }

      setImportResults([]); setImportTotal(rows.length); setImportProcessed(0);
      setIsImportComplete(false); setIsImportDialogOpen(true);
      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]; const rowNum = i + 2;
        try {
          const name = row['Name']?.toString().trim();
          if (!name) { results.push({ row: rowNum, status: 'error', message: 'Name is required' }); setImportResults([...results]); setImportProcessed(i + 1); continue; }

          const locationName = row['Location']?.toString().trim();
          let locationId: string | null = null;
          if (locationName) {
            const loc = locations.find(l => l.name.toLowerCase() === locationName.toLowerCase());
            if (!loc) { results.push({ row: rowNum, status: 'error', message: `Location "${locationName}" not found` }); setImportResults([...results]); setImportProcessed(i + 1); continue; }
            locationId = loc.id;
          }

          const notes = row['Notes']?.toString().trim() || null;
          const { data: nextId } = await supabase.rpc('get_next_ledger_id' as any, { p_company_id: companyId });

          const { error: insertError } = await supabase.from('ledgers' as any).insert({
            company_id: companyId, ledger_id: nextId || '0001', name,
            location_id: locationId, notes, is_active: true,
          });
          if (insertError) throw insertError;
          results.push({ row: rowNum, status: 'success', message: `Ledger "${name}" created` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed' });
        }
        setImportResults([...results]); setImportProcessed(i + 1);
      }
      setIsImportComplete(true); fetchLedgers(companyId);
    } catch (err: any) { toast.error(err.message || 'Failed to read file'); }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ArrowLeft className="w-5 h-5" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <div className="flex items-center gap-3">
                <BookOpen className="w-7 h-7 text-muted-foreground" />
                <h1 className="text-xl font-display font-bold text-foreground">Ledgers</h1>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <ImportExportButtons
                  importEnabled={isImportEnabled('ledger')}
                  exportEnabled={isExportEnabled('ledger')}
                  onImport={handleImportLedgers}
                  onExport={handleExportLedgers}
                  onDownloadTemplate={handleDownloadTemplate}
                  entityName="Ledgers"
                />
                <Button variant="outline" size="icon" onClick={() => setIsAutoMakeOpen(true)}>
                  <Wand2 className="w-4 h-4" />
                </Button>
                <Button onClick={openCreateDialog} size="icon" className="relative">
                  <Plus className="w-4 h-4" />
                  <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {ledgers.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No ledgers yet</h2>
            <p className="text-muted-foreground mb-4">
              Create a ledger to track your financial transactions.
            </p>
            {isAdmin && (
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create your first ledger
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgers.map((ledger) => (
                  <TableRow key={ledger.id}>
                    <TableCell className="font-mono">
                      <button
                        type="button"
                        className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0 font-mono text-sm"
                        onClick={() => openViewDialog(ledger)}
                      >
                        {ledger.ledger_id}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{ledger.name}</TableCell>
                    <TableCell>{ledger.location?.name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <span className={(ledger.computed_balance || 0) < 0 ? 'text-destructive' : 'text-green-600'}>
                        {formatCurrency(ledger.computed_balance || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ledger.is_active ? 'default' : 'secondary'}>
                        {ledger.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewDialog(ledger)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Transactions
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuItem onClick={() => openEditDialog(ledger)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {!(ledger.transaction_count && ledger.transaction_count > 0) && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(ledger)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={isCreateMaximized ? "!max-w-[95vw] !h-[95vh]" : "sm:max-w-[500px]"} onOpenAutoFocus={(e) => e.preventDefault()}>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Ledger' : 'Create Ledger'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update ledger information' : 'Add a new financial ledger'}
              </DialogDescription>
            </DialogHeader>
            
            <button
              type="button"
              onClick={() => setIsCreateMaximized(prev => !prev)}
              className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
            >
              {isCreateMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="sr-only">{isCreateMaximized ? 'Minimize' : 'Maximize'}</span>
            </button>
            
            {!isEditing && (
              <div className="absolute right-20 top-4 z-10">
                <CopyFromIdDialog<Ledger>
                  idLabel="Ledger ID"
                  onFetch={async (id) => {
                    const { data } = await supabase
                      .from('ledgers')
                      .select('*')
                      .eq('company_id', companyId!)
                      .eq('ledger_id', id)
                      .maybeSingle();
                    return data;
                  }}
                  onApply={(ledger) => {
                    setFormData(prev => ({
                      ...prev,
                      name: ledger.name,
                      notes: ledger.notes || '',
                      location_id: ledger.location_id || '',
                      is_active: ledger.is_active,
                    }));
                  }}
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ledger_id">Ledger ID</Label>
                    <Input
                      id="ledger_id"
                      value={formData.ledger_id}
                      onChange={(e) => setFormData({ ...formData, ledger_id: e.target.value })}
                      disabled={isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., General Ledger"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_id">Location (optional)</Label>
                  <Select
                    value={formData.location_id}
                    onValueChange={(value) => setFormData({ ...formData, location_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No location</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes about this ledger..."
                  rows={10}
                  className="min-h-[200px]"
                />
              </TabsContent>
            </Tabs>
            </div>

            <DialogFooter className="shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {isEditing ? 'Update' : 'Create'}
                    <Kbd className="ml-2">⌘S</Kbd>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Transactions Dialog */}
      <Dialog open={!!viewingLedger} onOpenChange={() => setViewingLedger(null)}>
        <DialogContent className={isViewMaximized ? "!w-screen !h-screen !max-w-none !max-h-none !rounded-none" : "sm:max-w-[700px]"}>
          <DialogHeader>
            <DialogTitle>
              {viewingLedger?.name} - Transactions
            </DialogTitle>
            <DialogDescription>
              Balance: <span className={viewingLedger && (viewingLedger.computed_balance || 0) < 0 ? 'text-destructive' : 'text-green-600'}>
                {viewingLedger && formatCurrency(viewingLedger.computed_balance || 0)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="absolute right-16 top-4 flex items-center gap-3 z-10">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAdjustmentForm({
                    transaction_type: 'adjustment',
                    amount: '',
                    description: '',
                    reference_number: '',
                    transaction_date: new Date().toISOString().split('T')[0],
                  });
                  setIsAddAdjustmentOpen(true);
                }}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                title="Add transaction"
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Add transaction</span>
              </button>
            )}
            {ledgerTransactions.length > 0 && (
              <button
                type="button"
                onClick={handleExportTransactions}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                title="Export transactions to Excel"
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Export</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsViewMaximized(prev => !prev)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {isViewMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="sr-only">{isViewMaximized ? 'Minimize' : 'Maximize'}</span>
            </button>
          </div>

          <div className={isViewMaximized ? "mt-4 flex-1 overflow-y-auto" : "mt-4 max-h-[400px] overflow-y-auto"}>
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : ledgerTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions recorded yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead label="Date" sortKey="_date" currentSortKey={txSortConfig.key} currentSortDirection={txSortConfig.direction} onSort={handleTxSort} filterConfig={getTxFilterConfig('_date')} onFilterConfig={handleTxFilterConfig} filterKey="_date" />
                    <SortableTableHead label="Time" sortKey="_time" currentSortKey={txSortConfig.key} currentSortDirection={txSortConfig.direction} onSort={handleTxSort} filterConfig={getTxFilterConfig('_time')} onFilterConfig={handleTxFilterConfig} filterKey="_time" />
                    <SortableTableHead label="Type" sortKey="_type" currentSortKey={txSortConfig.key} currentSortDirection={txSortConfig.direction} onSort={handleTxSort} filterConfig={getTxFilterConfig('_type')} onFilterConfig={handleTxFilterConfig} filterKey="_type" />
                    <SortableTableHead label="Reference" sortKey="_reference" currentSortKey={txSortConfig.key} currentSortDirection={txSortConfig.direction} onSort={handleTxSort} filterConfig={getTxFilterConfig('_reference')} onFilterConfig={handleTxFilterConfig} filterKey="_reference" />
                    <SortableTableHead label="Description" sortKey="_description" currentSortKey={txSortConfig.key} currentSortDirection={txSortConfig.direction} onSort={handleTxSort} filterConfig={getTxFilterConfig('_description')} onFilterConfig={handleTxFilterConfig} filterKey="_description" />
                    <SortableTableHead label="Amount" sortKey="_amount" currentSortKey={txSortConfig.key} currentSortDirection={txSortConfig.direction} onSort={handleTxSort} filterConfig={getTxFilterConfig('_amount')} onFilterConfig={handleTxFilterConfig} filterKey="_amount" className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((tx) => (
                    <TableRow 
                      key={tx.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setViewingTransaction(tx)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {tx._date}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {tx._time}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tx._type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {tx.reference_number && resolveReferenceDocType(tx.reference_number) ? (
                          <button
                            type="button"
                            className="text-primary hover:underline font-mono text-sm flex items-center gap-1"
                            onClick={(e) => handleReferenceClick(e, tx.reference_number!)}
                          >
                            {tx.reference_number}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          tx.reference_number || '—'
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tx.description || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`flex items-center justify-end gap-1 ${tx.amount < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {tx.amount < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                          {formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!viewingTransaction} onOpenChange={() => setViewingTransaction(null)}>
        <DialogContent className={isTxDetailMaximized ? "!max-w-[95vw] !h-[95vh]" : "sm:max-w-[450px]"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingTransaction && viewingTransaction.amount < 0 ? (
                <TrendingDown className="w-5 h-5 text-destructive" />
              ) : (
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              )}
              Transaction Details
            </DialogTitle>
            <DialogDescription>
              View and manage this transaction
            </DialogDescription>
          </DialogHeader>

          <button
            type="button"
            onClick={() => setIsTxDetailMaximized(prev => !prev)}
            className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isTxDetailMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="sr-only">{isTxDetailMaximized ? 'Minimize' : 'Maximize'}</span>
          </button>

          {viewingTransaction && (
            <div className="space-y-4 px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm font-medium">
                    {format(parseISO(viewingTransaction.transaction_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Badge variant="outline" className="mt-1">
                    {getTransactionTypeLabel(viewingTransaction.transaction_type)}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Reference</Label>
                <p className="font-mono text-sm">{viewingTransaction.reference_number || '—'}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm">{viewingTransaction.description || 'No description'}</p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <p className={`text-2xl font-bold ${viewingTransaction.amount < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {viewingTransaction.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(viewingTransaction.amount))}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteTxDialogOpen(true)}
              disabled={isDeletingTx || isAdjustingOff}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdjustOff}
              disabled={isDeletingTx || isAdjustingOff}
            >
              <Scale className="w-4 h-4 mr-2" />
              {isAdjustingOff ? 'Creating...' : 'Adjust Off'}
            </Button>
            <div className="flex-1" />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation */}
      <AlertDialog open={isDeleteTxDialogOpen} onOpenChange={setIsDeleteTxDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This will update the ledger balance and cannot be undone.
              {viewingTransaction && (
                <span className="block mt-2 font-medium">
                  Amount: {formatCurrency(viewingTransaction.amount)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTx}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteTransaction();
              }}
              disabled={isDeletingTx}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingTx ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AutoMake Dialog */}
      <AutoMakeLedgersDialog
        open={isAutoMakeOpen}
        onOpenChange={setIsAutoMakeOpen}
        locations={locations}
        companyId={companyId}
        onCreated={() => fetchLedgers(companyId!)}
      />

      <ImportProgressDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Importing Ledgers"
        totalRows={importTotal}
        processedRows={importProcessed}
        results={importResults}
        isComplete={isImportComplete}
      />

      {/* Add Transaction Dialog */}
      <Dialog open={isAddAdjustmentOpen} onOpenChange={setIsAddAdjustmentOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Add a new transaction to {viewingLedger?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adj_type">Type</Label>
              <Select
                value={adjustmentForm.transaction_type}
                onValueChange={(v) => setAdjustmentForm(prev => ({ ...prev, transaction_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="purchase_order">Purchase Order</SelectItem>
                  <SelectItem value="sales_order">Sales Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj_amount">Amount *</Label>
              <Input
                id="adj_amount"
                type="number"
                step="0.01"
                value={adjustmentForm.amount}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="e.g. 100.00 or -50.00"
              />
              <p className="text-xs text-muted-foreground">Use negative values for debits</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj_date">Date</Label>
              <Input
                id="adj_date"
                type="date"
                value={adjustmentForm.transaction_date}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, transaction_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj_ref">Reference Number</Label>
              <Input
                id="adj_ref"
                value={adjustmentForm.reference_number}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, reference_number: e.target.value }))}
                placeholder="Optional reference"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adj_desc">Description</Label>
              <Textarea
                id="adj_desc"
                value={adjustmentForm.description}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleAddAdjustment}
              disabled={isSubmittingAdjustment || !adjustmentForm.amount}
            >
              {isSubmittingAdjustment ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Transaction'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ledgers;
