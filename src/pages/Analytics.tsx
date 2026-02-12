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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  ArrowLeft,
  Play,
  Plus,
  ChevronRight,
  ChevronDown,
  FileText,
  Save,
  X,
} from "lucide-react";
import { toast } from '@/lib/toast';
import { cn } from "@/lib/utils";
import { entities } from "@/components/analytics/entities";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { ReportTab, ReportField, SavedReport, FieldFilter, EntityField } from "@/components/analytics/types";
import { DraggableField } from "@/components/analytics/DraggableField";
import { DraggableEntity } from "@/components/analytics/DraggableEntity";
import { ReportBuilderDropZone } from "@/components/analytics/ReportBuilderDropZone";
import { FieldFilterDialog } from "@/components/analytics/FieldFilterDialog";

const Analytics = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  // F1 to go back
  useKeyboardShortcut('F1', () => navigate(-1));

  // Tab state
  const [tabs, setTabs] = useState<ReportTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Drag state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Filter dialog state
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<ReportField | null>(null);

  // Query state
  const [rowLimit, setRowLimit] = useState<string>("100");
  const [isLoading, setIsLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
    const stored = localStorage.getItem(`analytics_reports_v2_${user!.id}`);
    if (stored) {
      setSavedReports(JSON.parse(stored));
    }
  };

  const saveReportsToStorage = (reports: SavedReport[]) => {
    localStorage.setItem(`analytics_reports_v2_${user!.id}`, JSON.stringify(reports));
    setSavedReports(reports);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

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

  const handleNewReport = () => {
    const newTab: ReportTab = {
      id: crypto.randomUUID(),
      name: "New Report",
      isNew: true,
      entity: "",
      fields: [],
      results: [],
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabId: string) => {
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  const handleSelectReport = (report: SavedReport) => {
    // Check if already open
    const existingTab = tabs.find((t) => !t.isNew && t.id === report.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab: ReportTab = {
      id: report.id,
      name: report.name,
      isNew: false,
      entity: report.entity,
      fields: report.fields,
      results: [],
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleDeleteReport = (reportId: string) => {
    const updated = savedReports.filter((r) => r.id !== reportId);
    saveReportsToStorage(updated);
    handleCloseTab(reportId);
    toast.success("Report deleted");
  };

  const updateActiveTab = (updates: Partial<ReportTab>) => {
    if (!activeTabId) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, ...updates } : t))
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    if (!over || !activeTab) return;

    // Handle reordering within drop zone
    if (over.id === "report-drop-zone" || activeTab.fields.some((f) => f.id === over.id)) {
      const activeData = active.data.current;

      // Adding new field from sidebar
      if (activeData && "field" in activeData && !activeTab.fields.some((f) => f.id === active.id)) {
        const { entityName, field } = activeData as { entityName: string; field: EntityField };

        // Check if entity matches or is first field
        if (activeTab.fields.length > 0 && activeTab.entity !== entityName) {
          toast.error("All fields must be from the same data object");
          return;
        }

        const newField: ReportField = {
          id: `${entityName}-${field.key}-${Date.now()}`,
          entityName,
          fieldKey: field.key,
          fieldLabel: field.label,
          fieldType: field.type,
        };

        updateActiveTab({
          entity: entityName,
          fields: [...activeTab.fields, newField],
        });
        return;
      }

      // Adding all fields from entity folder
      if (activeData && "isEntity" in activeData) {
        const { entity } = activeData as { isEntity: boolean; entity: typeof entities[0] };

        if (activeTab.fields.length > 0 && activeTab.entity !== entity.name) {
          toast.error("All fields must be from the same data object");
          return;
        }

        const newFields: ReportField[] = entity.fields.map((field) => ({
          id: `${entity.name}-${field.key}-${Date.now()}`,
          entityName: entity.name,
          fieldKey: field.key,
          fieldLabel: field.label,
          fieldType: field.type,
        }));

        // Filter out fields that already exist
        const existingKeys = new Set(activeTab.fields.map((f) => f.fieldKey));
        const fieldsToAdd = newFields.filter((f) => !existingKeys.has(f.fieldKey));

        updateActiveTab({
          entity: entity.name,
          fields: [...activeTab.fields, ...fieldsToAdd],
        });
        return;
      }

      // Reordering existing fields
      const oldIndex = activeTab.fields.findIndex((f) => f.id === active.id);
      const newIndex = activeTab.fields.findIndex((f) => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        updateActiveTab({
          fields: arrayMove(activeTab.fields, oldIndex, newIndex),
        });
      }
    }
  };

  const handleRemoveField = (fieldId: string) => {
    if (!activeTab) return;
    const newFields = activeTab.fields.filter((f) => f.id !== fieldId);
    updateActiveTab({
      fields: newFields,
      entity: newFields.length === 0 ? "" : activeTab.entity,
    });
  };

  const handleFieldClick = (field: ReportField) => {
    setSelectedField(field);
    setFilterDialogOpen(true);
  };

  const handleSaveFilter = (filter: FieldFilter | undefined) => {
    if (!activeTab || !selectedField) return;
    updateActiveTab({
      fields: activeTab.fields.map((f) =>
        f.id === selectedField.id ? { ...f, filter } : f
      ),
    });
  };

  const handleSaveReport = () => {
    if (!activeTab) return;
    if (!activeTab.name.trim() || activeTab.name === "New Report") {
      toast.error("Please enter a report name");
      return;
    }
    if (activeTab.fields.length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    const report: SavedReport = {
      id: activeTab.isNew ? crypto.randomUUID() : activeTab.id,
      name: activeTab.name,
      entity: activeTab.entity,
      fields: activeTab.fields,
      createdAt: new Date().toISOString(),
    };

    const existingIndex = savedReports.findIndex((r) => r.id === report.id);
    const newReports =
      existingIndex >= 0
        ? savedReports.map((r, i) => (i === existingIndex ? report : r))
        : [...savedReports, report];

    saveReportsToStorage(newReports);
    toast.success("Report saved");

    // Update tab to reflect saved state
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, id: report.id, isNew: false } : t
      )
    );
    setActiveTabId(report.id);
  };

  const currentEntity = entities.find((e) => e.name === activeTab?.entity);

  const handleRunQuery = async () => {
    if (!activeTab || !currentEntity || activeTab.fields.length === 0 || !companyId) {
      toast.error("Please add fields to query");
      return;
    }

    setIsLoading(true);
    try {
      // Build query with filters - use explicit typing to avoid TS recursion issues
      const selectFields = activeTab.fields.map((f) => f.fieldKey).join(",");
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let queryBuilder = (supabase as any)
        .from(currentEntity.table)
        .select(selectFields)
        .eq("company_id", companyId)
        .limit(parseInt(rowLimit));

      // Apply filters
      for (const field of activeTab.fields) {
        if (field.filter) {
          const { operator, value } = field.filter;
          const key = field.fieldKey;
          
          switch (operator) {
            case "eq":
              queryBuilder = queryBuilder.eq(key, value);
              break;
            case "neq":
              queryBuilder = queryBuilder.neq(key, value);
              break;
            case "gt":
              queryBuilder = queryBuilder.gt(key, value);
              break;
            case "gte":
              queryBuilder = queryBuilder.gte(key, value);
              break;
            case "lt":
              queryBuilder = queryBuilder.lt(key, value);
              break;
            case "lte":
              queryBuilder = queryBuilder.lte(key, value);
              break;
            case "like":
              queryBuilder = queryBuilder.like(key, `%${value}%`);
              break;
            case "ilike":
              queryBuilder = queryBuilder.ilike(key, `%${value}%`);
              break;
            case "is_null":
              queryBuilder = queryBuilder.is(key, null);
              break;
            case "not_null":
              queryBuilder = queryBuilder.not(key, "is", null);
              break;
          }
        }
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;

      updateActiveTab({ results: (data as Record<string, unknown>[]) || [] });
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

  const draggedEntity =
    activeDragId?.startsWith("entity-")
      ? entities.find((e) => `entity-${e.name}` === activeDragId)
      : null;

  const draggedFieldData = activeDragId
    ? (() => {
        for (const entity of entities) {
          for (const field of entity.fields) {
            if (`${entity.name}-${field.key}` === activeDragId) {
              return { entityName: entity.name, field };
            }
          }
        }
        return null;
      })()
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center gap-4 px-4 h-14">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Analytics</h1>
            <div className="flex-1" />
            <Button size="sm" onClick={handleNewReport}>
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Button>
          </div>

          {/* Tabs */}
          {tabs.length > 0 && (
            <div className="px-4 border-t">
              <Tabs value={activeTabId || undefined} onValueChange={setActiveTabId}>
                <TabsList className="h-10 bg-transparent border-0 p-0 gap-0">
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="relative h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 gap-2"
                    >
                      {tab.name}
                      {tab.isNew && (
                        <span className="text-xs text-muted-foreground">(unsaved)</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab.id);
                        }}
                        className="ml-1 hover:bg-accent rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}
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
                        tabs.some((t) => t.id === report.id)
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
                    <CollapsibleTrigger className="flex items-center gap-1 w-full px-2 py-1.5 rounded-md hover:bg-accent/50 text-left">
                      {expandedEntities.has(entity.name) ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <DraggableEntity entity={entity} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 pl-2 border-l">
                        {entity.fields.map((field) => {
                          const isSelected = activeTab?.fields.some(
                            (f) => f.entityName === entity.name && f.fieldKey === field.key
                          );
                          return (
                            <DraggableField
                              key={field.key}
                              entityName={entity.name}
                              field={field}
                              isSelected={isSelected || false}
                            />
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
            {activeTab ? (
              <div className="flex-1 p-4 overflow-auto">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Input
                        value={activeTab.name}
                        onChange={(e) => updateActiveTab({ name: e.target.value })}
                        className="text-base font-semibold h-8 w-auto max-w-xs"
                        placeholder="Report name..."
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ReportBuilderDropZone
                      fields={activeTab.fields}
                      onRemoveField={handleRemoveField}
                      onFieldClick={handleFieldClick}
                    />

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Limit:</Label>
                        <Select value={rowLimit} onValueChange={setRowLimit}>
                          <SelectTrigger className="w-28 h-9">
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
                      <div className="flex-1" />
                      <Button
                        onClick={handleRunQuery}
                        disabled={activeTab.fields.length === 0 || isLoading}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Query
                      </Button>
                      <Button onClick={handleSaveReport} variant="outline">
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Results */}
                {activeTab.results.length > 0 && (
                  <Card className="mt-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Results ({activeTab.results.length} rows)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-auto max-h-[400px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                              {activeTab.fields.map((field) => (
                                <TableHead key={field.id}>{field.fieldLabel}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeTab.results.map((row, idx) => (
                              <TableRow key={idx}>
                                {activeTab.fields.map((field) => (
                                  <TableCell key={field.id}>
                                    {formatValue(row[field.fieldKey])}
                                  </TableCell>
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
                  <h2 className="text-lg font-medium mb-2">No Report Open</h2>
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

      {/* Drag overlay */}
      <DragOverlay>
        {draggedEntity && (
          <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-md shadow-lg">
            <span className="text-sm font-medium">{draggedEntity.name}</span>
            <span className="text-xs text-muted-foreground">
              ({draggedEntity.fields.length} fields)
            </span>
          </div>
        )}
        {draggedFieldData && (
          <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-md shadow-lg">
            <span className="text-sm">{draggedFieldData.field.label}</span>
          </div>
        )}
      </DragOverlay>

      {/* Filter Dialog */}
      <FieldFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        field={selectedField}
        onSave={handleSaveFilter}
      />
    </DndContext>
  );
};

export default Analytics;
