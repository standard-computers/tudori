import { useEffect, useState, useMemo } from "react";
import jsPDF from "jspdf";
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/use-column-visibility";
import { ColumnToggle } from "@/components/ColumnToggle";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { useExcel } from "@/hooks/use-excel";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { ImportProgressDialog, ImportResult } from "@/components/ImportProgressDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { useVendorSources } from "@/hooks/use-vendor-sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/SortableTableHead";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { SearchableSelect, SearchableSelectOption } from "@/components/SearchableSelect";
import {
  ArrowLeft,
  DollarSign,
  Plus,
  Eye,
  Loader2,
  MoreHorizontal,
  Trash2,
  Pencil,
  Check,
  X,
  BookOpen,
  Maximize2,
  Minimize2,
  History,
  Search,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { toast } from '@/lib/toast';
import { AuditHistoryTab } from "@/components/AuditHistoryTab";
import { useReduceAppLoad } from "@/hooks/use-reduce-app-load";
import { AppLoadQueryDialog, QueryField } from "@/components/AppLoadQueryDialog";

const SALES_ORDER_QUERY_FIELDS: QueryField[] = [
  { key: "so_number", label: "SO #", placeholder: "Search by SO number..." },
  { key: "status", label: "Status", placeholder: "e.g. draft, confirmed..." },
  { key: "customer", label: "Customer", placeholder: "Search by customer name..." },
  { key: "order_date", label: "Order Date", type: "date" },
];

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  rate_type: string;
  is_default: boolean;
}

interface SelectedTaxRate {
  tax_rate_id: string;
  name: string;
  rate: number;
  rate_type: string;
}

interface SalesOrder {
  id: string;
  so_number: string;
  status: string;
  customer_id: string | null;
  location_id: string | null;
  bill_to_location_id: string | null;
  ledger_id: string | null;
  tax_rate_id: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  created_at: string;
  customer?: {
    id: string;
    name: string;
    customer_id: string;
    email?: string;
    phone?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  } | null;
  location?: {
    id: string;
    name: string;
    location_id: string;
    address_line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  } | null;
  bill_to_location?: {
    id: string;
    name: string;
    location_id: string;
    address_line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  } | null;
  ledger?: { name: string } | null;
  tax_rate?: { name: string; rate: number } | null;
  applied_tax_rates?: { tax_rate_id: string; tax_amount: number; tax_rate: { name: string; rate: number } }[];
}

interface SalesOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  product?: { name: string; price: number | null; product_id?: string };
}

interface Location {
  id: string;
  name: string;
  location_id: string;
}

interface Customer {
  id: string;
  name: string;
  customer_id: string;
}

interface Ledger {
  id: string;
  name: string;
  location_id: string | null;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  product_id: string;
  price: number | null;
  unit: string | null;
}

interface ProductUom {
  id: string;
  product_id: string;
  name: string;
  abbreviation: string | null;
  conversion_factor: number;
}

interface InventoryRecord {
  id: string;
  product_id: string;
  quantity: number;
  bin_id: string | null;
  product?: { name: string; product_id: string };
  bin?: { name: string; bin_id: string } | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-500",
  pending: "bg-yellow-500",
  confirmed: "bg-indigo-500",
  processing: "bg-blue-500",
  shipped: "bg-purple-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  backorder: "bg-orange-500",
};

