import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTransaction } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Database, Search, RefreshCw, Table as TableIcon, X, PanelLeftClose, PanelLeft, Trash2, Download, ArrowUp, ArrowDown, Filter, Zap, SearchCheck, Settings2 } from "lucide-react";
import { DatabaseOptionsDialog } from "@/components/data-explorer/DatabaseOptionsDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Kbd } from "@/components/ui/kbd";
import { useStatusMessage } from "@/hooks/use-status-message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useExcel } from "@/hooks/use-excel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ImportProgressDialog, ImportResult } from "@/components/ImportProgressDialog";
const AVAILABLE_TABLES = [
  "accounts",
  "areas",
  "assignments",
  "audit_log",
  "batches",
  "bill_of_materials",
  "bin_products",
  "bins",
  "bom_items",
  "bom_step_items",
  "bom_steps",
  "calendar_events",
  "carriers",
  "companies",
  "company_settings",
  "conversation_participants",
  "conversations",
  "credit_memo_items",
  "credit_memos",
  "customers",
  "debit_memo_items",
  "debit_memos",
  "deliveries",
  "delivery_items",
  "developer_keys",
  "document_id_config",
  "employee_reviews",
  "employees",
  "goods_issue_items",
  "goods_issues",
  "goods_receipt_items",
  "goods_receipts",
  "help_documents",
  "help_folders",
  "inventory",
  "inventory_count_items",
  "inventory_counts",
  "invitations",
  "invoice_items",
  "invoice_tax_rates",
  "invoices",
  "ledger_transactions",
  "ledgers",
  "location_users",
  "locations",
  "material_movements",
  "messages",
  "outbound_deliveries",
  "outbound_delivery_items",
  "packaging_units",
  "payments",
  "pos_location_products",
  "pos_location_rates",
  "position_locations",
  "positions",
  "product_components",
  "product_safety_stock",
  "product_uoms",
  "production_order_consumptions",
  "production_order_items",
  "production_orders",
  "products",
  "profiles",
  "purchase_order_items",
  "purchase_order_tax_rates",
  "purchase_orders",
  "requisition_items",
  "requisitions",
  "routes",
  "sales_order_items",
  "sales_order_tax_rates",
  "sales_orders",
  "tasks",
  "tax_rates",
  "team_members",
  "teams",
  "time_off_requests",
  "time_punches",
  "user_preferences",
  "user_roles",
  "user_transaction_access",
  "vendors",
  "work_tasks",
];

interface TableTab {
  id: string;
  tableName: string;
  data: Record<string, unknown>[];
  columns: string[];
  isLoading: boolean;
  recordCount: number;
  searchTerm: string;
  selectedRows: Set<number>;
  sortKey: string | null;
  sortDirection: 'asc' | 'desc' | null;
  columnFilters: Record<string, string>;
}

