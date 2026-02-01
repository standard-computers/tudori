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
import { ArrowLeft, Plus, Pencil, Trash2, Truck, Route, Users, ArrowRight } from 'lucide-react';
import { SearchableSelect } from '@/components/SearchableSelect';
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

interface Location {
  id: string;
  location_id: string;
  name: string;
}

interface RouteRecord {
  id: string;
  route_id: string;
  name: string;
  source_location_id: string;
  destination_location_id: string;
  carrier_id: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
  source_location?: { id: string; location_id: string; name: string } | null;
  destination_location?: { id: string; location_id: string; name: string } | null;
  carrier?: { id: string; carrier_id: string; name: string } | null;
}

interface Product {
  id: string;
  product_id: string;
  name: string;
}

interface Vendor {
  id: string;
  vendor_id: string;
  name: string;
}

interface Assignment {
  id: string;
  assignment_id: string;
  product_id: string;
  vendor_id: string;
  destination_location_id: string;
  priority: number;
  is_active: boolean;
  notes: string | null;
  product?: { id: string; product_id: string; name: string } | null;
  vendor?: { id: string; vendor_id: string; name: string } | null;
  destination_location?: { id: string; location_id: string; name: string } | null;
}

const Transportation = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('carriers');
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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

  // Route dialog state
  const [isRouteDialogOpen, setIsRouteDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteRecord | null>(null);
  const [routeForm, setRouteForm] = useState({
    route_id: '',
    name: '',
    source_location_id: '',
    destination_location_id: '',
    carrier_id: '',
    priority: 1,
    is_active: true,
    notes: '',
  });

  // Assignment dialog state
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    assignment_id: '',
    product_id: '',
    vendor_id: '',
    destination_location_id: '',
    priority: 1,
    is_active: true,
    notes: '',
  });

  const {
    sortConfig,
    filters,
    handleSort,
    setFilter,
    sortedAndFilteredData: sortedCarriers,
  } = useTableSort<Carrier>(carriers, 'carrier_id', 'asc');

  const {
    sortConfig: routeSortConfig,
    filters: routeFilters,
    handleSort: handleRouteSort,
    setFilter: setRouteFilter,
    sortedAndFilteredData: sortedRoutes,
  } = useTableSort<RouteRecord>(routes, 'route_id', 'asc');

  const {
    sortConfig: assignmentSortConfig,
    filters: assignmentFilters,
    handleSort: handleAssignmentSort,
    setFilter: setAssignmentFilter,
    sortedAndFilteredData: sortedAssignments,
  } = useTableSort<Assignment>(assignments, 'assignment_id', 'asc');

  // Keyboard shortcut for save
  useSaveShortcut(() => {
    if (isCarrierDialogOpen && carrierForm.carrier_id && carrierForm.name) {
      handleSaveCarrier();
    }
    if (isRouteDialogOpen && routeForm.route_id && routeForm.name && routeForm.source_location_id && routeForm.destination_location_id) {
      handleSaveRoute();
    }
    if (isAssignmentDialogOpen && assignmentForm.assignment_id && assignmentForm.product_id && assignmentForm.vendor_id && assignmentForm.destination_location_id) {
      handleSaveAssignment();
    }
  }, isCarrierDialogOpen || isRouteDialogOpen || isAssignmentDialogOpen);

  // Set transaction code for status bar
  useEffect(() => {
    if (isCarrierDialogOpen) {
      setTransaction(editingCarrier ? 'trn/carrier/edit' : 'trn/carrier/new');
    } else if (isRouteDialogOpen) {
      setTransaction(editingRoute ? 'trn/route/edit' : 'trn/route/new');
    } else if (isAssignmentDialogOpen) {
      setTransaction(editingAssignment ? 'trn/assignment/edit' : 'trn/assignment/new');
    } else {
      setTransaction('trn');
    }
  }, [isCarrierDialogOpen, editingCarrier, isRouteDialogOpen, editingRoute, isAssignmentDialogOpen, editingAssignment, setTransaction]);

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
      fetchLocations();
      fetchRoutes();
      fetchProducts();
      fetchVendors();
      fetchAssignments();
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

  const fetchLocations = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('locations')
      .select('id, location_id, name')
      .eq('company_id', companyId)
      .order('name');

    if (!error && data) {
      setLocations(data);
    }
  };

  const fetchRoutes = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        source_location:locations!routes_source_location_id_fkey(id, location_id, name),
        destination_location:locations!routes_destination_location_id_fkey(id, location_id, name),
        carrier:carriers(id, carrier_id, name)
      `)
      .eq('company_id', companyId)
      .order('route_id');

    if (error) {
      console.error('Failed to load routes:', error);
    } else {
      setRoutes(data || []);
    }
  };

  const fetchProducts = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('products')
      .select('id, product_id, name')
      .eq('company_id', companyId)
      .order('name');

    if (!error && data) {
      setProducts(data);
    }
  };

  const fetchVendors = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('vendors')
      .select('id, vendor_id, name')
      .eq('company_id', companyId)
      .order('name');

    if (!error && data) {
      setVendors(data);
    }
  };

  const fetchAssignments = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        product:products(id, product_id, name),
        vendor:vendors(id, vendor_id, name),
        destination_location:locations(id, location_id, name)
      `)
      .eq('company_id', companyId)
      .order('assignment_id');

    if (error) {
      console.error('Failed to load assignments:', error);
    } else {
      setAssignments(data || []);
    }
  };

  const getNextCarrierId = async (): Promise<string> => {
    if (!companyId) return 'CAR-0001';
    
    const { data, error } = await supabase.rpc('generate_carrier_id', {
      p_company_id: companyId
    });

    if (error || !data) {
      console.error('Failed to generate carrier ID:', error);
      return 'CAR-0001';
    }
    return data;
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

  // Route functions
  const getNextRouteId = async (): Promise<string> => {
    if (!companyId) return 'RTE-0001';
    
    const { data, error } = await supabase.rpc('generate_route_id', {
      p_company_id: companyId
    });

    if (error || !data) {
      console.error('Failed to generate route ID:', error);
      return 'RTE-0001';
    }
    return data;
  };

  const openNewRouteDialog = async () => {
    const nextId = await getNextRouteId();
    setRouteForm({
      route_id: nextId,
      name: '',
      source_location_id: '',
      destination_location_id: '',
      carrier_id: '',
      priority: 1,
      is_active: true,
      notes: '',
    });
    setEditingRoute(null);
    setIsRouteDialogOpen(true);
  };

  const openEditRouteDialog = (route: RouteRecord) => {
    setRouteForm({
      route_id: route.route_id,
      name: route.name,
      source_location_id: route.source_location_id,
      destination_location_id: route.destination_location_id,
      carrier_id: route.carrier_id || '',
      priority: route.priority,
      is_active: route.is_active,
      notes: route.notes || '',
    });
    setEditingRoute(route);
    setIsRouteDialogOpen(true);
  };

  const handleSaveRoute = async () => {
    if (!companyId || !routeForm.route_id || !routeForm.name || !routeForm.source_location_id || !routeForm.destination_location_id) return;

    if (routeForm.source_location_id === routeForm.destination_location_id) {
      toast.error('Source and destination locations must be different');
      return;
    }

    const routeData = {
      company_id: companyId,
      route_id: routeForm.route_id,
      name: routeForm.name,
      source_location_id: routeForm.source_location_id,
      destination_location_id: routeForm.destination_location_id,
      carrier_id: routeForm.carrier_id || null,
      priority: routeForm.priority,
      is_active: routeForm.is_active,
      notes: routeForm.notes || null,
    };

    if (editingRoute) {
      const { error } = await supabase
        .from('routes')
        .update(routeData)
        .eq('id', editingRoute.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Route updated');
        setIsRouteDialogOpen(false);
        fetchRoutes();
      }
    } else {
      const { error } = await supabase
        .from('routes')
        .insert(routeData);

      if (error) {
        if (error.message.includes('duplicate')) {
          toast.error('A route between these locations already exists');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Route created');
        setIsRouteDialogOpen(false);
        fetchRoutes();
      }
    }
  };

  const handleDeleteRoute = async (route: RouteRecord) => {
    if (!confirm(`Delete route "${route.name}"?`)) return;

    const { error } = await supabase
      .from('routes')
      .delete()
      .eq('id', route.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Route deleted');
      fetchRoutes();
    }
  };

  // Assignment functions
  const getNextAssignmentId = async (): Promise<string> => {
    if (!companyId) return 'ASN-0001';
    
    const { data, error } = await supabase.rpc('generate_assignment_id', {
      p_company_id: companyId
    });

    if (error || !data) {
      console.error('Failed to generate assignment ID:', error);
      return 'ASN-0001';
    }
    return data;
  };

  const openNewAssignmentDialog = async () => {
    const nextId = await getNextAssignmentId();
    setAssignmentForm({
      assignment_id: nextId,
      product_id: '',
      vendor_id: '',
      destination_location_id: '',
      priority: 1,
      is_active: true,
      notes: '',
    });
    setEditingAssignment(null);
    setIsAssignmentDialogOpen(true);
  };

  const openEditAssignmentDialog = (assignment: Assignment) => {
    setAssignmentForm({
      assignment_id: assignment.assignment_id,
      product_id: assignment.product_id,
      vendor_id: assignment.vendor_id,
      destination_location_id: assignment.destination_location_id,
      priority: assignment.priority,
      is_active: assignment.is_active,
      notes: assignment.notes || '',
    });
    setEditingAssignment(assignment);
    setIsAssignmentDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!companyId || !assignmentForm.assignment_id || !assignmentForm.product_id || !assignmentForm.vendor_id || !assignmentForm.destination_location_id) return;

    const assignmentData = {
      company_id: companyId,
      assignment_id: assignmentForm.assignment_id,
      product_id: assignmentForm.product_id,
      vendor_id: assignmentForm.vendor_id,
      destination_location_id: assignmentForm.destination_location_id,
      priority: assignmentForm.priority,
      is_active: assignmentForm.is_active,
      notes: assignmentForm.notes || null,
    };

    if (editingAssignment) {
      const { error } = await supabase
        .from('assignments')
        .update(assignmentData)
        .eq('id', editingAssignment.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Assignment updated');
        setIsAssignmentDialogOpen(false);
        fetchAssignments();
      }
    } else {
      const { error } = await supabase
        .from('assignments')
        .insert(assignmentData);

      if (error) {
        if (error.message.includes('duplicate')) {
          toast.error('This product-vendor-location assignment already exists');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Assignment created');
        setIsAssignmentDialogOpen(false);
        fetchAssignments();
      }
    }
  };

  const handleDeleteAssignment = async (assignment: Assignment) => {
    if (!confirm(`Delete assignment "${assignment.assignment_id}"?`)) return;

    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignment.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Assignment deleted');
      fetchAssignments();
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="h-16 px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold">Transportation</h1>
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
            </div>
          </div>
        </header>

        <div className="p-4">
          <TabsContent value="carriers" className="mt-0">
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
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Define fulfillment routes between locations
              </p>
              <Button onClick={openNewRouteDialog}>
                <Plus className="h-4 w-4 mr-2" />
                New Route
              </Button>
            </div>

            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <SortableTableHead
                    label="Route ID"
                    sortKey="route_id"
                    currentSortKey={routeSortConfig.key}
                    currentSortDirection={routeSortConfig.direction}
                    onSort={handleRouteSort}
                    filterValue={routeFilters['route_id'] || ''}
                    onFilter={(value) => setRouteFilter('route_id', value)}
                  />
                  <SortableTableHead
                    label="Name"
                    sortKey="name"
                    currentSortKey={routeSortConfig.key}
                    currentSortDirection={routeSortConfig.direction}
                    onSort={handleRouteSort}
                    filterValue={routeFilters['name'] || ''}
                    onFilter={(value) => setRouteFilter('name', value)}
                  />
                  <TableHead>Source Location</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Destination Location</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No routes configured. Create your first route to define fulfillment paths.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRoutes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-mono">{route.route_id}</TableCell>
                      <TableCell className="font-medium">{route.name}</TableCell>
                      <TableCell>{route.source_location?.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <ArrowRight className="h-4 w-4" />
                      </TableCell>
                      <TableCell>{route.destination_location?.name || '-'}</TableCell>
                      <TableCell>{route.carrier?.name || '-'}</TableCell>
                      <TableCell>{route.priority}</TableCell>
                      <TableCell>
                        <Checkbox checked={route.is_active} disabled />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditRouteDialog(route)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRoute(route)}
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

          <TabsContent value="assignments" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Assign vendors to fulfill products at specific locations
              </p>
              <Button onClick={openNewAssignmentDialog}>
                <Plus className="h-4 w-4 mr-2" />
                New Assignment
              </Button>
            </div>

            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <SortableTableHead
                    label="Assignment ID"
                    sortKey="assignment_id"
                    currentSortKey={assignmentSortConfig.key}
                    currentSortDirection={assignmentSortConfig.direction}
                    onSort={handleAssignmentSort}
                    filterValue={assignmentFilters['assignment_id'] || ''}
                    onFilter={(value) => setAssignmentFilter('assignment_id', value)}
                  />
                  <TableHead>Product</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Destination Location</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No assignments configured. Create your first assignment to define vendor fulfillment.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-mono">{assignment.assignment_id}</TableCell>
                      <TableCell>
                        {assignment.product ? `${assignment.product.product_id} - ${assignment.product.name}` : '-'}
                      </TableCell>
                      <TableCell>
                        {assignment.vendor ? `${assignment.vendor.vendor_id} - ${assignment.vendor.name}` : '-'}
                      </TableCell>
                      <TableCell>
                        {assignment.destination_location?.name || '-'}
                      </TableCell>
                      <TableCell>{assignment.priority}</TableCell>
                      <TableCell>
                        <Checkbox checked={assignment.is_active} disabled />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditAssignmentDialog(assignment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAssignment(assignment)}
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

          <div className="flex-1 overflow-y-auto min-h-0 px-6">
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

      {/* Route Dialog */}
      <Dialog open={isRouteDialogOpen} onOpenChange={setIsRouteDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingRoute ? 'Edit Route' : 'New Route'}</DialogTitle>
            <DialogDescription>
              {editingRoute ? 'Update route configuration' : 'Define a fulfillment path between locations'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-6">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="route_id">Route ID *</Label>
                  <Input
                    id="route_id"
                    value={routeForm.route_id}
                    onChange={(e) => setRouteForm({ ...routeForm, route_id: e.target.value })}
                    disabled={!!editingRoute}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    min={1}
                    value={routeForm.priority}
                    onChange={(e) => setRouteForm({ ...routeForm, priority: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="route_name">Name *</Label>
                <Input
                  id="route_name"
                  value={routeForm.name}
                  onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                  placeholder="e.g., Warehouse to Store A"
                />
              </div>

              <div className="space-y-2">
                <Label>Source Location *</Label>
                <SearchableSelect
                  options={locations.map((l) => ({ value: l.id, label: `${l.location_id} - ${l.name}` }))}
                  value={routeForm.source_location_id}
                  onValueChange={(value) => setRouteForm({ ...routeForm, source_location_id: value })}
                  placeholder="Select source location"
                />
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <Label>Destination Location *</Label>
                <SearchableSelect
                  options={locations.map((l) => ({ value: l.id, label: `${l.location_id} - ${l.name}` }))}
                  value={routeForm.destination_location_id}
                  onValueChange={(value) => setRouteForm({ ...routeForm, destination_location_id: value })}
                  placeholder="Select destination location"
                />
              </div>

              <div className="space-y-2">
                <Label>Preferred Carrier</Label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'None' },
                    ...carriers.filter(c => c.is_active).map((c) => ({ value: c.id, label: `${c.carrier_id} - ${c.name}` }))
                  ]}
                  value={routeForm.carrier_id}
                  onValueChange={(value) => setRouteForm({ ...routeForm, carrier_id: value })}
                  placeholder="Select carrier (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="route_notes">Notes</Label>
                <Input
                  id="route_notes"
                  value={routeForm.notes}
                  onChange={(e) => setRouteForm({ ...routeForm, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="route_is_active"
                  checked={routeForm.is_active}
                  onCheckedChange={(checked) =>
                    setRouteForm({ ...routeForm, is_active: checked as boolean })
                  }
                />
                <Label htmlFor="route_is_active">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button
              onClick={handleSaveRoute}
              disabled={!routeForm.route_id || !routeForm.name || !routeForm.source_location_id || !routeForm.destination_location_id}
            >
              {editingRoute ? 'Update' : 'Create'}
              <Kbd>⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</DialogTitle>
            <DialogDescription>
              {editingAssignment ? 'Update assignment configuration' : 'Assign a vendor to fulfill a product at a location'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-6">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignment_id">Assignment ID *</Label>
                  <Input
                    id="assignment_id"
                    value={assignmentForm.assignment_id}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, assignment_id: e.target.value })}
                    disabled={!!editingAssignment}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment_priority">Priority</Label>
                  <Input
                    id="assignment_priority"
                    type="number"
                    min={1}
                    value={assignmentForm.priority}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, priority: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product *</Label>
                <SearchableSelect
                  options={products.map((p) => ({ value: p.id, label: `${p.product_id} - ${p.name}` }))}
                  value={assignmentForm.product_id}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, product_id: value })}
                  placeholder="Select product"
                />
              </div>

              <div className="space-y-2">
                <Label>Vendor *</Label>
                <SearchableSelect
                  options={vendors.map((v) => ({ value: v.id, label: `${v.vendor_id} - ${v.name}` }))}
                  value={assignmentForm.vendor_id}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, vendor_id: value })}
                  placeholder="Select vendor"
                />
              </div>

              <div className="space-y-2">
                <Label>Destination Location *</Label>
                <SearchableSelect
                  options={locations.map((l) => ({ value: l.id, label: `${l.location_id} - ${l.name}` }))}
                  value={assignmentForm.destination_location_id}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, destination_location_id: value })}
                  placeholder="Select destination location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment_notes">Notes</Label>
                <Input
                  id="assignment_notes"
                  value={assignmentForm.notes}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="assignment_is_active"
                  checked={assignmentForm.is_active}
                  onCheckedChange={(checked) =>
                    setAssignmentForm({ ...assignmentForm, is_active: checked as boolean })
                  }
                />
                <Label htmlFor="assignment_is_active">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button
              onClick={handleSaveAssignment}
              disabled={!assignmentForm.assignment_id || !assignmentForm.product_id || !assignmentForm.vendor_id || !assignmentForm.destination_location_id}
            >
              {editingAssignment ? 'Update' : 'Create'}
              <Kbd>⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Tabs>
    </div>
  );
};

export default Transportation;
