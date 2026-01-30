import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface EntityConfig {
  name: string;
  table: string;
  fields: { key: string; label: string }[];
}

const entities: EntityConfig[] = [
  {
    name: "Products",
    table: "products",
    fields: [
      { key: "product_id", label: "Product ID" },
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
      { key: "category", label: "Category" },
      { key: "sku", label: "SKU" },
      { key: "upc", label: "UPC" },
      { key: "price", label: "Price" },
      { key: "cost", label: "Cost" },
      { key: "is_active", label: "Active" },
      { key: "created_at", label: "Created At" },
    ],
  },
  {
    name: "Inventory",
    table: "inventory",
    fields: [
      { key: "id", label: "ID" },
      { key: "product_id", label: "Product ID" },
      { key: "location_id", label: "Location ID" },
      { key: "bin_id", label: "Bin ID" },
      { key: "quantity", label: "Quantity" },
      { key: "min_quantity", label: "Min Quantity" },
      { key: "max_quantity", label: "Max Quantity" },
      { key: "updated_at", label: "Updated At" },
    ],
  },
  {
    name: "Purchase Orders",
    table: "purchase_orders",
    fields: [
      { key: "order_id", label: "Order ID" },
      { key: "vendor_id", label: "Vendor ID" },
      { key: "location_id", label: "Location ID" },
      { key: "status", label: "Status" },
      { key: "total_amount", label: "Total Amount" },
      { key: "order_date", label: "Order Date" },
      { key: "expected_date", label: "Expected Date" },
      { key: "created_at", label: "Created At" },
    ],
  },
  {
    name: "Sales Orders",
    table: "sales_orders",
    fields: [
      { key: "order_id", label: "Order ID" },
      { key: "customer_id", label: "Customer ID" },
      { key: "location_id", label: "Location ID" },
      { key: "status", label: "Status" },
      { key: "total_amount", label: "Total Amount" },
      { key: "order_date", label: "Order Date" },
      { key: "created_at", label: "Created At" },
    ],
  },
  {
    name: "Vendors",
    table: "vendors",
    fields: [
      { key: "vendor_id", label: "Vendor ID" },
      { key: "name", label: "Name" },
      { key: "contact_name", label: "Contact" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "is_active", label: "Active" },
      { key: "created_at", label: "Created At" },
    ],
  },
  {
    name: "Customers",
    table: "customers",
    fields: [
      { key: "customer_id", label: "Customer ID" },
      { key: "name", label: "Name" },
      { key: "contact_name", label: "Contact" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "type", label: "Type" },
      { key: "created_at", label: "Created At" },
    ],
  },
  {
    name: "Requisitions",
    table: "requisitions",
    fields: [
      { key: "requisition_id", label: "Requisition ID" },
      { key: "vendor_id", label: "Vendor ID" },
      { key: "location_id", label: "Location ID" },
      { key: "status", label: "Status" },
      { key: "total_amount", label: "Total Amount" },
      { key: "created_at", label: "Created At" },
    ],
  },
  {
    name: "Employees",
    table: "employees",
    fields: [
      { key: "employee_id", label: "Employee ID" },
      { key: "first_name", label: "First Name" },
      { key: "last_name", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "department", label: "Department" },
      { key: "job_title", label: "Job Title" },
      { key: "status", label: "Status" },
      { key: "hire_date", label: "Hire Date" },
    ],
  },
];

const Analytics = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rowLimit, setRowLimit] = useState<string>("100");

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

  const fetchCompanyId = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user!.id)
      .single();
    if (data) setCompanyId(data.company_id);
  };

  const currentEntity = entities.find((e) => e.name === selectedEntity);

  const handleEntityChange = (value: string) => {
    setSelectedEntity(value);
    setSelectedFields([]);
    setResults([]);
  };

  const handleFieldToggle = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleSelectAll = () => {
    if (currentEntity) {
      setSelectedFields(currentEntity.fields.map((f) => f.key));
    }
  };

  const handleClearAll = () => {
    setSelectedFields([]);
  };

  const handleReset = () => {
    setSelectedEntity("");
    setSelectedFields([]);
    setResults([]);
  };

  const handleRunQuery = async () => {
    if (!currentEntity || selectedFields.length === 0 || !companyId) {
      toast.error("Please select an entity and at least one field");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(currentEntity.table as "products")
        .select(selectedFields.join(","))
        .eq("company_id", companyId)
        .limit(parseInt(rowLimit));

      if (error) throw error;

      setResults((data as unknown as Record<string, unknown>[]) || []);
      toast.success(`Retrieved ${data?.length || 0} rows`);
    } catch (error) {
      console.error("Query error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to run query");
    } finally {
      setIsLoading(false);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toLocaleString();
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value).toLocaleDateString();
    }
    return String(value);
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
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Analytics</h1>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-4">
        {/* Query Builder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Query Builder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Entity Selection */}
              <div className="space-y-2">
                <Label>Select Entity</Label>
                <Select value={selectedEntity} onValueChange={handleEntityChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an entity..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((entity) => (
                      <SelectItem key={entity.name} value={entity.name}>
                        {entity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Row Limit */}
              <div className="space-y-2">
                <Label>Row Limit</Label>
                <Select value={rowLimit} onValueChange={setRowLimit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 rows</SelectItem>
                    <SelectItem value="100">100 rows</SelectItem>
                    <SelectItem value="500">500 rows</SelectItem>
                    <SelectItem value="1000">1000 rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={handleRunQuery}
                    disabled={!selectedEntity || selectedFields.length === 0 || isLoading}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Query
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Field Selection */}
            {currentEntity && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Fields</Label>
                  <div className="flex gap-2">
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={handleSelectAll}>
                      Select All
                    </Button>
                    <span className="text-muted-foreground">|</span>
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={handleClearAll}>
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {currentEntity.fields.map((field) => (
                    <div key={field.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.key}
                        checked={selectedFields.includes(field.key)}
                        onCheckedChange={() => handleFieldToggle(field.key)}
                      />
                      <Label htmlFor={field.key} className="text-sm cursor-pointer">
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Results ({results.length} rows)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      {selectedFields.map((field) => (
                        <TableHead key={field}>
                          {currentEntity?.fields.find((f) => f.key === field)?.label || field}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((row, idx) => (
                      <TableRow key={idx}>
                        {selectedFields.map((field) => (
                          <TableCell key={field}>{formatValue(row[field])}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {results.length === 0 && selectedEntity && selectedFields.length > 0 && !isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Click "Run Query" to fetch data
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Analytics;
