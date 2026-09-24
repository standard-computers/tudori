import { useEffect, useState } from 'react';
import POSCheckoutScreen from '@/components/pos/POSCheckoutScreen';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusBar } from '@/contexts/StatusBarContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, Search, CreditCard, Settings, Monitor, MonitorOff } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { toast } from '@/lib/toast';
import POSSettingsDialog from '@/components/pos/POSSettingsDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

interface Location {
  id: string;
  location_id: string;
  name: string;
}

interface Product {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number | null;
  image_url: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface LocationRate {
  id: string;
  name: string;
  rate: number;
  rate_type: string;
}

const POS = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isLocationAdmin, setIsLocationAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [posProductIds, setPosProductIds] = useState<Set<string> | null>(null);
  const [showProductIdsOnTiles, setShowProductIdsOnTiles] = useState(false);
  const [showProductImagesOnTiles, setShowProductImagesOnTiles] = useState(true);
  const [locationRates, setLocationRates] = useState<LocationRate[]>([]);
  const [posCount, setPosCount] = useState(1);
  const [posAssignments, setPosAssignments] = useState<{ pos_number: number; user_id: string; employee_id: string | null }[]>([]);
  const [locationEmployees, setLocationEmployees] = useState<{ id: string; user_id: string; name: string }[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignPosNumber, setAssignPosNumber] = useState('');
  const [unassignConfirmOpen, setUnassignConfirmOpen] = useState(false);

  useEffect(() => {
    setTransaction('pos');
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
    if (companyId) {
      fetchPOSLocations();
      fetchProducts();
    }
  }, [companyId]);

  const fetchPosAssignments = async () => {
    if (!selectedLocationId) return;
    const [{ data: loc }, { data: asg }] = await Promise.all([
      supabase.from('locations').select('pos_count').eq('id', selectedLocationId).maybeSingle(),
      supabase.from('pos_assignments').select('pos_number, user_id, employee_id').eq('location_id', selectedLocationId),
    ]);
    setPosCount(loc?.pos_count ?? 1);
    setPosAssignments(asg || []);
    fetchLocationEmployees();
  };

  const fetchLocationEmployees = async () => {
    if (!selectedLocationId || !companyId) return;
    const { data: locUsers } = await supabase
      .from('location_users')
      .select('user_id')
      .eq('location_id', selectedLocationId);
    const userIds = (locUsers || []).map(lu => lu.user_id);
    if (!userIds.length) { setLocationEmployees([]); return; }
    const { data: emps } = await supabase
      .from('employees')
      .select('id, user_id, first_name, last_name, employee_id')
      .eq('company_id', companyId)
      .in('user_id', userIds);
    const empIds = (emps || []).map(e => e.id);
    const { data: openPunches } = empIds.length
      ? await supabase.from('time_punches').select('employee_id').in('employee_id', empIds).is('punch_out', null)
      : { data: [] as { employee_id: string }[] };
    const clocked = new Set((openPunches || []).map(p => p.employee_id));
    setLocationEmployees(
      (emps || [])
        .filter(e => e.user_id)
        .map(e => ({
          id: e.id,
          user_id: e.user_id as string,
          name: `${e.first_name} ${e.last_name}`.trim() + (e.employee_id ? ` (${e.employee_id})` : ''),
          fullName: `${e.first_name} ${e.last_name}`.trim(),
          clockedIn: clocked.has(e.id),
        }))
    );
  };

  const assignPos = async () => {
    if (!user || !companyId) return;
    const employee = locationEmployees.find(e => e.id === assignEmployeeId);
    const n = Number(assignPosNumber);
    if (!employee) { toast.error('Select an employee to assign'); return; }
    if (!employee.clockedIn) { toast.error(`${employee.fullName} must be clocked in to be assigned`); return; }
    if (!n) { toast.error('Select a POS number'); return; }
    const { error } = await supabase.from('pos_assignments').insert({
      company_id: companyId, location_id: selectedLocationId, pos_number: n,
      user_id: employee.user_id, employee_id: employee.id,
    });
    if (error) toast.error('That POS is no longer available');
    else {
      toast.success(`${employee.name} assigned to POS ${n}`);
      setAssignDialogOpen(false);
      setAssignEmployeeId('');
      setAssignPosNumber('');
    }
    fetchPosAssignments();
  };

  const unassignPos = async () => {
    if (!user) return;
    const { error } = await supabase.from('pos_assignments').delete()
      .eq('location_id', selectedLocationId).eq('user_id', user.id);
    if (error) toast.error('Failed to unassign POS');
    else toast.success('Unassigned from POS');
    fetchPosAssignments();
  };

