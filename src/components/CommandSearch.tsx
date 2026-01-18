import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSearch } from '@/contexts/SearchContext';
import { supabase } from '@/integrations/supabase/client';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { defaultApps } from '@/config/apps';
import { Search, MapPin, Building, Users, Package, ShoppingCart, FileSpreadsheet, Truck, BookOpen, Percent, UserCog, Settings, Gauge, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'navigation' | 'vendor' | 'customer' | 'product' | 'order' | 'sales_order' | 'requisition' | 'delivery' | 'location' | 'ledger';
  label: string;
  sublabel?: string;
  path: string;
  icon: React.ReactNode;
}

const typeIcons: Record<string, React.ReactNode> = {
  navigation: <Search className="w-4 h-4" />,
  vendor: <Building className="w-4 h-4" />,
  customer: <Users className="w-4 h-4" />,
  product: <Package className="w-4 h-4" />,
  order: <ShoppingCart className="w-4 h-4" />,
  sales_order: <DollarSign className="w-4 h-4" />,
  requisition: <FileSpreadsheet className="w-4 h-4" />,
  delivery: <Truck className="w-4 h-4" />,
  location: <MapPin className="w-4 h-4" />,
  ledger: <BookOpen className="w-4 h-4" />,
};

export function CommandSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isOpen, closeSearch } = useSearch();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Fetch company ID
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.company_id) {
            setCompanyId(data.company_id);
          }
        });
    }
  }, [user]);

  // Navigation results (always available)
  const navigationResults: SearchResult[] = defaultApps
    .filter((app) => app.path)
    .map((app) => ({
      id: `nav-${app.name}`,
      type: 'navigation' as const,
      label: app.name,
      sublabel: app.description,
      path: app.path!,
      icon: <app.icon className="w-4 h-4" />,
    }));

  // Search database when query changes
  const searchDatabase = useCallback(async (searchQuery: string) => {
    if (!companyId || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults: SearchResult[] = [];
    const searchTerm = `%${searchQuery}%`;

    try {
      // Search vendors
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id, name, vendor_id')
        .eq('company_id', companyId)
        .or(`name.ilike.${searchTerm},vendor_id.ilike.${searchTerm}`)
        .limit(5);

      vendors?.forEach((v) => {
        searchResults.push({
          id: `vendor-${v.id}`,
          type: 'vendor',
          label: v.name,
          sublabel: v.vendor_id,
          path: '/vendors',
          icon: typeIcons.vendor,
        });
      });

      // Search customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, customer_id')
        .eq('company_id', companyId)
        .or(`name.ilike.${searchTerm},customer_id.ilike.${searchTerm}`)
        .limit(5);

      customers?.forEach((c) => {
        searchResults.push({
          id: `customer-${c.id}`,
          type: 'customer',
          label: c.name,
          sublabel: c.customer_id,
          path: '/customers',
          icon: typeIcons.customer,
        });
      });

      // Search products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, product_id, sku')
        .eq('company_id', companyId)
        .or(`name.ilike.${searchTerm},product_id.ilike.${searchTerm},sku.ilike.${searchTerm}`)
        .limit(5);

      products?.forEach((p) => {
        searchResults.push({
          id: `product-${p.id}`,
          type: 'product',
          label: p.name,
          sublabel: p.product_id,
          path: '/products',
          icon: typeIcons.product,
        });
      });

      // Search orders
      const { data: orders } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status')
        .eq('company_id', companyId)
        .ilike('po_number', searchTerm)
        .limit(5);

      orders?.forEach((o) => {
        searchResults.push({
          id: `order-${o.id}`,
          type: 'order',
          label: o.po_number,
          sublabel: o.status,
          path: '/orders',
          icon: typeIcons.order,
        });
      });

      // Search sales orders
      const { data: salesOrders } = await supabase
        .from('sales_orders' as any)
        .select('id, so_number, status')
        .eq('company_id', companyId)
        .ilike('so_number', searchTerm)
        .limit(5);

      (salesOrders as any)?.forEach((so: any) => {
        searchResults.push({
          id: `sales_order-${so.id}`,
          type: 'sales_order',
          label: so.so_number,
          sublabel: so.status,
          path: '/sales-orders',
          icon: typeIcons.sales_order,
        });
      });

      // Search requisitions
      const { data: requisitions } = await supabase
        .from('requisitions')
        .select('id, requisition_id, status')
        .eq('company_id', companyId)
        .ilike('requisition_id', searchTerm)
        .limit(5);

      requisitions?.forEach((r) => {
        searchResults.push({
          id: `requisition-${r.id}`,
          type: 'requisition',
          label: r.requisition_id,
          sublabel: r.status,
          path: '/requisitions',
          icon: typeIcons.requisition,
        });
      });

      // Search deliveries
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('id, delivery_id, status')
        .eq('company_id', companyId)
        .ilike('delivery_id', searchTerm)
        .limit(5);

      deliveries?.forEach((d) => {
        searchResults.push({
          id: `delivery-${d.id}`,
          type: 'delivery',
          label: d.delivery_id,
          sublabel: d.status,
          path: '/deliveries',
          icon: typeIcons.delivery,
        });
      });

      // Search locations
      const { data: locations } = await supabase
        .from('locations')
        .select('id, name, location_id')
        .eq('company_id', companyId)
        .or(`name.ilike.${searchTerm},location_id.ilike.${searchTerm}`)
        .limit(5);

      locations?.forEach((l) => {
        searchResults.push({
          id: `location-${l.id}`,
          type: 'location',
          label: l.name,
          sublabel: l.location_id,
          path: '/locations',
          icon: typeIcons.location,
        });
      });

      // Search ledgers
      const { data: ledgers } = await supabase
        .from('ledgers')
        .select('id, name, ledger_id')
        .eq('company_id', companyId)
        .or(`name.ilike.${searchTerm},ledger_id.ilike.${searchTerm}`)
        .limit(5);

      ledgers?.forEach((l) => {
        searchResults.push({
          id: `ledger-${l.id}`,
          type: 'ledger',
          label: l.name,
          sublabel: l.ledger_id,
          path: '/ledgers',
          icon: typeIcons.ledger,
        });
      });

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchDatabase(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchDatabase]);

  // Reset query when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  const handleSelect = (result: SearchResult) => {
    closeSearch();
    navigate(result.path);
  };

  // Filter navigation results by query
  const filteredNavigation = navigationResults.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.sublabel?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && closeSearch()}>
      <Command className="rounded-lg border shadow-md">
        <CommandInput 
          placeholder="Search transactions, objects..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? 'Searching...' : 'No results found.'}
          </CommandEmpty>
          
          {/* Navigation/Transactions */}
          {filteredNavigation.length > 0 && (
            <CommandGroup heading="Transactions">
              {filteredNavigation.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                    {item.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Database results */}
          {results.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Objects">
                {results.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.sublabel || ''}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                      {item.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                      )}
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground capitalize">
                      {item.type}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