export default function DataExplorer() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  useTransaction('dexp');
  const status = useStatusMessage();
  const { exportToExcel } = useExcel();
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasITRole, setHasITRole] = useState(false);
  const [allowMassDeletion, setAllowMassDeletion] = useState(false);
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabs, setTabs] = useState<TableTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [dbOptionsOpen, setDbOptionsOpen] = useState(false);

  // Extended search state
  const [extOpen, setExtOpen] = useState(false);
  const [extTable, setExtTable] = useState<string | null>(null);
  const [extColumns, setExtColumns] = useState<string[]>([]);
  const [extInputs, setExtInputs] = useState<Record<string, { from: string; to: string }>>({});
  const [extTableFilter, setExtTableFilter] = useState("");
  const [extLoadingCols, setExtLoadingCols] = useState(false);
  const [extRunning, setExtRunning] = useState(false);

  const openExtSearch = () => {
    setExtTable(null);
    setExtColumns([]);
    setExtInputs({});
    setExtTableFilter("");
    setExtOpen(true);
  };

  const selectExtTable = async (table: string) => {
    setExtTable(table);
    setExtInputs({});
    setExtColumns([]);
    setExtLoadingCols(true);
    const { data, error } = await supabase.from(table as "accounts").select("*").limit(1);
    if (!error && data && data.length > 0) {
      setExtColumns(Object.keys(data[0]).filter((c) => c !== "company_id"));
      setExtLoadingCols(false);
      return;
    }
    // Fallback: fetch column metadata from information_schema via RPC
    const { data: cols, error: rpcErr } = await (supabase as any).rpc("get_table_columns", { p_table: table });
    setExtLoadingCols(false);
    if (rpcErr) {
      status.error(`Failed to load columns: ${rpcErr.message}`);
      return;
    }
    if (cols && cols.length > 0) {
      setExtColumns(cols.map((c: { column_name: string }) => c.column_name).filter((c: string) => c !== "company_id"));
    } else {
      status.info("No columns found for this table");
    }
  };

  const updateExtInput = (col: string, key: "from" | "to", value: string) => {
    setExtInputs(prev => ({
      ...prev,
      [col]: { from: prev[col]?.from ?? "", to: prev[col]?.to ?? "", [key]: value },
    }));
  };

  const runExtendedSearch = async () => {
    if (!extTable) return;
    const hasWild = (v: string) => v.includes("*") || v.includes("%");
    const toPattern = (v: string) => v.replace(/\*/g, "%");

    setExtRunning(true);
    let q: any = supabase.from(extTable as "accounts").select("*", { count: "exact" }).limit(500);

    for (const [col, { from, to }] of Object.entries(extInputs)) {
      const f = (from ?? "").trim();
      const t = (to ?? "").trim();
      if (!f && !t) continue;

      if (f) {
        if (hasWild(f)) q = q.ilike(col, toPattern(f));
        else q = q.gte(col, f);
      }
      if (t) {
        if (hasWild(t)) q = q.ilike(col, toPattern(t));
        else q = q.lte(col, t);
      }
    }

    const { data, error, count } = await q;
    setExtRunning(false);

    if (error) {
      status.error(`Search failed: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const cols = rows.length > 0 ? Object.keys(rows[0]) : extColumns;
    const newTabId = `${extTable}-search-${Date.now()}`;
    setTabs(prev => [...prev, {
      id: newTabId,
      tableName: extTable,
      data: rows,
      columns: cols,
      isLoading: false,
      recordCount: count ?? rows.length,
      searchTerm: "",
      selectedRows: new Set(),
      sortKey: null,
      sortDirection: null,
      columnFilters: {},
    }]);
    setActiveTabId(newTabId);
    setExtOpen(false);
    status.success(`Found ${rows.length} record(s) in ${extTable}`);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Check if user has IT role for delete permissions
  useEffect(() => {
    const checkITRole = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      
      if (!profile?.company_id) return;
      
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", profile.company_id)
        .in("role", ["it", "owner", "admin"]);
      
      setHasITRole(roleData && roleData.length > 0);

      // Fetch mass deletion setting
      const { data: settingData } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", profile.company_id)
        .eq("setting_key", "process_controls")
        .maybeSingle();
      if (settingData?.setting_value && typeof settingData.setting_value === "object" && !Array.isArray(settingData.setting_value)) {
        const val = settingData.setting_value as Record<string, unknown>;
        setAllowMassDeletion((val.allow_mass_deletion as boolean) ?? false);
      }
    };
    
    checkITRole();
  }, [user]);

  // F2 keyboard shortcut to close active tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && activeTabId) {
        e.preventDefault();
        setTabs(prev => {
          const newTabs = prev.filter(t => t.id !== activeTabId);
          if (newTabs.length > 0) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
          } else {
            setActiveTabId(null);
          }
          return newTabs;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId]);

  const fetchTableData = async (tableName: string): Promise<{ data: Record<string, unknown>[]; columns: string[]; count: number }> => {
    try {
      const { data: tableData, error, count } = await supabase
        .from(tableName as "accounts")
        .select("*", { count: "exact" })
        .limit(500);

      if (error) {
        status.error(`Error fetching data: ${error.message}`);
        return { data: [], columns: [], count: 0 };
      }

      if (tableData && tableData.length > 0) {
        const cols = Object.keys(tableData[0]);
        status.success(`Loaded ${tableData.length} records from ${tableName}`);
        return { data: tableData as Record<string, unknown>[], columns: cols, count: count || tableData.length };
      } else {
        status.info(`No records found in ${tableName}`);
        return { data: [], columns: [], count: 0 };
      }
    } catch (err) {
      status.error("Failed to fetch table data");
      console.error(err);
      return { data: [], columns: [], count: 0 };
    }
  };

  const openTable = async (tableName: string) => {
    // Check if tab already exists
    const existingTab = tabs.find(t => t.tableName === tableName);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTabId = `${tableName}-${Date.now()}`;
    const newTab: TableTab = {
      id: newTabId,
      tableName,
      data: [],
      columns: [],
      isLoading: true,
      recordCount: 0,
      searchTerm: "",
      selectedRows: new Set(),
      sortKey: null,
      sortDirection: null,
      columnFilters: {},
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);

    const result = await fetchTableData(tableName);
    
    setTabs(prev => prev.map(tab => 
      tab.id === newTabId 
        ? { ...tab, data: result.data, columns: result.columns, recordCount: result.count, isLoading: false }
        : tab
    ));
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      return newTabs;
    });
  };

  const refreshTab = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, isLoading: true } : t));
    const result = await fetchTableData(tab.tableName);
    setTabs(prev => prev.map(t => 
      t.id === tabId 
        ? { ...t, data: result.data, columns: result.columns, recordCount: result.count, isLoading: false }
        : t
    ));
  };

  const updateTabSearch = (tabId: string, searchTerm: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, searchTerm } : t));
  };

  const handleSort = (tabId: string, columnKey: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t;
      let newDirection: 'asc' | 'desc' | null = 'asc';
      if (t.sortKey === columnKey) {
        if (t.sortDirection === 'asc') newDirection = 'desc';
        else if (t.sortDirection === 'desc') newDirection = null;
      }
      return { 
        ...t, 
        sortKey: newDirection ? columnKey : null, 
        sortDirection: newDirection,
        selectedRows: new Set() 
      };
    }));
  };

  const setColumnFilter = (tabId: string, column: string, value: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t;
      const newFilters = { ...t.columnFilters };
      if (value) {
        newFilters[column] = value;
      } else {
        delete newFilters[column];
      }
      return { ...t, columnFilters: newFilters, selectedRows: new Set() };
    }));
  };

  const toggleRowSelection = (tabId: string, rowIndex: number) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t;
      const newSelected = new Set(t.selectedRows);
      if (newSelected.has(rowIndex)) {
        newSelected.delete(rowIndex);
      } else {
        newSelected.add(rowIndex);
      }
      return { ...t, selectedRows: newSelected };
    }));
  };

  const toggleAllSelection = (tabId: string, filteredData: Record<string, unknown>[]) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t;
      const allSelected = t.selectedRows.size === filteredData.length && filteredData.length > 0;
      return { ...t, selectedRows: allSelected ? new Set() : new Set(filteredData.map((_, i) => i)) };
    }));
  };

  // Delete progress dialog state
  const [deleteProgressOpen, setDeleteProgressOpen] = useState(false);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [deleteProcessed, setDeleteProcessed] = useState(0);
  const [deleteResults, setDeleteResults] = useState<ImportResult[]>([]);
  const [deleteComplete, setDeleteComplete] = useState(false);

  const handleDeleteSelected = async (tab: TableTab, filteredData: Record<string, unknown>[]) => {
    const selectedData = Array.from(tab.selectedRows).map(i => filteredData[i]).filter(Boolean);
    if (selectedData.length === 0) return;

    setIsDeleting(true);
    setDeleteResults([]);
    setDeleteProcessed(0);
    setDeleteTotal(selectedData.length);
    setDeleteComplete(false);
    setDeleteProgressOpen(true);

    let successCount = 0;
    let errorCount = 0;

    for (let idx = 0; idx < selectedData.length; idx++) {
      const row = selectedData[idx];
      const id = row.id as string;
      if (!id) {
        errorCount++;
        setDeleteResults(prev => [...prev, { row: idx + 1, status: 'error' as const, message: 'No id field' }]);
        setDeleteProcessed(prev => prev + 1);
        continue;
      }
      const { error } = await supabase.from(tab.tableName as "accounts").delete().eq("id", id);
      if (error) {
        errorCount++;
        setDeleteResults(prev => [...prev, { row: idx + 1, status: 'error' as const, message: error.message }]);
      } else {
        successCount++;
        setDeleteResults(prev => [...prev, { row: idx + 1, status: 'success' as const, message: `Deleted ${id.slice(0, 8)}…` }]);
      }
      setDeleteProcessed(prev => prev + 1);
    }

    setDeleteComplete(true);
    setIsDeleting(false);
    
    if (successCount > 0) {
      status.success(`Deleted ${successCount} record(s)`);
      refreshTab(tab.id);
    }
    if (errorCount > 0) {
      status.error(`Failed to delete ${errorCount} record(s)`);
    }
    
    setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, selectedRows: new Set() } : t));
  };

  const handleMassDeleteSelected = async (tab: TableTab, filteredData: Record<string, unknown>[]) => {
    const selectedData = Array.from(tab.selectedRows).map(i => filteredData[i]).filter(Boolean);
    if (selectedData.length === 0) return;

    const ids = selectedData.map(row => row.id as string).filter(Boolean);
    if (ids.length === 0) {
      status.error("No records with id field found");
      return;
    }

    setIsDeleting(true);
    const { error, count } = await supabase
      .from(tab.tableName as "accounts")
      .delete({ count: 'exact' })
      .in("id", ids);
    setIsDeleting(false);

    if (error) {
      status.error(`Mass delete failed: ${error.message}`);
    } else {
      status.success(`Mass deleted ${count ?? ids.length} record(s)`);
      refreshTab(tab.id);
    }

    setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, selectedRows: new Set() } : t));
  };

  const handleExportSelected = async (tab: TableTab, filteredData: Record<string, unknown>[]) => {
    const selectedData = Array.from(tab.selectedRows).map(i => filteredData[i]).filter(Boolean);
    if (selectedData.length === 0) return;

    await exportToExcel(selectedData, `${tab.tableName}_export.xlsx`, tab.tableName);
    status.success(`Exported ${selectedData.length} record(s)`);
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  const getFilteredData = (tab: TableTab) => {
    let result = [...tab.data];
    
    // Apply column filters
    Object.entries(tab.columnFilters).forEach(([col, filterValue]) => {
      if (filterValue) {
        result = result.filter(row => {
          const cellValue = row[col];
          if (cellValue === null || cellValue === undefined) return false;
          return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });
    
    // Apply global search
    if (tab.searchTerm) {
      result = result.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(tab.searchTerm.toLowerCase())
        )
      );
    }
    
    // Apply sorting
    if (tab.sortKey && tab.sortDirection) {
      result.sort((a, b) => {
        const aVal = a[tab.sortKey!];
        const bVal = b[tab.sortKey!];
        
        if (aVal === null || aVal === undefined) return tab.sortDirection === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return tab.sortDirection === 'asc' ? -1 : 1;
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return tab.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return tab.sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    
    return result;
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value).toLocaleString();
    }
    return String(value);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-background h-16 flex items-center px-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
          <ArrowLeft className="h-5 w-5" />
          <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
        </Button>
        <Database className="h-5 w-5 text-primary ml-2" />
        <h1 className="font-semibold ml-2">Data Explorer</h1>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="ml-4"
        >
          {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={openExtSearch}
          className="ml-2"
          title="Extended search"
        >
          <SearchCheck className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDbOptionsOpen(true)}
          className="ml-2"
          title="Database options"
        >
          <Settings2 className="h-5 w-5" />
        </Button>

        {activeTab && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="icon" onClick={() => refreshTab(activeTab.id)} disabled={activeTab.isLoading}>
              <RefreshCw className={cn("h-4 w-4", activeTab.isLoading && "animate-spin")} />
            </Button>
            
            {activeTab.selectedRows.size > 0 && (
              <>
                {hasITRole && allowMassDeletion && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isDeleting}>
                        <Zap className="h-4 w-4 mr-1" />
                        Mass Delete ({activeTab.selectedRows.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Mass Delete Records</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to mass delete {activeTab.selectedRows.size} record(s) at once? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleMassDeleteSelected(activeTab, getFilteredData(activeTab))}>
                          Mass Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {hasITRole && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete ({activeTab.selectedRows.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Records</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {activeTab.selectedRows.size} record(s)? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteSelected(activeTab, getFilteredData(activeTab))}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button variant="outline" size="sm" onClick={() => handleExportSelected(activeTab, getFilteredData(activeTab))}>
                  <Download className="h-4 w-4 mr-1" />
                  Export ({activeTab.selectedRows.size})
                </Button>
              </>
            )}
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search records..."
                value={activeTab.searchTerm}
                onChange={(e) => updateTabSearch(activeTab.id, e.target.value)}
                className="pl-8 w-[250px]"
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {getFilteredData(activeTab).length} of {activeTab.recordCount} records
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className={cn(
          "border-r bg-muted/30 shrink-0 flex flex-col min-h-0 transition-all duration-200",
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-56"
        )}>
          {/* Search stays fixed above the scrolling table list so it's never clipped */}
          <div className="p-2 pb-1 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter tables..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
            <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Tables</div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-2 pb-2">
              {AVAILABLE_TABLES.filter(t => t.includes(tableSearch.toLowerCase())).map((table) => (
                <button
                  key={table}
                  onClick={() => openTable(table)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-md flex items-center gap-2 hover:bg-accent transition-colors",
                    tabs.some(t => t.tableName === table) && "bg-accent/50"
                  )}
                >
                  <TableIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate block min-w-0 flex-1">{table}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Tabs & Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab Bar */}
          {tabs.length > 0 && (
            <div className="border-b bg-muted/30 flex items-center overflow-x-auto shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm border-r hover:bg-accent/50 transition-colors shrink-0",
                    activeTabId === tab.id && "bg-background border-b-2 border-b-primary"
                  )}
                >
                  <TableIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-[120px] truncate">{tab.tableName}</span>
                  {tab.isLoading ? (
                    <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                      {tab.recordCount.toLocaleString()}
                    </span>
                  )}
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Table Content */}
          <div className="flex-1 overflow-auto">
            {!activeTab ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Database className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg">Select a table from the sidebar</p>
              </div>
            ) : activeTab.isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : activeTab.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Database className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg">No records found in {activeTab.tableName}</p>
              </div>
            ) : (
              (() => {
                const filteredData = getFilteredData(activeTab);
                const allSelected = activeTab.selectedRows.size === filteredData.length && filteredData.length > 0;
                return (
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleAllSelection(activeTab.id, filteredData)}
                          />
                        </TableHead>
                        {activeTab.columns.map((col) => (
                          <TableHead key={col} className="font-medium">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSort(activeTab.id, col)}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                <span>{col}</span>
                                {activeTab.sortKey === col && (
                                  activeTab.sortDirection === 'asc' 
                                    ? <ArrowUp className="h-3 w-3" /> 
                                    : <ArrowDown className="h-3 w-3" />
                                )}
                              </button>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className={cn(
                                      "h-6 w-6",
                                      activeTab.columnFilters[col] && "text-primary"
                                    )}
                                  >
                                    <Filter className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" align="start">
                                  <Input
                                    placeholder={`Filter ${col}...`}
                                    value={activeTab.columnFilters[col] || ""}
                                    onChange={(e) => setColumnFilter(activeTab.id, col, e.target.value)}
                                    className="h-8"
                                  />
                                  {activeTab.columnFilters[col] && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full mt-1"
                                      onClick={() => setColumnFilter(activeTab.id, col, "")}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((row, rowIndex) => (
                        <TableRow 
                          key={rowIndex}
                          className={cn(activeTab.selectedRows.has(rowIndex) && "bg-muted/50")}
                        >
                          <TableCell className="w-10">
                            <Checkbox
                              checked={activeTab.selectedRows.has(rowIndex)}
                              onCheckedChange={() => toggleRowSelection(activeTab.id, rowIndex)}
                            />
                          </TableCell>
                          {activeTab.columns.map((col) => (
                            <TableCell key={col} className="max-w-[300px] truncate" title={formatCellValue(row[col])}>
                              {formatCellValue(row[col])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()
            )}
          </div>
        </div>
      </div>
      <ImportProgressDialog
        open={deleteProgressOpen}
        onOpenChange={setDeleteProgressOpen}
        title="Deleting Records"
        totalRows={deleteTotal}
        processedRows={deleteProcessed}
        results={deleteResults}
        isComplete={deleteComplete}
      />

      <DatabaseOptionsDialog
        open={dbOptionsOpen}
        onOpenChange={setDbOptionsOpen}
        tables={AVAILABLE_TABLES}
        canPurge={hasITRole && allowMassDeletion}
        onPurged={() => tabs.forEach(t => refreshTab(t.id))}
      />

      {/* Extended Search Dialog */}
      <Dialog open={extOpen} onOpenChange={setExtOpen}>
        <DialogContent className="!w-screen !h-screen !max-w-none !max-h-none flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SearchCheck className="h-5 w-5 text-primary" />
              Extended Search
              {extTable && <span className="text-muted-foreground text-sm font-normal">— {extTable}</span>}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {!extTable ? (
              <div className="space-y-3">
                <Label>Select a table</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter tables..."
                    value={extTableFilter}
                    onChange={(e) => setExtTableFilter(e.target.value)}
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {AVAILABLE_TABLES.filter(t => t.includes(extTableFilter.toLowerCase())).map((table) => (
                    <button
                      key={table}
                      onClick={() => selectExtTable(table)}
                      className="text-left px-3 py-2 text-sm rounded-md border hover:bg-accent hover:border-primary transition-colors flex items-center gap-2"
                    >
                      <TableIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{table}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : extLoadingCols ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => { setExtTable(null); setExtColumns([]); setExtInputs({}); }}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Change table
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Use <code className="px-1 py-0.5 bg-muted rounded">*</code> or <code className="px-1 py-0.5 bg-muted rounded">%</code> for wildcards (e.g. <code className="px-1 py-0.5 bg-muted rounded">abc*</code>, <code className="px-1 py-0.5 bg-muted rounded">*xyz</code>, <code className="px-1 py-0.5 bg-muted rounded">*foo*</code>). Plain values use range (from ≥, to ≤).
                  </p>
                </div>
                {extColumns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No columns available.</p>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/3">Property</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extColumns.map((col) => (
                          <TableRow key={col}>
                            <TableCell className="font-medium">{col}</TableCell>
                            <TableCell>
                              <Input
                                placeholder="From or pattern (e.g. abc*)"
                                value={extInputs[col]?.from ?? ""}
                                onChange={(e) => updateExtInput(col, "from", e.target.value)}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="To or pattern (e.g. *xyz)"
                                value={extInputs[col]?.to ?? ""}
                                onChange={(e) => updateExtInput(col, "to", e.target.value)}
                                className="h-8"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </DialogBody>
          {extTable && extColumns.length > 0 && (
            <DialogFooter>
              <Button onClick={runExtendedSearch} disabled={extRunning}>
                {extRunning ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Searching...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" /> Run Search</>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
