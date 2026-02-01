import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useTableSort } from '@/hooks/use-table-sort';
import { ArrowLeft, Plus, Pencil, Trash2, Truck, Route, Users } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { toast } from 'sonner';

interface Carrier {
  id: string;
  carrier_id: string;
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
  notes: string | null;
  is_active: boolean;
}

const Transportation = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('carriers');
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrier dialog state
  const [isCarrierDialogOpen, setIsCarrierDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [carrierForm, setCarrierForm] = useState({
    carrier_id: '',
    name: '',
    type: 'external',
    contact_name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'USA',
    notes: '',
    is_active: true,
  });

  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    sortedAndFilteredData: sortedCarriers,
  } = useTableSort<Carrier>(carriers, 'carrier_id', 'asc');

  // Keyboard shortcut for save
  useSaveShortcut(() => {
    if (isCarrierDialogOpen && carrierForm.carrier_id && carrierForm.name) {
      handleSaveCarrier();
    }
  }, isCarrierDialogOpen);

  // Set transaction code for status bar
  useEffect(() => {
    if (isCarrierDialogOpen) {
      setTransaction(editingCarrier ? 'trn/carrier/edit' : 'trn/carrier/new');
    } else {
      setTransaction('trn');
    }
  }, [isCarrierDialogOpen, editingCarrier, setTransaction]);

  // Fetch company ID from profile
  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (data?.company_id) {
        setCompanyId(data.company_id);
      }
    };

    fetchCompanyId();
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchCarriers();
    }
  }, [companyId]);

  const fetchCarriers = async () => {
    if (!companyId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('company_id', companyId)
      .order('carrier_id');

    if (error) {
      toast.error('Failed to load carriers');
    } else {
      setCarriers(data || []);
    }
    setLoading(false);
  };

  const getNextCarrierId = async (): Promise<string> => {
    if (!companyId) return 'CAR-001';
    
    const { data } = await supabase
      .from('carriers')
      .select('carrier_id')
      .eq('company_id', companyId)
      .order('carrier_id', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastId = data[0].carrier_id;
      const match = lastId.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10) + 1;
        return `CAR-${String(num).padStart(3, '0')}`;
      }
    }
    return 'CAR-001';
  };

  const openNewCarrierDialog = async () => {
    const nextId = await getNextCarrierId();
    setCarrierForm({
      carrier_id: nextId,
      name: '',
      type: 'external',
      contact_name: '',
      email: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'USA',
      notes: '',
      is_active: true,
    });
    setEditingCarrier(null);
    setIsCarrierDialogOpen(true);
  };

  const openEditCarrierDialog = (carrier: Carrier) => {
    setCarrierForm({
      carrier_id: carrier.carrier_id,
      name: carrier.name,
      type: carrier.type,
      contact_name: carrier.contact_name || '',
      email: carrier.email || '',
      phone: carrier.phone || '',
      address_line1: carrier.address_line1 || '',
      address_line2: carrier.address_line2 || '',
      city: carrier.city || '',
      state: carrier.state || '',
      postal_code: carrier.postal_code || '',
      country: carrier.country || 'USA',
      notes: carrier.notes || '',
      is_active: carrier.is_active,
    });
    setEditingCarrier(carrier);
    setIsCarrierDialogOpen(true);
  };

  const handleSaveCarrier = async () => {
    if (!companyId || !carrierForm.carrier_id || !carrierForm.name) return;

    const carrierData = {
      company_id: companyId,
      carrier_id: carrierForm.carrier_id,
      name: carrierForm.name,
      type: carrierForm.type,
      contact_name: carrierForm.contact_name || null,
      email: carrierForm.email || null,
      phone: carrierForm.phone || null,
      address_line1: carrierForm.address_line1 || null,
      address_line2: carrierForm.address_line2 || null,
      city: carrierForm.city || null,
      state: carrierForm.state || null,
      postal_code: carrierForm.postal_code || null,
      country: carrierForm.country || null,
      notes: carrierForm.notes || null,
      is_active: carrierForm.is_active,
    };

    if (editingCarrier) {
      const { error } = await supabase
        .from('carriers')
        .update(carrierData)
        .eq('id', editingCarrier.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Carrier updated');
        setIsCarrierDialogOpen(false);
        fetchCarriers();
      }
    } else {
      const { error } = await supabase
        .from('carriers')
        .insert(carrierData);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Carrier created');
        setIsCarrierDialogOpen(false);
        fetchCarriers();
      }
    }
  };

  const handleDeleteCarrier = async (carrier: Carrier) => {
    if (!confirm(`Delete carrier "${carrier.name}"?`)) return;

    const { error } = await supabase
      .from('carriers')
      .delete()
      .eq('id', carrier.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Carrier deleted');
      fetchCarriers();
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Transportation</h1>
          </div>
        </div>
      </header>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="carriers" className="gap-2">
              <Truck className="h-4 w-4" />
              Carriers
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2">
              <Route className="h-4 w-4" />
              Routes
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <Users className="h-4 w-4" />
              Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="carriers" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Manage shipping carriers and logistics partners
              </p>
              <Button onClick={openNewCarrierDialog}>
                <Plus className="h-4 w-4 mr-2" />
                New Carrier
              </Button>
            </div>

            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <SortableTableHead
                    label="Carrier ID"
                    sortKey="carrier_id"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={handleSort}
                    filterValue={filters['carrier_id'] || ''}
                    onFilter={(value) => setFilter('carrier_id', value)}
                  />
                  <SortableTableHead
                    label="Name"
                    sortKey="name"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={handleSort}
                    filterValue={filters['name'] || ''}
                    onFilter={(value) => setFilter('name', value)}
                  />
                  <SortableTableHead
                    label="Type"
                    sortKey="type"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={handleSort}
                    filterValue={filters['type'] || ''}
                    onFilter={(value) => setFilter('type', value)}
                  />
                  <SortableTableHead
                    label="Contact"
                    sortKey="contact_name"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={handleSort}
                    filterValue={filters['contact_name'] || ''}
                    onFilter={(value) => setFilter('contact_name', value)}
                  />
                  <SortableTableHead
                    label="Phone"
                    sortKey="phone"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={handleSort}
                    filterValue={filters['phone'] || ''}
                    onFilter={(value) => setFilter('phone', value)}
                  />
                  <SortableTableHead
                    label="City"
                    sortKey="city"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={handleSort}
                    filterValue={filters['city'] || ''}
                    onFilter={(value) => setFilter('city', value)}
                  />
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : sortedCarriers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No carriers found. Create your first carrier to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCarriers.map((carrier) => (
                    <TableRow key={carrier.id}>
                      <TableCell className="font-mono">{carrier.carrier_id}</TableCell>
                      <TableCell className="font-medium">{carrier.name}</TableCell>
                      <TableCell className="capitalize">{carrier.type}</TableCell>
                      <TableCell>{carrier.contact_name || '-'}</TableCell>
                      <TableCell>{carrier.phone || '-'}</TableCell>
                      <TableCell>{carrier.city || '-'}</TableCell>
                      <TableCell>
                        <Checkbox checked={carrier.is_active} disabled />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditCarrierDialog(carrier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCarrier(carrier)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="routes" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Routes configuration coming soon</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Assignments configuration coming soon</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Carrier Dialog */}
      <Dialog open={isCarrierDialogOpen} onOpenChange={setIsCarrierDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingCarrier ? 'Edit Carrier' : 'New Carrier'}</DialogTitle>
            <DialogDescription>
              {editingCarrier ? 'Update carrier details' : 'Add a new shipping carrier'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-1">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="carrier_id">Carrier ID *</Label>
                  <Input
                    id="carrier_id"
                    value={carrierForm.carrier_id}
                    onChange={(e) => setCarrierForm({ ...carrierForm, carrier_id: e.target.value })}
                    disabled={!!editingCarrier}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={carrierForm.type}
                    onValueChange={(value) => setCarrierForm({ ...carrierForm, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="external">External</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={carrierForm.name}
                  onChange={(e) => setCarrierForm({ ...carrierForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    value={carrierForm.contact_name}
                    onChange={(e) => setCarrierForm({ ...carrierForm, contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={carrierForm.phone}
                    onChange={(e) => setCarrierForm({ ...carrierForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={carrierForm.email}
                  onChange={(e) => setCarrierForm({ ...carrierForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input
                  id="address_line1"
                  value={carrierForm.address_line1}
                  onChange={(e) => setCarrierForm({ ...carrierForm, address_line1: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={carrierForm.address_line2}
                  onChange={(e) => setCarrierForm({ ...carrierForm, address_line2: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={carrierForm.city}
                    onChange={(e) => setCarrierForm({ ...carrierForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={carrierForm.state}
                    onChange={(e) => setCarrierForm({ ...carrierForm, state: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={carrierForm.postal_code}
                    onChange={(e) => setCarrierForm({ ...carrierForm, postal_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={carrierForm.country}
                    onChange={(e) => setCarrierForm({ ...carrierForm, country: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={carrierForm.notes}
                  onChange={(e) => setCarrierForm({ ...carrierForm, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_active"
                  checked={carrierForm.is_active}
                  onCheckedChange={(checked) =>
                    setCarrierForm({ ...carrierForm, is_active: checked as boolean })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button
              onClick={handleSaveCarrier}
              disabled={!carrierForm.carrier_id || !carrierForm.name}
            >
              {editingCarrier ? 'Update' : 'Create'}
              <Kbd>⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transportation;
