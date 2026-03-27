import { useEffect, useState } from "react";
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/use-column-visibility";
import { ColumnToggle } from "@/components/ColumnToggle";
import { SortableTableHead } from "@/components/SortableTableHead";
import { useTableSort, ColumnFilterConfig } from "@/hooks/use-table-sort";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { ImportProgressDialog, ImportResult } from "@/components/ImportProgressDialog";
import { useExcel } from "@/hooks/use-excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { ArrowLeft, Percent, Plus, Loader2, MoreHorizontal, Trash2, Pencil, DollarSign, Wand2 } from "lucide-react";
import { toast } from '@/lib/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RATE_COLUMNS: ColumnDefinition[] = [
  { key: "rate_id", label: "Rate ID", defaultVisible: true },
  { key: "name", label: "Name", defaultVisible: true },
  { key: "type", label: "Type", defaultVisible: true },
  { key: "rate", label: "Rate/Amount", defaultVisible: true },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysVisible: true },
];

interface TaxRate {
  id: string;
  rate_id: string;
  name: string;
  rate: number;
  rate_type: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

const Rates = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Column visibility
  const { visibleColumns, isColumnVisible, toggleColumn, resetToDefaults, showAll, hideAll } = useColumnVisibility(
    "rates",
    RATE_COLUMNS,
  );

  const {
    sortConfig,
    handleSort,
    setFilter,
    getFilterConfig,
    sortedAndFilteredData,
  } = useTableSort<TaxRate>(taxRates, 'name', 'asc');

  const handleFilterConfig = (key: string, config: ColumnFilterConfig | null) => {
    if (config) setFilter(key, config);
    else setFilter(key, '');
  };

