import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Database, Search, RefreshCw, Table as TableIcon } from "lucide-react";
import { useStatusMessage } from "@/hooks/use-status-message";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
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
] as const;

type TableName = typeof AVAILABLE_TABLES[number];

interface DataExplorerSidebarProps {
  selectedTable: string;
  onSelectTable: (table: string) => void;
}

function DataExplorerSidebar({ selectedTable, onSelectTable }: DataExplorerSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tables</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {AVAILABLE_TABLES.map((table) => (
                <SidebarMenuItem key={table}>
                  <SidebarMenuButton
                    onClick={() => onSelectTable(table)}
                    isActive={selectedTable === table}
                    tooltip={table}
                  >
                    <TableIcon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{table}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function DataExplorerContent() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const status = useStatusMessage();
  
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [recordCount, setRecordCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchTableData = async (tableName: string) => {
    setIsLoading(true);
    try {
      const query = supabase.from(tableName as "accounts");
      const { data: tableData, error, count } = await query
        .select("*", { count: "exact" })
        .limit(500);

      if (error) {
        status.error(`Error fetching data: ${error.message}`);
        setData([]);
        setColumns([]);
        return;
      }

      if (tableData && tableData.length > 0) {
        const cols = Object.keys(tableData[0]);
        setColumns(cols);
        setData(tableData as Record<string, unknown>[]);
        setRecordCount(count || tableData.length);
        status.success(`Loaded ${tableData.length} records from ${tableName}`);
      } else {
        setColumns([]);
        setData([]);
        setRecordCount(0);
        status.info(`No records found in ${tableName}`);
      }
    } catch (err) {
      status.error("Failed to fetch table data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setSearchTerm("");
    fetchTableData(tableName);
  };

  const handleRefresh = () => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  };

  const filteredData = data.filter((row) => {
    if (!searchTerm) return true;
    return Object.values(row).some((value) =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

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
    <div className="flex min-h-screen w-full">
      <DataExplorerSidebar selectedTable={selectedTable} onSelectTable={handleTableSelect} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex h-14 items-center gap-4 px-4">
            <SidebarTrigger />
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Database className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">Data Explorer</h1>
            
            {selectedTable && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium">{selectedTable}</span>
                <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
              </>
            )}

            {selectedTable && (
              <div className="flex items-center gap-2 ml-auto">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-[250px]"
                  />
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {filteredData.length} of {recordCount} records
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {!selectedTable ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-muted-foreground">
              <Database className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg">Select a table from the sidebar</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-muted-foreground">
              <Database className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg">No records found in {selectedTable}</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-14 bg-background z-10">
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="font-medium">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((col) => (
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
  );
}

export default function DataExplorer() {
  return (
    <SidebarProvider>
      <DataExplorerContent />
    </SidebarProvider>
  );
}
