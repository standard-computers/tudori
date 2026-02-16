import { useEffect, useState, useRef, useMemo } from "react";
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/use-column-visibility";
import { ColumnToggle } from "@/components/ColumnToggle";
import { useVendorSources } from "@/hooks/use-vendor-sources";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { useExcel } from "@/hooks/use-excel";
import { ImportExportButtons } from "@/components/ImportExportButtons";
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
  ShoppingCart,
  Plus,
  Eye,
  Loader2,
  MoreHorizontal,
  Trash2,
  Pencil,
  Check,
  X,
  BookOpen,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Minimize2,
  Package,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from '@/lib/toast';
import { DeliveryItemsDialog } from "@/components/DeliveryItemsDialog";
import { AuditHistoryTab } from "@/components/AuditHistoryTab";
import { useReduceAppLoad } from "@/hooks/use-reduce-app-load";
import { AppLoadQueryDialog, QueryField } from "@/components/AppLoadQueryDialog";
import { ImportProgressDialog, ImportResult } from "@/components/ImportProgressDialog";

const ORDER_QUERY_FIELDS: QueryField[] = [
  { key: "po_number", label: "PO #", placeholder: "Search by PO number..." },
  { key: "status", label: "Status", placeholder: "e.g. draft, confirmed..." },
  { key: "vendor", label: "Vendor", placeholder: "Search by vendor name..." },
  { key: "order_date", label: "Order Date", type: "date" },
];
import jsPDF from "jspdf";

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

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  vendor_id: string | null;
  source_location_id: string | null;
  location_id: string | null;
  bill_to_location_id: string | null;
  ledger_id: string | null;
  requisition_id: string | null;
  tax_rate_id: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  created_at: string;
  created_by: string | null;
  vendor?: { name: string; vendor_id: string } | null;
  source_location?: { name: string; location_id: string } | null;
  location?: { name: string; location_id: string } | null;
  bill_to_location?: { name: string; location_id: string } | null;
  ledger?: { name: string } | null;
  requisition?: { requisition_id: string } | null;
  tax_rate?: { name: string; rate: number } | null;
  applied_tax_rates?: { tax_rate_id: string; tax_amount: number; tax_rate: { name: string; rate: number } }[];
  creator?: { first_name: string; last_name: string } | null;
}

interface PurchaseOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  product?: {
    name: string;
    product_id: string;
    price: number | null;
    sku: string | null;
    description: string | null;
    category: string | null;
    unit: string | null;
    vendor_id: string | null;
  };
}

interface DetailProduct {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  price: number | null;
  unit: string | null;
  vendor_id: string | null;
  vendor?: { name: string } | null;
}

interface Location {
  id: string;
  name: string;
  location_id: string;
  type?: string;
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface Vendor {
  id: string;
  name: string;
  vendor_id: string;
  type?: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  website?: string | null;
  notes?: string | null;
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
  vendor_id: string | null;
  status: string;
  unit: string | null;
  transport_time_days: number | null;
  manufacture_time_days: number | null;
  lead_time_days: number | null;
}

interface PackagingUnit {
  id: string;
  pu_number: string;
  quantity: number;
  product_id: string;
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
  location_id: string;
  quantity: number;
  bin_id: string | null;
  product?: { name: string; product_id: string };
  bin?: { name: string } | null;
}

interface Assignment {
  id: string;
  vendor_id: string | null;
  source_location_id: string | null;
  destination_location_id: string;
  is_active: boolean;
}

// Helper function to calculate expected delivery date based on product lead times
const calculateExpectedDelivery = (product: Product | undefined): string => {
  const today = new Date();
  let totalLeadDays = 0;

  if (product) {
    totalLeadDays =
      (product.transport_time_days || 0) + (product.manufacture_time_days || 0) + (product.lead_time_days || 0);
  }

  // If no lead time defined or sum is 0, use tomorrow
  if (totalLeadDays === 0) {
    totalLeadDays = 1;
  }

  const expectedDate = new Date(today);
  expectedDate.setDate(today.getDate() + totalLeadDays);

  return expectedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const statusColors: Record<string, string> = {
  draft: "bg-slate-500",
  pending: "bg-yellow-500",
  sent: "bg-blue-500",
  confirmed: "bg-indigo-500",
  shipped: "bg-purple-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  backorder: "bg-orange-500",
};

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string | null;
}

// Column definitions for Purchase Orders table
const ORDER_COLUMNS: ColumnDefinition[] = [
  { key: "po_number", label: "PO #", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "vendor", label: "Vendor", defaultVisible: true },
  { key: "ship_to", label: "Ship To", defaultVisible: true },
  { key: "bill_to", label: "Bill To", defaultVisible: true },
  { key: "total_amount", label: "Total", defaultVisible: true },
  { key: "order_date", label: "Date", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

const Orders = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const { exportToExcel } = useExcel();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { reduceAppLoad, loading: reduceAppLoadLoading } = useReduceAppLoad();
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);

  // Use vendor sources hook for combined vendors + DC/warehouse locations
  const { vendorOptions, plainVendorOptions, parseVendorValue, getVendorDisplayName } = useVendorSources(companyId);

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);

  // Delivery items selection dialog state
  const [isDeliveryItemsDialogOpen, setIsDeliveryItemsDialogOpen] = useState(false);
  const [pendingConfirmOrderId, setPendingConfirmOrderId] = useState<string | null>(null);

