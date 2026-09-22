import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/use-column-visibility";
import { useTableSort, ColumnFilterConfig } from "@/hooks/use-table-sort";
import { useMaximizedState } from "@/hooks/use-maximize-preference";
import { ColumnToggle } from "@/components/ColumnToggle";
import { SortableTableHead } from "@/components/SortableTableHead";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AuditHistoryTab } from "@/components/AuditHistoryTab";
import { useChangeHistorySettings } from "@/hooks/use-change-history-settings";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { useExcel } from "@/hooks/use-excel";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { ImportProgressDialog, ImportResult } from "@/components/ImportProgressDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Plus, Loader2, Trash2, Pencil, Printer, Box, MoreHorizontal,
  Maximize2, Minimize2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

interface Asset {
  id: string;
  name: string;
  asset_tag: string | null;
  description: string | null;
  procurement_value: number;
  procurement_date: string;
  depreciation_rate: number;
  useful_life_years: number | null;
  salvage_value: number;
  location_id: string | null;
  employee_id: string | null;
  status: string;
  notes: string | null;
}

interface LocationOpt { id: string; name: string; location_id: string }
interface EmployeeOpt { id: string; employee_id: string | null; first_name: string; last_name: string }

const STATUSES = ["active", "in_repair", "retired", "disposed"];

const ASSET_COLUMNS: ColumnDefinition[] = [
  { key: "asset_tag", label: "Tag", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "location", label: "Location", defaultVisible: true },
  { key: "employee", label: "Assigned To", defaultVisible: true },
  { key: "procurement_value", label: "Procurement Value", defaultVisible: true },
  { key: "procurement_date", label: "Procurement Date", defaultVisible: true },
  { key: "depreciation_rate", label: "Depr. %", defaultVisible: true },
  { key: "book_value", label: "Book Value", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

const emptyForm = (): Omit<Asset, "id"> => ({
  name: "", asset_tag: "", description: "",
  procurement_value: 0, procurement_date: format(new Date(), "yyyy-MM-dd"),
  depreciation_rate: 20, useful_life_years: 5, salvage_value: 0,
  location_id: null, employee_id: null, status: "active", notes: "",
});


function computeSchedule(a: Pick<Asset, "procurement_value" | "procurement_date" | "depreciation_rate" | "salvage_value" | "useful_life_years">) {
  const start = parseISO(a.procurement_date);
  const years = Math.max(1, Math.min(50, a.useful_life_years || Math.ceil(100 / Math.max(0.01, a.depreciation_rate))));
  const annual = (a.procurement_value * a.depreciation_rate) / 100;
  const points: { year: string; value: number }[] = [];
  let v = a.procurement_value;
  points.push({ year: String(start.getFullYear()), value: Math.round(v * 100) / 100 });
  for (let i = 1; i <= years; i++) {
    v = Math.max(a.salvage_value, v - annual);
    points.push({ year: String(start.getFullYear() + i), value: Math.round(v * 100) / 100 });
    if (v <= a.salvage_value) break;
  }
  return points;
}

function currentBookValue(a: Asset) {
  const start = parseISO(a.procurement_date);
  const now = new Date();
  const years = Math.max(0, (now.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000));
  const depreciated = (a.procurement_value * a.depreciation_rate / 100) * years;
  return Math.max(a.salvage_value, a.procurement_value - depreciated);
}

function barcodeDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, value, { format: "CODE128", width: 2, height: 60, displayValue: false, margin: 0 });
  } catch { return ""; }
  return canvas.toDataURL("image/png");
}

