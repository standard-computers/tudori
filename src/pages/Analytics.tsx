import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Play,
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Hash,
  Calendar,
  ToggleLeft,
  Type,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EntityField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

interface EntityConfig {
  name: string;
  table: string;
  fields: EntityField[];
}

interface SavedReport {
  id: string;
  name: string;
  entity: string;
  fields: string[];
  createdAt: string;
}

const entities: EntityConfig[] = [
  {
    name: "Products",
    table: "products",
    fields: [
      { key: "product_id", label: "Product ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "category", label: "Category", type: "string" },
      { key: "sku", label: "SKU", type: "string" },
      { key: "upc", label: "UPC", type: "string" },
      { key: "price", label: "Price", type: "number" },
      { key: "cost", label: "Cost", type: "number" },
      { key: "is_active", label: "Active", type: "boolean" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
  },
  {
    name: "Inventory",
    table: "inventory",
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "product_id", label: "Product ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "bin_id", label: "Bin ID", type: "string" },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "min_quantity", label: "Min Quantity", type: "number" },
      { key: "max_quantity", label: "Max Quantity", type: "number" },
      { key: "updated_at", label: "Updated At", type: "date" },
    ],
  },
  {
    name: "Purchase Orders",
    table: "purchase_orders",
    fields: [
      { key: "order_id", label: "Order ID", type: "string" },
      { key: "vendor_id", label: "Vendor ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "total_amount", label: "Total Amount", type: "number" },
      { key: "order_date", label: "Order Date", type: "date" },
      { key: "expected_date", label: "Expected Date", type: "date" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
  },
  {
    name: "Sales Orders",
    table: "sales_orders",
    fields: [
      { key: "order_id", label: "Order ID", type: "string" },
      { key: "customer_id", label: "Customer ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "total_amount", label: "Total Amount", type: "number" },
      { key: "order_date", label: "Order Date", type: "date" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
  },
  {
    name: "Vendors",
    table: "vendors",
    fields: [
      { key: "vendor_id", label: "Vendor ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "contact_name", label: "Contact", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "is_active", label: "Active", type: "boolean" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
  },
  {
    name: "Customers",
    table: "customers",
    fields: [
      { key: "customer_id", label: "Customer ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "contact_name", label: "Contact", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "type", label: "Type", type: "string" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
  },
  {
    name: "Requisitions",
    table: "requisitions",
    fields: [
      { key: "requisition_id", label: "Requisition ID", type: "string" },
      { key: "vendor_id", label: "Vendor ID", type: "string" },
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "total_amount", label: "Total Amount", type: "number" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
  },
  {
    name: "Employees",
    table: "employees",
    fields: [
      { key: "employee_id", label: "Employee ID", type: "string" },
      { key: "first_name", label: "First Name", type: "string" },
      { key: "last_name", label: "Last Name", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "department", label: "Department", type: "string" },
      { key: "job_title", label: "Job Title", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "hire_date", label: "Hire Date", type: "date" },
    ],
  },
  {
    name: "Locations",
    table: "locations",
    fields: [
      { key: "location_id", label: "Location ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "type", label: "Type", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "country", label: "Country", type: "string" },
      { key: "created_at", label: "Created At", type: "date" },
    ],
  },
  {
    name: "Invoices",
    table: "invoices",
    fields: [
      { key: "invoice_number", label: "Invoice #", type: "string" },
      { key: "account_id", label: "Account ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "invoice_date", label: "Invoice Date", type: "date" },
      { key: "due_date", label: "Due Date", type: "date" },
    ],
  },
];

const getFieldIcon = (type: EntityField["type"]) => {
  switch (type) {
    case "number":
      return Hash;
    case "date":
      return Calendar;
    case "boolean":
      return ToggleLeft;
    default:
      return Type;
  }
};

const Analytics = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);

  // Report builder state
  const [reportName, setReportName] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [rowLimit, setRowLimit] = useState<string>("100");
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
      loadSavedReports();
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

  const loadSavedReports = () => {
    const stored = localStorage.getItem(`analytics_reports_${user!.id}`);
    if (stored) {
      setSavedReports(JSON.parse(stored));
    }
  };

  const saveReportsToStorage = (reports: SavedReport[]) => {
    localStorage.setItem(`analytics_reports_${user!.id}`, JSON.stringify(reports));
    setSavedReports(reports);
  };

  const toggleEntity = (entityName: string) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityName)) {
        next.delete(entityName);
      } else {
        next.add(entityName);
      }
      return next;
    });
  };

  const handleFieldClick = (entityName: string, fieldKey: string) => {
    if (!isCreating) return;
    if (selectedEntity !== entityName) {
      setSelectedEntity(entityName);
      setSelectedFields([fieldKey]);
    } else {
      setSelectedFields((prev) =>
        prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey]
      );
    }
  };

  const handleNewReport = () => {
    setIsCreating(true);
    setSelectedReport(null);
    setReportName("");
    setSelectedEntity("");
    setSelectedFields([]);
    setResults([]);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setReportName("");
    setSelectedEntity("");
    setSelectedFields([]);
    setResults([]);
  };

  const handleSaveReport = () => {
    if (!reportName.trim()) {
      toast.error("Please enter a report name");
      return;
    }
    if (!selectedEntity || selectedFields.length === 0) {
      toast.error("Please select an entity and at least one field");
      return;
    }

    const newReport: SavedReport = {
      id: crypto.randomUUID(),
      name: reportName,
      entity: selectedEntity,
      fields: selectedFields,
      createdAt: new Date().toISOString(),
    };

    saveReportsToStorage([...savedReports, newReport]);
    toast.success("Report saved");
    setIsCreating(false);
    setSelectedReport(newReport);
  };

  const handleDeleteReport = (reportId: string) => {
    const updated = savedReports.filter((r) => r.id !== reportId);
    saveReportsToStorage(updated);
    if (selectedReport?.id === reportId) {
      setSelectedReport(null);
      setResults([]);
    }
    toast.success("Report deleted");
  };

  const handleSelectReport = (report: SavedReport) => {
    setSelectedReport(report);
    setSelectedEntity(report.entity);
    setSelectedFields(report.fields);
    setIsCreating(false);
    setResults([]);
  };

  const currentEntity = entities.find((e) => e.name === selectedEntity);

  const handleRunQuery = async () => {
    if (!currentEntity || selectedFields.length === 0 || !companyId) {
      toast.error("Please select fields to query");
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 h-16">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Analytics</h1>
          <div className="flex-1" />
          <Button size="sm" onClick={handleNewReport}>
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          {/* Saved Reports Section */}
          <div className="p-3 border-b">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Saved Reports
            </h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {savedReports.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No saved reports</p>
              ) : (
                savedReports.map((report) => (
                  <div
                    key={report.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group",
                      selectedReport?.id === report.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => handleSelectReport(report)}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate flex-1">{report.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteReport(report.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Entity Browser */}
            <div className="p-3 border-t">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Data Objects
              </h3>
            </div>
            <div className="px-2 pb-4">
              {entities.map((entity) => (
                <Collapsible
                  key={entity.name}
                  open={expandedEntities.has(entity.name)}
                  onOpenChange={() => toggleEntity(entity.name)}
                >
                  <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent/50 text-left">
                    {expandedEntities.has(entity.name) ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm">{entity.name}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 pl-2 border-l">
                      {entity.fields.map((field) => {
                        const Icon = getFieldIcon(field.type);
                        const isSelected =
                          selectedEntity === entity.name && selectedFields.includes(field.key);
                        return (
                          <div
                            key={field.key}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1 rounded-md text-sm",
                              isCreating
                                ? "cursor-pointer hover:bg-accent/50"
                                : "cursor-default",
                              isSelected && "bg-primary/10 text-primary"
                            )}
                            onClick={() => handleFieldClick(entity.name, field.key)}
                          >
                            <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{field.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isCreating ? (
            /* Report Builder */
            <div className="flex-1 p-4 overflow-auto">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">New Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Report Name</Label>
                      <Input
                        placeholder="Enter report name..."
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                      />
                    </div>
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
                    <div className="space-y-2">
                      <Label>&nbsp;</Label>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleRunQuery}
                          disabled={selectedFields.length === 0 || isLoading}
                          className="flex-1"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button onClick={handleSaveReport} variant="outline">
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={handleCancelCreate} variant="ghost">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>

                  {selectedEntity && selectedFields.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Selected: <span className="font-medium">{selectedEntity}</span> →{" "}
                      {selectedFields
                        .map((f) => currentEntity?.fields.find((ef) => ef.key === f)?.label || f)
                        .join(", ")}
                    </div>
                  )}

                  {selectedFields.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Click on fields in the sidebar to add them to your report
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Preview Results */}
              {results.length > 0 && (
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Preview ({results.length} rows)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-auto max-h-[400px]">
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
            </div>
          ) : selectedReport ? (
            /* View Saved Report */
            <div className="flex-1 p-4 overflow-auto">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedReport.name}</CardTitle>
                    <div className="flex gap-2">
                      <Select value={rowLimit} onValueChange={setRowLimit}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50 rows</SelectItem>
                          <SelectItem value="100">100 rows</SelectItem>
                          <SelectItem value="500">500 rows</SelectItem>
                          <SelectItem value="1000">1000 rows</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleRunQuery} disabled={isLoading}>
                        <Play className="h-4 w-4 mr-2" />
                        Run
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedReport.entity} →{" "}
                    {selectedReport.fields
                      .map(
                        (f) =>
                          entities
                            .find((e) => e.name === selectedReport.entity)
                            ?.fields.find((ef) => ef.key === f)?.label || f
                      )
                      .join(", ")}
                  </p>
                </CardHeader>
              </Card>

              {/* Results */}
              {results.length > 0 && (
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Results ({results.length} rows)</CardTitle>
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
            </div>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-lg font-medium mb-2">No Report Selected</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Select a saved report or create a new one
                </p>
                <Button onClick={handleNewReport}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Report
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