  // Nested detail dialog states
  const [isVendorDetailOpen, setIsVendorDetailOpen] = useState(false);
  const [isLocationDetailOpen, setIsLocationDetailOpen] = useState(false);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  const [detailLocation, setDetailLocation] = useState<Location | null>(null);
  const [detailLocationLabel, setDetailLocationLabel] = useState<string>("");
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);

  // Product detail dialog state
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<DetailProduct | null>(null);

  // Multi-select state for bulk actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Bulk status update state
  const [bulkConfirmOrderIndex, setBulkConfirmOrderIndex] = useState(0);
  const [bulkConfirmOrderIds, setBulkConfirmOrderIds] = useState<string[]>([]);
  const [isAutoConfirming, setIsAutoConfirming] = useState(false);

  // Auto-confirm progress dialog state
  const [autoConfirmProgressOpen, setAutoConfirmProgressOpen] = useState(false);
  const [autoConfirmTotal, setAutoConfirmTotal] = useState(0);
  const [autoConfirmProcessed, setAutoConfirmProcessed] = useState(0);
  const [autoConfirmResults, setAutoConfirmResults] = useState<ImportResult[]>([]);
  const [autoConfirmComplete, setAutoConfirmComplete] = useState(false);

  // Set transaction based on dialog state
  useEffect(() => {
    if (isCreateDialogOpen) {
      setTransaction(isEditMode ? "ord/edit" : "ord/new");
    } else if (isViewDialogOpen) {
      setTransaction("ord/view");
    } else {
      setTransaction("ord");
    }
  }, [isCreateDialogOpen, isViewDialogOpen, isEditMode, setTransaction]);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isCreateDialogOpen && !isSubmitting) {
      handleSaveOrder();
    }
  }, isCreateDialogOpen);

  // View dialog state
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [viewItems, setViewItems] = useState<PurchaseOrderItem[]>([]);
  const [viewInvoice, setViewInvoice] = useState<{ invoice_number: string; id: string } | null>(null);
  const [viewGoodsReceipts, setViewGoodsReceipts] = useState<{ receipt_number: string; id: string; status: string }[]>(
    [],
  );

  // Create dialog form state
  const [formData, setFormData] = useState({
    vendor_id: "",
    location_id: "",
    bill_to_location_id: "",
    ledger_id: "",
    notes: "",
  });
  const [orderItems, setOrderItems] = useState<
    { product_id: string; quantity: number; unit_price: number; pu_id: string | null }[]
  >([]);
  const [packagingUnits, setPackagingUnits] = useState<PackagingUnit[]>([]);
  const [productUoms, setProductUoms] = useState<ProductUom[]>([]);
  const [selectedTaxRates, setSelectedTaxRates] = useState<SelectedTaxRate[]>([]);
  const [viewTaxRates, setViewTaxRates] = useState<
    { tax_rate_id: string; tax_amount: number; tax_rate: { name: string; rate: number } }[]
  >([]);

  // BOM import state
  const [isBomImportOpen, setIsBomImportOpen] = useState(false);
  const [bomImportId, setBomImportId] = useState("");
  const [bomImportQty, setBomImportQty] = useState("1");
  const [isBomImporting, setIsBomImporting] = useState(false);
  const [isValidationPopoverOpen, setIsValidationPopoverOpen] = useState(false);
  const [isEditingTaxRates, setIsEditingTaxRates] = useState(false);
  const [editTaxRates, setEditTaxRates] = useState<SelectedTaxRate[]>([]);

  // Availability tab state
  const [locationInventory, setLocationInventory] = useState<InventoryRecord[]>([]);

  // Route enforcement state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [enforceRouteRecords, setEnforceRouteRecords] = useState(false);
  const [routeFilteredVendors, setRouteFilteredVendors] = useState<string[] | null>(null);

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
      fetchProducts();
      fetchPackagingUnits();
      fetchProductUoms();
      fetchTaxRates();
      fetchLedgers();
      fetchAllVendors();
      fetchAssignments();
      fetchRouteEnforcementSetting();
    }
  }, [companyId, reduceAppLoad, reduceAppLoadLoading]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);

      // Also fetch company details for logo
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name, logo_url, address_line1, city, state, postal_code, country, phone")
        .eq("id", profile.company_id)
        .single();

      if (companyData) {
        setCompany(companyData);
      }
    }
    setLoading(false);
  };

  const fetchOrders = async (filters?: Record<string, string>) => {
    let query = supabase
      .from("purchase_orders")
      .select(
        `
        *,
        vendor:vendors(name, vendor_id),
        source_location:locations!purchase_orders_source_location_id_fkey(name, location_id),
        location:locations!purchase_orders_location_id_fkey(name, location_id),
         bill_to_location:locations!purchase_orders_bill_to_location_id_fkey(name, location_id),
        ledger:ledgers(name),
        requisition:requisitions(requisition_id),
        tax_rate:tax_rates(name, rate)
      `,
      )
      .eq("company_id", companyId);

    if (filters?.po_number) query = query.ilike("po_number", `%${filters.po_number}%`);
    if (filters?.status) query = query.ilike("status", `%${filters.status}%`);
    if (filters?.order_date) query = query.eq("order_date", filters.order_date);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load purchase orders");
      return;
    }

    // Fetch creator profiles for orders with created_by
    let ordersData = data || [];

    // Client-side filter for vendor name (joined table)
    if (filters?.vendor) {
      const term = filters.vendor.toLowerCase();
      ordersData = ordersData.filter((o) => o.vendor?.name?.toLowerCase().includes(term));
    }

    const createdByIds = [...new Set(ordersData.filter((o) => o.created_by).map((o) => o.created_by))] as string[];

    if (createdByIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", createdByIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, { first_name: p.first_name, last_name: p.last_name }]) || [],
      );

      const ordersWithCreator = ordersData.map((order) => ({
        ...order,
        creator: order.created_by ? profileMap.get(order.created_by) || null : null,
      }));

      setOrders(ordersWithCreator);
    } else {
      setOrders(ordersData.map((o) => ({ ...o, creator: null })));
    }
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
      .select("id, name, location_id, type, address_line1, address_line2, city, state, postal_code, country")
      .eq("company_id", companyId)
      .order("name");
    setLocations(data || []);
  };

  const fetchAllVendors = async () => {
    const { data } = await supabase
      .from("vendors")
      .select(
        "id, vendor_id, name, type, contact_name, email, phone, address_line1, address_line2, city, state, postal_code, country, website, notes",
      )
      .eq("company_id", companyId)
      .order("name");
    setAllVendors(data || []);
  };

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
      .select(
        "id, name, product_id, price, vendor_id, status, unit, transport_time_days, manufacture_time_days, lead_time_days",
      )
      .eq("company_id", companyId)
      .eq("status", "active") // Only fetch active products for purchase orders
      .order("name");
    setProducts(data || []);
  };

  const fetchPackagingUnits = async () => {
    const { data } = await supabase
      .from("packaging_units")
      .select("id, pu_number, quantity, product_id")
      .eq("company_id", companyId);
    setPackagingUnits(data || []);
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

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from("assignments")
      .select("id, vendor_id, source_location_id, destination_location_id, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true);
    setAssignments(data || []);
  };

  const fetchRouteEnforcementSetting = async () => {
    const { data } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("company_id", companyId)
      .eq("setting_key", "process_controls")
      .maybeSingle();

    if (data?.setting_value && typeof data.setting_value === "object" && !Array.isArray(data.setting_value)) {
      const val = data.setting_value as Record<string, unknown>;
      setEnforceRouteRecords((val.enforce_route_records as boolean) ?? false);
    }
  };

  // Fetch inventory for availability check (source location for internal transfers, Ship To for external)
  const fetchLocationInventory = async (locationId: string) => {
    if (!locationId) {
      setLocationInventory([]);
      return;
    }

    const { data } = await supabase
      .from("inventory")
      .select(
        `
        id,
        product_id,
        location_id,
        quantity,
        bin_id,
        product:products(name, product_id),
        bin:bins(name)
      `,
      )
      .eq("location_id", locationId);

    setLocationInventory((data as InventoryRecord[]) || []);
  };

  // Determine the location to check for availability
  // For internal transfers: check source location (the internal vendor)
  // For external vendors: check Ship To location (existing stock)
  const availabilityLocationId = useMemo(() => {
    const parsed = parseVendorValue(formData.vendor_id);
    if (parsed?.type === "location") {
      // Internal transfer - check source location (where items ship FROM)
      return parsed.id;
    }
    // External vendor - check Ship To location (existing stock there)
    return formData.location_id;
  }, [formData.vendor_id, formData.location_id, parseVendorValue]);

  // Get display name for the availability check location
  const availabilityLocationName = useMemo(() => {
    const parsed = parseVendorValue(formData.vendor_id);
    if (parsed?.type === "location") {
      return getVendorDisplayName(formData.vendor_id);
    }
    return locations.find((l) => l.id === formData.location_id)?.name || "";
  }, [formData.vendor_id, formData.location_id, parseVendorValue, getVendorDisplayName, locations]);

  // Is this an internal transfer?
  const isInternalTransfer = useMemo(() => {
    const parsed = parseVendorValue(formData.vendor_id);
    return parsed?.type === "location";
  }, [formData.vendor_id, parseVendorValue]);

  // Fetch inventory when availability location changes
  useEffect(() => {
    if (isCreateDialogOpen && availabilityLocationId) {
      fetchLocationInventory(availabilityLocationId);
    } else {
      setLocationInventory([]);
    }
  }, [isCreateDialogOpen, availabilityLocationId]);

  // Calculate item availability for Availability tab
  const itemAvailability = useMemo(() => {
    const availability: Record<string, { available: number; required: number; sufficient: boolean }> = {};

    // Aggregate inventory by product
    const inventoryByProduct: Record<string, number> = {};
    locationInventory.forEach((inv) => {
      inventoryByProduct[inv.product_id] = (inventoryByProduct[inv.product_id] || 0) + inv.quantity;
    });

    // Calculate for each order item
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

  // Check if any item has stock issues
  const hasStockIssue = useMemo(() => {
    return Object.values(itemAvailability).some((a) => !a.sufficient);
  }, [itemAvailability]);

  // Helper to open vendor detail dialog
  const openVendorDetail = (vendorId: string | null) => {
    if (!vendorId) return;
    const vendor = allVendors.find((v) => v.id === vendorId);
    if (vendor) {
      setDetailVendor(vendor);
      setIsVendorDetailOpen(true);
    }
  };

  // Helper to open location detail dialog
  const openLocationDetail = (locationId: string | null, label: string) => {
    if (!locationId) return;
    const location = locations.find((l) => l.id === locationId);
    if (location) {
      setDetailLocation(location);
      setDetailLocationLabel(label);
      setIsLocationDetailOpen(true);
    }
  };

  // Helper to open product detail dialog
  const openProductDetail = async (item: PurchaseOrderItem) => {
    if (!item.product) return;

    // Fetch vendor name if vendor_id exists
    let vendorData: { name: string } | null = null;
    if (item.product.vendor_id) {
      const vendor = allVendors.find((v) => v.id === item.product?.vendor_id);
      vendorData = vendor ? { name: vendor.name } : null;
    }

    setDetailProduct({
      id: item.product_id,
      product_id: item.product.product_id,
      name: item.product.name,
      sku: item.product.sku,
      description: item.product.description,
      category: item.product.category,
      price: item.product.price,
      unit: item.product.unit,
      vendor_id: item.product.vendor_id,
      vendor: vendorData,
    });
    setIsProductDetailOpen(true);
  };

  // Download PO as XLSX
  const handleDownloadXlsx = async () => {
    if (!viewOrder || viewItems.length === 0) return;

    const data = viewItems.map((item, index) => ({
      "Line #": index + 1,
      "Product ID": item.product?.product_id || "",
      "Product Name": item.product?.name || "Unknown",
      Quantity: item.quantity,
      "Unit Price": Number(item.unit_price || 0).toFixed(2),
      Total: Number(item.total_price || 0).toFixed(2),
    }));

    // Add summary rows
    data.push({
      "Line #": "",
      "Product ID": "",
      "Product Name": "",
      Quantity: "",
      "Unit Price": "Subtotal:",
      Total: Number(viewOrder.subtotal || 0).toFixed(2),
    } as any);

    // Add percentage-based taxes
    const percentTaxes = viewTaxRates.filter((vt) => (vt.tax_rate as any).rate_type !== "flat");
    const flatFees = viewTaxRates.filter((vt) => (vt.tax_rate as any).rate_type === "flat");

    if (percentTaxes.length > 0) {
      percentTaxes.forEach((vt) => {
        data.push({
          "Line #": "",
          "Product ID": "",
          "Product Name": "",
          Quantity: "",
          "Unit Price": `${vt.tax_rate.name} (${vt.tax_rate.rate}%):`,
          Total: Number(vt.tax_amount || 0).toFixed(2),
        } as any);
      });
    }

    // Add flat fees after taxes
    if (flatFees.length > 0) {
      flatFees.forEach((vt) => {
        data.push({
          "Line #": "",
          "Product ID": "",
          "Product Name": "",
          Quantity: "",
          "Unit Price": `${vt.tax_rate.name} (Fee):`,
          Total: Number(vt.tax_amount || 0).toFixed(2),
        } as any);
      });
    }

    data.push({
      "Line #": "",
      "Product ID": "",
      "Product Name": "",
      Quantity: "",
      "Unit Price": "Total:",
      Total: Number(viewOrder.total_amount || 0).toFixed(2),
    } as any);

    await exportToExcel(data, `PO_${viewOrder.po_number}.xlsx`, "Purchase Order");
    toast.success("Downloaded as XLSX");
  };

  // Download PO as PDF
  const handleDownloadPdf = async () => {
    if (!viewOrder || viewItems.length === 0) return;

    const doc = new jsPDF();
    let yPos = 20;
    const leftMargin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Add company logo if available
    if (company?.logo_url) {
      try {
        const response = await fetch(company.logo_url);
        const blob = await response.blob();
        const reader = new FileReader();

        await new Promise<void>((resolve) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            doc.addImage(base64data, "PNG", leftMargin, yPos, 40, 20);
            resolve();
          };
          reader.readAsDataURL(blob);
        });

        yPos += 25;
      } catch (error) {
        console.error("Failed to load company logo:", error);
      }
    }

    // Company name
    if (company?.name) {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(company.name, leftMargin, yPos);
      yPos += 6;
    }

    // Company address
    if (company?.address_line1) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(company.address_line1, leftMargin, yPos);
      yPos += 4;
      doc.text(`${company.city}, ${company.state} ${company.postal_code}`, leftMargin, yPos);
      yPos += 4;
      if (company.phone) {
        doc.text(company.phone, leftMargin, yPos);
        yPos += 4;
      }
    }

    yPos += 6;

    // PO Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PURCHASE ORDER", pageWidth - leftMargin, 25, { align: "right" });

    doc.setFontSize(12);
    doc.text(viewOrder.po_number, pageWidth - leftMargin, 33, { align: "right" });

    // Order date (use created_at as the PO date)
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date(viewOrder.created_at).toLocaleDateString()}`, pageWidth - leftMargin, 40, {
      align: "right",
    });

    yPos = Math.max(yPos, 50);

    // Helper to render an address block
    const renderAddressBlock = (
      label: string,
      name: string,
      address: { address_line1?: string | null; address_line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null } | null,
      xStart: number,
    ) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(label, xStart, yPos);
      const blockStartY = yPos;
      let localY = yPos + 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(name, xStart, localY);
      localY += 4;
      if (address?.address_line1) {
        doc.text(address.address_line1, xStart, localY);
        localY += 4;
      }
      if (address?.address_line2) {
        doc.text(address.address_line2, xStart, localY);
        localY += 4;
      }
      const cityLine = [address?.city, address?.state, address?.postal_code].filter(Boolean).join(", ");
      if (cityLine) {
        doc.text(cityLine, xStart, localY);
        localY += 4;
      }
      if (address?.country) {
        doc.text(address.country, xStart, localY);
        localY += 4;
      }
      return localY;
    };

    // Layout: Vendor on left, Ship To in center, Bill To on right
    const colWidth = (pageWidth - leftMargin * 2) / 3;
    const savedY = yPos;
    let maxY = yPos;

    // Vendor info
    if (viewOrder.vendor) {
      const vendorDetail = allVendors.find((v) => v.id === viewOrder.vendor_id);
      const endY = renderAddressBlock("Vendor:", viewOrder.vendor.name, vendorDetail || null, leftMargin);
      maxY = Math.max(maxY, endY);
    }

    // Ship To
    if (viewOrder.location) {
      yPos = savedY;
      const shipDetail = locations.find((l) => l.id === viewOrder.location_id);
      const endY = renderAddressBlock("Ship To:", viewOrder.location.name, shipDetail || null, leftMargin + colWidth);
      maxY = Math.max(maxY, endY);
    }

    // Bill To
    if (viewOrder.bill_to_location) {
      yPos = savedY;
      const billDetail = locations.find((l) => l.id === viewOrder.bill_to_location_id);
      const endY = renderAddressBlock("Bill To:", viewOrder.bill_to_location.name, billDetail || null, leftMargin + colWidth * 2);
      maxY = Math.max(maxY, endY);
    }

    yPos = maxY + 2;

    yPos += 10;

    // Table header
    const colWidths = [15, 35, 55, 20, 25, 25];
    const tableHeaders = ["#", "Item ID", "Product", "Qty", "Unit Price", "Total"];

    doc.setFillColor(240, 240, 240);
    doc.rect(leftMargin, yPos - 4, pageWidth - leftMargin * 2, 8, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    let xPos = leftMargin;
    tableHeaders.forEach((header, i) => {
      doc.text(header, xPos + 2, yPos);
      xPos += colWidths[i];
    });

    yPos += 8;

    // Table rows
    doc.setFont("helvetica", "normal");
    viewItems.forEach((item, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      xPos = leftMargin;
      doc.text(String(index + 1), xPos + 2, yPos);
      xPos += colWidths[0];
      doc.text(item.product?.product_id || "-", xPos + 2, yPos);
      xPos += colWidths[1];
      const productName = item.product?.name || "Unknown";
      doc.text(productName.substring(0, 30), xPos + 2, yPos);
      xPos += colWidths[2];
      doc.text(String(item.quantity), xPos + 2, yPos);
      xPos += colWidths[3];
      doc.text(`$${Number(item.unit_price || 0).toFixed(2)}`, xPos + 2, yPos);
      xPos += colWidths[4];
      doc.text(`$${Number(item.total_price || 0).toFixed(2)}`, xPos + 2, yPos);

      yPos += 6;
    });

    // Separator line
    yPos += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(leftMargin, yPos, pageWidth - leftMargin, yPos);
    yPos += 8;

    // Totals
    const totalsX = pageWidth - 70;

    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", totalsX, yPos);
    doc.text(`$${Number(viewOrder.subtotal || 0).toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" });
    yPos += 6;

    viewTaxRates.forEach((vt) => {
      const rateDisplay =
        (vt.tax_rate as any).rate_type === "flat" ? `$${vt.tax_rate.rate.toFixed(2)}` : `${vt.tax_rate.rate}%`;
      doc.text(`${vt.tax_rate.name} (${rateDisplay}):`, totalsX, yPos);
      doc.text(`$${Number(vt.tax_amount || 0).toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" });
      yPos += 6;
    });

    doc.setFont("helvetica", "bold");
    doc.text("Total:", totalsX, yPos);
    doc.text(`$${Number(viewOrder.total_amount || 0).toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" });

    // Notes
    if (viewOrder.notes) {
      yPos += 15;
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", leftMargin, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const splitNotes = doc.splitTextToSize(viewOrder.notes, pageWidth - leftMargin * 2);
      doc.text(splitNotes, leftMargin, yPos);
    }

    doc.save(`PO_${viewOrder.po_number}.pdf`);
    toast.success("Downloaded as PDF");
  };

  const handleExportOrders = async () => {
    if (orders.length === 0) {
      toast.info("No purchase orders to export");
      return;
    }
    const exportData = orders.map((o) => ({
      "PO #": o.po_number,
      "Status": o.status,
      "Vendor": o.vendor?.name || o.source_location?.name || "",
      "Vendor ID": o.vendor?.vendor_id || o.source_location?.location_id || "",
      "Ship To": o.location?.name || "",
      "Bill To": o.bill_to_location?.name || "",
      "Subtotal": o.subtotal,
      "Tax": o.tax_amount,
      "Total": o.total_amount,
      "Order Date": o.order_date,
      "Expected Delivery": o.expected_delivery_date || "",
      "Notes": o.notes || "",
    }));
    await exportToExcel(exportData, `purchase_orders_export_${new Date().toISOString().split("T")[0]}.xlsx`, "Purchase Orders");
    toast.success("Purchase orders exported successfully");
  };

  const handleCreateClick = () => {
    const defaultRate = taxRates.find((r) => r.is_default);
    setFormData({ vendor_id: "", location_id: "", bill_to_location_id: "", ledger_id: "", notes: "" });
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
    setIsEditMode(false);
    setEditOrderId(null);
    setIsCreateDialogOpen(true);
  };

  const handleEditOrder = async (order: PurchaseOrder) => {
    // Fetch order items
    const { data: items } = await supabase
      .from("purchase_order_items")
      .select(
        `
        *,
        product:products(name, product_id, price, sku, description, category, unit, vendor_id)
      `,
      )
      .eq("purchase_order_id", order.id);

    // Fetch applied tax rates
    const { data: appliedTaxRates } = await supabase
      .from("purchase_order_tax_rates")
      .select(
        `
        tax_rate_id,
        tax_amount,
        tax_rate:tax_rates(name, rate, rate_type)
      `,
      )
      .eq("purchase_order_id", order.id);

    // Determine vendor value format (vendor:id or location:id)
    let vendorValue = "";
    if (order.vendor_id) {
      vendorValue = `vendor:${order.vendor_id}`;
    } else if (order.source_location_id) {
      vendorValue = `location:${order.source_location_id}`;
    }

    // Set form data
    setFormData({
      vendor_id: vendorValue,
      location_id: order.location_id || "",
      bill_to_location_id: order.bill_to_location_id || "",
      ledger_id: order.ledger_id || "",
      notes: order.notes || "",
    });

    // Set order items
    setOrderItems(
      (items || []).map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        pu_id: item.pu_id || null,
      })),
    );

    // Set tax rates
    setSelectedTaxRates(
      (appliedTaxRates || []).map((tr: any) => ({
        tax_rate_id: tr.tax_rate_id,
        name: tr.tax_rate.name,
        rate: tr.tax_rate.rate,
        rate_type: tr.tax_rate.rate_type || "percent",
      })),
    );

    setLocationInventory([]);
    setIsEditMode(true);
    setEditOrderId(order.id);
    setIsCreateDialogOpen(true);
  };

  // Keyboard shortcut for creating new PO
  useKeyboardShortcut("n", handleCreateClick);
  useTransactionAction('new', handleCreateClick);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { product_id: "", quantity: 1, unit_price: 0, pu_id: null }]);
  };

  // Import components from a Bill of Materials
  const handleBomImport = async () => {
    if (!bomImportId.trim()) return;

    setIsBomImporting(true);
    try {
      // Find the BOM by its bom_id
      const { data: bom, error: bomError } = await supabase
        .from("bill_of_materials")
        .select("id, bom_id, name")
        .eq("bom_id", bomImportId.trim())
        .eq("company_id", companyId)
        .single();

      if (bomError || !bom) {
        toast.error(`BOM "${bomImportId}" not found`);
        setIsBomImporting(false);
        return;
      }

      // Fetch the BOM items (components)
      const { data: bomItems, error: itemsError } = await supabase
        .from("bom_items")
        .select(
          `
           id,
           product_id,
           quantity,
           product:products(id, name, product_id, price)
         `,
        )
        .eq("bom_id", bom.id);

      if (itemsError || !bomItems || bomItems.length === 0) {
        toast.error(`No components found in BOM "${bomImportId}"`);
        setIsBomImporting(false);
        return;
      }

      const multiplier = parseInt(bomImportQty) || 1;

      // Create order items from BOM components
      const newItems = bomItems.map((item) => {
        const product = item.product as any;
        return {
          product_id: item.product_id,
          quantity: item.quantity * multiplier,
          unit_price: product?.price || 0,
          pu_id: null,
        };
      });

      // Add to existing order items
      setOrderItems([...orderItems, ...newItems]);

      toast.success(`Imported ${newItems.length} component(s) from ${bom.bom_id} (x${multiplier})`);

      // Reset and close
      setBomImportId("");
      setBomImportQty("1");
      setIsBomImportOpen(false);
    } catch (error) {
      console.error("BOM import error:", error);
      toast.error("Failed to import BOM components");
    } finally {
      setIsBomImporting(false);
    }
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

      // Calculate unit price based on conversion factor (e.g., Bag of 250 = 250 * base price)
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
    if (!formData.vendor_id) {
      toast.error("Please select a vendor");
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
      toast.error("Please create a ledger first before creating purchase orders");
      return;
    }

    // Parse vendor value to extract actual UUID (handles 'vendor:uuid' or 'location:uuid' format)
    const parsedVendor = parseVendorValue(formData.vendor_id);
    const actualVendorId = parsedVendor?.type === "vendor" ? parsedVendor.id : null;
    const sourceLocationId = parsedVendor?.type === "location" ? parsedVendor.id : null;

    // Determine which ledger to use - prioritize explicit selection
    let selectedLedgerId: string | null = formData.ledger_id || null;

    if (!selectedLedgerId) {
      if (ledgers.length === 1) {
        // If only one ledger, use it automatically
        selectedLedgerId = ledgers[0].id;
      } else if (formData.bill_to_location_id) {
        // Find ledger for the bill-to location
        const locationLedger = ledgers.find((l) => l.location_id === formData.bill_to_location_id);
        if (locationLedger) {
          selectedLedgerId = locationLedger.id;
        } else {
          // Find a general ledger (no location)
          const generalLedger = ledgers.find((l) => !l.location_id);
          if (generalLedger) {
            selectedLedgerId = generalLedger.id;
          } else {
            toast.error(
              "No ledger found for the selected bill-to location. Please create a ledger for this location or select a different location.",
            );
            return;
          }
        }
      } else {
        // No bill-to location, use general ledger
        const generalLedger = ledgers.find((l) => !l.location_id);
        if (generalLedger) {
          selectedLedgerId = generalLedger.id;
        } else {
          selectedLedgerId = ledgers[0].id; // Fall back to first ledger
        }
      }
    }

    setIsSubmitting(true);

    try {
      // Get next PO number (uses document_id_config for prefix/formatting)
      const { data: poNumber, error: poNumError } = await supabase.rpc("get_next_po_number", {
        p_company_id: companyId,
      });

      if (poNumError) throw poNumError;

      const subtotal = calculateTotal();
      const taxAmount = calculateTax();
      const totalAmount = calculateGrandTotal();

      // Determine order status - backorder if no availability for internal transfers
      const orderStatus = hasStockIssue && sourceLocationId ? "backorder" : "draft";

      // Create purchase order - ensure empty strings become null for UUID fields
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: companyId!,
          po_number: poNumber,
          status: orderStatus,
          vendor_id: actualVendorId,
          source_location_id: sourceLocationId,
          location_id: formData.location_id || null,
          bill_to_location_id: formData.bill_to_location_id || null,
          ledger_id: selectedLedgerId,
          tax_rate_id: selectedTaxRates.length === 1 ? selectedTaxRates[0].tax_rate_id : null,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: formData.notes || null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create purchase order tax rates
      if (selectedTaxRates.length > 0) {
        const taxRatesToInsert = selectedTaxRates.map((sr) => ({
          purchase_order_id: order.id,
          tax_rate_id: sr.tax_rate_id,
          tax_amount: subtotal * (sr.rate / 100),
        }));

        const { error: taxError } = await supabase.from("purchase_order_tax_rates").insert(taxRatesToInsert);

        if (taxError) throw taxError;
      }

      // Note: Ledger transaction is created when the Goods Receipt is posted

      // Create order items
      const itemsToInsert = orderItems.map((item) => ({
        purchase_order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        pu_id: item.pu_id || null,
      }));

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(`Purchase Order ${poNumber} created`);
      setIsCreateDialogOpen(false);
      fetchOrders();
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error(error.message || "Failed to create purchase order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrder = async () => {
    if (!editOrderId) return;

    if (!formData.vendor_id) {
      toast.error("Please select a vendor");
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

    // Parse vendor value to extract actual UUID
    const parsedVendor = parseVendorValue(formData.vendor_id);
    const actualVendorId = parsedVendor?.type === "vendor" ? parsedVendor.id : null;
    const sourceLocationId = parsedVendor?.type === "location" ? parsedVendor.id : null;

    setIsSubmitting(true);

    try {
      const subtotal = calculateTotal();
      const taxAmount = calculateTax();
      const totalAmount = calculateGrandTotal();

      // Update purchase order
      const { error: orderError } = await supabase
        .from("purchase_orders")
        .update({
          vendor_id: actualVendorId,
          source_location_id: sourceLocationId,
          location_id: formData.location_id || null,
          bill_to_location_id: formData.bill_to_location_id || null,
          ledger_id: formData.ledger_id || null,
          tax_rate_id: selectedTaxRates.length === 1 ? selectedTaxRates[0].tax_rate_id : null,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: formData.notes || null,
        })
        .eq("id", editOrderId);

      if (orderError) throw orderError;

      // Delete existing tax rates and items
      await supabase.from("purchase_order_tax_rates").delete().eq("purchase_order_id", editOrderId);
      await supabase.from("purchase_order_items").delete().eq("purchase_order_id", editOrderId);

      // Re-create tax rates
      if (selectedTaxRates.length > 0) {
        const taxRatesToInsert = selectedTaxRates.map((sr) => ({
          purchase_order_id: editOrderId,
          tax_rate_id: sr.tax_rate_id,
          tax_amount: sr.rate_type === "flat" ? sr.rate : subtotal * (sr.rate / 100),
        }));

        const { error: taxError } = await supabase.from("purchase_order_tax_rates").insert(taxRatesToInsert);

        if (taxError) throw taxError;
      }

      // Re-create order items
      const itemsToInsert = orderItems.map((item) => ({
        purchase_order_id: editOrderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        pu_id: item.pu_id || null,
      }));

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Purchase Order updated");
      setIsCreateDialogOpen(false);
      setIsEditMode(false);
      setEditOrderId(null);
      fetchOrders();
    } catch (error: any) {
      console.error("Error updating order:", error);
      toast.error(error.message || "Failed to update purchase order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveOrder = () => {
    if (isEditMode) {
      handleUpdateOrder();
    } else {
      handleCreateOrder();
    }
  };

  const handleViewOrder = async (order: PurchaseOrder) => {
    setViewOrder(order);

    const { data: items } = await supabase
      .from("purchase_order_items")
      .select(
        `
        *,
        product:products(name, product_id, price, sku, description, category, unit, vendor_id)
      `,
      )
      .eq("purchase_order_id", order.id);

    setViewItems(items || []);

    // Fetch applied tax rates
    const { data: appliedTaxRates } = await supabase
      .from("purchase_order_tax_rates")
      .select(
        `
        tax_rate_id,
        tax_amount,
        tax_rate:tax_rates(name, rate)
      `,
      )
      .eq("purchase_order_id", order.id);

    setViewTaxRates((appliedTaxRates as any) || []);

    // Fetch associated invoice
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount")
      .eq("purchase_order_id", order.id)
      .maybeSingle();

    setViewInvoice(invoice);

    // Fetch associated goods receipts
    const { data: goodsReceipts } = await supabase
      .from("goods_receipts" as any)
      .select("id, receipt_number, status")
      .eq("purchase_order_id", order.id);

    setViewGoodsReceipts((goodsReceipts as any) || []);
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
      await supabase.from("purchase_order_tax_rates").delete().eq("purchase_order_id", viewOrder.id);

      // Calculate new totals
      const subtotal = viewOrder.subtotal || 0;
      const totalTaxRate = editTaxRates.reduce((sum, r) => sum + r.rate, 0);
      const taxAmount = subtotal * (totalTaxRate / 100);
      const totalAmount = subtotal + taxAmount;

      // Insert new tax rates
      if (editTaxRates.length > 0) {
        const taxRatesToInsert = editTaxRates.map((er) => ({
          purchase_order_id: viewOrder.id,
          tax_rate_id: er.tax_rate_id,
          tax_amount: subtotal * (er.rate / 100),
        }));

        await supabase.from("purchase_order_tax_rates").insert(taxRatesToInsert);
      }

      // Update PO totals
      await supabase
        .from("purchase_orders")
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
          tax_amount: subtotal * (er.rate / 100),
          tax_rate: { name: er.name, rate: er.rate },
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
      // Get the order to check current status and get details
      const order = orders.find((o) => o.id === id);
      if (!order) return;

      // Fetch automation settings
      const { data: settingsData } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "po_automation")
        .maybeSingle();

      const settings =
        settingsData?.setting_value &&
        typeof settingsData.setting_value === "object" &&
        !Array.isArray(settingsData.setting_value)
          ? (settingsData.setting_value as Record<string, unknown>)
          : null;

      const autoCreateDelivery = settings?.auto_create_delivery_on_confirmed ?? true;

      // If changing to confirmed and auto-create is enabled, show item selection dialog
      if (newStatus === "confirmed" && autoCreateDelivery) {
        setPendingConfirmOrderId(id);
        setIsDeliveryItemsDialogOpen(true);
        return;
      }

      // For other status changes, proceed normally
      await executeStatusUpdate(id, newStatus);
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const executeStatusUpdate = async (
    id: string,
    newStatus: string,
    deliveryItems?: { product_id: string; quantity: number }[],
  ) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;

    // Fetch automation settings
    const { data: settingsData } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("company_id", companyId)
      .eq("setting_key", "po_automation")
      .maybeSingle();

    const settings =
      settingsData?.setting_value &&
      typeof settingsData.setting_value === "object" &&
      !Array.isArray(settingsData.setting_value)
        ? (settingsData.setting_value as Record<string, unknown>)
        : null;

    const autoCreateDelivery = settings?.auto_create_delivery_on_confirmed ?? true;
    const autoMarkShipped = settings?.auto_mark_delivery_shipped ?? true;
    const autoMarkDelivered = settings?.auto_mark_delivery_delivered ?? true;

    // Update the PO status
    const { error } = await supabase.from("purchase_orders").update({ status: newStatus }).eq("id", id);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    // Auto-create delivery when status changes to 'confirmed'
    if (newStatus === "confirmed" && autoCreateDelivery) {
      const isInternalTransfer = !!order.source_location_id;

      if (isInternalTransfer) {
        // Internal transfer: create an outbound delivery from the source location
        const { data: deliveryNumber } = await supabase.rpc("get_next_outbound_delivery_number", {
          p_company_id: companyId,
        });

        const { data: outboundData, error: outboundError } = await supabase
          .from("outbound_deliveries" as any)
          .insert({
            company_id: companyId,
            delivery_number: deliveryNumber,
            purchase_order_id: id,
            from_location_id: order.source_location_id,
            to_location_id: order.location_id,
            status: "pending",
            notes: `Auto-created from PO ${order.po_number} (Internal Transfer)`,
          })
          .select("id")
          .single();

        if (outboundError) {
          console.error("Failed to create outbound delivery:", outboundError);
          toast.error("Failed to create outbound delivery");
        } else {
          toast.success(`Outbound Delivery ${deliveryNumber} created with ${deliveryItems?.length || 0} items`);
        }
      } else {
        // External vendor: create a regular inbound delivery
        const { data: deliveryId } = await supabase.rpc("get_next_delivery_id", {
          p_company_id: companyId,
        });

        const { data: deliveryData, error: deliveryError } = await supabase
          .from("deliveries")
          .insert({
            company_id: companyId,
            delivery_id: deliveryId,
            purchase_order_id: id,
            vendor_id: order.vendor_id,
            location_id: order.location_id,
            status: "pending",
            expected_date: order.expected_delivery_date,
            notes: `Auto-created from PO ${order.po_number}`,
          })
          .select("id")
          .single();

        if (!deliveryError && deliveryData && deliveryItems && deliveryItems.length > 0) {
          const itemsToInsert = deliveryItems.map((item) => ({
            delivery_id: deliveryData.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));

          await supabase.from("delivery_items").insert(itemsToInsert);
        }

        toast.success(`Delivery ${deliveryId} created with ${deliveryItems?.length || 0} items`);
      }
    }

    // Auto-mark delivery as shipped when PO is marked shipped
    if (newStatus === "shipped" && autoMarkShipped) {
      if (order.source_location_id) {
        // Internal transfer: update outbound delivery
        await supabase.from("outbound_deliveries" as any).update({ status: "in_transit", shipped_date: new Date().toISOString().split("T")[0] }).eq("purchase_order_id", id);
      } else {
        await supabase.from("deliveries").update({ status: "shipped" }).eq("purchase_order_id", id);
      }
    }

    // Auto-mark delivery as delivered when PO is marked delivered
    if (newStatus === "delivered" && autoMarkDelivered) {
      if (order.source_location_id) {
        // Internal transfer: update outbound delivery
        await supabase.from("outbound_deliveries" as any).update({
          status: "delivered",
          delivered_date: new Date().toISOString().split("T")[0],
        }).eq("purchase_order_id", id);
      } else {
        await supabase
          .from("deliveries")
          .update({
            status: "delivered",
            delivered_date: new Date().toISOString().split("T")[0],
          })
          .eq("purchase_order_id", id);
      }
    }

    // Mark associated purchase requisition as completed when PO is delivered
    if (newStatus === "delivered" && order.requisition_id) {
      await supabase.from("requisitions").update({ status: "completed" }).eq("id", order.requisition_id);
    }

    toast.success("Status updated");
    // Don't fetchOrders during bulk confirm or auto-confirm - let the handler manage it
    if (bulkConfirmOrderIds.length === 0 && !isAutoConfirming) {
      fetchOrders();
    }

    if (viewOrder?.id === id) {
      setViewOrder({ ...viewOrder, status: newStatus });
    }
  };

  const handleDeliveryItemsConfirm = async (items: { product_id: string; quantity: number }[]) => {
    if (pendingConfirmOrderId) {
      await executeStatusUpdate(pendingConfirmOrderId, "confirmed", items);

      // Check if we're in bulk mode
      if (bulkConfirmOrderIds.length > 0) {
        const nextIndex = bulkConfirmOrderIndex + 1;
        if (nextIndex < bulkConfirmOrderIds.length) {
          // Close dialog first, then reopen for next order after a delay
          setIsDeliveryItemsDialogOpen(false);
          setPendingConfirmOrderId(null);
          setBulkConfirmOrderIndex(nextIndex);
          // Use a longer delay and ensure state settles before reopening
          await new Promise(resolve => setTimeout(resolve, 500));
          const nextOrderId = bulkConfirmOrderIds[nextIndex];
          setPendingConfirmOrderId(nextOrderId);
          // Re-check if auto-create is needed (it should be since we're in this flow)
          setIsDeliveryItemsDialogOpen(true);
        } else {
          // All done with bulk
          const totalCount = bulkConfirmOrderIds.length;
          setBulkConfirmOrderIds([]);
          setBulkConfirmOrderIndex(0);
          setSelectedOrderIds(new Set());
          setPendingConfirmOrderId(null);
          setIsDeliveryItemsDialogOpen(false);
          toast.success(`Updated ${totalCount} order(s) to confirmed`);
          fetchOrders();
        }
      } else {
        setPendingConfirmOrderId(null);
        setIsDeliveryItemsDialogOpen(false);
        fetchOrders();
      }
    }
  };

  const handleDeleteOrder = async (id: string) => {
    // Check for associated deliveries
    const { data: deliveries } = await supabase.from("deliveries").select("id, status").eq("purchase_order_id", id);

    // Check if any delivery is already delivered
    const deliveredDelivery = deliveries?.find((d) => d.status === "delivered");
    if (deliveredDelivery) {
      toast.error("Cannot delete PO - associated delivery has been delivered");
      return;
    }

    if (
      !confirm("Are you sure you want to delete this purchase order? Any associated deliveries will also be deleted.")
    )
      return;

    // Delete associated non-delivered deliveries first
    if (deliveries && deliveries.length > 0) {
      const { error: deliveryError } = await supabase.from("deliveries").delete().eq("purchase_order_id", id);

      if (deliveryError) {
        toast.error("Failed to delete associated deliveries");
        return;
      }
    }

    const { error } = await supabase.from("purchase_orders").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete purchase order");
      return;
    }

    toast.success("Purchase order deleted");
    fetchOrders();
  };

  // Auto-confirm: confirm selected POs that have no deliveries, with full quantities
  const handleAutoConfirm = async () => {
    if (isAutoConfirming) return;
    const selectedIds = Array.from(selectedOrderIds);
    if (selectedIds.length === 0) return;

    setIsAutoConfirming(true);
    // Reset progress state
    setAutoConfirmResults([]);
    setAutoConfirmProcessed(0);
    setAutoConfirmComplete(false);

    try {
      // Filter to only draft/pending/sent from the selection
      const candidateIds = selectedIds.filter((id) => {
        const o = orders.find((order) => order.id === id);
        return o && ["draft", "pending", "sent"].includes(o.status);
      });

      if (candidateIds.length === 0) {
        toast.info("No selected orders eligible for auto-confirm");
        setIsAutoConfirming(false);
        return;
      }

      // Find which ones have no deliveries
      const [{ data: inbound }, { data: outbound }] = await Promise.all([
        supabase.from("deliveries").select("purchase_order_id").in("purchase_order_id", candidateIds),
        supabase.from("outbound_deliveries" as any).select("purchase_order_id").in("purchase_order_id", candidateIds),
      ]);
      const hasDelivery = new Set([
        ...(inbound || []).map((d: any) => d.purchase_order_id),
        ...(outbound || []).map((d: any) => d.purchase_order_id),
      ]);
      const eligibleIds = candidateIds.filter((id) => !hasDelivery.has(id));

      if (eligibleIds.length === 0) {
        toast.info("All selected orders already have deliveries");
        setIsAutoConfirming(false);
        return;
      }

      // Open progress dialog
      setAutoConfirmTotal(eligibleIds.length);
      setAutoConfirmProgressOpen(true);

      let confirmed = 0;
      for (const orderId of eligibleIds) {
        const order = orders.find((o) => o.id === orderId);
        const poLabel = order?.po_number || orderId.slice(0, 8);
        try {
          const { data: poItems } = await supabase
            .from("purchase_order_items")
            .select("product_id, quantity")
            .eq("purchase_order_id", orderId);

          const deliveryItems = (poItems || []).map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          }));

          await executeStatusUpdate(orderId, "confirmed", deliveryItems.length > 0 ? deliveryItems : undefined);
          confirmed++;
          setAutoConfirmResults((prev) => [...prev, { row: confirmed, status: 'success' as const, message: `${poLabel} confirmed` }]);
        } catch (err: any) {
          confirmed++;
          setAutoConfirmResults((prev) => [...prev, { row: confirmed, status: 'error' as const, message: `${poLabel}: ${err?.message || 'Failed'}` }]);
        }
        setAutoConfirmProcessed((prev) => prev + 1);
      }

      setAutoConfirmComplete(true);
      toast.success(`Auto-confirmed ${eligibleIds.length} order(s)`);
      setSelectedOrderIds(new Set());
      fetchOrders();
    } catch (error: any) {
      console.error("Error auto-confirming:", error);
      toast.error("Failed to auto-confirm orders");
      setAutoConfirmComplete(true);
    } finally {
      setIsAutoConfirming(false);
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async (newStatus: string) => {
    const selectedIds = Array.from(selectedOrderIds);

    if (selectedIds.length === 0) return;

    // If setting to 'confirmed', we need to process each one with the delivery flow
    if (newStatus === "confirmed") {
      // Store the list and start processing them one by one
      setBulkConfirmOrderIds(selectedIds);
      setBulkConfirmOrderIndex(0);
      // Trigger the first one
      handleUpdateStatus(selectedIds[0], "confirmed");
      return;
    }

    // For other statuses, batch update directly
    try {
      const { error } = await supabase.from("purchase_orders").update({ status: newStatus }).in("id", selectedIds);

      if (error) {
        toast.error("Failed to update status");
        return;
      }

      toast.success(`Updated ${selectedIds.length} order(s) to ${newStatus}`);
      setSelectedOrderIds(new Set());
      fetchOrders();
    } catch (error: any) {
      console.error("Error bulk updating status:", error);
      toast.error("Failed to update orders");
    }
  };

  // Handle the next bulk confirm order after delivery dialog closes
  const handleBulkDeliveryComplete = () => {
    setIsDeliveryItemsDialogOpen(false);
    setPendingConfirmOrderId(null);

    // If we're in bulk mode, process next
    if (bulkConfirmOrderIds.length > 0) {
      const nextIndex = bulkConfirmOrderIndex + 1;
      if (nextIndex < bulkConfirmOrderIds.length) {
        setBulkConfirmOrderIndex(nextIndex);
        // Small delay to let UI update
        setTimeout(() => {
          handleUpdateStatus(bulkConfirmOrderIds[nextIndex], "confirmed");
        }, 300);
      } else {
        // All done
        setBulkConfirmOrderIds([]);
        setBulkConfirmOrderIndex(0);
        setSelectedOrderIds(new Set());
        toast.success(`Updated ${bulkConfirmOrderIds.length} order(s) to confirmed`);
      }
    }

    fetchOrders();
  };

  // Filter products by selected vendor (handle new vendor:id format)
  const filteredProducts = useMemo(() => {
    if (!formData.vendor_id) return products;
    const parsed = parseVendorValue(formData.vendor_id);
    if (parsed?.type === "vendor") {
      return products.filter((p) => p.vendor_id === parsed.id);
    }
    // For location-based vendors (DC/warehouse), show all products
    return products;
  }, [formData.vendor_id, products, parseVendorValue]);

  // Create filtered product options for SearchableSelect
  const filteredProductOptions: SearchableSelectOption[] = useMemo(() => {
    return filteredProducts.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `$${p.price?.toFixed(2) || "0.00"}`,
    }));
  }, [filteredProducts]);

  // Compute valid vendor options based on route enforcement
  const routeValidVendorOptions = useMemo(() => {
    // If route enforcement is disabled or no ship-to selected, return all vendor options
    if (!enforceRouteRecords || !formData.location_id) {
      return vendorOptions;
    }

    const shipToLocationId = formData.location_id;
    const assignmentsForShipTo = assignments.filter((a) => a.destination_location_id === shipToLocationId);

    // If no assignments exist for this ship-to, return all vendor options (will show warning)
    if (assignmentsForShipTo.length === 0) {
      return vendorOptions;
    }

    // Filter vendor options to only those in route records
    const validVendorIds = new Set<string>();
    const validLocationIds = new Set<string>();

    assignmentsForShipTo.forEach((a) => {
      if (a.vendor_id) validVendorIds.add(a.vendor_id);
      if (a.source_location_id) validLocationIds.add(a.source_location_id);
    });

    return vendorOptions.filter((opt) => {
      const parsed = parseVendorValue(opt.value);
      if (!parsed) return false;
      if (parsed.type === "vendor") return validVendorIds.has(parsed.id);
      if (parsed.type === "location") return validLocationIds.has(parsed.id);
      return false;
    });
  }, [enforceRouteRecords, formData.location_id, assignments, vendorOptions, parseVendorValue]);

  // Effect to handle vendor mismatch when ship-to changes with route enforcement
  useEffect(() => {
    if (!enforceRouteRecords || !formData.location_id || !formData.vendor_id) return;

    const shipToLocationId = formData.location_id;
    const parsed = parseVendorValue(formData.vendor_id);
    if (!parsed) return;

    const assignmentsForShipTo = assignments.filter((a) => a.destination_location_id === shipToLocationId);

    // If assignments exist for ship-to, check if current vendor is valid
    if (assignmentsForShipTo.length > 0) {
      let isCurrentVendorValid = false;

      if (parsed.type === "vendor") {
        isCurrentVendorValid = assignmentsForShipTo.some((a) => a.vendor_id === parsed.id);
      } else if (parsed.type === "location") {
        isCurrentVendorValid = assignmentsForShipTo.some((a) => a.source_location_id === parsed.id);
      }

      // If current vendor is not valid, clear it to force re-selection
      if (!isCurrentVendorValid) {
        setFormData((prev) => ({ ...prev, vendor_id: "" }));
        setOrderItems([]);
      }
    }
  }, [formData.location_id, enforceRouteRecords, assignments]);

  // Validation for PO creation - compute errors (blocking) and warnings
  const poValidation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Blocking errors
    if (!formData.vendor_id) {
      errors.push("Vendor / Source is required");
    }
    if (!formData.location_id) {
      errors.push("Ship To location is required");
    }
    if (!formData.bill_to_location_id) {
      errors.push("Bill To location is required");
    }
    if (orderItems.length === 0) {
      errors.push("At least one item is required");
    }

    // Check for items without products selected
    const emptyItems = orderItems.filter((item) => !item.product_id);
    if (emptyItems.length > 0) {
      errors.push(`${emptyItems.length} item(s) missing product selection`);
    }

    // Check for items with zero quantity
    const zeroQtyItems = orderItems.filter((item) => item.product_id && item.quantity <= 0);
    if (zeroQtyItems.length > 0) {
      errors.push(`${zeroQtyItems.length} item(s) have zero or negative quantity`);
    }

    // Warnings (non-blocking)
    // Check if items have different vendors than the selected vendor
    if (formData.vendor_id) {
      const parsed = parseVendorValue(formData.vendor_id);
      if (parsed?.type === "vendor") {
        const itemsWithDifferentVendor = orderItems.filter((item) => {
          if (!item.product_id) return false;
          const product = products.find((p) => p.id === item.product_id);
          return product && product.vendor_id && product.vendor_id !== parsed.id;
        });
        if (itemsWithDifferentVendor.length > 0) {
          warnings.push(`${itemsWithDifferentVendor.length} item(s) are from different vendors than selected`);
        }
      }
    }

    // Check for items with zero price
    const zeroPriceItems = orderItems.filter((item) => item.product_id && item.unit_price === 0);
    if (zeroPriceItems.length > 0) {
      warnings.push(`${zeroPriceItems.length} item(s) have $0.00 unit price`);
    }

    // Route enforcement validation - only warn when NO routes exist for ship-to
    // (When routes exist, vendor dropdown is already filtered to valid options)
    if (enforceRouteRecords && formData.location_id) {
      const shipToLocationId = formData.location_id;
      const shipToLocation = locations.find((l) => l.id === shipToLocationId);
      const shipToName = shipToLocation?.name || shipToLocation?.location_id || "selected location";

      // Find all assignments for this ship-to destination
      const assignmentsForShipTo = assignments.filter((a) => a.destination_location_id === shipToLocationId);

      if (assignmentsForShipTo.length === 0) {
        // No route records exist at all for this ship-to - show warning
        warnings.push(`No route records exist for ${shipToName}. All sources are available.`);
      }
      // Note: When routes exist, vendor dropdown is filtered to only valid options,
      // so no need for additional validation warnings
    }

    return { errors, warnings };
  }, [formData, orderItems, products, parseVendorValue, enforceRouteRecords, assignments, locations]);

  // Auto-open validation popover when route enforcement warnings are detected
  useEffect(() => {
    if (!isCreateDialogOpen) return;

    const hasRouteWarning = poValidation.warnings.some((w) => w.includes("No route records exist"));

    if (hasRouteWarning) {
      setIsValidationPopoverOpen(true);
    }
  }, [poValidation.warnings, isCreateDialogOpen]);

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
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-7 h-7 text-orange-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Purchase Orders</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQueryDialog(true)} title="Search purchase orders">
                <Search className="w-4 h-4" />
              </Button>
              {selectedOrderIds.size > 0 && (
                <Button
                  variant="outline"
                  onClick={handleAutoConfirm}
                  disabled={isAutoConfirming}
                >
                  {isAutoConfirming ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Auto Confirm ({selectedOrderIds.size})
                </Button>
              )}
              {selectedOrderIds.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">
                      Update Status ({selectedOrderIds.size})
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {["draft", "pending", "sent", "confirmed", "shipped", "delivered", "cancelled"].map((status) => (
                      <DropdownMenuItem key={status} onClick={() => handleBulkStatusUpdate(status)}>
                        <Badge className={`${statusColors[status]} text-white mr-2`}>{status}</Badge>
                        Set to {status}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <ImportExportButtons
                importEnabled={isImportEnabled("purchase_order")}
                exportEnabled={isExportEnabled("purchase_order")}
                onExport={handleExportOrders}
                entityName="Purchase Orders"
              />
              <Button onClick={handleCreateClick} variant="default" size="icon" className="relative">
                <Plus className="w-4 h-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No purchase orders yet</h3>
            <p className="text-muted-foreground mb-4">Create your first purchase order to send to vendors</p>
            <Button onClick={handleCreateClick}>
              <Plus className="w-4 h-4 mr-2" />
              Create Purchase Order
            </Button>
          </div>
        ) : (
          <OrdersTable
            orders={orders}
            selectedOrderIds={selectedOrderIds}
            onSelectionChange={setSelectedOrderIds}
            onViewOrder={handleViewOrder}
            onEditOrder={handleEditOrder}
            onConfirmOrder={(id) => handleUpdateStatus(id, "confirmed")}
            onDeleteOrder={handleDeleteOrder}
            onVendorClick={openVendorDetail}
            onLocationClick={(locationId) => openLocationDetail(locationId, "Ship To")}
          />
        )}
      </main>

      {/* Create PO Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent
          className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? "!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]" : "max-w-3xl max-h-[85vh]"}`}
        >
          {/* Validation Alert Button */}
          {(poValidation.errors.length > 0 || poValidation.warnings.length > 0) && (
            <Popover open={isValidationPopoverOpen} onOpenChange={setIsValidationPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`absolute right-16 top-4 rounded-sm ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10 flex items-center justify-center ${
                    poValidation.errors.length > 0 ? "text-destructive opacity-100" : "text-yellow-500 opacity-90"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span
                    className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      poValidation.errors.length > 0 ? "bg-destructive" : "bg-yellow-500"
                    }`}
                  >
                    {poValidation.errors.length > 0 ? poValidation.errors.length : poValidation.warnings.length}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Validation Issues</h4>

                  {poValidation.errors.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-destructive text-xs font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Blocking Issues ({poValidation.errors.length})
                      </div>
                      <ul className="space-y-1.5 text-sm">
                        {poValidation.errors.map((error, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-destructive">
                            <span className="text-destructive mt-0.5">•</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {poValidation.warnings.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 text-xs font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Warnings ({poValidation.warnings.length})
                      </div>
                      <ul className="space-y-1.5 text-sm">
                        {poValidation.warnings.map((warning, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-yellow-600 dark:text-yellow-500">
                            <span className="mt-0.5">•</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Purchase Order" : "Create Purchase Order"}</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Edit purchase order details and items" : "Create a new purchase order to send to a vendor"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pb-6">
            {/* Header Fields */}
            <div className="grid grid-cols-3 gap-4 pb-4 border-b px-6">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor / Source *</Label>
                <SearchableSelect
                  options={routeValidVendorOptions}
                  value={formData.vendor_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, vendor_id: value });
                    setOrderItems([]);
                  }}
                  placeholder="Select vendor or source"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ship To</Label>
                <SearchableSelect
                  options={locationOptions}
                  value={formData.location_id}
                  onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                  placeholder="Select location"
                  allowClear
                  clearLabel="No location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_to_location">Bill To</Label>
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
            <Tabs defaultValue="items" className="w-full mt-4 px-6">
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
                  <div className="flex items-center gap-2">
                    <Popover open={isBomImportOpen} onOpenChange={setIsBomImportOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="icon" title="Import from BOM">
                          <BookOpen className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="end">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Import from Bill of Materials</h4>
                            <p className="text-xs text-muted-foreground">
                              Enter a BOM ID to import its components as line items.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="bom_id">BOM ID</Label>
                            <Input
                              id="bom_id"
                              value={bomImportId}
                              onChange={(e) => setBomImportId(e.target.value)}
                              placeholder="e.g. BOM-001"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="bom_qty">Quantity</Label>
                            <Input
                              id="bom_qty"
                              type="number"
                              min="1"
                              value={bomImportQty}
                              onChange={(e) => setBomImportQty(e.target.value)}
                              placeholder="1"
                            />
                          </div>
                          <Button
                            type="button"
                            className="w-full"
                            size="sm"
                            onClick={handleBomImport}
                            disabled={isBomImporting || !bomImportId.trim()}
                          >
                            {isBomImporting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              "Import Components"
                            )}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
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
                          <TableHead className="w-[32%]">Product</TableHead>
                          <TableHead className="w-[12%]">UOM</TableHead>
                          <TableHead className="w-[10%] text-right">Qty</TableHead>
                          <TableHead className="w-[12%] text-right">Unit Price</TableHead>
                          <TableHead className="w-[12%] text-right">Total</TableHead>
                          <TableHead className="w-[17%]">Expected Delivery</TableHead>
                          <TableHead className="w-[5%]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => {
                          const uomOptions = item.product_id ? getUomOptions(item.product_id) : [];
                          const selectedProduct = products.find((p) => p.id === item.product_id);
                          return (
                            <TableRow key={index}>
                              <TableCell className="p-2">
                                <SearchableSelect
                                  options={filteredProductOptions}
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
                              <TableCell className="p-2 text-muted-foreground text-sm">
                                {item.product_id ? calculateExpectedDelivery(selectedProduct) : "-"}
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
                {!availabilityLocationId ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    {isInternalTransfer
                      ? "Select a source location to check inventory availability"
                      : 'Select a "Ship To" location to check inventory availability'}
                  </p>
                ) : orderItems.filter((item) => item.product_id).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    Add items to the order to check availability
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isInternalTransfer ? "Checking source stock at: " : "Checking stock at: "}
                        <span className="font-medium text-foreground">{availabilityLocationName}</span>
                      </span>
                      <Badge variant={hasStockIssue ? "destructive" : "default"}>
                        {hasStockIssue ? "Stock Issues" : "All Available"}
                      </Badge>
                    </div>

                    <div className="rounded-lg border overflow-hidden">
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
                          {orderItems
                            .filter((item) => item.product_id)
                            .map((item, index) => {
                              const product = products.find((p) => p.id === item.product_id);
                              const availability = itemAvailability[item.product_id];
                              const status = availability?.sufficient
                                ? "In Stock"
                                : availability?.available > 0
                                  ? "Partial"
                                  : "Out of Stock";

                              return (
                                <TableRow key={index}>
                                  <TableCell>{product?.name || "Unknown"}</TableCell>
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                  <TableCell className="text-right">{availability?.available || 0}</TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant={availability?.sufficient ? "default" : "destructive"}>
                                      {status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assignment" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <Label>Ledger Assignment</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select the ledger to record this purchase order transaction. The transaction will be recorded as a
                    negative amount (expense).
                  </p>
                  <SearchableSelect
                    options={ledgers.map((l) => ({
                      value: l.id,
                      label: l.name,
                      sublabel: l.location_id ? locations.find((loc) => loc.id === l.location_id)?.name : "General",
                    }))}
                    value={formData.ledger_id}
                    onValueChange={(value) => setFormData({ ...formData, ledger_id: value })}
                    placeholder="Auto-select based on Bill To location"
                    allowClear
                    clearLabel="Auto-select"
                  />
                  {formData.ledger_id && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <span className="text-muted-foreground">Transaction amount: </span>
                      <span className="font-mono text-destructive">-${calculateGrandTotal().toFixed(2)}</span>
                    </div>
                  )}
                  {!formData.ledger_id && formData.bill_to_location_id && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <span className="text-muted-foreground">Will use ledger for: </span>
                      <span>
                        {locations.find((l) => l.id === formData.bill_to_location_id)?.name || "Bill To location"}
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
            <Button onClick={handleSaveOrder} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditMode ? "Save Changes" : "Create Order"}
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Items Selection Dialog */}
      {pendingConfirmOrderId && companyId && (
        <DeliveryItemsDialog
          open={isDeliveryItemsDialogOpen}
          onOpenChange={(open) => {
            setIsDeliveryItemsDialogOpen(open);
            if (!open) {
              setPendingConfirmOrderId(null);
              // If user cancels during bulk, clear bulk state
              if (bulkConfirmOrderIds.length > 0) {
                setBulkConfirmOrderIds([]);
                setBulkConfirmOrderIndex(0);
              }
            }
          }}
          purchaseOrderId={pendingConfirmOrderId}
          companyId={companyId}
          onConfirm={handleDeliveryItemsConfirm}
          title={
            bulkConfirmOrderIds.length > 0
              ? `Select Items for Delivery (${bulkConfirmOrderIndex + 1} of ${bulkConfirmOrderIds.length})`
              : "Select Items for Delivery"
          }
          description="Choose which items to include in this delivery. You can select all or partial quantities."
        />
      )}

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
            <DialogTitle>Purchase Order {viewOrder?.po_number}</DialogTitle>
            <DialogDescription>View order details and update status</DialogDescription>
          </DialogHeader>

          {viewOrder && (
            <div className="flex-1 overflow-y-auto space-y-4 px-6 pb-6">
              {/* Header Fields */}
              <div className="grid grid-cols-5 gap-4 pb-4 border-b">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Select
                      value={viewOrder.status}
                      onValueChange={(value) => handleUpdateStatus(viewOrder.id, value)}
                      disabled={viewOrder.status === "shipped" || viewOrder.status === "delivered"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    {viewOrder.source_location_id ? "Source Location" : "Vendor"}
                  </Label>
                  {viewOrder.vendor_id ? (
                    <button
                      type="button"
                      onClick={() => openVendorDetail(viewOrder.vendor_id)}
                      className="mt-1 font-medium text-primary hover:underline cursor-pointer block text-left"
                    >
                      {viewOrder.vendor?.name || "-"}
                    </button>
                  ) : viewOrder.source_location_id ? (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => openLocationDetail(viewOrder.source_location_id, "Source Location")}
                        className="font-medium text-primary hover:underline cursor-pointer block text-left"
                      >
                        {viewOrder.source_location?.name || "-"}
                      </button>
                      <Badge variant="outline" className="mt-1 text-xs">
                        Internal Transfer
                      </Badge>
                    </div>
                  ) : (
                    <p className="mt-1 font-medium">-</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Ship To</Label>
                  {viewOrder.location_id ? (
                    <button
                      type="button"
                      onClick={() => openLocationDetail(viewOrder.location_id, "Ship To")}
                      className="mt-1 text-primary hover:underline cursor-pointer block text-left"
                    >
                      {viewOrder.location?.name || "-"}
                    </button>
                  ) : (
                    <p className="mt-1">-</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Bill To</Label>
                  {viewOrder.bill_to_location_id ? (
                    <button
                      type="button"
                      onClick={() => openLocationDetail(viewOrder.bill_to_location_id, "Bill To")}
                      className="mt-1 text-primary hover:underline cursor-pointer block text-left"
                    >
                      {viewOrder.bill_to_location?.name || "-"}
                    </button>
                  ) : (
                    <p className="mt-1">-</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">From Requisition</Label>
                  {viewOrder.requisition ? (
                    <p className="mt-1 text-sm font-mono">{viewOrder.requisition.requisition_id}</p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">-</p>
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
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="space-y-4 mt-4">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Item ID</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Expected Delivery</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewItems.map((item, index) => {
                          const viewProduct = products.find((p) => p.id === item.product_id);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => openProductDetail(item)}
                                  className="text-primary hover:underline cursor-pointer text-left"
                                >
                                  {item.product?.product_id || "-"}
                                </button>
                              </TableCell>
                              <TableCell>{item.product?.name || "Unknown"}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right font-mono">
                                ${Number(item.unit_price || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${Number(item.total_price || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {calculateExpectedDelivery(viewProduct)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                    {viewInvoice && (
                      <>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <Label>Invoice</Label>
                        </div>
                        <div className="p-4 border rounded-lg space-y-3">
                          <div>
                            <Label className="text-muted-foreground text-xs">Invoice Number</Label>
                            <button
                              type="button"
                              onClick={() => navigate("/invoices")}
                              className="block font-mono text-primary hover:underline"
                            >
                              {viewInvoice.invoice_number}
                            </button>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Amount</Label>
                            <p className="font-mono">${Number((viewInvoice as any).amount || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </>
                    )}
                    {viewGoodsReceipts.length > 0 && (
                      <>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <Label>Goods Receipts</Label>
                        </div>
                        <div className="p-4 border rounded-lg space-y-3">
                          {viewGoodsReceipts.map((gr) => (
                            <div key={gr.id} className="flex items-center justify-between">
                              <div>
                                <Label className="text-muted-foreground text-xs">Receipt Number</Label>
                                <button
                                  type="button"
                                  onClick={() => navigate("/goods-receipts")}
                                  className="block font-mono text-primary hover:underline"
                                >
                                  {gr.receipt_number}
                                </button>
                              </div>
                              <Badge variant={gr.status === "posted" ? "default" : "secondary"}>{gr.status}</Badge>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
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
                        <p className="font-mono text-destructive">-${Number(viewOrder.total_amount || 0).toFixed(2)}</p>
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
                    <Label className="text-muted-foreground">Created Date</Label>
                    <p className="text-sm">{new Date(viewOrder.created_at).toLocaleDateString()}</p>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <AuditHistoryTab
                    tableName="purchase_orders"
                    recordId={viewOrder.id}
                    fieldLabels={{
                      status: "Status",
                      vendor_id: "Vendor",
                      location_id: "Ship To Location",
                      total_amount: "Total Amount",
                      notes: "Notes",
                      expected_delivery: "Expected Delivery",
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleDownloadXlsx}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Download as XLSX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPdf}>
                  <FileText className="w-4 h-4 mr-2" />
                  Download as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Detail Dialog */}
      <Dialog open={isVendorDetailOpen} onOpenChange={setIsVendorDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>{detailVendor?.vendor_id}</DialogDescription>
          </DialogHeader>
          {detailVendor && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{detailVendor.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p>{detailVendor.type || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Contact</Label>
                  <p>{detailVendor.contact_name || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p>{detailVendor.phone || "-"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Email</Label>
                <p>{detailVendor.email || "-"}</p>
              </div>
              {(detailVendor.address_line1 || detailVendor.city) && (
                <div>
                  <Label className="text-muted-foreground text-xs">Address</Label>
                  <p>{detailVendor.address_line1}</p>
                  {detailVendor.address_line2 && <p>{detailVendor.address_line2}</p>}
                  <p>{[detailVendor.city, detailVendor.state, detailVendor.postal_code].filter(Boolean).join(", ")}</p>
                  {detailVendor.country && <p>{detailVendor.country}</p>}
                </div>
              )}
              {detailVendor.website && (
                <div>
                  <Label className="text-muted-foreground text-xs">Website</Label>
                  <p>{detailVendor.website}</p>
                </div>
              )}
              {detailVendor.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <p className="text-sm text-muted-foreground">{detailVendor.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVendorDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Detail Dialog */}
      <Dialog open={isLocationDetailOpen} onOpenChange={setIsLocationDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailLocationLabel} Location</DialogTitle>
            <DialogDescription>{detailLocation?.location_id}</DialogDescription>
          </DialogHeader>
          {detailLocation && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{detailLocation.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p>{detailLocation.type || "-"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Address</Label>
                <p>{detailLocation.address_line1}</p>
                {detailLocation.address_line2 && <p>{detailLocation.address_line2}</p>}
                <p>
                  {[detailLocation.city, detailLocation.state, detailLocation.postal_code].filter(Boolean).join(", ")}
                </p>
                {detailLocation.country && <p>{detailLocation.country}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLocationDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog open={isProductDetailOpen} onOpenChange={setIsProductDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>{detailProduct?.product_id}</DialogDescription>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{detailProduct.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">SKU</Label>
                  <p>{detailProduct.sku || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Category</Label>
                  <p>{detailProduct.category || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Unit</Label>
                  <p>{detailProduct.unit || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Price</Label>
                  <p className="font-mono">
                    {detailProduct.price != null ? `$${Number(detailProduct.price).toFixed(2)}` : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Vendor</Label>
                  <p>{detailProduct.vendor?.name || "-"}</p>
                </div>
              </div>
              {detailProduct.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <p className="text-sm text-muted-foreground">{detailProduct.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AppLoadQueryDialog
        open={showQueryDialog}
        onClose={() => setShowQueryDialog(false)}
        onQuery={handleQueryDialogQuery}
        onLoadAll={handleQueryDialogLoadAll}
        fields={ORDER_QUERY_FIELDS}
        title="Load Purchase Orders"
        loading={queryLoading}
      />
      <ImportProgressDialog
        open={autoConfirmProgressOpen}
        onOpenChange={setAutoConfirmProgressOpen}
        title="Auto Confirm Purchase Orders"
        totalRows={autoConfirmTotal}
        processedRows={autoConfirmProcessed}
        results={autoConfirmResults}
        isComplete={autoConfirmComplete}
      />
    </div>
  );
};

// Separate table component for sorting/filtering
function OrdersTable({
  orders,
  selectedOrderIds,
  onSelectionChange,
  onViewOrder,
  onEditOrder,
  onConfirmOrder,
  onDeleteOrder,
  onVendorClick,
  onLocationClick,
}: {
  orders: PurchaseOrder[];
  selectedOrderIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onViewOrder: (order: PurchaseOrder) => void;
  onEditOrder: (order: PurchaseOrder) => void;
  onConfirmOrder: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onVendorClick: (vendorId: string) => void;
  onLocationClick: (locationId: string) => void;
}) {
  const { sortConfig, filters, handleSort, setFilter, clearAllFilters, sortedAndFilteredData } = useTableSort(
    orders,
    "po_number",
    "desc",
  );

  const hasFilters = Object.values(filters).some((v) => v);

  const allSelected =
    sortedAndFilteredData.length > 0 && sortedAndFilteredData.every((o) => selectedOrderIds.has(o.id));
  const someSelected = sortedAndFilteredData.some((o) => selectedOrderIds.has(o.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelection = new Set(selectedOrderIds);
      sortedAndFilteredData.forEach((o) => newSelection.add(o.id));
      onSelectionChange(newSelection);
    } else {
      const newSelection = new Set(selectedOrderIds);
      sortedAndFilteredData.forEach((o) => newSelection.delete(o.id));
      onSelectionChange(newSelection);
    }
  };

  const handleSelectRow = (orderId: string, checked: boolean) => {
    const newSelection = new Set(selectedOrderIds);
    if (checked) {
      newSelection.add(orderId);
    } else {
      newSelection.delete(orderId);
    }
    onSelectionChange(newSelection);
  };

  return (
    <div className="space-y-4">
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
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
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement).dataset.state = someSelected
                        ? "indeterminate"
                        : allSelected
                          ? "checked"
                          : "unchecked";
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <SortableTableHead
                label="PO #"
                sortKey="po_number"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["po_number"]}
                onFilter={(v) => setFilter("po_number", v)}
              />
              <SortableTableHead
                label="Status"
                sortKey="status"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["status"]}
                onFilter={(v) => setFilter("status", v)}
              />
              <SortableTableHead
                label="Vendor ID"
                sortKey="vendor.vendor_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["vendor.vendor_id"]}
                onFilter={(v) => setFilter("vendor.vendor_id", v)}
              />
              <SortableTableHead
                label="Vendor Name"
                sortKey="vendor.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["vendor.name"]}
                onFilter={(v) => setFilter("vendor.name", v)}
              />
              <SortableTableHead
                label="Ship To ID"
                sortKey="location.location_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["location.location_id"]}
                onFilter={(v) => setFilter("location.location_id", v)}
              />
              <SortableTableHead
                label="Ship To Name"
                sortKey="location.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["location.name"]}
                onFilter={(v) => setFilter("location.name", v)}
              />
              <SortableTableHead
                label="Bill To ID"
                sortKey="bill_to_location.location_id"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["bill_to_location.location_id"]}
                onFilter={(v) => setFilter("bill_to_location.location_id", v)}
              />
              <SortableTableHead
                label="Bill To Name"
                sortKey="bill_to_location.name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["bill_to_location.name"]}
                onFilter={(v) => setFilter("bill_to_location.name", v)}
              />
              <SortableTableHead
                label="Total"
                sortKey="total_amount"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                className="text-right"
                filterable={false}
              />
              <SortableTableHead
                label="Created By"
                sortKey="creator.last_name"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterValue={filters["creator.last_name"]}
                onFilter={(v) => setFilter("creator.last_name", v)}
              />
              <SortableTableHead
                label="Date"
                sortKey="created_at"
                currentSortKey={sortConfig.key}
                currentSortDirection={sortConfig.direction}
                onSort={handleSort}
                filterable={false}
              />
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.map((order) => (
              <TableRow key={order.id} className={selectedOrderIds.has(order.id) ? "bg-muted/50" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selectedOrderIds.has(order.id)}
                    onCheckedChange={(checked) => handleSelectRow(order.id, !!checked)}
                  />
                </TableCell>
                <TableCell className="font-mono">
                  <button
                    type="button"
                    onClick={() => onViewOrder(order)}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    {order.po_number}
                  </button>
                </TableCell>
                <TableCell>
                  <Badge className={`${statusColors[order.status]} text-white`}>{order.status}</Badge>
                </TableCell>
                <TableCell>
                  {order.vendor?.vendor_id ? (
                    <button
                      type="button"
                      onClick={() => onVendorClick(order.vendor_id!)}
                      className="text-primary hover:underline font-mono"
                    >
                      {order.vendor.vendor_id}
                    </button>
                  ) : order.source_location?.location_id ? (
                    <button
                      type="button"
                      onClick={() => onLocationClick(order.source_location_id!)}
                      className="text-primary hover:underline font-mono"
                    >
                      {order.source_location.location_id}
                    </button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {order.vendor?.name || order.source_location?.name || "-"}
                  {order.source_location && !order.vendor && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Transfer
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {order.location?.location_id ? (
                    <button
                      type="button"
                      onClick={() => onLocationClick(order.location_id!)}
                      className="text-primary hover:underline font-mono"
                    >
                      {order.location.location_id}
                    </button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{order.location?.name || "-"}</TableCell>
                <TableCell>
                  {order.bill_to_location?.location_id ? (
                    <button
                      type="button"
                      onClick={() => onLocationClick(order.bill_to_location_id!)}
                      className="text-primary hover:underline font-mono"
                    >
                      {order.bill_to_location.location_id}
                    </button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{order.bill_to_location?.name || "-"}</TableCell>
                <TableCell className="text-right font-mono">${Number(order.total_amount || 0).toFixed(2)}</TableCell>
                <TableCell className="text-sm">
                  {order.creator
                    ? `${order.creator.first_name || ""} ${order.creator.last_name || ""}`.trim() || "-"
                    : "-"}
                </TableCell>
                <TableCell className="text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onViewOrder(order)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(order.status === "draft" || order.status === "pending") && (
                          <DropdownMenuItem onClick={() => onEditOrder(order)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {order.status !== "shipped" && order.status !== "delivered" && (
                          <DropdownMenuItem onClick={() => onConfirmOrder(order.id)}>
                            <Check className="w-4 h-4 mr-2" />
                            Confirm
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onDeleteOrder(order.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
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

export default Orders;
