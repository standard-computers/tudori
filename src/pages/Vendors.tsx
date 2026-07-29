import { useEffect, useState, useRef } from "react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { COUNTRY_OPTIONS } from "@/config/countries";
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useReduceAppLoad } from "@/hooks/use-reduce-app-load";
import { AppLoadQueryDialog, QueryField } from "@/components/AppLoadQueryDialog";
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/use-column-visibility";
import { ColumnToggle } from "@/components/ColumnToggle";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTransaction, useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { useExcel } from "@/hooks/use-excel";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/SortableTableHead";
import {
  ArrowLeft,
  Plus,
  Building,
  Pencil,
  Trash2,
  AlertCircle,
  Search,
  Loader2,
  X,
  Eye,
  MoreHorizontal,
  History,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyFromIdDialog } from "@/components/CopyFromIdDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { AuditHistoryTab } from "@/components/AuditHistoryTab";
import { toast } from "@/lib/toast";

const VENDOR_COLUMNS: ColumnDefinition[] = [
  { key: "vendor_id", label: "ID", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "type", label: "Type", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "contact_name", label: "Contact", defaultVisible: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "phone", label: "Phone", defaultVisible: true },
  { key: "address_line1", label: "Address", defaultVisible: true },
  { key: "city", label: "City", defaultVisible: true },
  { key: "state", label: "State", defaultVisible: true },
  { key: "postal_code", label: "Postal Code", defaultVisible: true },
  { key: "country", label: "Country", defaultVisible: true },
  { key: "website", label: "Website", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

interface Vendor {
  id: string;
  vendor_id: string;
  name: string;
  type: string;
  status: string;
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
  payment_terms: number | null;
}

type VendorStatus = "active" | "blocked";

const VENDOR_STATUSES: { value: VendorStatus; label: string; color: string }[] = [
  { value: "active", label: "Active", color: "bg-success" },
  { value: "blocked", label: "Blocked", color: "bg-destructive" },
];

const VENDOR_TYPES = ["Supplier", "Manufacturer", "Distributor", "Contractor", "Service Provider", "Consultant"];

// Separated table component with sorting/filtering
const VendorTable = ({
  vendors,
  onView,
  onEdit,
  onDelete,
  isColumnVisible,
}: {
  vendors: Vendor[];
  onView: (vendor: Vendor) => void;
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
  isColumnVisible: (key: string) => boolean;
}) => {
  const { sortConfig, filters, handleSort, setFilter, clearAllFilters, sortedAndFilteredData } = useTableSort(
    vendors,
    "vendor_id",
    "asc",
  );

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const visibleColumnCount = VENDOR_COLUMNS.filter((c) => isColumnVisible(c.key)).length;

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
          {Object.entries(filters).map(
            ([key, value]) =>
              value && (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}: {value}
                  <button onClick={() => setFilter(key, "")} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ),
          )}
        </div>
      )}
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isColumnVisible("vendor_id") && (
                <SortableTableHead
                  label="ID"
                  sortKey="vendor_id"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["vendor_id"]}
                  onFilter={(value) => setFilter("vendor_id", value)}
                  className="w-24"
                />
              )}
              {isColumnVisible("name") && (
                <SortableTableHead
                  label="Name"
                  sortKey="name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["name"]}
                  onFilter={(value) => setFilter("name", value)}
                />
              )}
              {isColumnVisible("type") && (
                <SortableTableHead
                  label="Type"
                  sortKey="type"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["type"]}
                  onFilter={(value) => setFilter("type", value)}
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
                  onFilter={(value) => setFilter("status", value)}
                />
              )}
              {isColumnVisible("contact_name") && (
                <SortableTableHead
                  label="Contact"
                  sortKey="contact_name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["contact_name"]}
                  onFilter={(value) => setFilter("contact_name", value)}
                />
              )}
              {isColumnVisible("email") && (
                <SortableTableHead
                  label="Email"
                  sortKey="email"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["email"]}
                  onFilter={(value) => setFilter("email", value)}
                />
              )}
              {isColumnVisible("phone") && (
                <SortableTableHead
                  label="Phone"
                  sortKey="phone"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["phone"]}
                  onFilter={(value) => setFilter("phone", value)}
                />
              )}
              {isColumnVisible("address_line1") && (
                <SortableTableHead
                  label="Address"
                  sortKey="address_line1"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["address_line1"]}
                  onFilter={(value) => setFilter("address_line1", value)}
                />
              )}
              {isColumnVisible("city") && (
                <SortableTableHead
                  label="City"
                  sortKey="city"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["city"]}
                  onFilter={(value) => setFilter("city", value)}
                />
              )}
              {isColumnVisible("state") && (
                <SortableTableHead
                  label="State"
                  sortKey="state"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["state"]}
                  onFilter={(value) => setFilter("state", value)}
                />
              )}
              {isColumnVisible("postal_code") && (
                <SortableTableHead
                  label="Postal Code"
                  sortKey="postal_code"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["postal_code"]}
                  onFilter={(value) => setFilter("postal_code", value)}
                />
              )}
              {isColumnVisible("country") && (
                <SortableTableHead
                  label="Country"
                  sortKey="country"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["country"]}
                  onFilter={(value) => setFilter("country", value)}
                />
              )}
              {isColumnVisible("website") && (
                <SortableTableHead
                  label="Website"
                  sortKey="website"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["website"]}
                  onFilter={(value) => setFilter("website", value)}
                />
              )}
              {isColumnVisible("actions") && (
                <SortableTableHead
                  label="Actions"
                  sortKey=""
                  currentSortKey=""
                  currentSortDirection={null}
                  onSort={() => {}}
                  filterable={false}
                  className="w-24"
                />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="text-center py-8 text-muted-foreground">
                  No vendors match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((vendor) => (
                <TableRow key={vendor.id}>
                  {isColumnVisible("vendor_id") && (
                    <TableCell className="font-mono text-sm">
                      <button
                        type="button"
                        onClick={() => onView(vendor)}
                        className="text-primary hover:underline cursor-pointer"
                      >
                        {vendor.vendor_id}
                      </button>
                    </TableCell>
                  )}
                  {isColumnVisible("name") && <TableCell className="font-medium">{vendor.name}</TableCell>}
                  {isColumnVisible("type") && <TableCell>{vendor.type}</TableCell>}
                  {isColumnVisible("status") && (
                    <TableCell>
                      {(() => {
                        const statusConfig =
                          VENDOR_STATUSES.find((s) => s.value === vendor.status) || VENDOR_STATUSES[0];
                        return <Badge className={`${statusConfig.color} text-white`}>{statusConfig.label}</Badge>;
                      })()}
                    </TableCell>
                  )}
                  {isColumnVisible("contact_name") && <TableCell>{vendor.contact_name || "-"}</TableCell>}
                  {isColumnVisible("email") && <TableCell>{vendor.email || "-"}</TableCell>}
                  {isColumnVisible("phone") && <TableCell>{vendor.phone || "-"}</TableCell>}
                  {isColumnVisible("address_line1") && <TableCell>{vendor.address_line1 || "-"}</TableCell>}
                  {isColumnVisible("city") && <TableCell>{vendor.city || "-"}</TableCell>}
                  {isColumnVisible("state") && <TableCell>{vendor.state || "-"}</TableCell>}
                  {isColumnVisible("postal_code") && <TableCell>{vendor.postal_code || "-"}</TableCell>}
                  {isColumnVisible("country") && <TableCell>{vendor.country || "-"}</TableCell>}
                  {isColumnVisible("website") && <TableCell>{vendor.website || "-"}</TableCell>}
                  {isColumnVisible("actions") && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onView(vendor)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(vendor)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDelete(vendor)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  )}
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
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState<{ id: string; name: string } | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextVendorId, setNextVendorId] = useState("0001");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    open: boolean;
    total: number;
    current: number;
    imported: number;
    failed: number;
  }>({ open: false, total: 0, current: 0, imported: 0, failed: 0 });

  // Column visibility
  const { visibleColumns, isColumnVisible, toggleColumn, resetToDefaults, showAll, hideAll } = useColumnVisibility(
    "vendors",
    VENDOR_COLUMNS,
  );

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();

  const VENDOR_TEMPLATE_COLUMNS = [
    { header: "Name", key: "Name", width: 25 },
    { header: "Type", key: "Type", width: 18 },
    { header: "Status", key: "Status", width: 12 },
    { header: "Contact", key: "Contact", width: 20 },
    { header: "Email", key: "Email", width: 25 },
    { header: "Phone", key: "Phone", width: 18 },
    { header: "Address", key: "Address", width: 25 },
    { header: "Address 2", key: "Address 2", width: 20 },
    { header: "City", key: "City", width: 15 },
    { header: "State", key: "State", width: 12 },
    { header: "Postal Code", key: "Postal Code", width: 14 },
    { header: "Country", key: "Country", width: 15 },
    { header: "Website", key: "Website", width: 25 },
    { header: "Payment Terms", key: "Payment Terms", width: 16 },
    { header: "Notes", key: "Notes", width: 30 },
  ];

  const handleDownloadTemplate = async () => {
    const sampleRow = {
      Name: "Example Corp",
      Type: "Supplier",
      Status: "active",
      Contact: "John Doe",
      Email: "john@example.com",
      Phone: "555-0100",
      Address: "123 Main St",
      "Address 2": "",
      City: "New York",
      State: "NY",
      "Postal Code": "10001",
      Country: "United States",
      Website: "https://example.com",
      "Payment Terms": "30",
      Notes: "",
    };
    await exportToExcel([sampleRow], "vendor_import_template.xlsx", "Vendors", VENDOR_TEMPLATE_COLUMNS);
    toast.success("Template downloaded");
  };

  const handleImport = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) {
        toast.error("No data found in file");
        return;
      }

      let imported = 0;
      let failed = 0;
      setImportProgress({ open: true, total: rows.length, current: 0, imported: 0, failed: 0 });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row["Name"]?.toString()?.trim();
        if (!name) {
          failed++;
          setImportProgress((p) => ({ ...p, current: i + 1, failed }));
          continue;
        }

        // Get next vendor ID for each row
        const { data: vid } = await supabase.rpc("get_next_vendor_id", { p_company_id: companyId });

        const { error } = await supabase.from("vendors").insert({
          company_id: companyId,
          vendor_id: vid || `IMP-${Date.now()}`,
          name,
          type: row["Type"]?.toString()?.trim() || "Supplier",
          status: row["Status"]?.toString()?.trim()?.toLowerCase() === "blocked" ? "blocked" : "active",
          contact_name: row["Contact"]?.toString()?.trim() || null,
          email: row["Email"]?.toString()?.trim() || null,
          phone: row["Phone"]?.toString()?.trim() || null,
          address_line1: row["Address"]?.toString()?.trim() || null,
          address_line2: row["Address 2"]?.toString()?.trim() || null,
          city: row["City"]?.toString()?.trim() || null,
          state: row["State"]?.toString()?.trim() || null,
          postal_code: row["Postal Code"]?.toString()?.trim() || null,
          country: row["Country"]?.toString()?.trim() || "United States",
          website: row["Website"]?.toString()?.trim() || null,
          notes: row["Notes"]?.toString()?.trim() || null,
          payment_terms: row["Payment Terms"] ? parseInt(row["Payment Terms"].toString(), 10) || null : null,
        });

        if (error) {
          failed++;
        } else {
          imported++;
        }
        setImportProgress((p) => ({ ...p, current: i + 1, imported, failed }));
      }

      if (imported > 0) {
        toast.success(
          `Imported ${imported} vendor${imported > 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed)` : ""}`,
        );
        fetchVendors();
        fetchNextVendorId();
      } else {
        toast.error(`Import failed: ${failed} row${failed > 1 ? "s" : ""} could not be imported`);
      }
    } catch (err) {
      toast.error("Failed to read file");
    } finally {
      // Auto-close after a short delay so the user sees 100%
      setTimeout(() => setImportProgress((p) => ({ ...p, open: false })), 1500);
    }
  };

  const handleExport = async () => {
    if (vendors.length === 0) {
      toast.info("No vendors to export");
      return;
    }
    const exportData = vendors.map((v) => ({
      "Vendor ID": v.vendor_id,
      Name: v.name,
      Type: v.type,
      Status: v.status,
      Contact: v.contact_name || "",
      Email: v.email || "",
      Phone: v.phone || "",
      Address: v.address_line1 || "",
      "Address 2": v.address_line2 || "",
      City: v.city || "",
      State: v.state || "",
      "Postal Code": v.postal_code || "",
      Country: v.country || "",
      Website: v.website || "",
      "Payment Terms": v.payment_terms ?? "",
      Notes: v.notes || "",
    }));
    await exportToExcel(exportData, `vendors_export_${new Date().toISOString().split("T")[0]}.xlsx`, "Vendors");
    toast.success("Vendors exported successfully");
  };
  const [formData, setFormData] = useState({
    vendor_id: "",
    name: "",
    type: "Supplier",
    status: "active" as VendorStatus,
    contact_name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "United States",
    website: "",
    notes: "",
    payment_terms: "",
  });

  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? "vend/edit" : "vend/new");
    } else {
      setTransaction("vend");
    }
  }, [isDialogOpen, isEditing, setTransaction]);

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
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  const { reduceAppLoad, loading: reduceAppLoadLoading } = useReduceAppLoad();
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);

  const vendorQueryFields: QueryField[] = [
    { key: "vendor_id", label: "Vendor ID" },
    { key: "name", label: "Vendor Name" },
    { key: "city", label: "City" },
    { key: "type", label: "Type" },
  ];

  useEffect(() => {
    if (companyId && !reduceAppLoadLoading) {
      if (reduceAppLoad) {
        setShowQueryDialog(true);
      } else {
        fetchVendors();
      }
      fetchNextVendorId();
    }
  }, [companyId, reduceAppLoad, reduceAppLoadLoading]);

  const fetchCompanyId = async () => {
    const { data } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();

    if (data?.company_id) {
      setCompanyId(data.company_id);
    }
  };

  const fetchVendors = async (filters?: Record<string, string>) => {
    let query = supabase.from("vendors").select("*").eq("company_id", companyId!);

    if (filters?.vendor_id) query = query.ilike("vendor_id", `%${filters.vendor_id}%`);
    if (filters?.name) query = query.ilike("name", `%${filters.name}%`);
    if (filters?.city) query = query.ilike("city", `%${filters.city}%`);
    if (filters?.type) query = query.ilike("type", `%${filters.type}%`);

    const { data, error } = await query.order("vendor_id");

    if (error) {
      addMessage("Failed to load vendors", "error");
      return;
    }

    setVendors(data || []);
  };

  const handleQueryDialogSearch = async (filters: Record<string, string>) => {
    setQueryLoading(true);
    await fetchVendors(filters);
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const handleQueryDialogLoadAll = async () => {
    setQueryLoading(true);
    await fetchVendors();
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const fetchNextVendorId = async () => {
    const { data, error } = await supabase.rpc("get_next_vendor_id", {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextVendorId(data);
    }
  };

  const resetForm = () => {
    setFormData({
      vendor_id: nextVendorId,
      name: "",
      type: "Supplier",
      status: "active",
      contact_name: "",
      email: "",
      phone: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "United States",
      website: "",
      notes: "",
      payment_terms: "",
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleOpenDialog = async () => {
    resetForm();
    // Fetch fresh vendor ID to enforce document_id_config
    const { data: freshVendorId } = await supabase.rpc("get_next_vendor_id", {
      p_company_id: companyId!,
    });
    if (freshVendorId) {
      setNextVendorId(freshVendorId);
      setFormData((prev) => ({ ...prev, vendor_id: freshVendorId }));
    } else {
      setFormData((prev) => ({ ...prev, vendor_id: nextVendorId }));
    }
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new vendor
  useKeyboardShortcut("n", handleOpenDialog);
  useTransactionAction("new", handleOpenDialog);

  const handleEdit = (vendor: Vendor) => {
    setFormData({
      vendor_id: vendor.vendor_id,
      name: vendor.name,
      type: vendor.type,
      status: (vendor.status as VendorStatus) || "active",
      contact_name: vendor.contact_name || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      address_line1: vendor.address_line1 || "",
      address_line2: vendor.address_line2 || "",
      city: vendor.city || "",
      state: vendor.state || "",
      postal_code: vendor.postal_code || "",
      country: vendor.country || "United States",
      website: vendor.website || "",
      notes: vendor.notes || "",
      payment_terms: vendor.payment_terms?.toString() || "",
    });
    setIsEditing(true);
    setEditingId(vendor.id);
    setIsDialogOpen(true);
  };

  const handleDeleteRequest = async (vendor: Vendor) => {
    // Check for linked accounts
    const { data: accounts } = await supabase.from("accounts").select("account_id").eq("vendor_id", vendor.id).limit(1);

    if (accounts && accounts.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(
        `Cannot delete vendor "${vendor.name}". It is linked to account ${accounts[0].account_id}.`,
      );
      setDeletingVendor({ id: vendor.id, name: vendor.name });
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked purchase orders
    const { data: purchaseOrders } = await supabase
      .from("purchase_orders")
      .select("po_number")
      .eq("vendor_id", vendor.id)
      .limit(1);

    if (purchaseOrders && purchaseOrders.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(
        `Cannot delete vendor "${vendor.name}". It is linked to purchase order ${purchaseOrders[0].po_number}.`,
      );
      setDeletingVendor({ id: vendor.id, name: vendor.name });
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked deliveries
    const { data: deliveries } = await supabase
      .from("deliveries")
      .select("delivery_id")
      .eq("vendor_id", vendor.id)
      .limit(1);

    if (deliveries && deliveries.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(
        `Cannot delete vendor "${vendor.name}". It is linked to delivery ${deliveries[0].delivery_id}.`,
      );
      setDeletingVendor({ id: vendor.id, name: vendor.name });
      setDeleteDialogOpen(true);
      return;
    }

    // Check for linked goods receipts
    const { data: goodsReceipts } = await supabase
      .from("goods_receipts")
      .select("receipt_number")
      .eq("vendor_id", vendor.id)
      .limit(1);

    if (goodsReceipts && goodsReceipts.length > 0) {
      setDeleteBlocked(true);
      setDeleteBlockedReason(
        `Cannot delete vendor "${vendor.name}". It is linked to goods receipt ${goodsReceipts[0].receipt_number}.`,
      );
      setDeletingVendor({ id: vendor.id, name: vendor.name });
      setDeleteDialogOpen(true);
      return;
    }

    // No blocking records, show confirm dialog
    setDeleteBlocked(false);
    setDeleteBlockedReason("");
    setDeletingVendor({ id: vendor.id, name: vendor.name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingVendor) return;

    const { error } = await supabase.from("vendors").delete().eq("id", deletingVendor.id);

    if (error) {
      toast.error("Failed to delete vendor");
      return;
    }

    toast.success("Vendor deleted");
    setDeleteDialogOpen(false);
    setDeletingVendor(null);
    fetchVendors();
    fetchNextVendorId();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && editingId) {
      const { error } = await supabase
        .from("vendors")
        .update({
          name: formData.name,
          type: formData.type,
          status: formData.status,
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
          payment_terms: formData.payment_terms ? parseInt(formData.payment_terms, 10) : null,
        })
        .eq("id", editingId);

      if (error) {
        addMessage("Failed to update vendor", "error");
        return;
      }

      addMessage("Vendor updated", "success");
    } else {
      const { error } = await supabase.from("vendors").insert({
        company_id: companyId!,
        vendor_id: formData.vendor_id,
        name: formData.name,
        type: formData.type,
        status: formData.status,
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
        payment_terms: formData.payment_terms ? parseInt(formData.payment_terms, 10) : null,
      });

      if (error) {
        addMessage("Failed to create vendor", "error");
        return;
      }

      addMessage("Vendor created", "success");
    }

    setIsDialogOpen(false);
    fetchVendors();
    fetchNextVendorId();
  };

  const handleAILookup = async () => {
    if (!formData.name || formData.name.trim().length < 2) {
      addMessage("Enter a company name first", "error");
      return;
    }

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-vendor", {
        body: { companyName: formData.name },
      });

      if (error) {
        // Try to extract the error message from the response
        let errorMessage = "Failed to look up company";
        try {
          const errorBody = error.context?.body ? JSON.parse(error.context.body) : null;
          if (errorBody?.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // Use default message if parsing fails
        }
        addMessage(errorMessage, "error");
        return;
      }

      if (data.error) {
        addMessage(data.error, "error");
        return;
      }

      // Update form with found data
      setFormData((prev) => ({
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

      addMessage("Company information found!", "success");
    } catch (err) {
      console.error("Lookup error:", err);
      addMessage("Failed to look up company", "error");
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
      <AppLoadQueryDialog
        open={showQueryDialog}
        onClose={() => setShowQueryDialog(false)}
        onQuery={handleQueryDialogSearch}
        onLoadAll={handleQueryDialogLoadAll}
        fields={vendorQueryFields}
        title="Load Vendors"
        loading={queryLoading}
      />
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ArrowLeft className="w-5 h-5" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <div className="flex items-center gap-3">
                <Building className="w-7 h-7 text-red-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Vendors</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative"
                onClick={() => setShowQueryDialog(true)}
                title="Search vendors"
              >
                <Search className="w-4 h-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">⌘F</Kbd>
              </Button>
              <ColumnToggle
                columns={VENDOR_COLUMNS}
                visibleColumns={visibleColumns}
                onToggleColumn={toggleColumn}
                onResetToDefaults={resetToDefaults}
                onShowAll={showAll}
                onHideAll={hideAll}
              />
              <ImportExportButtons
                importEnabled={isImportEnabled("vendor")}
                exportEnabled={isExportEnabled("vendor")}
                onImport={handleImport}
                onExport={handleExport}
                onDownloadTemplate={handleDownloadTemplate}
                entityName="Vendors"
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenDialog} size="icon" className="relative">
                    <Plus className="w-4 h-4" />
                    <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? "!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]" : "sm:max-w-[600px]"}`}
                >
                  <div className="absolute right-10 top-4 z-10 flex items-center gap-2">
                    {!isEditing && (
                      <CopyFromIdDialog<Vendor>
                        idLabel="Vendor ID"
                        onFetch={async (id) => {
                          const { data } = await supabase
                            .from("vendors")
                            .select("*")
                            .eq("company_id", companyId!)
                            .eq("vendor_id", id)
                            .maybeSingle();
                          return data;
                        }}
                        onApply={(vendor) => {
                          setFormData((prev) => ({
                            ...prev,
                            name: vendor.name,
                            type: vendor.type,
                            contact_name: vendor.contact_name || "",
                            email: vendor.email || "",
                            phone: vendor.phone || "",
                            address_line1: vendor.address_line1 || "",
                            address_line2: vendor.address_line2 || "",
                            city: vendor.city || "",
                            state: vendor.state || "",
                            postal_code: vendor.postal_code || "",
                            country: vendor.country || "",
                            website: vendor.website || "",
                            payment_terms: vendor.payment_terms?.toString() || "",
                            notes: vendor.notes || "",
                          }));
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setIsMaximized(!isMaximized)}
                      className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                  </div>
                  <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>{isEditing ? "Edit Vendor" : "Create Vendor"}</DialogTitle>
                      <DialogDescription>
                        {isEditing ? "Update vendor details." : "Add a new vendor to your company."}
                      </DialogDescription>
                    </DialogHeader>




                    <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
                      <TabsList className="mx-6 w-fit">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="notes">Notes</TabsTrigger>
                      </TabsList>

                      <TabsContent value="general" className="flex-1 overflow-y-auto px-6 py-4 pb-6 mt-0 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="vendor_id">Vendor ID</Label>
                            <Input
                              id="vendor_id"
                              value={formData.vendor_id}
                              onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                              disabled={isEditing}
                              className={isEditing ? "bg-muted" : ""}
                              required
                            />
                            {!isEditing && (
                              <p className="text-sm text-muted-foreground">Suggested ID from Configuration</p>
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
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                              value={formData.status}
                              onValueChange={(value) => setFormData({ ...formData, status: value as VendorStatus })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VENDOR_STATUSES.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                      {status.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                            <SearchableSelect
                              options={COUNTRY_OPTIONS}
                              value={formData.country}
                              onValueChange={(val) => setFormData({ ...formData, country: val })}
                              placeholder="Select country..."
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
                              placeholder="30"
                            />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="notes" className="flex-1 overflow-y-auto px-6 py-4 pb-6 mt-0">
                        <div className="space-y-2 h-full">
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional notes about this vendor..."
                            className="min-h-[200px]"
                          />
                        </div>
                      </TabsContent>
                    </Tabs>
                    <DialogFooter className="shrink-0">
                      <Button type="submit">
                        {isEditing ? "Update" : "Create"}
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
            <p className="text-muted-foreground mb-4">Add your first vendor to get started.</p>
            <Button onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Vendor
            </Button>
          </div>
        ) : (
          <VendorTable
            vendors={vendors}
            onView={(vendor) => {
              setViewingVendor(vendor);
              setIsViewDialogOpen(true);
            }}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            isColumnVisible={isColumnVisible}
          />
        )}
      </main>

      {/* View Vendor Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent
          className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? "!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]" : "sm:max-w-[550px]"}`}
        >
          <div className="absolute right-10 top-4 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsViewDialogOpen(false);
                if (viewingVendor) handleEdit(viewingVendor);
              }}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
          <DialogHeader>
            <DialogTitle>View Vendor</DialogTitle>
            <DialogDescription>
              {viewingVendor?.vendor_id} - {viewingVendor?.name}
            </DialogDescription>
          </DialogHeader>
          {viewingVendor && (
            <Tabs defaultValue="details" className="w-full px-6 py-4">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1">
                  <History className="w-3.5 h-3.5" /> History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Vendor ID</Label>
                      <p className="font-mono">{viewingVendor.vendor_id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Type</Label>
                      <p>{viewingVendor.type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Status</Label>
                      <p>
                        {(() => {
                          const statusConfig =
                            VENDOR_STATUSES.find((s) => s.value === viewingVendor.status) || VENDOR_STATUSES[0];
                          return <Badge className={`${statusConfig.color} text-white`}>{statusConfig.label}</Badge>;
                        })()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Name</Label>
                    <p className="font-medium">{viewingVendor.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Contact Name</Label>
                      <p>{viewingVendor.contact_name || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Email</Label>
                      <p>{viewingVendor.email || "-"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p>{viewingVendor.phone || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Website</Label>
                      <p>{viewingVendor.website || "-"}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Address</Label>
                    <p>
                      {viewingVendor.address_line1 || "-"}
                      {viewingVendor.address_line2 && (
                        <>
                          <br />
                          {viewingVendor.address_line2}
                        </>
                      )}
                      {(viewingVendor.city || viewingVendor.state || viewingVendor.postal_code) && (
                        <>
                          <br />
                          {[viewingVendor.city, viewingVendor.state, viewingVendor.postal_code]
                            .filter(Boolean)
                            .join(", ")}
                        </>
                      )}
                      {viewingVendor.country && (
                        <>
                          <br />
                          {viewingVendor.country}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="products">
                <VendorProductsTab vendorId={viewingVendor.id} />
              </TabsContent>

              <TabsContent value="notes">
                <div className="space-y-4">
                  <p className="whitespace-pre-wrap">{viewingVendor.notes || "No notes."}</p>
                </div>
              </TabsContent>

              <TabsContent value="history">
                <AuditHistoryTab
                  tableName="vendors"
                  recordId={viewingVendor.id}
                  fieldLabels={{
                    status: "Status",
                    name: "Name",
                    type: "Type",
                    contact_name: "Contact Name",
                    email: "Email",
                    phone: "Phone",
                    website: "Website",
                    address_line1: "Address Line 1",
                    address_line2: "Address Line 2",
                    city: "City",
                    state: "State",
                    postal_code: "Postal Code",
                    country: "Country",
                    notes: "Notes",
                    payment_terms: "Payment Terms",
                  }}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Vendor"
        description={`Are you sure you want to delete vendor "${deletingVendor?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        isBlocked={deleteBlocked}
        blockedReason={deleteBlockedReason}
      />

      {/* Import Progress Dialog */}
      <Dialog open={importProgress.open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Importing Vendors</DialogTitle>
            <DialogDescription>
              Processing row {importProgress.current} of {importProgress.total}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{
                  width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {Math.round(importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0)}%
                complete
              </span>
              <div className="flex gap-4">
                <span className="text-success">{importProgress.imported} imported</span>
                {importProgress.failed > 0 && <span className="text-destructive">{importProgress.failed} failed</span>}
              </div>
            </div>
            {importProgress.current === importProgress.total && importProgress.total > 0 && (
              <p className="text-sm text-center text-muted-foreground">Import complete!</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vendors;