function printAssetBarcode(a: Asset) {
  const labelW = 100, labelH = 50;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [labelW, labelH] });
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  const name = a.name.length > 36 ? a.name.slice(0, 36) + "…" : a.name;
  doc.text(name, 3, 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Tag: ${a.asset_tag || a.id.slice(0, 8)}`, 3, 13);
  const code = a.asset_tag || a.id;
  const url = barcodeDataUrl(code);
  if (url) doc.addImage(url, "PNG", 10, 17, 80, 22);
  doc.setFontSize(8);
  doc.text(code, labelW / 2, 44, { align: "center" });
  doc.save(`asset-${a.asset_tag || a.id.slice(0, 8)}.pdf`);
}

const Assets = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const { isHistoryEnabled } = useChangeHistorySettings(companyId);
  const historyEnabled = isHistoryEnabled("asset");
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();

  const [importOpen, setImportOpen] = useState(false);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importComplete, setImportComplete] = useState(false);

  const { visibleColumns, isColumnVisible, toggleColumn, resetToDefaults, showAll, hideAll } =
    useColumnVisibility("assets", ASSET_COLUMNS);

  const { sortConfig, handleSort, setFilter, getFilterConfig, sortedAndFilteredData } =
    useTableSort<Asset>(assets, "name", "asc");

  const handleFilterConfig = (key: string, config: ColumnFilterConfig | null) => {
    if (config) setFilter(key, config); else setFilter(key, "");
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isViewMaximized, setIsViewMaximized] = useMaximizedState();
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("company_id").eq("user_id", user.id).single()
        .then(({ data }) => setCompanyId((data?.company_id as string) || null));
    }
  }, [user]);

  useEffect(() => {
    if (companyId) { void fetchAssets(); void fetchLocations(); }
  }, [companyId]);

  useEffect(() => {
    if (isDialogOpen) setTransaction(editingAsset ? "asset/edit" : "asset/new");
    else setTransaction("asset");
  }, [isDialogOpen, editingAsset, setTransaction]);

  async function fetchAssets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("assets" as any).select("*")
      .eq("company_id", companyId!).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setAssets((data || []) as any);
    setLoading(false);
  }

  async function fetchLocations() {
    const { data } = await supabase
      .from("locations").select("id, name, location_id")
      .eq("company_id", companyId!).order("name");
    setLocations((data || []) as any);
  }

  async function fetchEmployees() {
    const { data } = await supabase
      .from("employees").select("id, employee_id, first_name, last_name")
      .eq("company_id", companyId!).order("first_name");
    setEmployees((data || []) as any);
  }



  const handleAddClick = async () => {
    setEditingAsset(null);
    let nextTag = "";
    if (companyId) {
      const { data } = await supabase.rpc("get_next_asset_id" as any, { p_company_id: companyId });
      nextTag = (data as string) || "";
    }
    setForm({ ...emptyForm(), asset_tag: nextTag });
    setIsDialogOpen(true);
  };

  const handleEditClick = (a: Asset) => {
    setEditingAsset(a);
    setForm({
      name: a.name, asset_tag: a.asset_tag || "", description: a.description || "",
      procurement_value: a.procurement_value, procurement_date: a.procurement_date,
      depreciation_rate: a.depreciation_rate, useful_life_years: a.useful_life_years,
      salvage_value: a.salvage_value, location_id: a.location_id,
      employee_id: a.employee_id ?? null, status: a.status,
      notes: a.notes || "",
    });
    setIsDialogOpen(true);
  };

  useKeyboardShortcut("n", handleAddClick);
  useTransactionAction("new", handleAddClick);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Please enter a name"); return; }
    setIsSubmitting(true);
    try {
      const payload: any = {
        ...form,
        company_id: companyId,
        name: form.name.trim(),
        asset_tag: form.asset_tag?.trim() || null,
        description: form.description?.trim() || null,
        notes: form.notes?.trim() || null,
        location_id: form.location_id || null,
        useful_life_years: form.useful_life_years || null,
      };
      const q = editingAsset
        ? supabase.from("assets" as any).update(payload).eq("id", editingAsset.id)
        : supabase.from("assets" as any).insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast.success(editingAsset ? "Asset updated" : "Asset created");
      setIsDialogOpen(false);
      await fetchAssets();
    } catch (e: any) {
      toast.error(e.message || "Failed to save asset");
    } finally {
      setIsSubmitting(false);
    }
  };

  useSaveShortcut(() => {
    if (isDialogOpen && !isSubmitting) handleSubmit();
  }, isDialogOpen);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    const { error } = await supabase.from("assets" as any).delete().eq("id", id);
    if (error) toast.error("Failed to delete asset");
    else { toast.success("Asset deleted"); fetchAssets(); }
  };

  const ASSET_TEMPLATE_COLUMNS = [
    { header: "Name", key: "Name", width: 25 },
    { header: "Tag", key: "Tag", width: 16 },
    { header: "Description", key: "Description", width: 30 },
    { header: "Procurement Value", key: "Procurement Value", width: 18 },
    { header: "Procurement Date", key: "Procurement Date", width: 18 },
    { header: "Depreciation Rate", key: "Depreciation Rate", width: 18 },
    { header: "Useful Life Years", key: "Useful Life Years", width: 18 },
    { header: "Salvage Value", key: "Salvage Value", width: 16 },
    { header: "Location", key: "Location", width: 20 },
    { header: "Status", key: "Status", width: 14 },
    { header: "Notes", key: "Notes", width: 30 },
  ];

  const handleDownloadTemplate = async () => {
    const sampleRow = {
      Name: "Forklift",
      Tag: "",
      Description: "Electric forklift",
      "Procurement Value": 25000,
      "Procurement Date": format(new Date(), "yyyy-MM-dd"),
      "Depreciation Rate": 20,
      "Useful Life Years": 5,
      "Salvage Value": 1000,
      Location: locations[0]?.name || "",
      Status: "active",
      Notes: "",
    };
    await exportToExcel([sampleRow], "asset_import_template.xlsx", "Assets", ASSET_TEMPLATE_COLUMNS);
    toast.success("Template downloaded");
  };

  const handleExport = async () => {
    if (assets.length === 0) { toast.info("No assets to export"); return; }
    const rows = sortedAndFilteredData.map((a) => ({
      Name: a.name,
      Tag: a.asset_tag || "",
      Description: a.description || "",
      "Procurement Value": a.procurement_value,
      "Procurement Date": a.procurement_date,
      "Depreciation Rate": a.depreciation_rate,
      "Useful Life Years": a.useful_life_years ?? "",
      "Salvage Value": a.salvage_value,
      Location: locations.find((l) => l.id === a.location_id)?.name || "",
      Status: a.status,
      "Book Value": Math.round(currentBookValue(a) * 100) / 100,
      Notes: a.notes || "",
    }));
    await exportToExcel(rows, `assets_${format(new Date(), "yyyy-MM-dd")}.xlsx`, "Assets");
    toast.success(`Exported ${rows.length} asset${rows.length > 1 ? "s" : ""}`);
  };

  const handleImport = async (file: File) => {
    if (!companyId) return;
    let rows: Record<string, any>[] = [];
    try {
      rows = await readExcel(file);
    } catch {
      toast.error("Failed to read file");
      return;
    }
    if (rows.length === 0) { toast.error("No data found in file"); return; }

    setImportResults([]);
    setImportProcessed(0);
    setImportTotal(rows.length);
    setImportComplete(false);
    setImportOpen(true);

    const results: ImportResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const name = row["Name"]?.toString()?.trim();
      if (!name) {
        results.push({ row: rowNum, status: "error", message: "Missing Name" });
        setImportResults([...results]);
        setImportProcessed(i + 1);
        continue;
      }
      try {
        let tag = row["Tag"]?.toString()?.trim() || "";
        if (!tag) {
          const { data } = await supabase.rpc("get_next_asset_id" as any, { p_company_id: companyId });
          tag = (data as string) || "";
        }
        const locName = row["Location"]?.toString()?.trim();
        const loc = locName
          ? locations.find(
              (l) =>
                l.name.toLowerCase() === locName.toLowerCase() ||
                l.location_id?.toLowerCase() === locName.toLowerCase(),
            )
          : null;
        const statusRaw = row["Status"]?.toString()?.trim()?.toLowerCase();
        const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
        const dateRaw = row["Procurement Date"];
        let procurementDate = format(new Date(), "yyyy-MM-dd");
        if (dateRaw instanceof Date) procurementDate = format(dateRaw, "yyyy-MM-dd");
        else if (dateRaw) procurementDate = dateRaw.toString().slice(0, 10);

        const { error } = await supabase.from("assets" as any).insert({
          company_id: companyId,
          name,
          asset_tag: tag || null,
          description: row["Description"]?.toString()?.trim() || null,
          procurement_value: num(row["Procurement Value"]) ?? 0,
          procurement_date: procurementDate,
          depreciation_rate: num(row["Depreciation Rate"]) ?? 0,
          useful_life_years: num(row["Useful Life Years"]),
          salvage_value: num(row["Salvage Value"]) ?? 0,
          location_id: loc?.id || null,
          status: STATUSES.includes(statusRaw || "") ? statusRaw : "active",
          notes: row["Notes"]?.toString()?.trim() || null,
        });
        if (error) throw error;
        results.push({ row: rowNum, status: "success", message: `Created ${name}` });
      } catch (e: any) {
        results.push({ row: rowNum, status: "error", message: e?.message || "Failed to create asset" });
      }
      setImportResults([...results]);
      setImportProcessed(i + 1);
    }

    setImportComplete(true);
    await fetchAssets();
  };

  const locationLabel = (id: string | null) =>
    locations.find(l => l.id === id)?.name || "-";

  const employeeLabel = (id: string | null | undefined) => {
    const e = employees.find(emp => emp.id === id);
    return e ? `${e.first_name} ${e.last_name}`.trim() : "-";
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
                <Box className="w-7 h-7 text-fuchsia-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Assets</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ColumnToggle
                columns={ASSET_COLUMNS}
                visibleColumns={visibleColumns}
                onToggleColumn={toggleColumn}
                onResetToDefaults={resetToDefaults}
                onShowAll={showAll}
                onHideAll={hideAll}
              />
              <ImportExportButtons
                importEnabled={isImportEnabled("asset")}
                exportEnabled={isExportEnabled("asset")}
                onImport={handleImport}
                onExport={handleExport}
                onDownloadTemplate={handleDownloadTemplate}
                entityName="Assets"
              />
              <Button onClick={handleAddClick} variant="default" size="icon" className="relative">
                <Plus className="w-4 h-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {assets.length === 0 ? (
          <div className="text-center py-12">
            <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No assets yet</h3>
            <p className="text-muted-foreground mb-4">Create your first asset to track procurement and depreciation</p>
            <Button onClick={handleAddClick}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Asset
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {isColumnVisible("asset_tag") && (
                    <SortableTableHead label="Tag" sortKey="asset_tag" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig("asset_tag")} onFilterConfig={handleFilterConfig} filterKey="asset_tag" />
                  )}
                  {isColumnVisible("name") && (
                    <SortableTableHead label="Name" sortKey="name" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig("name")} onFilterConfig={handleFilterConfig} filterKey="name" />
                  )}
                  {isColumnVisible("location") && (
                    <SortableTableHead label="Location" sortKey="location_id" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig("location_id")} onFilterConfig={handleFilterConfig} filterKey="location_id" />
                  )}
                  {isColumnVisible("procurement_value") && (
                    <SortableTableHead label="Procurement Value" sortKey="procurement_value" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig("procurement_value")} onFilterConfig={handleFilterConfig} filterKey="procurement_value" className="text-right" />
                  )}
                  {isColumnVisible("procurement_date") && (
                    <SortableTableHead label="Procurement Date" sortKey="procurement_date" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig("procurement_date")} onFilterConfig={handleFilterConfig} filterKey="procurement_date" />
                  )}
                  {isColumnVisible("depreciation_rate") && (
                    <SortableTableHead label="Depr. %" sortKey="depreciation_rate" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig("depreciation_rate")} onFilterConfig={handleFilterConfig} filterKey="depreciation_rate" className="text-right" />
                  )}
                  {isColumnVisible("book_value") && (
                    <TableHead className="text-right">Book Value</TableHead>
                  )}
                  {isColumnVisible("status") && (
                    <SortableTableHead label="Status" sortKey="status" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig("status")} onFilterConfig={handleFilterConfig} filterKey="status" />
                  )}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredData.map((a) => (
                  <TableRow key={a.id}>
                    {isColumnVisible("asset_tag") && (
                      <TableCell className="font-mono">
                        <button
                          type="button"
                          onClick={() => { setViewingAsset(a); setIsViewDialogOpen(true); }}
                          className="text-primary hover:underline"
                        >
                          {a.asset_tag || a.id.slice(0, 8)}
                        </button>
                      </TableCell>
                    )}
                    {isColumnVisible("name") && (
                      <TableCell className="font-medium">{a.name}</TableCell>
                    )}
                    {isColumnVisible("location") && (
                      <TableCell className="text-muted-foreground">{locationLabel(a.location_id)}</TableCell>
                    )}
                    {isColumnVisible("procurement_value") && (
                      <TableCell className="text-right font-mono">${a.procurement_value.toFixed(2)}</TableCell>
                    )}
                    {isColumnVisible("procurement_date") && (
                      <TableCell>{format(parseISO(a.procurement_date), "MMM d, yyyy")}</TableCell>
                    )}
                    {isColumnVisible("depreciation_rate") && (
                      <TableCell className="text-right font-mono">{a.depreciation_rate}%</TableCell>
                    )}
                    {isColumnVisible("book_value") && (
                      <TableCell className="text-right font-mono">${currentBookValue(a).toFixed(2)}</TableCell>
                    )}
                    {isColumnVisible("status") && (
                      <TableCell><Badge variant="secondary">{a.status}</Badge></TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => printAssetBarcode(a)} title="Print barcode">
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(a)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDelete(a.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
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
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
            <DialogDescription>
              {editingAsset ? "Update asset details and depreciation settings" : "Track procurement value and depreciation over time"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
            <div className="px-6 pt-2">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="asset_tag">Asset Tag</Label>
                    <Input id="asset_tag" value={form.asset_tag || ""}
                      onChange={(e) => setForm({ ...form, asset_tag: e.target.value })}
                      placeholder="e.g., AST-0001" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Forklift #3" />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <SearchableSelect
                    options={locations.map(l => ({ value: l.id, label: l.name, sublabel: l.location_id }))}
                    value={form.location_id || ""}
                    onValueChange={(v) => setForm({ ...form, location_id: v || null })}
                    placeholder="Select location"
                    allowClear
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={form.description || ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional description..." rows={2} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="depreciation" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="procurement_value">Procurement Value *</Label>
                    <Input id="procurement_value" type="number" step="0.01" min="0"
                      value={form.procurement_value}
                      onChange={(e) => setForm({ ...form, procurement_value: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="procurement_date">Procurement Date *</Label>
                    <Input id="procurement_date" type="date" value={form.procurement_date}
                      onChange={(e) => setForm({ ...form, procurement_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depreciation_rate">Depreciation Rate (% / yr) *</Label>
                    <Input id="depreciation_rate" type="number" step="0.01" min="0" max="100"
                      value={form.depreciation_rate}
                      onChange={(e) => setForm({ ...form, depreciation_rate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="useful_life">Useful Life (years)</Label>
                    <Input id="useful_life" type="number" min="0"
                      value={form.useful_life_years || ""}
                      onChange={(e) => setForm({ ...form, useful_life_years: parseInt(e.target.value) || null })} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="salvage">Salvage Value</Label>
                    <Input id="salvage" type="number" step="0.01" min="0"
                      value={form.salvage_value}
                      onChange={(e) => setForm({ ...form, salvage_value: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4">
                <Textarea value={form.notes || ""} rows={12}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Add notes about this asset..." />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingAsset ? "Update" : "Create"}
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Asset Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent
          className={isViewMaximized ? "!max-w-none !w-screen !h-screen !max-h-screen !rounded-none" : "sm:max-w-[700px]"}
        >
          <div className="absolute right-10 top-4 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={() => viewingAsset && printAssetBarcode(viewingAsset)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
              title="Print barcode"
            >
              <Printer className="h-4 w-4" />
              <span className="sr-only">Print barcode</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsViewDialogOpen(false);
                if (viewingAsset) handleEditClick(viewingAsset);
              }}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
              title="Modify"
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Modify</span>
            </button>
            <button
              type="button"
              onClick={() => setIsViewMaximized(!isViewMaximized)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            >
              {isViewMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
          <DialogHeader>
            <DialogTitle>View Asset</DialogTitle>
            <DialogDescription>
              {viewingAsset?.asset_tag || viewingAsset?.id.slice(0, 8)} - {viewingAsset?.name}
            </DialogDescription>
          </DialogHeader>
          {viewingAsset && (
            <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0">
              <div className="px-6 pt-2">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  {historyEnabled && <TabsTrigger value="history">History</TabsTrigger>}
                </TabsList>
              </div>

              <TabsContent value="overview" className="flex-1 overflow-y-auto mt-0">
                <DialogBody className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Tag</Label>
                      <p className="font-mono text-sm">{viewingAsset.asset_tag || viewingAsset.id.slice(0, 8)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Status</Label>
                      <div className="mt-1"><Badge variant="secondary">{viewingAsset.status}</Badge></div>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Name</Label>
                      <p className="text-sm font-medium">{viewingAsset.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Location</Label>
                      <p className="text-sm">{locationLabel(viewingAsset.location_id)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Procurement Date</Label>
                      <p className="text-sm">{format(parseISO(viewingAsset.procurement_date), "MMM d, yyyy")}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Procurement Value</Label>
                      <p className="font-mono text-sm">${viewingAsset.procurement_value.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Salvage Value</Label>
                      <p className="font-mono text-sm">${viewingAsset.salvage_value.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Depreciation Rate</Label>
                      <p className="font-mono text-sm">{viewingAsset.depreciation_rate}% / yr</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Useful Life</Label>
                      <p className="text-sm">{viewingAsset.useful_life_years ? `${viewingAsset.useful_life_years} yrs` : "-"}</p>
                    </div>
                    <div className="col-span-2 rounded-md border bg-primary/5 border-primary/30 p-3">
                      <Label className="text-muted-foreground text-xs">Current Book Value</Label>
                      <p className="text-lg font-semibold text-primary">${currentBookValue(viewingAsset).toFixed(2)}</p>
                    </div>
                    {viewingAsset.description && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground text-xs">Description</Label>
                        <p className="text-sm whitespace-pre-wrap">{viewingAsset.description}</p>
                      </div>
                    )}
                  </div>
                </DialogBody>
              </TabsContent>

              <TabsContent value="depreciation" className="flex-1 overflow-y-auto mt-0">
                <DialogBody>
                  <div className="rounded-md border p-4 bg-card">
                    <h3 className="font-medium mb-3">Depreciation Schedule (Straight-line)</h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={computeSchedule(viewingAsset)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="year" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                            formatter={(v: any) => `$${Number(v).toFixed(2)}`}
                          />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="mt-4 border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Year</TableHead><TableHead className="text-right">Book Value</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {computeSchedule(viewingAsset).map(p => (
                          <TableRow key={p.year}>
                            <TableCell>{p.year}</TableCell>
                            <TableCell className="text-right font-mono">${p.value.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </DialogBody>
              </TabsContent>

              <TabsContent value="notes" className="flex-1 overflow-y-auto mt-0">
                <DialogBody>
                  {viewingAsset.notes ? (
                    <p className="text-sm whitespace-pre-wrap">{viewingAsset.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No notes for this asset.</p>
                  )}
                </DialogBody>
              </TabsContent>

              {historyEnabled && (
                <TabsContent value="history" className="flex-1 overflow-y-auto mt-0">
                  <DialogBody>
                    <AuditHistoryTab tableName="assets" recordId={viewingAsset.id} />
                  </DialogBody>
                </TabsContent>
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ImportProgressDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importing Assets"
        totalRows={importTotal}
        processedRows={importProcessed}
        results={importResults}
        isComplete={importComplete}
      />
    </div>
  );
};

export default Assets;
