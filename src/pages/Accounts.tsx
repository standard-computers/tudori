import { useEffect, useState, useMemo } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useTableSort } from '@/hooks/use-table-sort';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { ColumnToggle } from '@/components/ColumnToggle';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { ImportExportButtons } from '@/components/ImportExportButtons';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ArrowLeft, Users, Plus, Loader2, MoreHorizontal, Trash2, Pencil, Eye, Wand2 } from 'lucide-react';
import { AutoMakeAccountsDialog } from '@/components/accounts/AutoMakeAccountsDialog';
import { toast } from '@/lib/toast';

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
  parent_account_id: string | null;
  notes: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
  location?: { name: string; location_id: string } | null;
  ledger?: { name: string; ledger_id: string } | null;
  parent_account?: { account_id: string; name: string } | null;
}

interface Ledger {
  id: string;
  name: string;
  ledger_id: string;
}

interface CompanyUser {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

interface Customer {
  id: string;
  name: string;
  customer_id: string;
}

interface Vendor {
  id: string;
  name: string;
  vendor_id: string;
}

interface Location {
  id: string;
  name: string;
  location_id: string;
}

// Column definitions for Accounts table
const ACCOUNT_COLUMNS: ColumnDefinition[] = [
  { key: 'account_id', label: 'ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'parent_account', label: 'Parent Account', defaultVisible: true },
  { key: 'linked_to', label: 'Linked To', defaultVisible: true },
  { key: 'location_id', label: 'Location', defaultVisible: true },
  { key: 'ledger_id_display', label: 'Ledger ID', defaultVisible: true },
  { key: 'ledger_name_display', label: 'Ledger', defaultVisible: true },
  { key: 'balance', label: 'Balance', defaultVisible: true },
  { key: 'outstanding_invoices', label: 'Outstanding Invoices', defaultVisible: true },
  { key: 'is_active', label: 'Active', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

const Accounts = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [outstandingCounts, setOutstandingCounts] = useState<Record<string, number>>({});
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);

  

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAutoMakeOpen, setIsAutoMakeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form state
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    type: 'customer',
    customer_id: '',
    vendor_id: '',
    location_id: '',
    ledger_id: '',
    account_manager_id: '',
    parent_account_id: '',
    notes: '',
    valid_from: '',
    valid_to: '',
    is_active: true,
  });

  const { sortConfig, filters, sortedAndFilteredData, handleSort, setFilter } = useTableSort<Account & { outstanding_invoices: number; balance: number }>(
    useMemo(() => accounts.map(account => ({
      ...account,
      outstanding_invoices: outstandingCounts[account.id] || 0,
      balance: accountBalances[account.id] || 0,
      parent_account_display: account.parent_account 
        ? `${account.parent_account.account_id} - ${account.parent_account.name}` 
        : '',
      linked_to_display: account.type === 'customer' && account.customer?.name
        ? account.customer.name
        : account.type === 'vendor' && account.vendor?.name
        ? account.vendor.name
        : (account.type === 'location' || account.type === 'inventory') && account.location?.name
        ? account.location.name
        : '',
      location_id_display: account.location?.location_id || '',
      ledger_id_display: account.ledger?.ledger_id || '',
      ledger_name_display: account.ledger?.name || '',
    })), [accounts, outstandingCounts, accountBalances])
  );
  const { visibleColumns, toggleColumn, resetToDefaults, showAll, hideAll, toggleableColumns } = useColumnVisibility('accounts', ACCOUNT_COLUMNS);

  useEffect(() => {
    if (isCreateDialogOpen) {
      setTransaction('acc/new');
    } else if (isEditDialogOpen) {
      setTransaction('acc/edit');
    } else {
      setTransaction('acc');
    }
  }, [isCreateDialogOpen, isEditDialogOpen, setTransaction]);

