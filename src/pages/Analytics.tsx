import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTransaction } from "@/contexts/StatusBarContext";
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
  Calculator,
  Link2,
} from "lucide-react";
import { toast } from '@/lib/toast';
import { cn } from "@/lib/utils";
import { entities, canReachEntity } from "@/components/analytics/entities";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { ReportTab, ReportField, SavedReport, FieldFilter, EntityField, AggregateFunction, CalculatedColumn } from "@/components/analytics/types";
import { DraggableField } from "@/components/analytics/DraggableField";
import { DraggableEntity } from "@/components/analytics/DraggableEntity";
import { ReportBuilderDropZone } from "@/components/analytics/ReportBuilderDropZone";
import { FieldFilterDialog } from "@/components/analytics/FieldFilterDialog";
import { CalculatedColumnsDialog } from "@/components/analytics/CalculatedColumnsDialog";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";

const Analytics = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  useTransaction('analytics');
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

  // Calculated columns dialog
  const [calcDialogOpen, setCalcDialogOpen] = useState(false);

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
    const stored = localStorage.getItem(`analytics_reports_v3_${user!.id}`);
    if (stored) {
      setSavedReports(JSON.parse(stored));
    }
  };

  const saveReportsToStorage = (reports: SavedReport[]) => {
    localStorage.setItem(`analytics_reports_v3_${user!.id}`, JSON.stringify(reports));
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
      entities: [],
      fields: [],
      calculatedColumns: [],
      results: [],
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  useKeyboardShortcut('n', handleNewReport);

  const handleCloseTab = (tabId: string) => {
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  const handleSelectReport = (report: SavedReport) => {
    const existingTab = tabs.find((t) => !t.isNew && t.id === report.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab: ReportTab = {
      id: report.id,
      name: report.name,
      isNew: false,
      entities: report.entities,
      fields: report.fields,
      calculatedColumns: report.calculatedColumns || [],
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

        // Check if entity can be reached from existing entities
        if (activeTab.entities.length > 0 && !canReachEntity(activeTab.entities, entityName)) {
          toast.error(`Cannot join "${entityName}" with the current report entities. No relationship found.`);
          return;
        }

        const newField: ReportField = {
          id: `${entityName}-${field.key}-${Date.now()}`,
          entityName,
          fieldKey: field.key,
          fieldLabel: field.label,
          fieldType: field.type,
          aggregate: "none",
        };

        const newEntities = activeTab.entities.includes(entityName)
          ? activeTab.entities
          : [...activeTab.entities, entityName];

        updateActiveTab({
          entities: newEntities,
          fields: [...activeTab.fields, newField],
        });
        return;
      }

      // Adding all fields from entity folder
      if (activeData && "isEntity" in activeData) {
        const { entity } = activeData as { isEntity: boolean; entity: typeof entities[0] };

        if (activeTab.entities.length > 0 && !canReachEntity(activeTab.entities, entity.name)) {
          toast.error(`Cannot join "${entity.name}" with the current report entities. No relationship found.`);
          return;
        }

        const newFields: ReportField[] = entity.fields.map((field) => ({
          id: `${entity.name}-${field.key}-${Date.now()}-${Math.random()}`,
          entityName: entity.name,
          fieldKey: field.key,
          fieldLabel: field.label,
          fieldType: field.type,
          aggregate: "none" as AggregateFunction,
        }));

        const existingKeys = new Set(activeTab.fields.map((f) => `${f.entityName}-${f.fieldKey}`));
        const fieldsToAdd = newFields.filter((f) => !existingKeys.has(`${f.entityName}-${f.fieldKey}`));

        const newEntities = activeTab.entities.includes(entity.name)
          ? activeTab.entities
          : [...activeTab.entities, entity.name];

        updateActiveTab({
          entities: newEntities,
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
    // Recalculate entities from remaining fields
    const newEntities = [...new Set(newFields.map((f) => f.entityName))];
    updateActiveTab({
      fields: newFields,
      entities: newEntities,
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

  const handleAggregateChange = (fieldId: string, aggregate: AggregateFunction) => {
    if (!activeTab) return;
    updateActiveTab({
      fields: activeTab.fields.map((f) =>
        f.id === fieldId ? { ...f, aggregate } : f
      ),
    });
  };

  const handleSaveCalculatedColumns = (columns: CalculatedColumn[]) => {
    updateActiveTab({ calculatedColumns: columns });
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
      entities: activeTab.entities,
      fields: activeTab.fields,
      calculatedColumns: activeTab.calculatedColumns,
      createdAt: new Date().toISOString(),
    };

    const existingIndex = savedReports.findIndex((r) => r.id === report.id);
    const newReports =
      existingIndex >= 0
        ? savedReports.map((r, i) => (i === existingIndex ? report : r))
        : [...savedReports, report];

    saveReportsToStorage(newReports);
    toast.success("Report saved");

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, id: report.id, isNew: false } : t
      )
    );
    setActiveTabId(report.id);
  };

  const handleRunQuery = async () => {
    if (!activeTab || activeTab.fields.length === 0 || !companyId) {
      toast.error("Please add fields to query");
      return;
    }

    setIsLoading(true);
    try {
      // Build entity definitions for the edge function
      const usedEntityNames = [...new Set(activeTab.fields.map((f) => f.entityName))];
      const entityDefs = usedEntityNames.map((name) => {
        const entity = entities.find((e) => e.name === name)!;
        return {
          name: entity.name,
          table: entity.table,
          primaryKey: entity.primaryKey,
          relationships: entity.relationships,
        };
      });

      const payload = {
        fields: activeTab.fields.map((f) => ({
          entityName: f.entityName,
          fieldKey: f.fieldKey,
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType,
          aggregate: f.aggregate || "none",
          filter: f.filter ? { operator: f.filter.operator, value: f.filter.value } : undefined,
        })),
        calculatedColumns: activeTab.calculatedColumns.map((c) => ({
          name: c.name,
          expression: c.expression,
        })),
        entities: entityDefs,
        limit: parseInt(rowLimit),
        companyId,
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke("analytics-query", {
        body: payload,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (response.error) {
        throw new Error(response.error.message || "Query failed");
      }

      const result = response.data;
      if (result.error) {
        throw new Error(result.error);
      }

      const rows = result.data || [];
      updateActiveTab({ results: rows as Record<string, unknown>[] });
      toast.success(`Retrieved ${rows.length} rows`);
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

  // Get result column keys from the first result row
  const getResultColumns = () => {
    if (!activeTab || activeTab.results.length === 0) return [];
    return Object.keys(activeTab.results[0]);
  };

  const getColumnLabel = (key: string): string => {
    // Keys come back as "table__field" from the edge function
    const parts = key.split("__");
    if (parts.length === 2) {
      const [table, fieldKey] = parts;
      const entity = entities.find((e) => e.table === table);
      if (entity) {
        const field = entity.fields.find((f) => f.key === fieldKey);
        if (field) {
          const matchingReportField = activeTab?.fields.find(
            (f) => f.entityName === entity.name && f.fieldKey === fieldKey
          );
          const aggLabel = matchingReportField?.aggregate && matchingReportField.aggregate !== "none"
            ? ` (${matchingReportField.aggregate.toUpperCase()})`
            : "";
          return `${field.label}${aggLabel}`;
        }
      }
    }
    return key;
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

  // Determine which entities can be added based on relationships
  const reachableEntities = activeTab
    ? entities.filter((e) => canReachEntity(activeTab.entities, e.name))
    : entities;

  const unreachableEntities = activeTab
    ? entities.filter((e) => !canReachEntity(activeTab.entities, e.name))
    : [];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center gap-4 px-4 h-14">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Analytics</h1>
            <div className="flex-1" />
            <Button size="icon" onClick={handleNewReport} className="relative">
              <Plus className="h-4 w-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
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
                {/* Reachable entities */}
                {reachableEntities.map((entity) => (
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
                      {activeTab?.entities.includes(entity.name) && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">
                          In use
                        </Badge>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 pl-2 border-l">
                        {entity.relationships.length > 0 && (
                          <div className="py-1 mb-1">
                            <div className="flex flex-wrap gap-1">
                              {entity.relationships.map((rel) => (
                                <Badge
                                  key={rel.targetEntity}
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  <Link2 className="h-2.5 w-2.5 mr-0.5" />
                                  {rel.label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
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

                {/* Unreachable entities (dimmed) */}
                {unreachableEntities.length > 0 && activeTab && activeTab.entities.length > 0 && (
                  <>
                    <div className="px-2 py-2 mt-2 border-t">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        No direct relationship
                      </span>
                    </div>
                    {unreachableEntities.map((entity) => (
                      <Collapsible
                        key={entity.name}
                        open={expandedEntities.has(entity.name)}
                        onOpenChange={() => toggleEntity(entity.name)}
                      >
                        <CollapsibleTrigger className="flex items-center gap-1 w-full px-2 py-1.5 rounded-md text-left opacity-40">
                          {expandedEntities.has(entity.name) ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          <DraggableEntity entity={entity} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 pl-2 border-l opacity-40">
                            {entity.fields.map((field) => (
                              <div
                                key={field.key}
                                className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground"
                              >
                                <span className="truncate">{field.label}</span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab ? (
              <div className="flex-1 p-4 overflow-auto">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Input
                        value={activeTab.name}
                        onChange={(e) => updateActiveTab({ name: e.target.value })}
                        className="text-base font-semibold h-8 w-auto max-w-xs"
                        placeholder="Report name..."
                      />
                      {activeTab.entities.length > 0 && (
                        <div className="flex items-center gap-1">
                          {activeTab.entities.map((entityName, idx) => (
                            <span key={entityName} className="flex items-center">
                              {idx > 0 && <Link2 className="h-3 w-3 mx-1 text-muted-foreground" />}
                              <Badge variant="outline" className="text-xs">
                                {entityName}
                              </Badge>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ReportBuilderDropZone
                      fields={activeTab.fields}
                      onRemoveField={handleRemoveField}
                      onFieldClick={handleFieldClick}
                      onAggregateChange={handleAggregateChange}
                    />

                    <div className="flex items-center gap-4 flex-wrap">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCalcDialogOpen(true)}
                        disabled={activeTab.entities.length === 0}
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Calculated Columns
                        {activeTab.calculatedColumns.length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {activeTab.calculatedColumns.length}
                          </Badge>
                        )}
                      </Button>
                      <div className="flex-1" />
                      <Button
                        onClick={handleRunQuery}
                        disabled={activeTab.fields.length === 0 || isLoading}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {isLoading ? "Running..." : "Run Query"}
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
                        <table className="w-full caption-bottom text-sm">
                          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                            <tr className="border-b">
                              {getResultColumns().map((col) => (
                                <th key={col} className="h-10 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">
                                  {getColumnLabel(col)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activeTab.results.map((row, idx) => (
                              <tr key={idx} className="border-b">
                                {getResultColumns().map((col) => (
                                  <td key={col} className="p-4 align-middle whitespace-nowrap">
                                    {formatValue(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

      {/* Calculated Columns Dialog */}
      <CalculatedColumnsDialog
        open={calcDialogOpen}
        onOpenChange={setCalcDialogOpen}
        columns={activeTab?.calculatedColumns || []}
        onSave={handleSaveCalculatedColumns}
        activeEntities={activeTab?.entities || []}
      />
    </DndContext>
  );
};

export default Analytics;
