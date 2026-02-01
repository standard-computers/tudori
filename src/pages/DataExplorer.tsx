import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Database, Search, RefreshCw } from "lucide-react";
import { useStatusMessage } from "@/hooks/use-status-message";

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

export default function DataExplorer() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const status = useStatusMessage();
  
  const [selectedTable, setSelectedTable] = useState<TableName | "">("");
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
      // Use type assertion for dynamic table access
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

  const handleTableChange = (value: string) => {
    setSelectedTable(value as TableName);
    setSearchTerm("");
    if (value) {
      fetchTableData(value as TableName);
    } else {
      setData([]);
      setColumns([]);
    }
  };

  const handleRefresh = () => {
    if (selectedTable) {
      fetchTableData(selectedTable as TableName);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Database className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">Data Explorer</h1>
          
          <div className="flex items-center gap-2 ml-4">
            <Select value={selectedTable} onValueChange={handleTableChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select a table..." />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_TABLES.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedTable && (
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>

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
              <span className="text-sm text-muted-foreground">
                {filteredData.length} of {recordCount} records
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-0">
        {!selectedTable ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-muted-foreground">
            <Database className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg">Select a table to view its data</p>
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
  );
}
