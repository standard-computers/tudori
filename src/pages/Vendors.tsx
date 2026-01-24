import { useEffect, useState, useRef } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { useTableSort } from '@/hooks/use-table-sort';
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
import { ArrowLeft, Plus, Building, Pencil, Trash2, AlertCircle, Search, Loader2, X } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';

interface Vendor {
  id: string;
  vendor_id: string;
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
}

const VENDOR_TYPES = ['Supplier', 'Manufacturer', 'Distributor', 'Contractor', 'Service Provider', 'Consultant'];

// Separated table component with sorting/filtering
const VendorTable = ({
  vendors,
  onEdit,
  onDelete,
}: {
  vendors: Vendor[];
  onEdit: (vendor: Vendor) => void;
  onDelete: (id: string) => void;
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
              <SortableTableHead
                label="Name"
                sortKey="name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['name']}
                onFilter={(value) => setFilter('name', value)}
              />
              <SortableTableHead
                label="Type"
                sortKey="type"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['type']}
                onFilter={(value) => setFilter('type', value)}
              />
              <SortableTableHead
                label="Contact"
                sortKey="contact_name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['contact_name']}
                onFilter={(value) => setFilter('contact_name', value)}
              />
              <SortableTableHead
                label="Email"
                sortKey="email"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['email']}
                onFilter={(value) => setFilter('email', value)}
              />
              <SortableTableHead
                label="Phone"
                sortKey="phone"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['phone']}
                onFilter={(value) => setFilter('phone', value)}
              />
              <SortableTableHead
                label="Actions"
                sortKey=""
                currentSortKey=""
                currentSortDirection={null}
                onSort={() => {}}
                filterable={false}
                className="w-24"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No vendors match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-mono text-sm">{vendor.vendor_id}</TableCell>
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell>{vendor.type}</TableCell>
                  <TableCell>{vendor.contact_name || '-'}</TableCell>
                  <TableCell>{vendor.email || '-'}</TableCell>
                  <TableCell>{vendor.phone || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(vendor)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(vendor.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
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
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextVendorId, setNextVendorId] = useState('0001');
  const [isLookingUp, setIsLookingUp] = useState(false);
  
  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const [formData, setFormData] = useState({
    vendor_id: '',
    name: '',
    type: 'Supplier',
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
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, vendor_id: nextVendorId }));
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new vendor
  useKeyboardShortcut('n', handleOpenDialog);

  const handleEdit = (vendor: Vendor) => {
    setFormData({
      vendor_id: vendor.vendor_id,
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
    });
    setIsEditing(true);
    setEditingId(vendor.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);

    if (error) {
      addMessage('Failed to delete vendor', 'error');
      return;
    }

    addMessage('Vendor deleted', 'success');
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
        console.error('Lookup error:', error);
        addMessage('Failed to look up company', 'error');
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
                  
                  <div className="flex-1 overflow-y-auto px-6 py-4 pb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vendor_id">Vendor ID</Label>
                        <Input
                          id="vendor_id"
                          value={formData.vendor_id}
                          onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                          disabled={isEditing}
                          className={`${isEditing ? 'bg-muted' : ''} ${!isEditing && vendors.some(v => v.vendor_id === formData.vendor_id) ? 'border-destructive border-2' : ''}`}
                          required
                        />
                        {!isEditing && vendors.some(v => v.vendor_id === formData.vendor_id) && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            This ID is already in use
                          </p>
                        )}
                        {!isEditing && !vendors.some(v => v.vendor_id === formData.vendor_id) && formData.vendor_id && (
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
                            {VENDOR_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes about this vendor..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter className="shrink-0">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={!isEditing && vendors.some(v => v.vendor_id === formData.vendor_id)}
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
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
};

export default Vendors;
