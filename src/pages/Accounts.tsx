import { useEffect, useState, useMemo } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
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
import { ArrowLeft, Users, Plus, Loader2, MoreHorizontal, Trash2, Pencil, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Account {
  id: string;
  account_id: string;
  name: string;
  type: string;
  customer_id: string | null;
  vendor_id: string | null;
  location_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
  location?: { name: string } | null;
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

const Accounts = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);

  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'customer',
    customer_id: '',
    vendor_id: '',
    location_id: '',
    description: '',
    is_active: true,
  });

  const { sortConfig, sortedAndFilteredData, handleSort } = useTableSort<Account>(accounts);

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

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from('accounts' as any)
      .select(`
        *,
        customer:customers(name),
        vendor:vendors(name),
        location:locations(name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
      return;
    }

    setAccounts((data as any) || []);
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

  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return sortedAndFilteredData;
    const query = searchQuery.toLowerCase();
    return sortedAndFilteredData.filter(
      (account) =>
        account.name.toLowerCase().includes(query) ||
        account.account_id.toLowerCase().includes(query) ||
        account.type.toLowerCase().includes(query)
    );
  }, [sortedAndFilteredData, searchQuery]);

  const handleCreateClick = () => {
    setFormData({
      name: '',
      type: 'customer',
      customer_id: '',
      vendor_id: '',
      location_id: '',
      description: '',
      is_active: true,
    });
    setIsCreateDialogOpen(true);
  };

  useKeyboardShortcut('n', handleCreateClick);

  const handleEditClick = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      customer_id: account.customer_id || '',
      vendor_id: account.vendor_id || '',
      location_id: account.location_id || '',
      description: account.description || '',
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
        location_id: formData.type === 'location' && formData.location_id ? formData.location_id : null,
        description: formData.description || null,
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
          location_id: formData.type === 'location' && formData.location_id ? formData.location_id : null,
          description: formData.description || null,
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
      <div className="border-b">
        <div className="px-4 h-16 flex items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Users className="h-6 w-6 text-indigo-500" />
            <h1 className="text-2xl font-bold">Accounts</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Input
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex items-center gap-2">
            <ImportExportButtons
              importEnabled={isImportEnabled('account')}
              exportEnabled={isExportEnabled('account')}
              entityName="Accounts"
            />
            <Button onClick={handleCreateClick}>
              <Plus className="h-4 w-4 mr-2" />
              New Account
              <Kbd className="ml-2">N</Kbd>
            </Button>
          </div>
        </div>
        <div className="border rounded-lg">
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
                <TableHead>Linked To</TableHead>
                <SortableTableHead
                  label="Status"
                  sortKey="is_active"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterable={false}
                />
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No accounts found. Create your first account to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">{account.account_id}</TableCell>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {account.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.type === 'customer' && account.customer?.name}
                      {account.type === 'vendor' && account.vendor?.name}
                      {account.type === 'location' && account.location?.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? 'default' : 'secondary'}>
                        {account.is_active ? 'Active' : 'Inactive'}
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
                          <DropdownMenuItem onClick={() => navigate(`/accounts/${account.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
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
            <DialogTitle>Create Account</DialogTitle>
            <DialogDescription>Add a new account to track invoices.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-6">
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
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'customer' && (
              <div>
                <Label>Link to Customer</Label>
                <SearchableSelect
                  options={customerOptions}
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  placeholder="Select customer..."
                />
              </div>
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

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
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
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update account details.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-6">
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
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'customer' && (
              <div>
                <Label>Link to Customer</Label>
                <SearchableSelect
                  options={customerOptions}
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  placeholder="Select customer..."
                />
              </div>
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

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accounts;