// Column definitions for Sales Orders table
const SALES_ORDER_COLUMNS: ColumnDefinition[] = [
  { key: "so_number", label: "SO #", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "customer", label: "Customer", defaultVisible: true },
  { key: "location", label: "Ship From", defaultVisible: true },
  { key: "total_amount", label: "Total", defaultVisible: true },
  { key: "order_date", label: "Date", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

const SalesOrders = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SalesOrder[]>([]);

  // Auto-open view dialog when navigated here with openRef state (e.g. from Ledgers)
  useEffect(() => {
    const ref = (location.state as any)?.openRef;
    if (!ref || !orders.length) return;
    const match = orders.find(o => o.so_number === ref);
    if (match) {
      handleViewOrder(match);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state, orders]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);
  const { reduceAppLoad, loading: reduceAppLoadLoading } = useReduceAppLoad();
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);

  // Use vendor sources hook for ship from options (vendors + all locations)
  const { vendorOptions: shipFromOptions, parseVendorValue } = useVendorSources(companyId, {
    includeAllLocations: true,
  });

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();

  // Set transaction based on dialog state
  useEffect(() => {
    if (isCreateDialogOpen) {
      setTransaction("so/new");
    } else if (isViewDialogOpen) {
      setTransaction("so/view");
    } else {
      setTransaction("so");
    }
  }, [isCreateDialogOpen, isViewDialogOpen, setTransaction]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowQueryDialog(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isCreateDialogOpen && !isSubmitting) {
      handleCreateOrder();
    }
  }, isCreateDialogOpen);

  // View dialog state
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [viewItems, setViewItems] = useState<SalesOrderItem[]>([]);
  const [detailView, setDetailView] = useState<{ type: "customer" | "location"; data: any } | null>(null);

  // Create dialog form state
  const [formData, setFormData] = useState({
    customer_id: "",
    location_id: "",
    bill_to_location_id: "",
    ledger_id: "",
    notes: "",
  });
  const [orderItems, setOrderItems] = useState<
    { product_id: string; quantity: number; unit_price: number; pu_id: string | null }[]
  >([]);
  const [productUoms, setProductUoms] = useState<ProductUom[]>([]);
  const [selectedTaxRates, setSelectedTaxRates] = useState<SelectedTaxRate[]>([]);
  const [viewTaxRates, setViewTaxRates] = useState<
    { tax_rate_id: string; tax_amount: number; tax_rate: { name: string; rate: number } }[]
  >([]);
  const [isEditingTaxRates, setIsEditingTaxRates] = useState(false);
  const [editTaxRates, setEditTaxRates] = useState<SelectedTaxRate[]>([]);
  const [locationInventory, setLocationInventory] = useState<InventoryRecord[]>([]);

  // Column visibility for table
  const { visibleColumns, isColumnVisible, toggleColumn, resetToDefaults, showAll, hideAll } = useColumnVisibility(
    "sales_orders",
    SALES_ORDER_COLUMNS,
  );

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTotalRows, setImportTotalRows] = useState(0);
  const [importProcessedRows, setImportProcessedRows] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importComplete, setImportComplete] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId && !reduceAppLoadLoading) {
      if (reduceAppLoad) {
        setShowQueryDialog(true);
      } else {
        fetchOrders();
      }
      fetchLocations();
      fetchCustomers();
      fetchProducts();
      fetchProductUoms();
      fetchTaxRates();
      fetchLedgers();
    }
  }, [companyId, reduceAppLoad, reduceAppLoadLoading]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);
      const { data: companyData } = await supabase.from("companies").select("*").eq("id", profile.company_id).single();
      if (companyData) setCompany(companyData);
    }
    setLoading(false);
  };

  const fetchOrders = async (filters?: Record<string, string>) => {
    let query = supabase
      .from("sales_orders" as any)
      .select(
        `
        *,
        customer:customers(id, name, customer_id, email, phone, address_line1, city, state, postal_code),
        location:locations!sales_orders_location_id_fkey(id, name, location_id, address_line1, city, state, postal_code),
        bill_to_location:locations!sales_orders_bill_to_location_id_fkey(id, name, location_id, address_line1, city, state, postal_code),
        ledger:ledgers(name),
        tax_rate:tax_rates(name, rate)
      `,
      )
      .eq("company_id", companyId);

    if (filters?.so_number) query = query.ilike("so_number", `%${filters.so_number}%`);
    if (filters?.status) query = query.ilike("status", `%${filters.status}%`);
    if (filters?.order_date) query = query.eq("order_date", filters.order_date);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load sales orders");
      return;
    }

    // Client-side filter for customer name (joined table)
    let filtered = (data as any) || [];
    if (filters?.customer) {
      const term = filters.customer.toLowerCase();
      filtered = filtered.filter((o: any) => o.customer?.name?.toLowerCase().includes(term));
    }

    setOrders(filtered);
  };

  const handleQueryDialogQuery = async (filters: Record<string, string>) => {
    setQueryLoading(true);
    await fetchOrders(filters);
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const handleQueryDialogLoadAll = async () => {
    setQueryLoading(true);
    await fetchOrders();
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from("locations")
      .select("id, name, location_id")
      .eq("company_id", companyId)
      .order("name");
    setLocations(data || []);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, name, customer_id")
      .eq("company_id", companyId)
      .order("name");
    setCustomers(data || []);
  };

  // Create customer options for SearchableSelect
  const customerOptions: SearchableSelectOption[] = useMemo(() => {
    return customers.map((cust) => ({
      value: cust.id,
      label: cust.name,
      sublabel: cust.customer_id,
    }));
  }, [customers]);

  // Create location options for SearchableSelect
  const locationOptions: SearchableSelectOption[] = useMemo(() => {
    return locations.map((loc) => ({
      value: loc.id,
      label: loc.name,
      sublabel: loc.location_id,
    }));
  }, [locations]);

  // Create product options for SearchableSelect
  const productOptions: SearchableSelectOption[] = useMemo(() => {
    return products.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `$${p.price?.toFixed(2) || "0.00"}`,
    }));
  }, [products]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, product_id, price, unit")
      .eq("company_id", companyId)
      .order("name");
    setProducts(data || []);
  };

  const fetchProductUoms = async () => {
    // Fetch product UOMs for all products in the company
    const { data: productIds } = await supabase.from("products").select("id").eq("company_id", companyId);

    if (productIds && productIds.length > 0) {
      const { data } = await supabase
        .from("product_uoms")
        .select("id, product_id, name, abbreviation, conversion_factor")
        .in(
          "product_id",
          productIds.map((p) => p.id),
        );
      setProductUoms(data || []);
    }
  };

  const fetchTaxRates = async () => {
    const { data } = await supabase
      .from("tax_rates")
      .select("id, name, rate, rate_type, is_default")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");
    setTaxRates(data || []);

    // Set default tax rate in selected rates
    const defaultRate = data?.find((r) => r.is_default);
    if (defaultRate) {
      setSelectedTaxRates([
        {
          tax_rate_id: defaultRate.id,
          name: defaultRate.name,
          rate: defaultRate.rate,
          rate_type: defaultRate.rate_type || "percent",
        },
      ]);
    }
  };

  const fetchLedgers = async () => {
    const { data } = await supabase
      .from("ledgers" as any)
      .select("id, name, location_id, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");
    setLedgers((data as any) || []);
  };

  // Fetch inventory for selected ship from location
  const fetchLocationInventory = async (locationId: string) => {
    const { data } = await supabase
      .from("inventory")
      .select(
        `
        id,
        product_id,
        quantity,
        bin_id,
        product:products(name, product_id),
        bin:bins(name, bin_id)
      `,
      )
      .eq("location_id", locationId)
      .gt("quantity", 0)
      .order("product_id");
    setLocationInventory((data as any) || []);
  };

  // Effect to fetch inventory when ship from location changes
  useEffect(() => {
    if (isCreateDialogOpen && formData.location_id) {
      const parsed = parseVendorValue(formData.location_id);
      if (parsed?.type === "location") {
        fetchLocationInventory(parsed.id);
      } else {
        setLocationInventory([]);
      }
    } else {
      setLocationInventory([]);
    }
  }, [isCreateDialogOpen, formData.location_id, parseVendorValue]);

  // Calculate availability for order items
  const itemAvailability = useMemo(() => {
    const availability: Record<string, { available: number; required: number; sufficient: boolean }> = {};

    // Aggregate inventory by product
    const inventoryByProduct: Record<string, number> = {};
    locationInventory.forEach((inv) => {
      inventoryByProduct[inv.product_id] = (inventoryByProduct[inv.product_id] || 0) + inv.quantity;
    });

    // Check each order item
    orderItems.forEach((item) => {
      if (item.product_id) {
        const available = inventoryByProduct[item.product_id] || 0;
        const existingRequired = availability[item.product_id]?.required || 0;
        availability[item.product_id] = {
          available,
          required: existingRequired + item.quantity,
          sufficient: available >= existingRequired + item.quantity,
        };
      }
    });

    return availability;
  }, [locationInventory, orderItems]);

  // Check if any order item has stock issues
  const hasStockIssue = useMemo(() => {
    return Object.values(itemAvailability).some((a) => !a.sufficient);
  }, [itemAvailability]);

  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Customer': '', 'Ship From Location': '', 'Bill To Location': '', 'Notes': '' },
    ];
    exportToExcel(templateData, 'sales_orders_template.xlsx', 'Sales Orders', [
      { header: 'Customer', key: 'Customer', width: 30 },
      { header: 'Ship From Location', key: 'Ship From Location', width: 25 },
      { header: 'Bill To Location', key: 'Bill To Location', width: 25 },
      { header: 'Notes', key: 'Notes', width: 40 },
    ]);
    toast.success('Template downloaded');
  };

  const handleExport = async () => {
    if (orders.length === 0) {
      toast.info('No sales orders to export');
      return;
    }
    const exportData = orders.map(o => ({
      'SO #': o.so_number,
      'Status': o.status,
      'Customer': o.customer?.name || '',
      'Ship From': o.location?.name || '',
      'Bill To': o.bill_to_location?.name || '',
      'Ledger': o.ledger?.name || '',
      'Subtotal': o.subtotal,
      'Tax': o.tax_amount,
      'Total': o.total_amount,
      'Order Date': o.order_date,
      'Expected Delivery': o.expected_delivery_date || '',
      'Notes': o.notes || '',
    }));
    await exportToExcel(exportData, 'sales_orders.xlsx', 'Sales Orders');
    toast.success('Sales orders exported');
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) {
        toast.error('No data found in file');
        return;
      }

      setImportTotalRows(rows.length);
      setImportProcessedRows(0);
      setImportResults([]);
      setImportComplete(false);
      setImportDialogOpen(true);

      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
          const customerName = row['Customer']?.toString().trim();
          if (!customerName) {
            results.push({ row: rowNum, status: 'error', message: 'Customer is required' });
            setImportResults([...results]);
            setImportProcessedRows(i + 1);
            continue;
          }

          // Find customer by name
          const customer = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
          if (!customer) {
            results.push({ row: rowNum, status: 'error', message: `Customer "${customerName}" not found` });
            setImportResults([...results]);
            setImportProcessedRows(i + 1);
            continue;
          }

          // Find optional location
          const shipFromName = row['Ship From Location']?.toString().trim();
          const shipFromLoc = shipFromName ? locations.find(l => l.name.toLowerCase() === shipFromName.toLowerCase()) : null;

          const billToName = row['Bill To Location']?.toString().trim();
          const billToLoc = billToName ? locations.find(l => l.name.toLowerCase() === billToName.toLowerCase()) : null;

          const { data: nextId } = await supabase.rpc('get_next_so_number', {
            p_company_id: companyId,
          });

          const { error: insertError } = await (supabase.from('sales_orders' as any) as any).insert({
            company_id: companyId!,
            so_number: nextId,
            customer_id: customer.id,
            location_id: shipFromLoc?.id || null,
            bill_to_location_id: billToLoc?.id || null,
            notes: row['Notes']?.toString().trim() || null,
            status: 'draft',
            order_date: new Date().toISOString().split('T')[0],
            subtotal: 0,
            tax_amount: 0,
            total_amount: 0,
          });

          if (insertError) throw insertError;

          results.push({ row: rowNum, status: 'success', message: `SO "${nextId}" created for ${customerName}` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed to import' });
        }

        setImportResults([...results]);
        setImportProcessedRows(i + 1);
      }

      setImportComplete(true);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to read file');
    }
  };

  const handleCreateClick = () => {
    const defaultRate = taxRates.find((r) => r.is_default);
    setFormData({ customer_id: "", location_id: "", bill_to_location_id: "", ledger_id: "", notes: "" });
    setOrderItems([]);
    setLocationInventory([]);
    setSelectedTaxRates(
      defaultRate
        ? [
            {
              tax_rate_id: defaultRate.id,
              name: defaultRate.name,
              rate: defaultRate.rate,
              rate_type: defaultRate.rate_type || "percent",
            },
          ]
        : [],
    );
    setIsCreateDialogOpen(true);
  };

  // Keyboard shortcut for creating new SO
  useKeyboardShortcut("n", handleCreateClick);
  useTransactionAction('new', handleCreateClick);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { product_id: "", quantity: 1, unit_price: 0, pu_id: null }]);
  };

  // Helper to get conversion factor for a UOM selection
  const getUomConversionFactor = (uomValue: string | null): number => {
    if (!uomValue || uomValue === "base") return 1;
    if (uomValue.startsWith("uom:")) {
      const uomId = uomValue.substring(4);
      const uom = productUoms.find((u) => u.id === uomId);
      return uom?.conversion_factor || 1;
    }
    return 1;
  };

  // Get UOM options for a product (base unit + product UOMs)
  const getUomOptions = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    const uoms = productUoms.filter((uom) => uom.product_id === productId);

    const options: { value: string; label: string }[] = [];

    // Add base unit first (use 'base' as value since Radix doesn't allow empty strings)
    if (product?.unit) {
      options.push({ value: "base", label: product.unit });
    } else {
      options.push({ value: "base", label: "EA" });
    }

    // Add product UOMs
    uoms.forEach((uom) => {
      const label = uom.abbreviation
        ? `${uom.name} (${uom.abbreviation}) - ${uom.conversion_factor}x`
        : `${uom.name} - ${uom.conversion_factor}x`;
      options.push({ value: `uom:${uom.id}`, label });
    });

    return options;
  };

  const updateOrderItem = (index: number, field: string, value: string | number | null) => {
    const newItems = [...orderItems];
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        product_id: value as string,
        unit_price: product?.price || 0,
        pu_id: null, // Reset UOM when product changes
      };
    } else if (field === "pu_id") {
      // 'base' represents the product's base unit (null in database)
      const uomValue = value === "base" ? null : (value as string | null);
      const product = products.find((p) => p.id === newItems[index].product_id);
      const basePrice = product?.price || 0;
      const conversionFactor = getUomConversionFactor(value as string);

      // Calculate unit price based on conversion factor
      const unitPrice = basePrice * conversionFactor;

      newItems[index] = {
        ...newItems[index],
        pu_id: uomValue,
        unit_price: unitPrice,
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value as string | number };
    }
    setOrderItems(newItems);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const calculateTotalTaxRate = () => {
    // Only sum percentage rates
    return selectedTaxRates.filter((r) => r.rate_type === "percent").reduce((sum, r) => sum + r.rate, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateTotal();
    let tax = 0;
    selectedTaxRates.forEach((r) => {
      if (r.rate_type === "flat") {
        tax += r.rate;
      } else {
        tax += subtotal * (r.rate / 100);
      }
    });
    return tax;
  };

  const calculateGrandTotal = () => {
    return calculateTotal() + calculateTax();
  };

  const addTaxRate = (taxRateId: string) => {
    const rate = taxRates.find((r) => r.id === taxRateId);
    if (rate && !selectedTaxRates.find((sr) => sr.tax_rate_id === taxRateId)) {
      setSelectedTaxRates([
        ...selectedTaxRates,
        { tax_rate_id: rate.id, name: rate.name, rate: rate.rate, rate_type: rate.rate_type || "percent" },
      ]);
    }
  };

  const removeTaxRate = (taxRateId: string) => {
    setSelectedTaxRates(selectedTaxRates.filter((r) => r.tax_rate_id !== taxRateId));
  };

  const availableTaxRates = taxRates.filter((r) => !selectedTaxRates.find((sr) => sr.tax_rate_id === r.id));

  const handleCreateOrder = async () => {
    if (!formData.customer_id) {
      toast.error("Please select a customer");
      return;
    }

    if (orderItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (orderItems.some((item) => !item.product_id)) {
      toast.error("Please select a product for all items");
      return;
    }

    // Check if ledgers exist
    if (ledgers.length === 0) {
      toast.error("Please create a ledger first before creating sales orders");
      return;
    }

    // Determine which ledger to use - prioritize explicit selection
    let selectedLedgerId: string | null = formData.ledger_id || null;

    if (!selectedLedgerId) {
      if (ledgers.length === 1) {
        selectedLedgerId = ledgers[0].id;
      } else if (formData.bill_to_location_id) {
        const locationLedger = ledgers.find((l) => l.location_id === formData.bill_to_location_id);
        if (locationLedger) {
          selectedLedgerId = locationLedger.id;
        } else {
          const generalLedger = ledgers.find((l) => !l.location_id);
          if (generalLedger) {
            selectedLedgerId = generalLedger.id;
          } else {
            toast.error("No ledger found for the selected bill-to location.");
            return;
          }
        }
      } else {
        const generalLedger = ledgers.find((l) => !l.location_id);
        if (generalLedger) {
          selectedLedgerId = generalLedger.id;
        } else {
          selectedLedgerId = ledgers[0].id;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // Get next SO number
      const { data: soNumber } = await supabase.rpc("get_next_so_number", {
        p_company_id: companyId,
      });

      const subtotal = calculateTotal();
      const taxAmount = calculateTax();
      const totalAmount = calculateGrandTotal();

      // Parse ship from value to extract actual ID
      const shipFromParsed = formData.location_id ? parseVendorValue(formData.location_id) : null;
      const shipFromLocationId = shipFromParsed?.type === "location" ? shipFromParsed.id : null;
      const shipFromVendorId = shipFromParsed?.type === "vendor" ? shipFromParsed.id : null;

      // Determine order status - backorder if no availability at ship from location
      const orderStatus = hasStockIssue && shipFromLocationId ? "backorder" : "draft";

      // Create sales order
      const { data: order, error: orderError } = await supabase
        .from("sales_orders" as any)
        .insert({
          company_id: companyId,
          so_number: soNumber,
          status: orderStatus,
          customer_id: formData.customer_id || null,
          location_id: shipFromLocationId,
          bill_to_location_id: formData.bill_to_location_id || null,
          ledger_id: selectedLedgerId,
          tax_rate_id: selectedTaxRates.length === 1 ? selectedTaxRates[0].tax_rate_id : null,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create sales order tax rates
      if (selectedTaxRates.length > 0) {
        const taxRatesToInsert = selectedTaxRates.map((sr) => ({
          sales_order_id: (order as any).id,
          tax_rate_id: sr.tax_rate_id,
          tax_amount: subtotal * (sr.rate / 100),
        }));

        const { error: taxError } = await supabase.from("sales_order_tax_rates" as any).insert(taxRatesToInsert);

        if (taxError) throw taxError;
      }

      // Note: Ledger transaction is created when the Goods Issue is posted

      // Create order items
      const itemsToInsert = orderItems.map((item) => ({
        sales_order_id: (order as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase.from("sales_order_items" as any).insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(`Sales Order ${soNumber} created`);
      setIsCreateDialogOpen(false);
      fetchOrders();
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error(error.message || "Failed to create sales order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewOrder = async (order: SalesOrder) => {
    setViewOrder(order);

    const { data: items } = await supabase
      .from("sales_order_items" as any)
      .select(
        `
        *,
        product:products(name, price, product_id)
      `,
      )
      .eq("sales_order_id", order.id);

    setViewItems((items as any) || []);

    // Fetch applied tax rates
    const { data: appliedTaxRates } = await supabase
      .from("sales_order_tax_rates" as any)
      .select(
        `
        tax_rate_id,
        tax_amount,
        tax_rate:tax_rates(name, rate, rate_type)
      `,
      )
      .eq("sales_order_id", order.id);

    setViewTaxRates((appliedTaxRates as any) || []);
    setIsEditingTaxRates(false);
    setIsViewDialogOpen(true);
  };

  const handleEditTaxRates = () => {
    setEditTaxRates(
      viewTaxRates.map((vt) => ({
        tax_rate_id: vt.tax_rate_id,
        name: vt.tax_rate.name,
        rate: vt.tax_rate.rate,
        rate_type: (vt.tax_rate as any).rate_type || "percent",
      })),
    );
    setIsEditingTaxRates(true);
  };

  const addEditTaxRate = (taxRateId: string) => {
    const rate = taxRates.find((r) => r.id === taxRateId);
    if (rate && !editTaxRates.find((er) => er.tax_rate_id === taxRateId)) {
      setEditTaxRates([
        ...editTaxRates,
        { tax_rate_id: rate.id, name: rate.name, rate: rate.rate, rate_type: rate.rate_type || "percent" },
      ]);
    }
  };

  const removeEditTaxRate = (taxRateId: string) => {
    setEditTaxRates(editTaxRates.filter((r) => r.tax_rate_id !== taxRateId));
  };

  const availableEditTaxRates = taxRates.filter((r) => !editTaxRates.find((er) => er.tax_rate_id === r.id));

  const handleSaveTaxRates = async () => {
    if (!viewOrder) return;
    setIsSubmitting(true);

    try {
      // Delete existing tax rates
      await supabase
        .from("sales_order_tax_rates" as any)
        .delete()
        .eq("sales_order_id", viewOrder.id);

      // Calculate new totals
      const subtotal = viewOrder.subtotal || 0;
      let taxAmount = 0;
      editTaxRates.forEach((r) => {
        if (r.rate_type === "flat") {
          taxAmount += r.rate;
        } else {
          taxAmount += subtotal * (r.rate / 100);
        }
      });
      const totalAmount = subtotal + taxAmount;

      // Insert new tax rates
      if (editTaxRates.length > 0) {
        const taxRatesToInsert = editTaxRates.map((er) => ({
          sales_order_id: viewOrder.id,
          tax_rate_id: er.tax_rate_id,
          tax_amount: er.rate_type === "flat" ? er.rate : subtotal * (er.rate / 100),
        }));

        await supabase.from("sales_order_tax_rates" as any).insert(taxRatesToInsert);
      }

      // Update SO totals
      await supabase
        .from("sales_orders" as any)
        .update({
          tax_rate_id: editTaxRates.length === 1 ? editTaxRates[0].tax_rate_id : null,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .eq("id", viewOrder.id);

      // Refresh view
      setViewTaxRates(
        editTaxRates.map((er) => ({
          tax_rate_id: er.tax_rate_id,
          tax_amount: er.rate_type === "flat" ? er.rate : subtotal * (er.rate / 100),
          tax_rate: { name: er.name, rate: er.rate, rate_type: er.rate_type },
        })),
      );
      setViewOrder({ ...viewOrder, tax_amount: taxAmount, total_amount: totalAmount });
      setIsEditingTaxRates(false);
      toast.success("Tax rates updated");
      fetchOrders();
    } catch (error: any) {
      toast.error("Failed to update tax rates");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("sales_orders" as any)
        .update({ status: newStatus })
        .eq("id", id);

      if (error) {
        toast.error("Failed to update status");
        return;
      }

      toast.success("Status updated");
      fetchOrders();

      if (viewOrder?.id === id) {
        setViewOrder({ ...viewOrder, status: newStatus });
      }
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleDeleteOrder = async (order: SalesOrder) => {
    // Check if status prevents deletion
    const restrictedStatuses = ["confirmed", "shipped", "delivered"];
    if (restrictedStatuses.includes(order.status)) {
      toast.error(`Cannot delete sales order with status "${order.status}"`);
      return;
    }

    // Check for linked outbound deliveries
    const { data: linkedDeliveries } = await supabase
      .from("outbound_deliveries")
      .select("delivery_number")
      .eq("sales_order_id", order.id)
      .limit(1);

    if (linkedDeliveries && linkedDeliveries.length > 0) {
      toast.error(`Cannot delete: Sales order is linked to outbound delivery ${linkedDeliveries[0].delivery_number}`);
      return;
    }

    // Check for linked goods issues
    const { data: linkedGoodsIssues } = await supabase
      .from("goods_issues")
      .select("issue_number")
      .eq("sales_order_id", order.id)
      .limit(1);

    if (linkedGoodsIssues && linkedGoodsIssues.length > 0) {
      toast.error(`Cannot delete: Sales order is linked to goods issue ${linkedGoodsIssues[0].issue_number}`);
      return;
    }

    // Check for linked invoices
    const { data: linkedInvoices } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("sales_order_id", order.id)
      .limit(1);

    if (linkedInvoices && linkedInvoices.length > 0) {
      toast.error(`Cannot delete: Sales order is linked to invoice ${linkedInvoices[0].invoice_number}`);
      return;
    }

    if (!confirm("Are you sure you want to delete this sales order?")) return;

    const { error } = await supabase
      .from("sales_orders" as any)
      .delete()
      .eq("id", order.id);

    if (error) {
      toast.error("Failed to delete sales order");
      return;
    }

    toast.success("Sales order deleted");
    fetchOrders();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ArrowLeft className="w-5 h-5" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <div className="flex items-center gap-3">
                <DollarSign className="w-7 h-7 text-emerald-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Sales Orders</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => setShowQueryDialog(true)} title="Search sales orders">
                <Search className="w-4 h-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">⌘F</Kbd>
              </Button>
              <ColumnToggle
                columns={SALES_ORDER_COLUMNS}
                visibleColumns={visibleColumns}
                onToggleColumn={toggleColumn}
                onResetToDefaults={resetToDefaults}
                onShowAll={showAll}
                onHideAll={hideAll}
              />
              <ImportExportButtons
                importEnabled={isImportEnabled('sales_order')}
                exportEnabled={isExportEnabled('sales_order')}
                onExport={handleExport}
                onImport={handleImport}
                onDownloadTemplate={handleDownloadTemplate}
                entityName="Sales Orders"
              />
              <Button onClick={handleCreateClick} variant="default" size="icon" className="relative">
                <Plus className="w-4 h-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <ImportProgressDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Importing Sales Orders"
        totalRows={importTotalRows}
        processedRows={importProcessedRows}
        results={importResults}
        isComplete={importComplete}
      />

      {/* Main content */}
      <main className="flex-1">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No sales orders yet</h3>
            <p className="text-muted-foreground mb-4">Create your first sales order to track customer orders</p>
            <Button onClick={handleCreateClick}>
              <Plus className="w-4 h-4 mr-2" />
              Create Sales Order
            </Button>
          </div>
        ) : (
          <SalesOrdersTable
            orders={orders}
            onViewOrder={handleViewOrder}
            onDeleteOrder={handleDeleteOrder}
            isColumnVisible={isColumnVisible}
          />
        )}
      </main>

      {/* Create SO Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent
          className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? "!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]" : "max-w-3xl max-h-[85vh]"}`}
        >
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader>
            <DialogTitle>Create Sales Order</DialogTitle>
            <DialogDescription>Create a new sales order for a customer</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pb-6">
            {/* Header Fields */}
            <div className="grid grid-cols-3 gap-4 pb-4 border-b px-6">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <SearchableSelect
                  options={customerOptions}
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  placeholder="Select customer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ship From</Label>
                <SearchableSelect
                  options={shipFromOptions}
                  value={formData.location_id}
                  onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                  placeholder="Select source"
                  allowClear
                  clearLabel="No source"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_to_location">Bill From</Label>
                <SearchableSelect
                  options={locationOptions}
                  value={formData.bill_to_location_id}
                  onValueChange={(value) => setFormData({ ...formData, bill_to_location_id: value })}
                  placeholder="Select location"
                  allowClear
                  clearLabel="No location (general ledger)"
                />
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="items" className="w-full px-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="rates">Rates</TabsTrigger>
                <TabsTrigger value="availability" className="relative">
                  Availability
                  {hasStockIssue && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      !
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="assignment">Assignment</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="items" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label>Order Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </Button>
                </div>

                {orderItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    No items added yet. Click "Add Item" to start.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">Product</TableHead>
                          <TableHead className="w-[15%]">UOM</TableHead>
                          <TableHead className="w-[12%] text-right">Qty</TableHead>
                          <TableHead className="w-[15%] text-right">Unit Price</TableHead>
                          <TableHead className="w-[13%] text-right">Total</TableHead>
                          <TableHead className="w-[5%]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => {
                          const uomOptions = item.product_id ? getUomOptions(item.product_id) : [];
                          return (
                            <TableRow key={index}>
                              <TableCell className="p-2">
                                <SearchableSelect
                                  options={productOptions}
                                  value={item.product_id}
                                  onValueChange={(value) => updateOrderItem(index, "product_id", value)}
                                  placeholder="Select product"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Select
                                  value={item.pu_id || "base"}
                                  onValueChange={(value) => updateOrderItem(index, "pu_id", value)}
                                  disabled={!item.product_id}
                                >
                                  <SelectTrigger className="h-10">
                                    <SelectValue placeholder="UOM" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {uomOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateOrderItem(index, "quantity", parseInt(e.target.value) || 1)}
                                  className="text-right"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.unit_price}
                                  onChange={(e) =>
                                    updateOrderItem(index, "unit_price", parseFloat(e.target.value) || 0)
                                  }
                                  className="text-right"
                                />
                              </TableCell>
                              <TableCell className="p-2 text-right font-mono">
                                ${(item.quantity * item.unit_price).toFixed(2)}
                              </TableCell>
                              <TableCell className="p-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeOrderItem(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="flex justify-end gap-8 text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-mono">${calculateTotal().toFixed(2)}</span>
                  </div>
                  {/* Percentage-based taxes */}
                  {selectedTaxRates
                    .filter((sr) => sr.rate_type === "percent")
                    .map((sr) => (
                      <div key={sr.tax_rate_id} className="flex justify-end gap-8 text-sm">
                        <span className="text-muted-foreground">
                          {sr.name} ({sr.rate}%):
                        </span>
                        <span className="font-mono">${((calculateTotal() * sr.rate) / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  {selectedTaxRates.filter((sr) => sr.rate_type === "percent").length === 0 && (
                    <div className="flex justify-end gap-8 text-sm">
                      <span className="text-muted-foreground">Tax:</span>
                      <span className="font-mono">$0.00</span>
                    </div>
                  )}
                  {/* Flat fees - shown after taxes */}
                  {selectedTaxRates
                    .filter((sr) => sr.rate_type === "flat")
                    .map((sr) => (
                      <div key={sr.tax_rate_id} className="flex justify-end gap-8 text-sm">
                        <span className="text-muted-foreground">{sr.name} (Fee):</span>
                        <span className="font-mono">${sr.rate.toFixed(2)}</span>
                      </div>
                    ))}
                  <div className="flex justify-end gap-8 text-base font-semibold">
                    <span>Total:</span>
                    <span className="font-mono">${calculateGrandTotal().toFixed(2)}</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="rates" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label>Tax Rates</Label>
                  {availableTaxRates.length > 0 && (
                    <Select onValueChange={addTaxRate}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Add tax rate" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTaxRates.map((rate) => (
                          <SelectItem key={rate.id} value={rate.id}>
                            {rate.name} ({rate.rate_type === "flat" ? `$${rate.rate.toFixed(2)}` : `${rate.rate}%`})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {selectedTaxRates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    No tax rates applied
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedTaxRates.map((sr) => (
                      <Badge key={sr.tax_rate_id} variant="secondary" className="flex items-center gap-1 py-1">
                        {sr.name} ({sr.rate_type === "flat" ? `$${sr.rate.toFixed(2)}` : `${sr.rate}%`})
                        <button
                          type="button"
                          onClick={() => removeTaxRate(sr.tax_rate_id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {selectedTaxRates.some((r) => r.rate_type === "percent") && (
                  <div className="text-sm text-muted-foreground">
                    Combined percentage rate: {calculateTotalTaxRate().toFixed(2)}%
                  </div>
                )}
              </TabsContent>

              <TabsContent value="availability" className="space-y-4 mt-4">
                {!formData.location_id ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    Select a "Ship From" location to view inventory availability
                  </p>
                ) : parseVendorValue(formData.location_id)?.type !== "location" ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    Inventory availability is only shown for location sources
                  </p>
                ) : orderItems.length === 0 || orderItems.every((i) => !i.product_id) ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    Add items to see their availability
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Required</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(itemAvailability).map(([productId, availability]) => {
                        const product = products.find((p) => p.id === productId);
                        return (
                          <TableRow key={productId}>
                            <TableCell>
                              <div>
                                <span className="font-medium">{product?.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">{product?.product_id}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">{availability.required}</TableCell>
                            <TableCell className="text-right font-mono">{availability.available}</TableCell>
                            <TableCell className="text-right">
                              {availability.sufficient ? (
                                <Badge variant="default" className="bg-primary text-primary-foreground">
                                  <Check className="w-3 h-3 mr-1" />
                                  In Stock
                                </Badge>
                              ) : availability.available > 0 ? (
                                <Badge variant="secondary" className="bg-accent text-accent-foreground">
                                  Partial ({availability.available})
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <X className="w-3 h-3 mr-1" />
                                  Out of Stock
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="assignment" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <Label>Ledger Assignment</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select the ledger to record this sales order transaction. The transaction will be recorded as a
                    positive amount (revenue).
                  </p>
                  <SearchableSelect
                    options={ledgers.map((l) => ({
                      value: l.id,
                      label: l.name,
                      sublabel: l.location_id ? locations.find((loc) => loc.id === l.location_id)?.name : "General",
                    }))}
                    value={formData.ledger_id}
                    onValueChange={(value) => setFormData({ ...formData, ledger_id: value })}
                    placeholder="Auto-select based on Bill From location"
                    allowClear
                    clearLabel="Auto-select"
                  />
                  {formData.ledger_id && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <span className="text-muted-foreground">Transaction amount: </span>
                      <span className="font-mono text-green-600">+${calculateGrandTotal().toFixed(2)}</span>
                    </div>
                  )}
                  {!formData.ledger_id && formData.bill_to_location_id && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <span className="text-muted-foreground">Will use ledger for: </span>
                      <span>
                        {locations.find((l) => l.id === formData.bill_to_location_id)?.name || "Bill From location"}
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Order Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any notes or special instructions for this order..."
                    rows={6}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button onClick={handleCreateOrder} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Order
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent
          className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? "!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]" : "max-w-3xl max-h-[85vh]"}`}
        >
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader>
            <DialogTitle>Sales Order {viewOrder?.so_number}</DialogTitle>
            <DialogDescription>View order details and update status</DialogDescription>
          </DialogHeader>

          {viewOrder && (
            <div className="flex-1 overflow-y-auto space-y-4 px-6 pb-6">
              {/* Header Fields */}
              <div className="grid grid-cols-4 gap-4 pb-4 border-b">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Select value={viewOrder.status} onValueChange={(value) => handleUpdateStatus(viewOrder.id, value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  {viewOrder.customer ? (
                    <button
                      type="button"
                      onClick={() => setDetailView({ type: "customer", data: viewOrder.customer })}
                      className="mt-1 font-medium text-primary hover:underline text-left"
                    >
                      {viewOrder.customer.customer_id} - {viewOrder.customer.name}
                    </button>
                  ) : (
                    <p className="mt-1 font-medium">-</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Ship From</Label>
                  {viewOrder.location ? (
                    <button
                      type="button"
                      onClick={() => setDetailView({ type: "location", data: viewOrder.location })}
                      className="mt-1 text-primary hover:underline text-left"
                    >
                      {viewOrder.location.location_id} - {viewOrder.location.name}
                    </button>
                  ) : (
                    <p className="mt-1">-</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Bill From</Label>
                  {viewOrder.bill_to_location ? (
                    <button
                      type="button"
                      onClick={() => setDetailView({ type: "location", data: viewOrder.bill_to_location })}
                      className="mt-1 text-primary hover:underline text-left"
                    >
                      {viewOrder.bill_to_location.location_id} - {viewOrder.bill_to_location.name}
                    </button>
                  ) : (
                    <p className="mt-1">-</p>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="items">Items</TabsTrigger>
                  <TabsTrigger value="rates">Rates</TabsTrigger>
                  <TabsTrigger value="assignment">Assignment</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-1">
                    <History className="w-3.5 h-3.5" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="space-y-4 mt-4">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product?.name || "Unknown"}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right font-mono">
                              ${Number(item.unit_price || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${Number(item.total_price || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Totals */}
                  <div className="border-t pt-4">
                    <div className="flex justify-end gap-8 text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono">${Number(viewOrder.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {/* Percentage-based taxes */}
                    {viewTaxRates
                      .filter((vt) => (vt.tax_rate as any).rate_type !== "flat")
                      .map((vt) => (
                        <div key={vt.tax_rate_id} className="flex justify-end gap-8 text-sm">
                          <span className="text-muted-foreground">
                            {vt.tax_rate.name} ({vt.tax_rate.rate}%):
                          </span>
                          <span className="font-mono">${Number(vt.tax_amount || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    {viewTaxRates.filter((vt) => (vt.tax_rate as any).rate_type !== "flat").length === 0 && (
                      <div className="flex justify-end gap-8 text-sm">
                        <span className="text-muted-foreground">Tax:</span>
                        <span className="font-mono">$0.00</span>
                      </div>
                    )}
                    {/* Flat fees - shown after taxes */}
                    {viewTaxRates
                      .filter((vt) => (vt.tax_rate as any).rate_type === "flat")
                      .map((vt) => (
                        <div key={vt.tax_rate_id} className="flex justify-end gap-8 text-sm">
                          <span className="text-muted-foreground">{vt.tax_rate.name} (Fee):</span>
                          <span className="font-mono">${Number(vt.tax_amount || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    <div className="flex justify-end gap-8 text-base font-semibold">
                      <span>Total:</span>
                      <span className="font-mono">${Number(viewOrder.total_amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rates" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label>Tax Rates</Label>
                    {!isEditingTaxRates && (
                      <Button variant="ghost" size="sm" onClick={handleEditTaxRates}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {isEditingTaxRates ? (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Edit Tax Rates</span>
                        {availableEditTaxRates.length > 0 && (
                          <Select onValueChange={addEditTaxRate}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Add tax rate" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableEditTaxRates.map((rate) => (
                                <SelectItem key={rate.id} value={rate.id}>
                                  {rate.name} (
                                  {rate.rate_type === "flat" ? `$${rate.rate.toFixed(2)}` : `${rate.rate}%`})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {editTaxRates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tax rates</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {editTaxRates.map((er) => (
                            <Badge key={er.tax_rate_id} variant="secondary" className="flex items-center gap-1 py-1">
                              {er.name} ({er.rate_type === "flat" ? `$${er.rate.toFixed(2)}` : `${er.rate}%`})
                              <button
                                type="button"
                                onClick={() => removeEditTaxRate(er.tax_rate_id)}
                                className="ml-1 hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingTaxRates(false)}>
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveTaxRates} disabled={isSubmitting}>
                          {isSubmitting ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : viewTaxRates.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewTaxRates.map((vt) => (
                        <Badge key={vt.tax_rate_id} variant="outline">
                          {vt.tax_rate.name} (
                          {(vt.tax_rate as any).rate_type === "flat"
                            ? `$${vt.tax_rate.rate.toFixed(2)}`
                            : `${vt.tax_rate.rate}%`}
                          )
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                      No tax rates applied
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="assignment" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      <Label>Ledger Assignment</Label>
                    </div>
                    <div className="p-4 border rounded-lg space-y-3">
                      <div>
                        <Label className="text-muted-foreground text-xs">Assigned Ledger</Label>
                        <p className="font-medium">{viewOrder.ledger?.name || "Not assigned"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Transaction Amount</Label>
                        <p className="font-mono text-green-600">+${Number(viewOrder.total_amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Order Notes</Label>
                    {viewOrder.notes ? (
                      <p className="text-sm p-3 bg-muted rounded-lg">{viewOrder.notes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                        No notes for this order
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Order Date</Label>
                    <p className="text-sm">{new Date(viewOrder.order_date).toLocaleDateString()}</p>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <AuditHistoryTab
                    tableName="sales_orders"
                    recordId={viewOrder.id}
                    fieldLabels={{
                      status: "Status",
                      customer_id: "Customer",
                      location_id: "Ship From",
                      bill_to_location_id: "Bill From",
                      ledger_id: "Ledger",
                      total_amount: "Total Amount",
                      subtotal: "Subtotal",
                      tax_amount: "Tax Amount",
                      notes: "Notes",
                      order_date: "Order Date",
                      expected_delivery_date: "Expected Delivery",
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Detail View Dialog (Customer/Location) */}
      <Dialog open={!!detailView} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailView?.type === "customer" ? "Customer Details" : "Location Details"}</DialogTitle>
          </DialogHeader>
          {detailView?.type === "customer" && detailView.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Customer ID</Label>
                  <p className="font-mono text-sm">{detailView.data.customer_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{detailView.data.name}</p>
                </div>
              </div>
              {detailView.data.email && (
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="text-sm">{detailView.data.email}</p>
                </div>
              )}
              {detailView.data.phone && (
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p className="text-sm">{detailView.data.phone}</p>
                </div>
              )}
              {detailView.data.address_line1 && (
                <div>
                  <Label className="text-muted-foreground text-xs">Address</Label>
                  <p className="text-sm">
                    {detailView.data.address_line1}
                    {detailView.data.city && `, ${detailView.data.city}`}
                    {detailView.data.state && `, ${detailView.data.state}`}
                    {detailView.data.postal_code && ` ${detailView.data.postal_code}`}
                  </p>
                </div>
              )}
            </div>
          )}
          {detailView?.type === "location" && detailView.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Location ID</Label>
                  <p className="font-mono text-sm">{detailView.data.location_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{detailView.data.name}</p>
                </div>
              </div>
              {detailView.data.address_line1 && (
                <div>
                  <Label className="text-muted-foreground text-xs">Address</Label>
                  <p className="text-sm">
                    {detailView.data.address_line1}
                    {detailView.data.city && `, ${detailView.data.city}`}
                    {detailView.data.state && `, ${detailView.data.state}`}
                    {detailView.data.postal_code && ` ${detailView.data.postal_code}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AppLoadQueryDialog
        open={showQueryDialog}
        onClose={() => setShowQueryDialog(false)}
        onQuery={handleQueryDialogQuery}
        onLoadAll={handleQueryDialogLoadAll}
        fields={SALES_ORDER_QUERY_FIELDS}
        title="Load Sales Orders"
        loading={queryLoading}
      />
    </div>
  );
};

// Separate table component for sorting/filtering
function SalesOrdersTable({
  orders,
  onViewOrder,
  onDeleteOrder,
  isColumnVisible,
}: {
  orders: SalesOrder[];
  onViewOrder: (order: SalesOrder) => void;
  onDeleteOrder: (order: SalesOrder) => void;
  isColumnVisible: (key: string) => boolean;
}) {
  const { sortConfig, filters, handleSort, setFilter, clearAllFilters, sortedAndFilteredData } = useTableSort(
    orders,
    "so_number",
    "desc",
  );

  const hasFilters = Object.values(filters).some((v) => v);

  return (
    <div className="space-y-0">
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {Object.entries(filters).map(([key, value]) =>
            value ? (
              <Badge key={key} variant="secondary">
                {key}: {value}
              </Badge>
            ) : null,
          )}
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear all
          </Button>
        </div>
      )}
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isColumnVisible("so_number") && (
                <SortableTableHead
                  label="SO #"
                  sortKey="so_number"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["so_number"]}
                  onFilter={(v) => setFilter("so_number", v)}
                />
              )}
              {isColumnVisible("status") && (
                <SortableTableHead
                  label="Status"
                  sortKey="status"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["status"]}
                  onFilter={(v) => setFilter("status", v)}
                />
              )}
              {isColumnVisible("customer") && (
                <SortableTableHead
                  label="Customer"
                  sortKey="customer.name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["customer.name"]}
                  onFilter={(v) => setFilter("customer.name", v)}
                />
              )}
              {isColumnVisible("location") && (
                <SortableTableHead
                  label="Ship From"
                  sortKey="location.name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["location.name"]}
                  onFilter={(v) => setFilter("location.name", v)}
                />
              )}
              {isColumnVisible("total_amount") && (
                <SortableTableHead
                  label="Total"
                  sortKey="total_amount"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                />
              )}
              {isColumnVisible("order_date") && (
                <SortableTableHead
                  label="Date"
                  sortKey="order_date"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                />
              )}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((order) => (
              <TableRow key={order.id}>
                {isColumnVisible("so_number") && (
                  <TableCell className="font-mono text-sm">
                    <button
                      onClick={() => onViewOrder(order)}
                      className="text-primary hover:underline focus:outline-none"
                    >
                      {order.so_number}
                    </button>
                  </TableCell>
                )}
                {isColumnVisible("status") && (
                  <TableCell>
                    <Badge className={`${statusColors[order.status] || "bg-gray-500"} text-white`}>
                      {order.status}
                    </Badge>
                  </TableCell>
                )}
                {isColumnVisible("customer") && <TableCell>{order.customer?.name || "-"}</TableCell>}
                {isColumnVisible("location") && <TableCell>{order.location?.name || "-"}</TableCell>}
                {isColumnVisible("total_amount") && (
                  <TableCell className="font-mono">${Number(order.total_amount || 0).toFixed(2)}</TableCell>
                )}
                {isColumnVisible("order_date") && (
                  <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewOrder(order)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewOrder(order)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        {!["confirmed", "shipped", "delivered"].includes(order.status) && (
                          <DropdownMenuItem onClick={() => onDeleteOrder(order)} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default SalesOrders;