  const { exportToExcel, readExcel } = useExcel();

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);

  // Import progress
  const [importProgressOpen, setImportProgressOpen] = useState(false);
  const [importTotalRows, setImportTotalRows] = useState(0);
  const [importProcessedRows, setImportProcessedRows] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importIsComplete, setImportIsComplete] = useState(false);

  // AI lookup state
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isDialogOpen && !isSubmitting) {
      handleSubmit();
    }
  }, isDialogOpen);

  // Form state
  const [formData, setFormData] = useState({
    rate_id: "",
    name: "",
    rate: "",
    rate_type: "percent" as "percent" | "flat",
    description: "",
    is_default: false,
    is_active: true,
  });

  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(editingRate ? "rate/edit" : "rate/new");
    } else {
      setTransaction("rate");
    }
  }, [isDialogOpen, editingRate, setTransaction]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId) {
      fetchTaxRates();
    }
  }, [companyId]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();

    if (profile?.company_id) {
      setCompanyId(profile.company_id);
    }
    setLoading(false);
  };

  const fetchTaxRates = async () => {
    const { data, error } = await supabase.from("tax_rates").select("*").eq("company_id", companyId).order("name");

    if (error) {
      console.error("Error fetching tax rates:", error);
      toast.error("Failed to load tax rates");
      return;
    }

    setTaxRates(data || []);
  };

  const handleAddClick = async () => {
    setEditingRate(null);
    let nextId = '';
    if (companyId) {
      const { data } = await supabase.rpc('get_next_rate_id', { p_company_id: companyId });
      nextId = data || '';
    }
    setFormData({
      rate_id: nextId,
      name: "",
      rate: "",
      rate_type: "percent",
      description: "",
      is_default: false,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new rate
  useKeyboardShortcut("n", handleAddClick);
  useTransactionAction('new', handleAddClick);

  const handleEditClick = (rate: TaxRate) => {
    setEditingRate(rate);
    setFormData({
      rate_id: rate.rate_id,
      name: rate.name,
      rate: rate.rate.toString(),
      rate_type: (rate.rate_type as "percent" | "flat") || "percent",
      description: rate.description || "",
      is_default: rate.is_default,
      is_active: rate.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    const rateValue = parseFloat(formData.rate);
    if (isNaN(rateValue) || rateValue < 0) {
      toast.error("Please enter a valid positive number");
      return;
    }

    if (formData.rate_type === "percent" && rateValue > 100) {
      toast.error("Percentage rate cannot exceed 100%");
      return;
    }

    setIsSubmitting(true);

    try {
      // If setting as default, unset other defaults first
      if (formData.is_default) {
        await supabase
          .from("tax_rates")
          .update({ is_default: false })
          .eq("company_id", companyId)
          .eq("is_default", true);
      }

      if (editingRate) {
        // Update existing
        const { error } = await supabase
          .from("tax_rates")
          .update({
            name: formData.name.trim(),
            rate: rateValue,
            rate_type: formData.rate_type,
            description: formData.description.trim() || null,
            is_default: formData.is_default,
            is_active: formData.is_active,
          })
          .eq("id", editingRate.id);

        if (error) throw error;
        toast.success("Rate updated");
      } else {
        // Create new
        const { error } = await supabase.from("tax_rates").insert({
          company_id: companyId,
          rate_id: formData.rate_id,
          name: formData.name.trim(),
          rate: rateValue,
          rate_type: formData.rate_type,
          description: formData.description.trim() || null,
          is_default: formData.is_default,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success("Rate created");
      }

      setIsDialogOpen(false);
      fetchTaxRates();
    } catch (error: any) {
      console.error("Error saving rate:", error);
      toast.error(error.message || "Failed to save rate");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tax rate?")) return;

    const { error } = await supabase.from("tax_rates").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete tax rate");
      return;
    }

    toast.success("Tax rate deleted");
    fetchTaxRates();
  };

  const handleToggleActive = async (rate: TaxRate) => {
    const { error } = await supabase.from("tax_rates").update({ is_active: !rate.is_active }).eq("id", rate.id);

    if (error) {
      toast.error("Failed to update tax rate");
      return;
    }

    fetchTaxRates();
  };

  const handleAiLookup = async () => {
    if (!aiQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-tax-rate', {
        body: { query: aiQuery.trim() },
      });
      if (error) throw error;
      if (data?.rate) {
        const r = data.rate;
        setFormData(prev => ({
          ...prev,
          name: r.name || prev.name,
          rate_type: r.rate_type === 'flat' ? 'flat' : 'percent',
          rate: r.rate?.toString() || prev.rate,
          description: r.description || prev.description,
        }));
        toast.success('Rate information filled');
        setAiQuery('');
      } else {
        toast.error('No results found');
      }
    } catch (err: any) {
      console.error('AI lookup error:', err);
      toast.error(err.message || 'Failed to look up rate');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = async () => {
    if (taxRates.length === 0) {
      toast.info('No tax rates to export');
      return;
    }
    const data = taxRates.map(r => ({
      rate_id: r.rate_id,
      name: r.name,
      rate_type: r.rate_type,
      rate: r.rate,
      description: r.description || '',
      is_default: r.is_default ? 'Yes' : 'No',
      is_active: r.is_active ? 'Yes' : 'No',
    }));
    await exportToExcel(data, 'tax_rates.xlsx', 'Tax Rates', [
      { header: 'Rate ID', key: 'rate_id', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Type', key: 'rate_type', width: 12 },
      { header: 'Rate/Amount', key: 'rate', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Default', key: 'is_default', width: 10 },
      { header: 'Active', key: 'is_active', width: 10 },
    ]);
    toast.success('Tax rates exported');
  };

  const handleDownloadTemplate = async () => {
    await exportToExcel([], 'tax_rates_template.xlsx', 'Tax Rates', [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Type (percent/flat)', key: 'rate_type', width: 20 },
      { header: 'Rate/Amount', key: 'rate', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Default (Yes/No)', key: 'is_default', width: 15 },
      { header: 'Active (Yes/No)', key: 'is_active', width: 15 },
    ]);
    toast.success('Template downloaded');
  };

  const handleImport = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) {
        toast.error('No data found in file');
        return;
      }

      setImportTotalRows(rows.length);
      setImportProcessedRows(0);
      setImportResults([]);
      setImportIsComplete(false);
      setImportProgressOpen(true);

      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const name = (row['Name'] || '').toString().trim();
          if (!name) throw new Error('Name is required');

          const rateType = (row['Type (percent/flat)'] || row['Type'] || row['rate_type'] || 'percent').toString().trim().toLowerCase();
          if (rateType !== 'percent' && rateType !== 'flat') throw new Error('Type must be "percent" or "flat"');

          const rateVal = parseFloat(row['Rate/Amount'] || row['rate'] || '0');
          if (isNaN(rateVal) || rateVal < 0) throw new Error('Invalid rate value');
          if (rateType === 'percent' && rateVal > 100) throw new Error('Percentage cannot exceed 100');

          const isDefault = (row['Default (Yes/No)'] || row['Default'] || row['is_default'] || 'No').toString().trim().toLowerCase() === 'yes';
          const isActive = (row['Active (Yes/No)'] || row['Active'] || row['is_active'] || 'Yes').toString().trim().toLowerCase() !== 'no';

          const { data: nextId } = await supabase.rpc('get_next_rate_id', { p_company_id: companyId });

          if (isDefault) {
            await supabase.from('tax_rates').update({ is_default: false }).eq('company_id', companyId).eq('is_default', true);
          }

          const { error } = await supabase.from('tax_rates').insert({
            company_id: companyId,
            rate_id: nextId || '',
            name,
            rate_type: rateType,
            rate: rateVal,
            description: (row['Description'] || row['description'] || '').toString().trim() || null,
            is_default: isDefault,
            is_active: isActive,
          });

          if (error) throw error;
          results.push({ row: i + 2, status: 'success', message: `Created "${name}"` });
        } catch (err: any) {
          results.push({ row: i + 2, status: 'error', message: err.message || 'Unknown error' });
        }

        setImportProcessedRows(i + 1);
        setImportResults([...results]);
      }

      setImportIsComplete(true);
      fetchTaxRates();
    } catch (err: any) {
      toast.error('Failed to read file: ' + (err.message || ''));
    }
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
                <Percent className="w-7 h-7 text-yellow-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Tax Rates</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ColumnToggle
                columns={RATE_COLUMNS}
                visibleColumns={visibleColumns}
                onToggleColumn={toggleColumn}
                onResetToDefaults={resetToDefaults}
                onShowAll={showAll}
                onHideAll={hideAll}
              />
              <ImportExportButtons
                importEnabled={isImportEnabled("tax_rate")}
                exportEnabled={isExportEnabled("tax_rate")}
                onImport={handleImport}
                onExport={handleExport}
                onDownloadTemplate={handleDownloadTemplate}
                entityName="Tax Rates"
              />
              <Button onClick={handleAddClick} variant="default" size="icon" className="relative">
                <Plus className="w-4 h-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {taxRates.length === 0 ? (
          <div className="text-center py-12">
            <Percent className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No tax rates yet</h3>
            <p className="text-muted-foreground mb-4">Create tax rates to apply to purchase orders</p>
            <Button onClick={handleAddClick}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Tax Rate
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {isColumnVisible("rate_id") && (
                    <SortableTableHead label="Rate ID" sortKey="rate_id" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig('rate_id')} onFilterConfig={handleFilterConfig} filterKey="rate_id" />
                  )}
                  {isColumnVisible("name") && (
                    <SortableTableHead label="Name" sortKey="name" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig('name')} onFilterConfig={handleFilterConfig} filterKey="name" />
                  )}
                  {isColumnVisible("type") && (
                    <SortableTableHead label="Type" sortKey="rate_type" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig('rate_type')} onFilterConfig={handleFilterConfig} filterKey="rate_type" />
                  )}
                  {isColumnVisible("rate") && (
                    <SortableTableHead label="Rate/Amount" sortKey="rate" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig('rate')} onFilterConfig={handleFilterConfig} filterKey="rate" className="text-right" />
                  )}
                  {isColumnVisible("description") && (
                    <SortableTableHead label="Description" sortKey="description" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig('description')} onFilterConfig={handleFilterConfig} filterKey="description" />
                  )}
                  {isColumnVisible("status") && (
                    <SortableTableHead label="Status" sortKey="is_active" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterConfig={getFilterConfig('is_active')} onFilterConfig={handleFilterConfig} filterKey="is_active" />
                  )}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredData.map((rate) => (
                  <TableRow key={rate.id}>
                    {isColumnVisible("rate_id") && (
                      <TableCell className="font-mono text-muted-foreground">{rate.rate_id}</TableCell>
                    )}
                    {isColumnVisible("name") && (
                      <TableCell className="font-medium">
                        {rate.name}
                        {rate.is_default && (
                          <Badge variant="secondary" className="ml-2">
                            Default
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {isColumnVisible("type") && (
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {rate.rate_type === "flat" ? (
                            <>
                              <DollarSign className="w-3 h-3" /> Flat
                            </>
                          ) : (
                            <>
                              <Percent className="w-3 h-3" /> Percent
                            </>
                          )}
                        </Badge>
                      </TableCell>
                    )}
                    {isColumnVisible("rate") && (
                      <TableCell className="text-right font-mono">
                        {rate.rate_type === "flat" ? `$${rate.rate.toFixed(2)}` : `${rate.rate}%`}
                      </TableCell>
                    )}
                    {isColumnVisible("description") && (
                      <TableCell className="text-muted-foreground">{rate.description || "-"}</TableCell>
                    )}
                    {isColumnVisible("status") && (
                      <TableCell>
                        <Badge className={rate.is_active ? "bg-green-500 text-white" : "bg-slate-500 text-white"}>
                          {rate.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(rate)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleToggleActive(rate)}>
                              {rate.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(rate.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
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
            <DialogTitle>{editingRate ? "Edit Rate" : "Add Rate"}</DialogTitle>
            <DialogDescription>
              {editingRate ? "Update the rate details" : "Create a new rate for orders"}
            </DialogDescription>
          </DialogHeader>

          {!editingRate && (
            <div className="flex items-center gap-2 px-6">
              <Input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="e.g., Ohio state sales tax"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAiLookup(); } }}
                disabled={aiLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAiLookup}
                disabled={aiLoading || !aiQuery.trim()}
                title="Look up tax rate"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              </Button>
            </div>
          )}

          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="rate_id">Rate ID</Label>
              <Input
                id="rate_id"
                value={formData.rate_id}
                onChange={(e) => setFormData({ ...formData, rate_id: e.target.value })}
                placeholder="Auto-generated"
                readOnly={!!editingRate}
                className={editingRate ? 'bg-muted' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Tax, VAT, Shipping Fee"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate_type">Rate Type *</Label>
              <Select
                value={formData.rate_type}
                onValueChange={(value: "percent" | "flat") => setFormData({ ...formData, rate_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Percentage
                    </div>
                  </SelectItem>
                  <SelectItem value="flat">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Flat Amount
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">{formData.rate_type === "percent" ? "Rate (%) *" : "Amount ($) *"}</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                max={formData.rate_type === "percent" ? "100" : undefined}
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder={formData.rate_type === "percent" ? "e.g., 10" : "e.g., 25.00"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_default">Default Rate</Label>
                <p className="text-sm text-muted-foreground">Use as default for new orders</p>
              </div>
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-sm text-muted-foreground">Available for use in orders</p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRate ? "Update" : "Create"}
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportProgressDialog
        open={importProgressOpen}
        onOpenChange={setImportProgressOpen}
        title="Importing Tax Rates"
        totalRows={importTotalRows}
        processedRows={importProcessedRows}
        results={importResults}
        isComplete={importIsComplete}
      />
    </div>
  );
};

export default Rates;
