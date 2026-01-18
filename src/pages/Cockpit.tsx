import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { useSaveShortcut } from '@/hooks/use-keyboard-shortcut';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { ArrowLeft, Gauge, MapPin, Package, ShoppingCart, Truck, Users, DollarSign, TrendingUp, AlertCircle, Lock, Grid3X3, Box, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Location {
  id: string;
  location_id: string;
  name: string;
  type: string;
  address_line1: string;
  city: string;
  state: string;
}

interface Area {
  id: string;
  area_id: string;
  name: string;
  description: string | null;
  location_id: string;
}

interface Bin {
  id: string;
  bin_id: string;
  name: string;
  description: string | null;
  capacity: string | null;
  area_id: string;
}

const Cockpit = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Areas & Bins state
  const [areas, setAreas] = useState<Area[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isBinDialogOpen, setIsBinDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  const [areaFormData, setAreaFormData] = useState({ area_id: '', name: '', description: '' });
  const [binFormData, setBinFormData] = useState({ bin_id: '', name: '', description: '', capacity: '', area_id: '' });
  const areaFormRef = useRef<HTMLFormElement>(null);
  const binFormRef = useRef<HTMLFormElement>(null);

  // Save shortcuts
  useSaveShortcut(() => {
    if (isAreaDialogOpen) areaFormRef.current?.requestSubmit();
    else if (isBinDialogOpen) binFormRef.current?.requestSubmit();
  });

  const isWarehouseOrDC = selectedLocation?.type === 'Warehouse' || selectedLocation?.type === 'Distribution Center';

  // Set transaction
  useEffect(() => {
    setTransaction('cpit');
  }, [setTransaction]);

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
    if (companyId && user) {
      fetchAccessibleLocations();
    }
  }, [companyId, user]);

  useEffect(() => {
    if (selectedLocationId && locations.length > 0) {
      const location = locations.find(l => l.id === selectedLocationId);
      setSelectedLocation(location || null);
    }
  }, [selectedLocationId, locations]);

  useEffect(() => {
    if (selectedLocationId && isWarehouseOrDC) {
      fetchAreas();
    } else {
      setAreas([]);
      setBins([]);
    }
  }, [selectedLocationId, selectedLocation]);

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

  const fetchAccessibleLocations = async () => {
    // First get locations the user has access to via location_users
    const { data: accessibleLocationIds } = await supabase
      .from('location_users')
      .select('location_id')
      .eq('user_id', user!.id);

    if (!accessibleLocationIds || accessibleLocationIds.length === 0) {
      setLocations([]);
      return;
    }

    const locationIds = accessibleLocationIds.map(l => l.location_id);

    // Then fetch the actual location data for those locations
    const { data } = await supabase
      .from('locations')
      .select('id, location_id, name, type, address_line1, city, state')
      .eq('company_id', companyId!)
      .in('id', locationIds)
      .order('location_id');

    setLocations(data || []);
  };

  const fetchAreas = async () => {
    if (!selectedLocationId) return;
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('location_id', selectedLocationId)
      .order('area_id');
    
    if (error) {
      console.error('Failed to fetch areas:', error);
      return;
    }
    setAreas(data || []);
    
    // Fetch bins for all areas
    if (data && data.length > 0) {
      const areaIds = data.map(a => a.id);
      const { data: binData } = await supabase
        .from('bins')
        .select('*')
        .in('area_id', areaIds)
        .order('bin_id');
      setBins(binData || []);
    } else {
      setBins([]);
    }
  };

  const getNextAreaId = () => {
    if (areas.length === 0) return 'A001';
    const maxNum = Math.max(...areas.map(a => parseInt(a.area_id.replace(/\D/g, '') || '0', 10)));
    return `A${String(maxNum + 1).padStart(3, '0')}`;
  };

  const getNextBinId = (areaId: string) => {
    const areaBins = bins.filter(b => b.area_id === areaId);
    const area = areas.find(a => a.id === areaId);
    const areaPrefix = area?.area_id || 'A001';
    if (areaBins.length === 0) return `${areaPrefix}-B001`;
    const maxNum = Math.max(...areaBins.map(b => parseInt(b.bin_id.split('-B')[1] || '0', 10)));
    return `${areaPrefix}-B${String(maxNum + 1).padStart(3, '0')}`;
  };

  const openAreaDialog = (area?: Area) => {
    if (area) {
      setEditingArea(area);
      setAreaFormData({ area_id: area.area_id, name: area.name, description: area.description || '' });
    } else {
      setEditingArea(null);
      setAreaFormData({ area_id: getNextAreaId(), name: '', description: '' });
    }
    setIsAreaDialogOpen(true);
  };

  const openBinDialog = (bin?: Bin) => {
    if (bin) {
      setEditingBin(bin);
      setBinFormData({ bin_id: bin.bin_id, name: bin.name, description: bin.description || '', capacity: bin.capacity || '', area_id: bin.area_id });
    } else {
      setEditingBin(null);
      const defaultAreaId = areas[0]?.id || '';
      setBinFormData({ bin_id: defaultAreaId ? getNextBinId(defaultAreaId) : '', name: '', description: '', capacity: '', area_id: defaultAreaId });
    }
    setIsBinDialogOpen(true);
  };

  const handleAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) return;

    if (editingArea) {
      const { error } = await supabase
        .from('areas')
        .update({ name: areaFormData.name, description: areaFormData.description || null })
        .eq('id', editingArea.id);
      if (error) {
        toast.error('Failed to update area');
        return;
      }
      toast.success('Area updated');
    } else {
      const { error } = await supabase
        .from('areas')
        .insert({ location_id: selectedLocationId, area_id: areaFormData.area_id, name: areaFormData.name, description: areaFormData.description || null });
      if (error) {
        toast.error('Failed to create area');
        return;
      }
      toast.success('Area created');
    }
    setIsAreaDialogOpen(false);
    fetchAreas();
  };

  const handleBinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binFormData.area_id) {
      toast.error('Please select an area');
      return;
    }

    if (editingBin) {
      const { error } = await supabase
        .from('bins')
        .update({ name: binFormData.name, description: binFormData.description || null, capacity: binFormData.capacity || null })
        .eq('id', editingBin.id);
      if (error) {
        toast.error('Failed to update bin');
        return;
      }
      toast.success('Bin updated');
    } else {
      const { error } = await supabase
        .from('bins')
        .insert({ area_id: binFormData.area_id, bin_id: binFormData.bin_id, name: binFormData.name, description: binFormData.description || null, capacity: binFormData.capacity || null });
      if (error) {
        toast.error('Failed to create bin');
        return;
      }
      toast.success('Bin created');
    }
    setIsBinDialogOpen(false);
    fetchAreas();
  };

  const handleDeleteArea = async (id: string) => {
    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete area');
      return;
    }
    toast.success('Area deleted');
    fetchAreas();
  };

  const handleDeleteBin = async (id: string) => {
    const { error } = await supabase.from('bins').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete bin');
      return;
    }
    toast.success('Bin deleted');
    fetchAreas();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Location Selection Screen
  if (!selectedLocationId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                    <Gauge className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-xl font-display font-bold text-foreground">Cockpit</h1>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Select Location</CardTitle>
              <CardDescription>
                Choose a location to view its dashboard and key metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {locations.length === 0 ? (
                <div className="text-center py-4">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground font-medium">No accessible locations</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You don't have access to any locations. Contact your administrator to be added to a location.
                  </p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate('/locations')}
                    className="mt-2"
                  >
                    Manage locations
                  </Button>
                </div>
              ) : (
                <>
                  <Select onValueChange={setSelectedLocationId}>
                    <SelectTrigger className="w-full h-14 text-lg">
                      <SelectValue placeholder="Select a location..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id} className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {location.location_id}
                            </span>
                            <span className="font-medium">{location.name}</span>
                            <span className="text-muted-foreground text-sm">({location.type})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground text-center">
                    {locations.length} location{locations.length !== 1 ? 's' : ''} available
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Location Dashboard
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedLocationId(null)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-display font-bold text-foreground">Cockpit</h1>
                  <p className="text-xs text-muted-foreground">
                    {selectedLocation?.name} • {selectedLocation?.location_id}
                  </p>
                </div>
              </div>
            </div>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{location.location_id}</span>
                      <span>{location.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Location Info Banner */}
        <Card className="mb-8 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{selectedLocation?.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedLocation?.address_line1}, {selectedLocation?.city}, {selectedLocation?.state}
                </p>
              </div>
              <div className="ml-auto">
                <span className="px-3 py-1 rounded-full bg-background text-sm font-medium">
                  {selectedLocation?.type}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Products</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Orders</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shipments</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks for this location</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/orders')}>
                <ShoppingCart className="w-5 h-5" />
                <span>New Order</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/requisitions')}>
                <Package className="w-5 h-5" />
                <span>Requisition</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/products')}>
                <Package className="w-5 h-5" />
                <span>Products</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/vendors')}>
                <Users className="w-5 h-5" />
                <span>Vendors</span>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates at this location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Activity will appear here as you work
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Areas & Bins - Only for Warehouse/DC */}
        {isWarehouseOrDC && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Areas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5" />
                    Areas
                  </CardTitle>
                  <CardDescription>Warehouse zones and sections</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAreaDialog()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Area
                </Button>
              </CardHeader>
              <CardContent>
                {areas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Grid3X3 className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No areas defined</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create areas to organize your warehouse
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Bins</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areas.map((area) => (
                        <TableRow key={area.id}>
                          <TableCell className="font-mono">{area.area_id}</TableCell>
                          <TableCell>{area.name}</TableCell>
                          <TableCell className="text-right">{bins.filter(b => b.area_id === area.id).length}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAreaDialog(area)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteArea(area.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Bins */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Box className="w-5 h-5" />
                    Bins
                  </CardTitle>
                  <CardDescription>Storage locations within areas</CardDescription>
                </div>
                <Button size="sm" onClick={() => openBinDialog()} disabled={areas.length === 0}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Bin
                </Button>
              </CardHeader>
              <CardContent>
                {bins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Box className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No bins defined</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {areas.length === 0 ? 'Create an area first' : 'Create bins to track inventory locations'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bins.map((bin) => {
                        const area = areas.find(a => a.id === bin.area_id);
                        return (
                          <TableRow key={bin.id}>
                            <TableCell className="font-mono">{bin.bin_id}</TableCell>
                            <TableCell>{bin.name}</TableCell>
                            <TableCell>{area?.name || '—'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBinDialog(bin)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBin(bin.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Area Dialog */}
      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form ref={areaFormRef} onSubmit={handleAreaSubmit}>
            <DialogHeader>
              <DialogTitle>{editingArea ? 'Edit Area' : 'Add Area'}</DialogTitle>
              <DialogDescription>
                {editingArea ? 'Update area details.' : 'Create a new warehouse area.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="area_id">Area ID</Label>
                <Input
                  id="area_id"
                  value={areaFormData.area_id}
                  onChange={(e) => setAreaFormData({ ...areaFormData, area_id: e.target.value })}
                  disabled={!!editingArea}
                  className={editingArea ? 'bg-muted' : ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area_name">Name *</Label>
                <Input
                  id="area_name"
                  value={areaFormData.name}
                  onChange={(e) => setAreaFormData({ ...areaFormData, name: e.target.value })}
                  placeholder="e.g., Receiving Zone"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area_description">Description</Label>
                <Input
                  id="area_description"
                  value={areaFormData.description}
                  onChange={(e) => setAreaFormData({ ...areaFormData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsAreaDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingArea ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bin Dialog */}
      <Dialog open={isBinDialogOpen} onOpenChange={setIsBinDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form ref={binFormRef} onSubmit={handleBinSubmit}>
            <DialogHeader>
              <DialogTitle>{editingBin ? 'Edit Bin' : 'Add Bin'}</DialogTitle>
              <DialogDescription>
                {editingBin ? 'Update bin details.' : 'Create a new storage bin.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bin_area">Area *</Label>
                <Select
                  value={binFormData.area_id}
                  onValueChange={(value) => {
                    setBinFormData({ 
                      ...binFormData, 
                      area_id: value, 
                      bin_id: editingBin ? binFormData.bin_id : getNextBinId(value) 
                    });
                  }}
                  disabled={!!editingBin}
                >
                  <SelectTrigger className={editingBin ? 'bg-muted' : ''}>
                    <SelectValue placeholder="Select an area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.area_id} - {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bin_id">Bin ID</Label>
                <Input
                  id="bin_id"
                  value={binFormData.bin_id}
                  onChange={(e) => setBinFormData({ ...binFormData, bin_id: e.target.value })}
                  disabled={!!editingBin}
                  className={editingBin ? 'bg-muted' : ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bin_name">Name *</Label>
                <Input
                  id="bin_name"
                  value={binFormData.name}
                  onChange={(e) => setBinFormData({ ...binFormData, name: e.target.value })}
                  placeholder="e.g., Shelf A1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bin_capacity">Capacity</Label>
                <Input
                  id="bin_capacity"
                  value={binFormData.capacity}
                  onChange={(e) => setBinFormData({ ...binFormData, capacity: e.target.value })}
                  placeholder="e.g., 100 units"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsBinDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingBin ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cockpit;