import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Database, Search, RefreshCw, Table as TableIcon, X, PanelLeftClose, PanelLeft } from "lucide-react";
import { useStatusMessage } from "@/hooks/use-status-message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const AVAILABLE_TABLES = [
  "accounts",
  "areas",
  "bill_of_materials",
  "bin_products",
  "bins",
  "bom_items",
  "bom_step_items",
  "bom_steps",
  "companies",
  "company_settings",
  "conversation_participants",
  "conversations",
  "credit_memos",
  "customers",
  "debit_memos",
  "deliveries",
  "delivery_items",
  "document_id_config",
  "employees",
  "goods_issue_items",
  "goods_issues",
  "goods_receipt_items",
  "goods_receipts",
  "inventory",
  "invitations",
  "invoices",
  "ledger_transactions",
  "ledgers",
  "location_users",
  "locations",
  "messages",
  "outbound_deliveries",
  "outbound_delivery_items",
  "packaging_units",
  "pos_transactions",
  "pos_transaction_items",
  "product_sources",
  "products",
  "production_order_consumptions",
  "production_orders",
  "profiles",
  "purchase_order_items",
  "purchase_orders",
  "requisition_items",
  "requisitions",
  "safety_stock",
  "sales_order_items",
  "sales_orders",
  "tasks",
  "team_members",
  "teams",
  "timesheets",
  "user_roles",
  "user_transaction_access",
  "vendors",
];

interface TableTab {
  id: string;
  tableName: string;
  data: Record<string, unknown>[];
  columns: string[];
  isLoading: boolean;
  recordCount: number;
  searchTerm: string;
}

export default function DataExplorer() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const status = useStatusMessage();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabs, setTabs] = useState<TableTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

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

  const activeTab = tabs.find(t => t.id === activeTabId);

  const getFilteredData = (tab: TableTab) => {
    if (!tab.searchTerm) return tab.data;
    return tab.data.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(tab.searchTerm.toLowerCase())
      )
    );
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
      <div className="border-b bg-background h-16 flex items-center px-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
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

        {activeTab && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="icon" onClick={() => refreshTab(activeTab.id)} disabled={activeTab.isLoading}>
              <RefreshCw className={cn("h-4 w-4", activeTab.isLoading && "animate-spin")} />
            </Button>
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
          "border-r bg-muted/30 shrink-0 transition-all duration-200",
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-56"
        )}>
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <div className="p-2">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Tables</div>
              {AVAILABLE_TABLES.map((table) => (
                <button
                  key={table}
                  onClick={() => openTable(table)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-md flex items-center gap-2 hover:bg-accent transition-colors",
                    tabs.some(t => t.tableName === table) && "bg-accent/50"
                  )}
                >
                  <TableIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{table}</span>
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
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {activeTab.columns.map((col) => (
                      <TableHead key={col} className="font-medium">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredData(activeTab).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {activeTab.columns.map((col) => (
                        <TableCell key={col} className="max-w-[300px] truncate" title={formatCellValue(row[col])}>
                          {formatCellValue(row[col])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