  useSaveShortcut(() => {
    if (isCreateDialogOpen && !isSubmitting) {
      handleCreate();
    } else if (isEditDialogOpen && !isSubmitting) {
      handleUpdate();
    }
  }, isCreateDialogOpen || isEditDialogOpen);

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
      fetchAccounts();
      fetchCustomers();
      fetchVendors();
      fetchLocations();
      fetchLedgers();
      fetchCompanyUsers();
      fetchOutstandingCounts();
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId && accounts.length > 0) {
      fetchAccountBalances();
    }
  }, [companyId, accounts]);

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

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from('accounts' as any)
      .select(`
        *,
        customer:customers(name),
        vendor:vendors(name),
        location:locations(name, location_id),
        ledger:ledgers(name, ledger_id)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
      return;
    }

    // Manually fetch parent account names for accounts that have parent_account_id
    const accountsData = (data as any) || [];
    const parentIds = [...new Set(accountsData.filter((a: any) => a.parent_account_id).map((a: any) => a.parent_account_id))];
    
    if (parentIds.length > 0) {
      const { data: parentAccounts } = await supabase
        .from('accounts' as any)
        .select('id, account_id, name')
        .in('id', parentIds);
      
      const parentMap = new Map((parentAccounts || []).map((p: any) => [p.id, p]));
      
      accountsData.forEach((account: any) => {
        if (account.parent_account_id) {
          account.parent_account = parentMap.get(account.parent_account_id) || null;
        } else {
          account.parent_account = null;
        }
      });
    } else {
      accountsData.forEach((account: any) => {
        account.parent_account = null;
      });
    }
    
    setAccounts(accountsData);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, customer_id')
      .eq('company_id', companyId)
      .order('name');
    setCustomers(data || []);
  };

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name, vendor_id')
      .eq('company_id', companyId)
      .order('name');
    setVendors(data || []);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, location_id')
      .eq('company_id', companyId)
      .order('name');
    setLocations(data || []);
  };

  const fetchLedgers = async () => {
    const { data } = await supabase
      .from('ledgers' as any)
      .select('id, name, ledger_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setLedgers((data as any) || []);
  };

  const fetchCompanyUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .eq('company_id', companyId)
      .order('last_name');
    setCompanyUsers(data || []);
  };

  const fetchOutstandingCounts = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('account_id')
      .eq('company_id', companyId)
      .neq('status', 'paid');

    if (error) {
      console.error('Error fetching outstanding invoices:', error);
      return;
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((inv: any) => {
      if (inv.account_id) {
        counts[inv.account_id] = (counts[inv.account_id] || 0) + 1;
      }
    });
    setOutstandingCounts(counts);
  };

  const fetchAccountBalances = async () => {
    // Fetch all data in parallel
    const [invoicesRes, paymentsRes, ledgerTxRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('account_id, amount')
        .eq('company_id', companyId),
      supabase
        .from('payments' as any)
        .select('account_id, amount')
        .eq('company_id', companyId),
      supabase
        .from('ledger_transactions' as any)
        .select('ledger_id, amount, transaction_type')
        .in('transaction_type', ['goods_receipt', 'goods_issue']),
    ]);

    // Sum invoices by account_id
    const invoiceTotals: Record<string, number> = {};
    (invoicesRes.data || []).forEach((inv: any) => {
      if (inv.account_id) {
        invoiceTotals[inv.account_id] = (invoiceTotals[inv.account_id] || 0) + (inv.amount || 0);
      }
    });

    // Sum payments by account_id
    const paymentTotals: Record<string, number> = {};
    (paymentsRes.data || []).forEach((pay: any) => {
      if (pay.account_id) {
        paymentTotals[pay.account_id] = (paymentTotals[pay.account_id] || 0) + (pay.amount || 0);
      }
    });

    // Sum GR/GI by ledger_id (GI amounts are already negative)
    const ledgerGrGiTotals: Record<string, number> = {};
    (ledgerTxRes.data || []).forEach((tx: any) => {
      if (tx.ledger_id) {
        ledgerGrGiTotals[tx.ledger_id] = (ledgerGrGiTotals[tx.ledger_id] || 0) + (tx.amount || 0);
      }
    });

    // Build a ledger_id -> account_id map from current accounts
    const balances: Record<string, number> = {};
    accounts.forEach((account) => {
      const grGi = account.ledger_id ? (ledgerGrGiTotals[account.ledger_id] || 0) : 0;
      const invVal = invoiceTotals[account.id] || 0;
      const payments = paymentTotals[account.id] || 0;
      balances[account.id] = grGi + (invVal - payments);
    });

    setAccountBalances(balances);
  };

  const customerOptions: SearchableSelectOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: c.id,
      label: c.name,
      sublabel: c.customer_id,
    }));
  }, [customers]);

  const vendorOptions: SearchableSelectOption[] = useMemo(() => {
    return vendors.map((v) => ({
      value: v.id,
      label: v.name,
      sublabel: v.vendor_id,
    }));
  }, [vendors]);

  const locationOptions: SearchableSelectOption[] = useMemo(() => {
    return locations.map((l) => ({
      value: l.id,
      label: l.name,
      sublabel: l.location_id,
    }));
  }, [locations]);

  const userOptions: SearchableSelectOption[] = useMemo(() => {
    return companyUsers.map((u) => ({
      value: u.user_id,
      label: u.first_name && u.last_name 
        ? `${u.first_name} ${u.last_name}` 
        : u.first_name || u.last_name || 'Unnamed User',
    }));
  }, [companyUsers]);

  const parentAccountOptions: SearchableSelectOption[] = useMemo(() => {
    return accounts
      .filter((a) => !editingAccount || a.id !== editingAccount.id) // Exclude self when editing
      .map((a) => ({
        value: a.id,
        label: a.name,
        sublabel: a.account_id,
      }));
  }, [accounts, editingAccount]);

  const handleCreateClick = () => {
    setFormData({
      name: '',
      type: 'customer',
      customer_id: '',
      vendor_id: '',
      location_id: '',
      ledger_id: '',
      account_manager_id: '',
      parent_account_id: '',
      notes: '',
      valid_from: '',
      valid_to: '',
      is_active: true,
    });
    setIsCreateDialogOpen(true);
  };

  useKeyboardShortcut('n', handleCreateClick);
  useTransactionAction('new', handleCreateClick);

  const handleEditClick = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      customer_id: account.customer_id || '',
      vendor_id: account.vendor_id || '',
      location_id: account.location_id || '',
      ledger_id: account.ledger_id || '',
      account_manager_id: account.account_manager_id || '',
      parent_account_id: account.parent_account_id || '',
      notes: account.notes || '',
      valid_from: account.valid_from || '',
      valid_to: account.valid_to || '',
      is_active: account.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Please enter an account name');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: accountId } = await supabase.rpc('get_next_account_id', {
        p_company_id: companyId,
      });

      const { error } = await supabase.from('accounts' as any).insert({
        company_id: companyId,
        account_id: accountId,
        name: formData.name,
        type: formData.type,
        customer_id: formData.type === 'customer' && formData.customer_id ? formData.customer_id : null,
        vendor_id: formData.type === 'vendor' && formData.vendor_id ? formData.vendor_id : null,
        location_id: (formData.type === 'location' || formData.type === 'customer' || formData.type === 'inventory') && formData.location_id ? formData.location_id : null,
        ledger_id: formData.ledger_id || null,
        account_manager_id: formData.account_manager_id || null,
        parent_account_id: formData.parent_account_id || null,
        notes: formData.notes || null,
        valid_from: formData.valid_from || null,
        valid_to: formData.valid_to || null,
        is_active: formData.is_active,
      });

      if (error) throw error;

      toast.success('Account created successfully');
      setIsCreateDialogOpen(false);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingAccount || !formData.name) {
      toast.error('Please enter an account name');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('accounts' as any)
        .update({
          name: formData.name,
          type: formData.type,
          customer_id: formData.type === 'customer' && formData.customer_id ? formData.customer_id : null,
          vendor_id: formData.type === 'vendor' && formData.vendor_id ? formData.vendor_id : null,
          location_id: (formData.type === 'location' || formData.type === 'customer' || formData.type === 'inventory') && formData.location_id ? formData.location_id : null,
          ledger_id: formData.ledger_id || null,
          account_manager_id: formData.account_manager_id || null,
          parent_account_id: formData.parent_account_id || null,
          notes: formData.notes || null,
          valid_from: formData.valid_from || null,
          valid_to: formData.valid_to || null,
          is_active: formData.is_active,
        })
        .eq('id', editingAccount.id);

      if (error) throw error;

      toast.success('Account updated successfully');
      setIsEditDialogOpen(false);
      setEditingAccount(null);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error updating account:', error);
      toast.error(error.message || 'Failed to update account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`Are you sure you want to delete account "${account.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('accounts' as any)
        .delete()
        .eq('id', account.id);

      if (error) throw error;

      toast.success('Account deleted successfully');
      fetchAccounts();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to delete account');
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
      <div>
        <div className="px-4 pr-16 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
              <ArrowLeft className="h-5 w-5" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
            </Button>
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Accounts</h1>
          </div>
          <div className="flex items-center gap-2">
            <ColumnToggle 
              columns={toggleableColumns} 
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onResetToDefaults={resetToDefaults}
              onShowAll={showAll}
              onHideAll={hideAll}
            />
            <ImportExportButtons
              importEnabled={isImportEnabled('account')}
              exportEnabled={isExportEnabled('account')}
              entityName="Accounts"
            />
            <Button onClick={() => setIsAutoMakeOpen(true)} variant="outline" size="icon" className="relative" title="AutoMake Accounts">
              <Wand2 className="h-4 w-4" />
            </Button>
            <Button onClick={handleCreateClick} size="icon" className="relative">
              <Plus className="h-4 w-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
            </Button>
          </div>
        </div>
      </div>

      <AutoMakeAccountsDialog
        open={isAutoMakeOpen}
        onOpenChange={setIsAutoMakeOpen}
        locations={locations}
        companyId={companyId}
        onCreated={fetchAccounts}
      />

      <div className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label="ID"
                  sortKey="account_id"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <SortableTableHead
                  label="Name"
                  sortKey="name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <SortableTableHead
                  label="Type"
                  sortKey="type"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <SortableTableHead
                  label="Parent Account"
                  sortKey="parent_account_display"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['parent_account_display'] || ''}
                  onFilter={(value) => setFilter('parent_account_display', value)}
                />
                <SortableTableHead
                  label="Linked To"
                  sortKey="linked_to_display"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['linked_to_display'] || ''}
                  onFilter={(value) => setFilter('linked_to_display', value)}
                />
                <SortableTableHead
                  label="Location"
                  sortKey="location_id_display"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['location_id_display'] || ''}
                  onFilter={(value) => setFilter('location_id_display', value)}
                />
                <SortableTableHead
                  label="Ledger ID"
                  sortKey="ledger_id_display"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['ledger_id_display'] || ''}
                  onFilter={(value) => setFilter('ledger_id_display', value)}
                />
                <SortableTableHead
                  label="Ledger"
                  sortKey="ledger_name_display"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['ledger_name_display'] || ''}
                  onFilter={(value) => setFilter('ledger_name_display', value)}
                />
                <SortableTableHead
                  label="Balance"
                  sortKey="balance"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <SortableTableHead
                  label="Status"
                  sortKey="is_active"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <SortableTableHead
                  label="Outstanding"
                  sortKey="outstanding_invoices"
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
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    No accounts found. Create your first account to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredData.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">
                      <a
                        href={`/accounts/${account.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/accounts/${account.id}`);
                        }}
                        className="text-primary hover:underline cursor-pointer"
                      >
                        {account.account_id}
                      </a>
                    </TableCell>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {account.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.parent_account ? (
                        <span className="text-sm">
                          <span className="font-mono text-muted-foreground">{account.parent_account.account_id}</span>
                          {' - '}
                          {account.parent_account.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {account.type === 'customer' && account.customer?.name}
                      {account.type === 'vendor' && account.vendor?.name}
                      {(account.type === 'location' || account.type === 'inventory') && account.location?.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {account.location?.location_id || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {(account as any).ledger_id_display || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {(account as any).ledger_name_display || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-right">
                      {(() => {
                        const bal = (account as any).balance || 0;
                        return (
                          <span className={bal < 0 ? 'text-destructive' : bal > 0 ? 'text-primary' : 'text-muted-foreground'}>
                            {bal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? 'default' : 'secondary'}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {(account as any).outstanding_invoices > 0 ? (
                        <Badge variant="outline">{(account as any).outstanding_invoices}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/accounts/${account.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleEditClick(account)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(account)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Account</DialogTitle>
            <DialogDescription>Add a new account to track invoices.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="mx-6 grid grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-auto px-6 py-4">
              <TabsContent value="general" className="space-y-4 mt-0">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Account name"
                  />
                </div>

                <div>
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value, customer_id: '', vendor_id: '', location_id: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="location">Internal</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === 'customer' && (
                  <>
                    <div>
                      <Label>Link to Customer</Label>
                      <SearchableSelect
                        options={customerOptions}
                        value={formData.customer_id}
                        onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                        placeholder="Select customer..."
                      />
                    </div>
                    <div>
                      <Label>Link to Location</Label>
                      <SearchableSelect
                        options={locationOptions}
                        value={formData.location_id}
                        onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                        placeholder="Select location (optional)..."
                      />
                    </div>
                  </>
                )}

                {formData.type === 'vendor' && (
                  <div>
                    <Label>Link to Vendor</Label>
                    <SearchableSelect
                      options={vendorOptions}
                      value={formData.vendor_id}
                      onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                      placeholder="Select vendor..."
                    />
                  </div>
                )}

                {formData.type === 'location' && (
                  <div>
                    <Label>Link to Location</Label>
                    <SearchableSelect
                      options={locationOptions}
                      value={formData.location_id}
                      onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                      placeholder="Select location..."
                    />
                  </div>
                )}

                {formData.type === 'inventory' && (
                  <div>
                    <Label>Link to Location *</Label>
                    <SearchableSelect
                      options={locationOptions}
                      value={formData.location_id}
                      onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                      placeholder="Select location..."
                    />
                  </div>
                )}

                <div>
                  <Label>Ledger</Label>
                  <SearchableSelect
                    options={ledgers.map(l => ({ value: l.id, label: l.name, sublabel: l.ledger_id }))}
                    value={formData.ledger_id}
                    onValueChange={(value) => setFormData({ ...formData, ledger_id: value })}
                    placeholder="Select ledger (optional)..."
                  />
                </div>

                <div>
                  <Label>Account Manager</Label>
                  <SearchableSelect
                    options={userOptions}
                    value={formData.account_manager_id}
                    onValueChange={(value) => setFormData({ ...formData, account_manager_id: value })}
                    placeholder="Select account manager..."
                  />
                </div>

                <div>
                  <Label>Parent Account</Label>
                  <SearchableSelect
                    options={parentAccountOptions}
                    value={formData.parent_account_id}
                    onValueChange={(value) => setFormData({ ...formData, parent_account_id: value })}
                    placeholder="Select parent account (optional)..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valid From</Label>
                    <Input
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Valid To</Label>
                    <Input
                      type="date"
                      value={formData.valid_to}
                      onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes about this account..."
                  rows={10}
                  className="min-h-[200px]"
                />
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Account
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update account details.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="mx-6 grid grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-auto px-6 py-4">
              <TabsContent value="general" className="space-y-4 mt-0">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Account name"
                  />
                </div>

                <div>
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value, customer_id: '', vendor_id: '', location_id: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="location">Internal</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === 'customer' && (
                  <>
                    <div>
                      <Label>Link to Customer</Label>
                      <SearchableSelect
                        options={customerOptions}
                        value={formData.customer_id}
                        onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                        placeholder="Select customer..."
                      />
                    </div>
                    <div>
                      <Label>Link to Location</Label>
                      <SearchableSelect
                        options={locationOptions}
                        value={formData.location_id}
                        onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                        placeholder="Select location (optional)..."
                      />
                    </div>
                  </>
                )}

                {formData.type === 'vendor' && (
                  <div>
                    <Label>Link to Vendor</Label>
                    <SearchableSelect
                      options={vendorOptions}
                      value={formData.vendor_id}
                      onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                      placeholder="Select vendor..."
                    />
                  </div>
                )}

                {formData.type === 'location' && (
                  <div>
                    <Label>Link to Location</Label>
                    <SearchableSelect
                      options={locationOptions}
                      value={formData.location_id}
                      onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                      placeholder="Select location..."
                    />
                  </div>
                )}

                {formData.type === 'inventory' && (
                  <div>
                    <Label>Link to Location *</Label>
                    <SearchableSelect
                      options={locationOptions}
                      value={formData.location_id}
                      onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                      placeholder="Select location..."
                    />
                  </div>
                )}

                <div>
                  <Label>Ledger</Label>
                  <SearchableSelect
                    options={ledgers.map(l => ({ value: l.id, label: l.name, sublabel: l.ledger_id }))}
                    value={formData.ledger_id}
                    onValueChange={(value) => setFormData({ ...formData, ledger_id: value })}
                    placeholder="Select ledger (optional)..."
                  />
                </div>

                <div>
                  <Label>Account Manager</Label>
                  <SearchableSelect
                    options={userOptions}
                    value={formData.account_manager_id}
                    onValueChange={(value) => setFormData({ ...formData, account_manager_id: value })}
                    placeholder="Select account manager..."
                  />
                </div>

                <div>
                  <Label>Parent Account</Label>
                  <SearchableSelect
                    options={parentAccountOptions}
                    value={formData.parent_account_id}
                    onValueChange={(value) => setFormData({ ...formData, parent_account_id: value })}
                    placeholder="Select parent account (optional)..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label>Active</Label>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valid From</Label>
                    <Input
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Valid To</Label>
                    <Input
                      type="date"
                      value={formData.valid_to}
                      onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes about this account..."
                  rows={10}
                  className="min-h-[200px]"
                />
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Account
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accounts;
