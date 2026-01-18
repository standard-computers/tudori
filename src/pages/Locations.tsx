import { useEffect, useState } from 'react';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, MapPin, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
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
}

const LOCATION_TYPES = ['Warehouse', 'Store', 'Office', 'Distribution Center', 'Manufacturing', 'Showroom'];

const Locations = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextLocationId, setNextLocationId] = useState('0001');
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

    setLocations(data || []);
  };

  const fetchNextLocationId = async () => {
    const { data, error } = await supabase.rpc('get_next_location_id', {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextLocationId(data);
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
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleOpenDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, location_id: nextLocationId }));
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new location
  useKeyboardShortcut('n', handleOpenDialog);

  const handleEdit = (location: Location) => {
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
    });
    setIsEditing(true);
    setEditingId(location.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete location');
      return;
    }

    toast.success('Location deleted');
    fetchLocations();
    fetchNextLocationId();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        })
        .eq('id', editingId);

      if (error) {
        toast.error('Failed to update location');
        return;
      }

      toast.success('Location updated');
    } else {
      const { error } = await supabase
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
        });

      if (error) {
        toast.error('Failed to create location');
        return;
      }

      toast.success('Location created');
    }

    setIsDialogOpen(false);
    fetchLocations();
    fetchNextLocationId();
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-display font-bold text-foreground">Locations</h1>
              </div>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location
                  <Kbd>N</Kbd>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Location' : 'Add Location'}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? 'Update location details.' : 'Add a new location to your company.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="location_id">Location ID</Label>
                        <Input
                          id="location_id"
                          value={formData.location_id}
                          onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                          disabled={isEditing}
                          className={`${isEditing ? 'bg-muted' : ''} ${!isEditing && locations.some(l => l.location_id === formData.location_id) ? 'border-destructive border-2' : ''}`}
                          required
                        />
                        {!isEditing && locations.some(l => l.location_id === formData.location_id) && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            This ID is already in use
                          </p>
                        )}
                        {!isEditing && !locations.some(l => l.location_id === formData.location_id) && formData.location_id && (
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
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
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
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={!isEditing && locations.some(l => l.location_id === formData.location_id)}
                    >
                      {isEditing ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-mono text-sm">{location.location_id}</TableCell>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>{location.type}</TableCell>
                    <TableCell>{location.address_line1}</TableCell>
                    <TableCell>{location.city}</TableCell>
                    <TableCell>{location.state}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(location)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(location.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

export default Locations;
