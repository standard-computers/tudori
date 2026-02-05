import { useEffect, useState, useRef } from 'react';
import { useKeyboardShortcut, useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ArrowLeft, Plus, MapPin, Pencil, Trash2, AlertCircle, Users, X, Settings2, MoreHorizontal, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { CopyFromIdDialog } from '@/components/CopyFromIdDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { toast } from 'sonner';

interface Location {
  id: string;
  location_id: string;
  name: string;
  type: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_internal_vendor?: boolean;
  is_pos_enabled?: boolean;
  is_production_enabled?: boolean;
  payment_terms?: number | null;
  status: string;
  user_count?: number;
}

interface CompanyUser {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

interface LocationUser {
  id: string;
  location_id: string;
  user_id: string;
}

const LOCATION_TYPES = ['Warehouse', 'Store', 'Office', 'Distribution Center', 'Manufacturing', 'Showroom'];

// Column definitions for Locations table
const LOCATION_COLUMNS: ColumnDefinition[] = [
  { key: 'location_id', label: 'ID', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'address_line1', label: 'Address', defaultVisible: true },
  { key: 'city', label: 'City', defaultVisible: true },
  { key: 'state', label: 'State', defaultVisible: true },
  { key: 'postal_code', label: 'Postal Code', defaultVisible: true },
  { key: 'country', label: 'Country', defaultVisible: true },
  { key: 'is_internal_vendor', label: 'Internal Vendor', defaultVisible: true },
  { key: 'is_pos_enabled', label: 'POS', defaultVisible: true },
  { key: 'is_production_enabled', label: 'Production', defaultVisible: true },
  { key: 'actions', label: 'Actions', alwaysVisible: true },
];

// Separated table component with sorting/filtering
const LocationTable = ({
  locations,
  onView,
  onEdit,
}: {
  locations: Location[];
  onView: (location: Location) => void;
  onEdit: (location: Location) => void;
}) => {
  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    clearAllFilters,
    sortedAndFilteredData,
  } = useTableSort(locations, 'location_id', 'asc');

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {locations.length} locations
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
                sortKey="location_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['location_id']}
                onFilter={(value) => setFilter('location_id', value)}
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
                label="Address"
                sortKey="address_line1"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['address_line1']}
                onFilter={(value) => setFilter('address_line1', value)}
              />
              <SortableTableHead
                label="City"
                sortKey="city"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['city']}
                onFilter={(value) => setFilter('city', value)}
              />
              <SortableTableHead
                label="State"
                sortKey="state"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['state']}
                onFilter={(value) => setFilter('state', value)}
              />
              <SortableTableHead
                label="Postal Code"
                sortKey="postal_code"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['postal_code']}
                onFilter={(value) => setFilter('postal_code', value)}
              />
              <SortableTableHead
                label="Country"
                sortKey="country"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['country']}
                onFilter={(value) => setFilter('country', value)}
              />
              <SortableTableHead
                label="Users"
                sortKey="user_count"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
                className="w-20 text-center"
              />
              <SortableTableHead
                label="Payment Terms"
                sortKey="payment_terms"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
                className="w-28"
              />
              <SortableTableHead
                label="Status"
                sortKey="status"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters['status']}
                onFilter={(value) => setFilter('status', value)}
              />
              <SortableTableHead
                label="Internal Vendor"
                sortKey="is_internal_vendor"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
                className="w-28 text-center"
              />
              <SortableTableHead
                label="POS"
                sortKey="is_pos_enabled"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
                className="w-20 text-center"
              />
              <SortableTableHead
                label="Production"
                sortKey="is_production_enabled"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
                className="w-24 text-center"
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
                <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                  No locations match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-mono text-sm">
                    <button 
                      onClick={() => onView(location)}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      {location.location_id}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>{location.type}</TableCell>
                  <TableCell>{location.address_line1}</TableCell>
                  <TableCell>{location.city}</TableCell>
                  <TableCell>{location.state}</TableCell>
                  <TableCell>{location.postal_code}</TableCell>
                  <TableCell>{location.country}</TableCell>
                  <TableCell className="text-center">{location.user_count || 0}</TableCell>
                  <TableCell>{location.payment_terms ? `${location.payment_terms} days` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={location.status === 'Active' ? 'default' : 'secondary'}>
                      {location.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {location.is_internal_vendor && <Badge variant="secondary">✓</Badge>}
                  </TableCell>
                  <TableCell className="text-center">
                    {location.is_pos_enabled && <Badge variant="secondary">✓</Badge>}
                  </TableCell>
                  <TableCell className="text-center">
                    {location.is_production_enabled && <Badge variant="secondary">✓</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onView(location)}
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
                          <DropdownMenuItem onClick={() => onEdit(location)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
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
    </div>
  );
};

const Locations = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isViewMode ? 'loc/view' : isEditing ? 'loc/edit' : 'loc/new');
    } else {
      setTransaction('loc');
    }
  }, [isDialogOpen, isEditing, isViewMode, setTransaction]);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextLocationId, setNextLocationId] = useState('0001');
  const [activeTab, setActiveTab] = useState('general');
  
  // Users state
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [locationUsers, setLocationUsers] = useState<LocationUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    location_id: '',
    name: '',
    type: 'Office',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    is_internal_vendor: true,
    is_pos_enabled: false,
    is_production_enabled: false,
    payment_terms: '',
    status: 'Active',
  });

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
      fetchLocations();
      fetchNextLocationId();
      fetchCompanyUsers();
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

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('company_id', companyId!)
      .order('location_id');

    if (error) {
      toast.error('Failed to load locations');
      return;
    }

    // Fetch user counts for each location
    const locationsData = data || [];
    if (locationsData.length > 0) {
      const locationIds = locationsData.map(l => l.id);
      const { data: userCounts } = await supabase
        .from('location_users')
        .select('location_id')
        .in('location_id', locationIds);
      
      const countMap = new Map<string, number>();
      (userCounts || []).forEach(lu => {
        countMap.set(lu.location_id, (countMap.get(lu.location_id) || 0) + 1);
      });
      
      locationsData.forEach(location => {
        (location as any).user_count = countMap.get(location.id) || 0;
      });
    }
    
    setLocations(locationsData as Location[]);
  };

  const fetchNextLocationId = async () => {
    const { data, error } = await supabase.rpc('get_next_location_id', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextLocationId(data);
    }
  };

  const fetchCompanyUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, first_name, last_name')
      .eq('company_id', companyId!);

    if (!error && data) {
      setCompanyUsers(data);
    }
  };

  const fetchLocationUsers = async (locationId: string) => {
    const { data, error } = await supabase
      .from('location_users')
      .select('*')
      .eq('location_id', locationId);

    if (!error && data) {
      setLocationUsers(data);
      setSelectedUserIds(data.map(lu => lu.user_id));
    } else {
      setLocationUsers([]);
      setSelectedUserIds([]);
    }
  };

  const resetForm = () => {
    setFormData({
      location_id: nextLocationId,
      name: '',
      type: 'Office',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'United States',
      is_internal_vendor: true,
      is_pos_enabled: false,
      is_production_enabled: false,
      payment_terms: '',
      status: 'Active',
    });
    setIsEditing(false);
    setIsViewMode(false);
    setEditingId(null);
    setActiveTab('general');
    setSelectedUserIds([]);
    setLocationUsers([]);
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, location_id: nextLocationId }));
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new location
  useKeyboardShortcut('n', handleOpenDialog);

  const handleView = async (location: Location) => {
    setFormData({
      location_id: location.location_id,
      name: location.name,
      type: location.type,
      address_line1: location.address_line1,
      address_line2: location.address_line2 || '',
      city: location.city,
      state: location.state,
      postal_code: location.postal_code,
      country: location.country,
      is_internal_vendor: location.is_internal_vendor ?? true,
      is_pos_enabled: location.is_pos_enabled ?? false,
      is_production_enabled: location.is_production_enabled ?? false,
      payment_terms: location.payment_terms?.toString() || '',
      status: location.status,
    });
    setIsViewMode(true);
    setIsEditing(false);
    setEditingId(location.id);
    setActiveTab('general');
    await fetchLocationUsers(location.id);
    setIsDialogOpen(true);
  };

  const handleEdit = async (location: Location) => {
    setFormData({
      location_id: location.location_id,
      name: location.name,
      type: location.type,
      address_line1: location.address_line1,
      address_line2: location.address_line2 || '',
      city: location.city,
      state: location.state,
      postal_code: location.postal_code,
      country: location.country,
      is_internal_vendor: location.is_internal_vendor ?? true,
      is_pos_enabled: location.is_pos_enabled ?? false,
      is_production_enabled: location.is_production_enabled ?? false,
      payment_terms: location.payment_terms?.toString() || '',
      status: location.status,
    });
    setIsViewMode(false);
    setIsEditing(true);
    setEditingId(location.id);
    setActiveTab('general');
    await fetchLocationUsers(location.id);
    setIsDialogOpen(true);
  };

  const handleDeleteFromEdit = async () => {
    if (!editingId) return;

    const location = locations.find(l => l.id === editingId);
    if (!location) return;

    // Check for linked accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('account_id')
      .eq('location_id', editingId)
      .limit(1);
    
    if (accounts && accounts.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete location "${location.name}". It is linked to account ${accounts[0].account_id}.`);
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked inventory
    const { data: inventory } = await supabase
      .from('inventory')
      .select('id')
      .eq('location_id', editingId)
      .limit(1);
    
    if (inventory && inventory.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete location "${location.name}". It has inventory records. Remove all inventory first.`);
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked purchase orders
    const { data: purchaseOrders } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .eq('location_id', editingId)
      .limit(1);
    
    if (purchaseOrders && purchaseOrders.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete location "${location.name}". It is linked to purchase order ${purchaseOrders[0].po_number}.`);
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked sales orders
    const { data: salesOrders } = await supabase
      .from('sales_orders')
      .select('so_number')
      .eq('location_id', editingId)
      .limit(1);
    
    if (salesOrders && salesOrders.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete location "${location.name}". It is linked to sales order ${salesOrders[0].so_number}.`);
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked deliveries
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('delivery_id')
      .eq('location_id', editingId)
      .limit(1);
    
    if (deliveries && deliveries.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(`Cannot delete location "${location.name}". It is linked to delivery ${deliveries[0].delivery_id}.`);
      setDeleteDialogOpen(true);
      return;
    }

    // No blocking records, show confirm dialog
    setDeleteBlocked(false);
    setDeleteBlockedReason('');
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!editingId) return;
    
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', editingId);

    if (error) {
      toast.error('Failed to delete location');
      return;
    }

    toast.success('Location deleted');
    setDeleteDialogOpen(false);
    setIsDialogOpen(false);
    fetchLocations();
    fetchNextLocationId();
  };

  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };

  const saveLocationUsers = async (locationId: string) => {
    // Get current location users
    const { data: currentUsers } = await supabase
      .from('location_users')
      .select('user_id')
      .eq('location_id', locationId);

    const currentUserIds = currentUsers?.map(u => u.user_id) || [];
    
    // Users to add
    const toAdd = selectedUserIds.filter(id => !currentUserIds.includes(id));
    // Users to remove
    const toRemove = currentUserIds.filter(id => !selectedUserIds.includes(id));

    // Add new users
    if (toAdd.length > 0) {
      const { error } = await supabase
        .from('location_users')
        .insert(toAdd.map(userId => ({ location_id: locationId, user_id: userId })));
      
      if (error) {
        console.error('Error adding location users:', error);
        throw error;
      }
    }

    // Remove users
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('location_users')
        .delete()
        .eq('location_id', locationId)
        .in('user_id', toRemove);
      
      if (error) {
        console.error('Error removing location users:', error);
        throw error;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('locations')
          .update({
            name: formData.name,
            type: formData.type,
            address_line1: formData.address_line1,
            address_line2: formData.address_line2 || null,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
            is_internal_vendor: formData.is_internal_vendor,
            is_pos_enabled: formData.is_pos_enabled,
            is_production_enabled: formData.is_production_enabled,
            payment_terms: formData.payment_terms ? parseInt(formData.payment_terms, 10) : null,
            status: formData.status,
          })
          .eq('id', editingId);

        if (error) throw error;

        // Save location users
        await saveLocationUsers(editingId);

        toast.success('Location updated');
      } else {
        const { data: newLocation, error } = await supabase
          .from('locations')
          .insert({
            company_id: companyId!,
            location_id: formData.location_id,
            name: formData.name,
            type: formData.type,
            address_line1: formData.address_line1,
            address_line2: formData.address_line2 || null,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
            is_internal_vendor: formData.is_internal_vendor,
            is_pos_enabled: formData.is_pos_enabled,
            is_production_enabled: formData.is_production_enabled,
            payment_terms: formData.payment_terms ? parseInt(formData.payment_terms, 10) : null,
            status: formData.status,
          })
          .select()
          .single();

        if (error) throw error;

        // Save location users for new location
        if (newLocation && selectedUserIds.length > 0) {
          await supabase
            .from('location_users')
            .insert(selectedUserIds.map(userId => ({ 
              location_id: newLocation.id, 
              user_id: userId 
            })));
        }

        toast.success('Location created');
      }

      setIsDialogOpen(false);
      fetchLocations();
      fetchNextLocationId();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save location');
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
                <MapPin className="w-7 h-7 text-green-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Locations</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ImportExportButtons
                importEnabled={isImportEnabled('location')}
                exportEnabled={isExportEnabled('location')}
                entityName="Locations"
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Location
                    <Kbd>N</Kbd>
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]" onOpenAutoFocus={(e) => e.preventDefault()}>
                <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>
                      {isViewMode ? 'View Location' : isEditing ? 'Edit Location' : 'Add Location'}
                    </DialogTitle>
                    <DialogDescription>
                      {isViewMode 
                        ? 'Location details and user access.' 
                        : isEditing 
                          ? 'Update location details and user access.' 
                          : 'Add a new location to your company.'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!isEditing && !isViewMode && (
                    <div className="absolute right-12 top-4 z-10">
                      <CopyFromIdDialog<Location>
                        idLabel="Location ID"
                        onFetch={async (id) => {
                          const { data } = await supabase
                            .from('locations')
                            .select('*')
                            .eq('company_id', companyId!)
                            .eq('location_id', id)
                            .maybeSingle();
                          return data;
                        }}
                        onApply={(location) => {
                          setFormData(prev => ({
                            ...prev,
                            name: location.name,
                            type: location.type,
                            address_line1: location.address_line1,
                            address_line2: location.address_line2 || '',
                            city: location.city,
                            state: location.state,
                            postal_code: location.postal_code,
                            country: location.country,
                            is_internal_vendor: location.is_internal_vendor ?? true,
                          }));
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="users">
                          <Users className="w-4 h-4 mr-2" />
                          Users ({selectedUserIds.length})
                        </TabsTrigger>
                        <TabsTrigger value="controls">
                          <Settings2 className="w-4 h-4 mr-2" />
                          Controls
                        </TabsTrigger>
                      </TabsList>
                    
                    <TabsContent value="general" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="location_id">Location ID</Label>
                          <Input
                            id="location_id"
                            value={formData.location_id}
                            onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                            disabled={isEditing || isViewMode}
                            className={`${isEditing || isViewMode ? 'bg-muted' : ''} ${!isEditing && !isViewMode && locations.some(l => l.location_id === formData.location_id) ? 'border-destructive border-2' : ''}`}
                            required
                          />
                          {!isEditing && !isViewMode && locations.some(l => l.location_id === formData.location_id) && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              This ID is already in use
                            </p>
                          )}
                          {!isEditing && !isViewMode && !locations.some(l => l.location_id === formData.location_id) && formData.location_id && (
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
                            disabled={isViewMode}
                          >
                            <SelectTrigger className={isViewMode ? 'bg-muted' : ''}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LOCATION_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Location Name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Main Warehouse"
                            disabled={isViewMode}
                            className={isViewMode ? 'bg-muted' : ''}
                            required
                          />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address_line1">Address Line 1</Label>
                          <Input
                            id="address_line1"
                            value={formData.address_line1}
                            onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                            placeholder="123 Main Street"
                            disabled={isViewMode}
                            className={isViewMode ? 'bg-muted' : ''}
                            required
                          />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address_line2">Address Line 2</Label>
                          <Input
                            id="address_line2"
                            value={formData.address_line2}
                            onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                            placeholder="Suite 100"
                            disabled={isViewMode}
                            className={isViewMode ? 'bg-muted' : ''}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                            <Input
                              id="city"
                              value={formData.city}
                              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                              disabled={isViewMode}
                              className={isViewMode ? 'bg-muted' : ''}
                              required
                            />
                          </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                            <Input
                              id="state"
                              value={formData.state}
                              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                              disabled={isViewMode}
                              className={isViewMode ? 'bg-muted' : ''}
                              required
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
                              disabled={isViewMode}
                              className={isViewMode ? 'bg-muted' : ''}
                              required
                            />
                          </div>
                        <div className="space-y-2">
                          <Label htmlFor="country">Country</Label>
                            <Input
                              id="country"
                              value={formData.country}
                              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                              disabled={isViewMode}
                              className={isViewMode ? 'bg-muted' : ''}
                              required
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
                            disabled={isViewMode}
                            className={isViewMode ? 'bg-muted' : ''}
                            placeholder="30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData({ ...formData, status: value })}
                            disabled={isViewMode}
                          >
                            <SelectTrigger className={isViewMode ? 'bg-muted' : ''}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="users" className="mt-4">
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Select users who can access this location in the Cockpit. Only selected users will be able to view this location.
                        </p>
                        {companyUsers.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>No users found in your company.</p>
                          </div>
                        ) : (
                          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                            {companyUsers.map((companyUser) => (
                              <div 
                                key={companyUser.user_id} 
                                className="flex items-center gap-3 p-3 hover:bg-muted/50"
                              >
                                <Checkbox
                                  id={`user-${companyUser.user_id}`}
                                  checked={selectedUserIds.includes(companyUser.user_id)}
                                  onCheckedChange={(checked) => 
                                    handleUserToggle(companyUser.user_id, checked as boolean)
                                  }
                                  disabled={isViewMode}
                                />
                                <label 
                                  htmlFor={`user-${companyUser.user_id}`}
                                  className="flex-1 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {companyUser.first_name} {companyUser.last_name}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      ({companyUser.id})
                                    </span>
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedUserIds.length === 0 && (
                          <p className="text-sm text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            No users selected. This location won't be visible in Cockpit to anyone.
                          </p>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="controls" className="mt-4">
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Configure how this location behaves in the system.
                        </p>
                        <div className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="is_internal_vendor" className="font-medium">Internal Vendor</Label>
                              <p className="text-sm text-muted-foreground">
                                Allow this location to appear as a vendor source in purchase requisitions.
                              </p>
                            </div>
                            <Switch
                              id="is_internal_vendor"
                              checked={formData.is_internal_vendor}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_internal_vendor: checked })}
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="is_pos_enabled" className="font-medium">POS Enabled</Label>
                              <p className="text-sm text-muted-foreground">
                                Enable point-of-sale functionality for this location.
                              </p>
                            </div>
                            <Switch
                              id="is_pos_enabled"
                              checked={formData.is_pos_enabled}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_pos_enabled: checked })}
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="is_production_enabled" className="font-medium">Production</Label>
                              <p className="text-sm text-muted-foreground">
                                Allow this location to process production orders.
                              </p>
                            </div>
                            <Switch
                              id="is_production_enabled"
                              checked={formData.is_production_enabled}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_production_enabled: checked })}
                              disabled={isViewMode}
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                  </div>
                  
                  {!isViewMode && (
                    <DialogFooter className="shrink-0">
                      {isEditing && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteFromEdit}
                          className="mr-auto"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      )}
                      <Button 
                        type="submit" 
                        disabled={!isEditing && locations.some(l => l.location_id === formData.location_id)}
                      >
                        {isEditing ? 'Update' : 'Create'}
                        <Kbd className="ml-2">⌘S</Kbd>
                      </Button>
                    </DialogFooter>
                  )}
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        </div>
      </header>

      <main className="flex-1">
        {locations.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No locations yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first location to get started.
            </p>
            <Button onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </div>
        ) : (
          <LocationTable
            locations={locations}
            onView={handleView}
            onEdit={handleEdit}
          />
        )}
      </main>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Location"
        description={`Are you sure you want to delete location "${formData.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        isBlocked={deleteBlocked}
        blockedReason={deleteBlockedReason}
      />
    </div>
  );
};

export default Locations;