  const myAssignment = posAssignments.find(a => a.user_id === user?.id);
  const myPos = myAssignment?.pos_number ?? null;
  const myEmployeeName = myAssignment
    ? (locationEmployees.find(e => e.id === myAssignment.employee_id || e.user_id === myAssignment.user_id)?.fullName ?? '')
    : '';

  // Check if user is admin for selected location & fetch POS product assignments
  useEffect(() => {
    if (selectedLocationId && user) {
      checkLocationAdmin();
      fetchPosProducts();
      fetchLocationRates();
      fetchPosAssignments();
      // Load show product IDs preference
      const stored = localStorage.getItem(`pos-show-ids-${selectedLocationId}`);
      setShowProductIdsOnTiles(stored === 'true');
      // Load show product images preference (default true)
      const storedImages = localStorage.getItem(`pos-show-images-${selectedLocationId}`);
      setShowProductImagesOnTiles(storedImages === null ? true : storedImages === 'true');
    }
  }, [selectedLocationId, user]);

  const checkLocationAdmin = async () => {
    if (!user || !selectedLocationId) return;
    // Check location_users for admin role
    const { data: luData } = await supabase
      .from('location_users')
      .select('role')
      .eq('location_id', selectedLocationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (luData?.role === 'admin') {
      setIsLocationAdmin(true);
      return;
    }

    // Check company-level admin/owner role
    if (companyId) {
      const { data: urData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin']);

      setIsLocationAdmin(!!(urData && urData.length > 0));
    } else {
      setIsLocationAdmin(false);
    }
  };

  const fetchPosProducts = async () => {
    const { data } = await supabase
      .from('pos_location_products')
      .select('product_id')
      .eq('location_id', selectedLocationId);

    if (data && data.length > 0) {
      setPosProductIds(new Set(data.map((r) => r.product_id)));
    } else {
      setPosProductIds(null); // null means show all products
    }
  };

  const fetchLocationRates = async () => {
    const { data } = await supabase
      .from('pos_location_rates')
      .select('rate_id, tax_rates(id, name, rate, rate_type)')
      .eq('location_id', selectedLocationId);

    if (data) {
      setLocationRates(
        data
          .map((r: any) => r.tax_rates)
          .filter(Boolean)
          .map((tr: any) => ({
            id: tr.id,
            name: tr.name,
            rate: Number(tr.rate),
            rate_type: tr.rate_type || 'percent',
          }))
      );
    } else {
      setLocationRates([]);
    }
  };

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

  const fetchPOSLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, location_id, name')
      .eq('company_id', companyId!)
      .eq('is_pos_enabled', true)
      .order('name');

    if (error) {
      toast.error('Failed to load POS locations');
      return;
    }

    setLocations(data || []);
    if (data && data.length > 0 && !selectedLocationId) {
      setSelectedLocationId(data[0].id);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_id, name, sku, price, image_url')
      .eq('company_id', companyId!)
      .eq('is_pos_available', true)
      .ilike('status', 'active')
      .order('name');

    if (error) {
      toast.error('Failed to load products');
      return;
    }

    setProducts(data || []);
  };

  // Filter by POS product assignments first, then by search
  const availableProducts = posProductIds
    ? products.filter((p) => posProductIds.has(p.id))
    : products;

  const filteredProducts = availableProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartSubtotal = cart.reduce((sum, item) => {
    return sum + (item.product.price || 0) * item.quantity;
  }, 0);

  // Calculate rate amounts
  const percentRates = locationRates.filter((r) => r.rate_type === 'percent');
  const flatRates = locationRates.filter((r) => r.rate_type === 'flat');
  const percentTotal = percentRates.reduce((sum, r) => sum + (cartSubtotal * r.rate) / 100, 0);
  const flatTotal = flatRates.reduce((sum, r) => sum + r.rate, 0);
  const ratesTotal = percentTotal + flatTotal;
  const cartTotal = cartSubtotal + ratesTotal;

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (!selectedLocationId) {
      toast.error('Please select a location');
      return;
    }
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setShowCheckout(true);
  };

  if (locations.length === 0 && companyId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 shrink-0">
          <div className="px-4">
            <div className="flex items-center gap-4 h-14">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ArrowLeft className="w-5 h-5" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <h1 className="text-xl font-semibold">Point of Sale</h1>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No POS locations</h3>
            <p className="text-muted-foreground mb-4">
              Enable POS in location settings to get started.
            </p>
            <Button onClick={() => navigate('/locations')}>
              Go to Locations
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (showCheckout && companyId) {
    return (
      <POSCheckoutScreen
        cart={cart}
        locationRates={locationRates}
        cartSubtotal={cartSubtotal}
        cartTotal={cartTotal}
        percentRates={percentRates}
        flatRates={flatRates}
        selectedLocationId={selectedLocationId}
        companyId={companyId}
        onBack={() => setShowCheckout(false)}
        onComplete={() => {
          setShowCheckout(false);
          setCart([]);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 shrink-0">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ArrowLeft className="w-5 h-5" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <h1 className="text-xl font-semibold">Point of Sale</h1>
            </div>
            <div className="flex items-center gap-2">
              {isLocationAdmin && (
                <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
                  <Settings className="w-5 h-5" />
                </Button>
              )}
              {selectedLocationId && (
                myPos !== null ? (
                  <Button variant="outline" onClick={() => setUnassignConfirmOpen(true)} title="Unassign from this POS">
                    <MonitorOff className="w-4 h-4 mr-2" /> POS {myPos} · {myEmployeeName ? `${myEmployeeName} · ` : ''}Unassign
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setAssignDialogOpen(true)}>
                    <Monitor className="w-4 h-4 mr-2" /> Assign POS
                  </Button>
                )
              )}
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex">
        {/* Products Grid */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-4">
                  {showProductImagesOnTiles && (
                    <div className="aspect-square bg-muted rounded-md mb-3 flex items-center justify-center overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <h3 className="font-medium text-sm truncate">{product.name}</h3>
                  {showProductIdsOnTiles && (
                    <p className="text-xs text-muted-foreground truncate">{product.product_id}</p>
                  )}
                  <p className="text-sm font-semibold mt-1">
                    ${(product.price || 0).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="w-96 border-l bg-card flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart ({cartItemCount})
              </h2>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Cart is empty
              </p>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3 p-2 border rounded-lg">
                    {showProductImagesOnTiles && (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
                        {item.product.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${(item.product.price || 0).toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t space-y-2">
            {locationRates.length > 0 && cart.length > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>
                {percentRates.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{r.name} ({r.rate}%)</span>
                    <span>${((cartSubtotal * r.rate) / 100).toFixed(2)}</span>
                  </div>
                ))}
                {flatRates.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{r.name}</span>
                    <span>${r.rate.toFixed(2)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={cart.length === 0}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Checkout
            </Button>
          </div>
        </div>
      </main>
      {selectedLocationId && companyId && (
        <>
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-[400px] p-6">
            <DialogHeader>
              <DialogTitle>Assign POS</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 px-1 py-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationEmployees.length === 0 ? (
                      <SelectItem value="__none" disabled>No employees at this location</SelectItem>
                    ) : (
                      locationEmployees.map(e => {
                        const taken = posAssignments.some(a => a.user_id === e.user_id);
                        return (
                          <SelectItem key={e.id} value={e.id} disabled={taken || !e.clockedIn}>
                            {e.name}{taken ? ' (assigned)' : !e.clockedIn ? ' (not clocked in)' : ''}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>POS</Label>
                <Select value={assignPosNumber} onValueChange={setAssignPosNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select POS" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: posCount }, (_, i) => i + 1).map(n => {
                      const taken = posAssignments.some(a => a.pos_number === n);
                      return (
                        <SelectItem key={n} value={String(n)} disabled={taken}>
                          POS {n}{taken ? ' (in use)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button onClick={assignPos} disabled={!assignEmployeeId || !assignPosNumber}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ConfirmDeleteDialog
          open={unassignConfirmOpen}
          onOpenChange={setUnassignConfirmOpen}
          title="Unassign POS"
          description={`Are you sure you want to unassign from POS ${myPos ?? ''}? You will no longer be able to process sales on this terminal until assigned again.`}
          confirmLabel="Unassign"
          onConfirm={() => { setUnassignConfirmOpen(false); unassignPos(); }}
        />
        <POSSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          locationId={selectedLocationId}
          locationName={locations.find(l => l.id === selectedLocationId)?.name || ''}
          companyId={companyId}
          onSaved={() => { fetchPosProducts(); fetchLocationRates(); fetchPosAssignments(); }}
          showProductIds={showProductIdsOnTiles}
          onShowProductIdsChange={(val) => {
            setShowProductIdsOnTiles(val);
            localStorage.setItem(`pos-show-ids-${selectedLocationId}`, String(val));
          }}
          showProductImages={showProductImagesOnTiles}
          onShowProductImagesChange={(val) => {
            setShowProductImagesOnTiles(val);
            localStorage.setItem(`pos-show-images-${selectedLocationId}`, String(val));
          }}
        />
        </>
      )}
    </div>
  );
};

export default POS;
