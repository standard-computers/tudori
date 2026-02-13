import { useEffect, useState, useRef } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTransactionAction } from '@/hooks/use-transaction-action';
import { useTableSort } from '@/hooks/use-table-sort';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { ColumnToggle } from '@/components/ColumnToggle';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { useExcel } from '@/hooks/use-excel';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/SortableTableHead';
import { ArrowLeft, Plus, Users, Pencil, Trash2, AlertCircle, X, Eye, MoreHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { AuditHistoryTab } from '@/components/AuditHistoryTab';
import { useChangeHistorySettings } from '@/hooks/use-change-history-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/lib/toast';

interface Customer {
  id: string;
  customer_id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  payment_terms: number | null;
}

const CUSTOMER_TYPES = ['Business', 'Individual', 'Government', 'Non-Profit', 'Educational', 'Reseller'];

// Column definitions for Customers table
const CUSTOMER_COLUMNS: ColumnDefinition[] = [
  { key: 'customer_id', label: 'ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'contact_name', label: 'Contact', defaultVisible: true },
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'phone', label: 'Phone', defaultVisible: true },
  { key: 'address_line1', label: 'Address', defaultVisible: true },
  { key: 'city', label: 'City', defaultVisible: true },
  { key: 'state', label: 'State', defaultVisible: true },
  { key: 'postal_code', label: 'Postal Code', defaultVisible: true },
  { key: 'country', label: 'Country', defaultVisible: true },
  { key: 'website', label: 'Website', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

// Separated table component with sorting/filtering
const CustomerTable = ({
  customers,
  onView,
  onEdit,
  onDelete,
  isColumnVisible,
}: {
  customers: Customer[];
  onView: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  isColumnVisible: (key: string) => boolean;
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(customers, 'customer_id', 'asc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const visibleColumnCount = CUSTOMER_COLUMNS.filter(c => isColumnVisible(c.key)).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {customers.length} customers
          </span>
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
            <X className="w-3 h-3 mr-1" />
            Clear filters
          </Button>
          {Object.entries(filters).map(([key, value]) => value && (
            <Badge key={key} variant="secondary" className="text-xs">
              {key}: {value}
              <button onClick={() => setFilter(key, '')} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isColumnVisible('customer_id') && (
                <SortableTableHead
                  label="ID"
                  sortKey="customer_id"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['customer_id']}
                  onFilter={(value) => setFilter('customer_id', value)}
                  className="w-24"
                />
              )}
              {isColumnVisible('name') && (
                <SortableTableHead
                  label="Name"
                  sortKey="name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['name']}
                  onFilter={(value) => setFilter('name', value)}
                />
              )}
              {isColumnVisible('type') && (
                <SortableTableHead
                  label="Type"
                  sortKey="type"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['type']}
                  onFilter={(value) => setFilter('type', value)}
                />
              )}
              {isColumnVisible('contact_name') && (
                <SortableTableHead
                  label="Contact"
                  sortKey="contact_name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['contact_name']}
                  onFilter={(value) => setFilter('contact_name', value)}
                />
              )}
              {isColumnVisible('email') && (
                <SortableTableHead
                  label="Email"
                  sortKey="email"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['email']}
                  onFilter={(value) => setFilter('email', value)}
                />
              )}
              {isColumnVisible('phone') && (
                <SortableTableHead
                  label="Phone"
                  sortKey="phone"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['phone']}
                  onFilter={(value) => setFilter('phone', value)}
                />
              )}
              {isColumnVisible('address_line1') && (
                <SortableTableHead
                  label="Address"
                  sortKey="address_line1"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['address_line1']}
                  onFilter={(value) => setFilter('address_line1', value)}
                />
              )}
              {isColumnVisible('city') && (
                <SortableTableHead
                  label="City"
                  sortKey="city"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['city']}
                  onFilter={(value) => setFilter('city', value)}
                />
              )}
              {isColumnVisible('state') && (
                <SortableTableHead
                  label="State"
                  sortKey="state"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['state']}
                  onFilter={(value) => setFilter('state', value)}
                />
              )}
              {isColumnVisible('postal_code') && (
                <SortableTableHead
                  label="Postal Code"
                  sortKey="postal_code"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['postal_code']}
                  onFilter={(value) => setFilter('postal_code', value)}
                />
              )}
              {isColumnVisible('country') && (
                <SortableTableHead
                  label="Country"
                  sortKey="country"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['country']}
                  onFilter={(value) => setFilter('country', value)}
                />
              )}
              {isColumnVisible('website') && (
                <SortableTableHead
                  label="Website"
                  sortKey="website"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['website']}
                  onFilter={(value) => setFilter('website', value)}
                />
              )}
              {isColumnVisible('actions') && (
                <SortableTableHead
                  label="Actions"
                  sortKey=""
                  currentSortKey=""
                  currentSortDirection={null}
                  onSort={() => {}}
                  filterable={false}
                  className="w-24"
                />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="text-center py-8 text-muted-foreground">
                  No customers match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((customer) => (
                <TableRow key={customer.id}>
                  {isColumnVisible('customer_id') && (
                    <TableCell className="font-mono text-sm">
                      <button
                        className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0 font-mono text-sm"
                        onClick={() => onView(customer)}
                      >
                        {customer.customer_id}
                      </button>
                    </TableCell>
                  )}
                  {isColumnVisible('name') && (
                    <TableCell className="font-medium">{customer.name}</TableCell>
                  )}
                  {isColumnVisible('type') && (
                    <TableCell>{customer.type}</TableCell>
                  )}
                  {isColumnVisible('contact_name') && (
                    <TableCell>{customer.contact_name || '-'}</TableCell>
                  )}
                  {isColumnVisible('email') && (
                    <TableCell>{customer.email || '-'}</TableCell>
                  )}
                  {isColumnVisible('phone') && (
                    <TableCell>{customer.phone || '-'}</TableCell>
                  )}
                  {isColumnVisible('address_line1') && (
                    <TableCell>{customer.address_line1 || '-'}</TableCell>
                  )}
                  {isColumnVisible('city') && (
                    <TableCell>{customer.city || '-'}</TableCell>
                  )}
                  {isColumnVisible('state') && (
                    <TableCell>{customer.state || '-'}</TableCell>
                  )}
                  {isColumnVisible('postal_code') && (
                    <TableCell>{customer.postal_code || '-'}</TableCell>
                  )}
                  {isColumnVisible('country') && (
                    <TableCell>{customer.country || '-'}</TableCell>
                  )}
                  {isColumnVisible('website') && (
                    <TableCell>{customer.website || '-'}</TableCell>
                  )}
                  {isColumnVisible('actions') && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(customer)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(customer)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDelete(customer)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const Customers = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const formRef = useRef<HTMLFormElement>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Import/Export settings
  const { isHistoryEnabled } = useChangeHistorySettings(companyId);
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel } = useExcel();

  const handleExport = async () => {
    if (customers.length === 0) {
      toast.info('No customers to export');
      return;
    }
    const exportData = customers.map((c) => ({
      'Customer ID': c.customer_id,
      'Name': c.name,
      'Type': c.type,
      'Contact': c.contact_name || '',
      'Email': c.email || '',
      'Phone': c.phone || '',
      'Address': c.address_line1 || '',
      'Address 2': c.address_line2 || '',
      'City': c.city || '',
      'State': c.state || '',
      'Postal Code': c.postal_code || '',
      'Country': c.country || '',
      'Website': c.website || '',
      'Payment Terms': c.payment_terms ?? '',
      'Notes': c.notes || '',
    }));
    await exportToExcel(exportData, `customers_export_${new Date().toISOString().split('T')[0]}.xlsx`, 'Customers');
    toast.success('Customers exported successfully');
  };

  // Column visibility
  const {
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    resetToDefaults,
    showAll,
    hideAll,
  } = useColumnVisibility('customers', CUSTOMER_COLUMNS);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<{ id: string; name: string } | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState('');
  const [nextCustomerId, setNextCustomerId] = useState('0001');
  const [formData, setFormData] = useState({
    customer_id: '',
    name: '',
    type: 'Business',
    contact_name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    website: '',
    notes: '',
    payment_terms: '',
  });

  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? 'cust/edit' : 'cust/new');
    } else if (isViewDialogOpen) {
      setTransaction('cust/view');
    } else {
      setTransaction('cust');
    }
  }, [isDialogOpen, isEditing, isViewDialogOpen, setTransaction]);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchCustomers();
      fetchNextCustomerId();
    }
  }, [companyId]);

  const fetchCompanyId = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user!.id)
      .single();
    
    if (data?.company_id) {
      setCompanyId(data.company_id);
    }
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId!)
      .order('customer_id');

    if (error) {
      toast.error('Failed to load customers');
      return;
    }

    setCustomers(data || []);
  };

  const fetchNextCustomerId = async () => {
    const { data, error } = await supabase.rpc('get_next_customer_id', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextCustomerId(data);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: nextCustomerId,
      name: '',
      type: 'Business',
      contact_name: '',
      email: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'United States',
      website: '',
      notes: '',
      payment_terms: '',
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, customer_id: nextCustomerId }));
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new customer
  useKeyboardShortcut('n', handleOpenDialog);
  useTransactionAction('new', handleOpenDialog);

  const handleView = (customer: Customer) => {
    setViewingCustomer(customer);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      customer_id: customer.customer_id,
      name: customer.name,
      type: customer.type,
      contact_name: customer.contact_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address_line1: customer.address_line1 || '',
      address_line2: customer.address_line2 || '',
      city: customer.city || '',
      state: customer.state || '',
      postal_code: customer.postal_code || '',
      country: customer.country || 'United States',
      website: customer.website || '',
      notes: customer.notes || '',
      payment_terms: customer.payment_terms?.toString() || '',
    });
    setIsEditing(true);
    setEditingId(customer.id);
    setIsDialogOpen(true);
  };

  const handleDeleteRequest = async (customer: Customer) => {
    // Check for linked accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('account_id')
      .eq('customer_id', customer.id)
      .limit(1);
    
    if (accounts && accounts.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete customer "${customer.name}". It is linked to account ${accounts[0].account_id}.`);
      setDeletingCustomer({ id: customer.id, name: customer.name });
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked sales orders
    const { data: salesOrders } = await supabase
      .from('sales_orders')
      .select('so_number')
      .eq('customer_id', customer.id)
      .limit(1);
    
    if (salesOrders && salesOrders.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete customer "${customer.name}". It is linked to sales order ${salesOrders[0].so_number}.`);
      setDeletingCustomer({ id: customer.id, name: customer.name });
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked goods issues
    const { data: goodsIssues } = await supabase
      .from('goods_issues')
      .select('issue_number')
      .eq('customer_id', customer.id)
      .limit(1);
    
    if (goodsIssues && goodsIssues.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete customer "${customer.name}". It is linked to goods issue ${goodsIssues[0].issue_number}.`);
      setDeletingCustomer({ id: customer.id, name: customer.name });
      setDeleteDialogOpen(true);
      return;
    }

    // No blocking records, show confirm dialog
    setDeleteBlocked(false);
    setDeleteBlockedReason('');
    setDeletingCustomer({ id: customer.id, name: customer.name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCustomer) return;
    
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', deletingCustomer.id);

    if (error) {
      toast.error('Failed to delete customer');
      return;
    }

    toast.success('Customer deleted');
    setDeleteDialogOpen(false);
    setDeletingCustomer(null);
    fetchCustomers();
    fetchNextCustomerId();
  };

  const isCustomerIdInUse = customers.some(c => c.customer_id === formData.customer_id && (!isEditing || c.id !== editingId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && editingId) {
      const { error } = await supabase
        .from('customers')
        .update({
          name: formData.name,
          type: formData.type,
          contact_name: formData.contact_name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address_line1: formData.address_line1 || null,
          address_line2: formData.address_line2 || null,
          city: formData.city || null,
          state: formData.state || null,
          postal_code: formData.postal_code || null,
          country: formData.country || null,
          website: formData.website || null,
          notes: formData.notes || null,
          payment_terms: formData.payment_terms ? parseInt(formData.payment_terms, 10) : null,
        })
        .eq('id', editingId);

      if (error) {
        toast.error('Failed to update customer');
        return;
      }

      toast.success('Customer updated');
    } else {
      const { error } = await supabase
        .from('customers')
        .insert({
          company_id: companyId!,
          customer_id: formData.customer_id,
          name: formData.name,
          type: formData.type,
          contact_name: formData.contact_name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address_line1: formData.address_line1 || null,
          address_line2: formData.address_line2 || null,
          city: formData.city || null,
          state: formData.state || null,
          postal_code: formData.postal_code || null,
          country: formData.country || null,
          website: formData.website || null,
          notes: formData.notes || null,
          payment_terms: formData.payment_terms ? parseInt(formData.payment_terms, 10) : null,
        });

      if (error) {
        toast.error('Failed to create customer');
        return;
      }

      toast.success('Customer created');
    }

    setIsDialogOpen(false);
    fetchCustomers();
    fetchNextCustomerId();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Users className="w-7 h-7 text-violet-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Customers</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ColumnToggle
                columns={CUSTOMER_COLUMNS}
                visibleColumns={visibleColumns}
                onToggleColumn={toggleColumn}
                onResetToDefaults={resetToDefaults}
                onShowAll={showAll}
                onHideAll={hideAll}
              />
              <ImportExportButtons
                importEnabled={isImportEnabled('customer')}
                exportEnabled={isExportEnabled('customer')}
                onExport={handleExport}
                entityName="Customers"
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Customer
                    <Kbd>N</Kbd>
                  </Button>
                </DialogTrigger>
              <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[600px]'}`}>
                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                >
                  {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? 'Update customer details.' : 'Add a new customer to your company.'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!isEditing && (
                    <div className="absolute right-12 top-4 z-10">
                      <CopyFromIdDialog<Customer>
                        idLabel="Customer ID"
                        onFetch={async (id) => {
                          const { data } = await supabase
                            .from('customers')
                            .select('*')
                            .eq('company_id', companyId!)
                            .eq('customer_id', id)
                            .maybeSingle();
                          return data;
                        }}
                        onApply={(customer) => {
                          setFormData(prev => ({
                            ...prev,
                            name: customer.name,
                            type: customer.type,
                            contact_name: customer.contact_name || '',
                            email: customer.email || '',
                            phone: customer.phone || '',
                            address_line1: customer.address_line1 || '',
                            address_line2: customer.address_line2 || '',
                            city: customer.city || '',
                            state: customer.state || '',
                            postal_code: customer.postal_code || '',
                            country: customer.country || 'United States',
                            website: customer.website || '',
                            notes: customer.notes || '',
                          }));
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 overflow-y-auto px-6 py-4 pb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customer_id">Customer ID</Label>
                        <Input
                          id="customer_id"
                          value={formData.customer_id}
                          onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                          disabled={isEditing}
                          className={`${isEditing ? 'bg-muted' : ''} ${!isEditing && isCustomerIdInUse ? 'border-destructive border-2' : ''}`}
                          required
                        />
                        {!isEditing && isCustomerIdInUse && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            This ID is already in use
                          </p>
                        )}
                        {!isEditing && !isCustomerIdInUse && formData.customer_id && (
                          <p className="text-sm text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            ID cannot be changed after creation
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value) => setFormData({ ...formData, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOMER_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Customer Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Acme Corporation"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contact_name">Contact Name</Label>
                        <Input
                          id="contact_name"
                          value={formData.contact_name}
                          onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                          placeholder="Jane Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="jane@acme.com"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          placeholder="https://acme.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_line1">Address Line 1</Label>
                      <Input
                        id="address_line1"
                        value={formData.address_line1}
                        onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_line2">Address Line 2</Label>
                      <Input
                        id="address_line2"
                        value={formData.address_line2}
                        onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                        placeholder="Suite 100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postal_code">Postal Code</Label>
                        <Input
                          id="postal_code"
                          value={formData.postal_code}
                          onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="payment_terms">Payment Terms (days)</Label>
                        <Input
                          id="payment_terms"
                          type="number"
                          min="0"
                          value={formData.payment_terms}
                          onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                          placeholder="30"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes about this customer..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter className="shrink-0">
                    <Button 
                      type="submit" 
                      disabled={!isEditing && isCustomerIdInUse}
                    >
                      {isEditing ? 'Update' : 'Create'}
                      <Kbd className="ml-2">⌘S</Kbd>
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
              <DialogContent className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? '!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]' : 'sm:max-w-[600px]'}`}>
                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                >
                  {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <DialogHeader>
                  <DialogTitle>View Customer</DialogTitle>
                  <DialogDescription>
                    Customer details and information.
                  </DialogDescription>
                </DialogHeader>
                
                <button
                  className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                  onClick={() => {
                    if (viewingCustomer) {
                      handleEdit(viewingCustomer);
                      setIsViewDialogOpen(false);
                    }
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                
                {viewingCustomer && (
                  <Tabs defaultValue="details" className="px-6 py-4">
                    <TabsList>
                      <TabsTrigger value="details">Details</TabsTrigger>
                      {isHistoryEnabled('customer') && (
                        <TabsTrigger value="history">History</TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="details">
                      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground text-xs">Customer ID</Label>
                            <p className="font-mono">{viewingCustomer.customer_id}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Type</Label>
                            <p>{viewingCustomer.type}</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Customer Name</Label>
                          <p className="font-medium">{viewingCustomer.name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground text-xs">Contact Name</Label>
                            <p>{viewingCustomer.contact_name || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Email</Label>
                            <p>{viewingCustomer.email || '-'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground text-xs">Phone</Label>
                            <p>{viewingCustomer.phone || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Website</Label>
                            <p>{viewingCustomer.website || '-'}</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Address</Label>
                          <p>
                            {viewingCustomer.address_line1 || '-'}
                            {viewingCustomer.address_line2 && <><br />{viewingCustomer.address_line2}</>}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground text-xs">City</Label>
                            <p>{viewingCustomer.city || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">State</Label>
                            <p>{viewingCustomer.state || '-'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground text-xs">Postal Code</Label>
                            <p>{viewingCustomer.postal_code || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Country</Label>
                            <p>{viewingCustomer.country || '-'}</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Payment Terms</Label>
                          <p>{viewingCustomer.payment_terms ? `${viewingCustomer.payment_terms} days` : '-'}</p>
                        </div>
                        {viewingCustomer.notes && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Notes</Label>
                            <p className="whitespace-pre-wrap">{viewingCustomer.notes}</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {isHistoryEnabled('customer') && (
                      <TabsContent value="history">
                        <AuditHistoryTab
                          tableName="customers"
                          recordId={viewingCustomer.id}
                          fieldLabels={{
                            name: 'Name',
                            type: 'Type',
                            contact_name: 'Contact Name',
                            email: 'Email',
                            phone: 'Phone',
                            website: 'Website',
                            address_line1: 'Address Line 1',
                            address_line2: 'Address Line 2',
                            city: 'City',
                            state: 'State',
                            postal_code: 'Postal Code',
                            country: 'Country',
                            notes: 'Notes',
                            payment_terms: 'Payment Terms',
                          }}
                        />
                      </TabsContent>
                    )}
                  </Tabs>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="Delete Customer"
            description={`Are you sure you want to delete customer "${deletingCustomer?.name}"? This action cannot be undone.`}
            onConfirm={handleDeleteConfirm}
            isBlocked={deleteBlocked}
            blockedReason={deleteBlockedReason}
          />
        </div>
        </div>
      </header>

      <main className="flex-1">
        {customers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No customers yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first customer to get started.
            </p>
            <Button onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>
        ) : (
          <CustomerTable
            customers={customers}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            isColumnVisible={isColumnVisible}
          />
        )}
      </main>
    </div>
  );
};

export default Customers;
