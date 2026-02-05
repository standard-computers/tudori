import { useEffect, useState, useRef } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
import { useColumnVisibility, ColumnDefinition } from '@/hooks/use-column-visibility';
import { ColumnToggle } from '@/components/ColumnToggle';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTransaction, useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { useImportExportSettings } from '@/hooks/use-import-export-settings';
import { ImportExportButtons } from '@/components/ImportExportButtons';
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
import { ArrowLeft, Plus, Building, Pencil, Trash2, AlertCircle, Search, Loader2, X, Eye, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { toast } from 'sonner';

const VENDOR_COLUMNS: ColumnDefinition[] = [
  { key: 'vendor_id', label: 'ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
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

interface Vendor {
  id: string;
  vendor_id: string;
  name: string;
  type: string;
  status: string;
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

type VendorStatus = 'active' | 'blocked';

const VENDOR_STATUSES: { value: VendorStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-success' },
  { value: 'blocked', label: 'Blocked', color: 'bg-destructive' },
];

const VENDOR_TYPES = ['Supplier', 'Manufacturer', 'Distributor', 'Contractor', 'Service Provider', 'Consultant'];

// Separated table component with sorting/filtering
const VendorTable = ({
  vendors,
  onView,
  onEdit,
  onDelete,
  isColumnVisible,
}: {
  vendors: Vendor[];
  onView: (vendor: Vendor) => void;
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
  isColumnVisible: (key: string) => boolean;
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(vendors, 'vendor_id', 'asc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const visibleColumnCount = VENDOR_COLUMNS.filter(c => isColumnVisible(c.key)).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {vendors.length} vendors
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
              {isColumnVisible('vendor_id') && (
                <SortableTableHead
                  label="ID"
                  sortKey="vendor_id"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['vendor_id']}
                  onFilter={(value) => setFilter('vendor_id', value)}
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
              {isColumnVisible('status') && (
                <SortableTableHead
                  label="Status"
                  sortKey="status"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters['status']}
                  onFilter={(value) => setFilter('status', value)}
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
                  No vendors match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((vendor) => (
                <TableRow key={vendor.id}>
                  {isColumnVisible('vendor_id') && (
                    <TableCell className="font-mono text-sm">
                      <button
                        type="button"
                        onClick={() => onView(vendor)}
                        className="text-primary hover:underline cursor-pointer"
                      >
                        {vendor.vendor_id}
                      </button>
                    </TableCell>
                  )}
                  {isColumnVisible('name') && (
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                  )}
                  {isColumnVisible('type') && (
                    <TableCell>{vendor.type}</TableCell>
                  )}
                  {isColumnVisible('status') && (
                    <TableCell>
                      {(() => {
                        const statusConfig = VENDOR_STATUSES.find(s => s.value === vendor.status) || VENDOR_STATUSES[0];
                        return (
                          <Badge className={`${statusConfig.color} text-white`}>
                            {statusConfig.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  )}
                  {isColumnVisible('contact_name') && (
                    <TableCell>{vendor.contact_name || '-'}</TableCell>
                  )}
                  {isColumnVisible('email') && (
                    <TableCell>{vendor.email || '-'}</TableCell>
                  )}
                  {isColumnVisible('phone') && (
                    <TableCell>{vendor.phone || '-'}</TableCell>
                  )}
                  {isColumnVisible('address_line1') && (
                    <TableCell>{vendor.address_line1 || '-'}</TableCell>
                  )}
                  {isColumnVisible('city') && (
                    <TableCell>{vendor.city || '-'}</TableCell>
                  )}
                  {isColumnVisible('state') && (
                    <TableCell>{vendor.state || '-'}</TableCell>
                  )}
                  {isColumnVisible('postal_code') && (
                    <TableCell>{vendor.postal_code || '-'}</TableCell>
                  )}
                  {isColumnVisible('country') && (
                    <TableCell>{vendor.country || '-'}</TableCell>
                  )}
                  {isColumnVisible('website') && (
                    <TableCell>{vendor.website || '-'}</TableCell>
                  )}
                  {isColumnVisible('actions') && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(vendor)}
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
                            <DropdownMenuItem onClick={() => onEdit(vendor)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDelete(vendor)}
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

const Vendors = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { addMessage, setTransaction } = useStatusBar();
  const formRef = useRef<HTMLFormElement>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState<{ id: string; name: string } | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextVendorId, setNextVendorId] = useState('0001');
  const [isLookingUp, setIsLookingUp] = useState(false);
  
  // Column visibility
  const {
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    resetToDefaults,
    showAll,
    hideAll,
  } = useColumnVisibility('vendors', VENDOR_COLUMNS);
  
  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const [formData, setFormData] = useState({
    vendor_id: '',
    name: '',
    type: 'Supplier',
    status: 'active' as VendorStatus,
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
      setTransaction(isEditing ? 'vend/edit' : 'vend/new');
    } else {
      setTransaction('vend');
    }
  }, [isDialogOpen, isEditing, setTransaction]);

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
      fetchVendors();
      fetchNextVendorId();
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

  const fetchVendors = async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('company_id', companyId!)
      .order('vendor_id');

    if (error) {
      addMessage('Failed to load vendors', 'error');
      return;
    }

    setVendors(data || []);
  };

  const fetchNextVendorId = async () => {
    const { data, error } = await supabase.rpc('get_next_vendor_id', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextVendorId(data);
    }
  };

  const resetForm = () => {
    setFormData({
      vendor_id: nextVendorId,
      name: '',
      type: 'Supplier',
      status: 'active',
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

  const handleOpenDialog = async () => {
    resetForm();
    // Fetch fresh vendor ID to enforce document_id_config
    const { data: freshVendorId } = await supabase.rpc('get_next_vendor_id', {
      p_company_id: companyId!,
    });
    if (freshVendorId) {
      setNextVendorId(freshVendorId);
      setFormData(prev => ({ ...prev, vendor_id: freshVendorId }));
    } else {
      setFormData(prev => ({ ...prev, vendor_id: nextVendorId }));
    }
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new vendor
  useKeyboardShortcut('n', handleOpenDialog);

  const handleEdit = (vendor: Vendor) => {
    setFormData({
      vendor_id: vendor.vendor_id,
      name: vendor.name,
      type: vendor.type,
      status: (vendor.status as VendorStatus) || 'active',
      contact_name: vendor.contact_name || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address_line1: vendor.address_line1 || '',
      address_line2: vendor.address_line2 || '',
      city: vendor.city || '',
      state: vendor.state || '',
      postal_code: vendor.postal_code || '',
      country: vendor.country || 'United States',
      website: vendor.website || '',
      notes: vendor.notes || '',
      payment_terms: vendor.payment_terms?.toString() || '',
    });
    setIsEditing(true);
    setEditingId(vendor.id);
    setIsDialogOpen(true);
  };

  const handleDeleteRequest = async (vendor: Vendor) => {
    // Check for linked accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('account_id')
      .eq('vendor_id', vendor.id)
      .limit(1);
    
    if (accounts && accounts.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete vendor "${vendor.name}". It is linked to account ${accounts[0].account_id}.`);
      setDeletingVendor({ id: vendor.id, name: vendor.name });
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked purchase orders
    const { data: purchaseOrders } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .eq('vendor_id', vendor.id)
      .limit(1);
    
    if (purchaseOrders && purchaseOrders.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete vendor "${vendor.name}". It is linked to purchase order ${purchaseOrders[0].po_number}.`);
      setDeletingVendor({ id: vendor.id, name: vendor.name });
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked deliveries
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('delivery_id')
      .eq('vendor_id', vendor.id)
      .limit(1);
    
    if (deliveries && deliveries.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete vendor "${vendor.name}". It is linked to delivery ${deliveries[0].delivery_id}.`);
      setDeletingVendor({ id: vendor.id, name: vendor.name });
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked goods receipts
    const { data: goodsReceipts } = await supabase
      .from('goods_receipts')
      .select('receipt_number')
      .eq('vendor_id', vendor.id)
      .limit(1);
    
    if (goodsReceipts && goodsReceipts.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete vendor "${vendor.name}". It is linked to goods receipt ${goodsReceipts[0].receipt_number}.`);
      setDeletingVendor({ id: vendor.id, name: vendor.name });
      setDeleteDialogOpen(true);
      return;
    }

    // No blocking records, show confirm dialog
    setDeleteBlocked(false);
    setDeleteBlockedReason('');
    setDeletingVendor({ id: vendor.id, name: vendor.name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingVendor) return;
    
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', deletingVendor.id);

    if (error) {
      toast.error('Failed to delete vendor');
      return;
    }

    toast.success('Vendor deleted');
    setDeleteDialogOpen(false);
    setDeletingVendor(null);
    fetchVendors();
    fetchNextVendorId();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && editingId) {
      const { error } = await supabase
        .from('vendors')
        .update({
          name: formData.name,
          type: formData.type,
          status: formData.status,
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
        addMessage('Failed to update vendor', 'error');
        return;
      }

      addMessage('Vendor updated', 'success');
    } else {
      const { error } = await supabase
        .from('vendors')
        .insert({
          company_id: companyId!,
          vendor_id: formData.vendor_id,
          name: formData.name,
          type: formData.type,
          status: formData.status,
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
        addMessage('Failed to create vendor', 'error');
        return;
      }

      addMessage('Vendor created', 'success');
    }

    setIsDialogOpen(false);
    fetchVendors();
    fetchNextVendorId();
  };

  const handleAILookup = async () => {
    if (!formData.name || formData.name.trim().length < 2) {
      addMessage('Enter a company name first', 'error');
      return;
    }

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-vendor', {
        body: { companyName: formData.name }
      });

      if (error) {
        // Try to extract the error message from the response
        let errorMessage = 'Failed to look up company';
        try {
          const errorBody = error.context?.body ? JSON.parse(error.context.body) : null;
          if (errorBody?.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // Use default message if parsing fails
        }
        addMessage(errorMessage, 'error');
        return;
      }

      if (data.error) {
        addMessage(data.error, 'error');
        return;
      }

      // Update form with found data
      setFormData(prev => ({
        ...prev,
        website: data.website || prev.website,
        phone: data.phone || prev.phone,
        email: data.email || prev.email,
        address_line1: data.address_line1 || prev.address_line1,
        city: data.city || prev.city,
        state: data.state || prev.state,
        postal_code: data.postal_code || prev.postal_code,
        country: data.country || prev.country,
      }));

      addMessage('Company information found!', 'success');
    } catch (err) {
      console.error('Lookup error:', err);
      addMessage('Failed to look up company', 'error');
    } finally {
      setIsLookingUp(false);
    }
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Building className="w-7 h-7 text-red-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Vendors</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ColumnToggle
                columns={VENDOR_COLUMNS}
                visibleColumns={visibleColumns}
                onToggleColumn={toggleColumn}
                onResetToDefaults={resetToDefaults}
                onShowAll={showAll}
                onHideAll={hideAll}
              />
              <ImportExportButtons
                importEnabled={isImportEnabled('vendor')}
                exportEnabled={isExportEnabled('vendor')}
                entityName="Vendors"
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vendor
                    <Kbd>N</Kbd>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? 'Update vendor details.' : 'Add a new vendor to your company.'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!isEditing && (
                    <div className="absolute right-12 top-4 z-10">
                      <CopyFromIdDialog<Vendor>
                        idLabel="Vendor ID"
                        onFetch={async (id) => {
                          const { data } = await supabase
                            .from('vendors')
                            .select('*')
                            .eq('company_id', companyId!)
                            .eq('vendor_id', id)
                            .maybeSingle();
                          return data;
                        }}
                        onApply={(vendor) => {
                          setFormData(prev => ({
                            ...prev,
                            name: vendor.name,
                            type: vendor.type,
                            contact_name: vendor.contact_name || '',
                            email: vendor.email || '',
                            phone: vendor.phone || '',
                            address_line1: vendor.address_line1 || '',
                            address_line2: vendor.address_line2 || '',
                            city: vendor.city || '',
                            state: vendor.state || '',
                            postal_code: vendor.postal_code || '',
                            country: vendor.country || 'United States',
                            website: vendor.website || '',
                            notes: vendor.notes || '',
                          }));
                        }}
                      />
                    </div>
                  )}
                  
                  <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="mx-6 w-fit">
                      <TabsTrigger value="general">General</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="general" className="flex-1 overflow-y-auto px-6 py-4 pb-6 mt-0 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="vendor_id">Vendor ID</Label>
                          <Input
                            id="vendor_id"
                            value={formData.vendor_id}
                            onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                            disabled={true}
                            className="bg-muted"
                            required
                          />
                          {!isEditing && (
                            <p className="text-sm text-muted-foreground">
                              Auto-generated from Configuration
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
                              {VENDOR_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData({ ...formData, status: value as VendorStatus })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VENDOR_STATUSES.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                    {status.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Vendor Name *</Label>
                          <div className="flex gap-2">
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="Acme Supplies Inc."
                              required
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleAILookup}
                              disabled={isLookingUp || !formData.name || formData.name.trim().length < 2}
                              title="Look up company info with AI"
                            >
                              {isLookingUp ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Click the search icon to auto-fill contact info using AI
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact_name">Contact Name</Label>
                          <Input
                            id="contact_name"
                            value={formData.contact_name}
                            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                            placeholder="John Smith"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@acme.com"
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
                    </TabsContent>
                    
                    <TabsContent value="notes" className="flex-1 overflow-y-auto px-6 py-4 pb-6 mt-0">
                      <div className="space-y-2 h-full">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Additional notes about this vendor..."
                          className="min-h-[200px]"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                  <DialogFooter className="shrink-0">
                    <Button 
                      type="submit" 
                    >
                      {isEditing ? 'Update' : 'Create'}
                      <Kbd className="ml-2">⌘S</Kbd>
                    </Button>
                  </DialogFooter>
                </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {vendors.length === 0 ? (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No vendors yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first vendor to get started.
            </p>
            <Button onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </div>
        ) : (
          <VendorTable
            vendors={vendors}
            onView={(vendor) => {
              setViewingVendor(vendor);
              setIsViewDialogOpen(true);
            }}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            isColumnVisible={isColumnVisible}
          />
        )}
      </main>

      {/* View Vendor Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <button
            type="button"
            onClick={() => {
              setIsViewDialogOpen(false);
              if (viewingVendor) handleEdit(viewingVendor);
            }}
            className="absolute right-10 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </button>
          <DialogHeader>
            <DialogTitle>View Vendor</DialogTitle>
            <DialogDescription>
              {viewingVendor?.vendor_id} - {viewingVendor?.name}
            </DialogDescription>
          </DialogHeader>
          {viewingVendor && (
            <div className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Vendor ID</Label>
                  <p className="font-mono">{viewingVendor.vendor_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p>{viewingVendor.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  {(() => {
                    const statusConfig = VENDOR_STATUSES.find(s => s.value === viewingVendor.status) || VENDOR_STATUSES[0];
                    return (
                      <Badge className={`${statusConfig.color} text-white`}>
                        {statusConfig.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Name</Label>
                <p className="font-medium">{viewingVendor.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Contact Name</Label>
                  <p>{viewingVendor.contact_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p>{viewingVendor.email || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p>{viewingVendor.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Website</Label>
                  <p>{viewingVendor.website || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Address</Label>
                <p>
                  {viewingVendor.address_line1 || '-'}
                  {viewingVendor.address_line2 && <><br />{viewingVendor.address_line2}</>}
                  {(viewingVendor.city || viewingVendor.state || viewingVendor.postal_code) && (
                    <><br />{[viewingVendor.city, viewingVendor.state, viewingVendor.postal_code].filter(Boolean).join(', ')}</>
                  )}
                  {viewingVendor.country && <><br />{viewingVendor.country}</>}
                </p>
              </div>
              {viewingVendor.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <p className="whitespace-pre-wrap">{viewingVendor.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Vendor"
        description={`Are you sure you want to delete vendor "${deletingVendor?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        isBlocked={deleteBlocked}
        blockedReason={deleteBlockedReason}
      />
    </div>
  );
};

export default Vendors;
