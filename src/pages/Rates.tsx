import { useEffect, useState } from "react";
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/use-column-visibility";
import { ColumnToggle } from "@/components/ColumnToggle";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ArrowLeft, Percent, Plus, Loader2, MoreHorizontal, Trash2, Pencil, DollarSign } from "lucide-react";
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

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);

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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
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
                entityName="Tax Rates"
              />
              <Button onClick={handleAddClick} variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Rate
                <Kbd>N</Kbd>
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
                  {isColumnVisible("rate_id") && <TableHead>Rate ID</TableHead>}
                  {isColumnVisible("name") && <TableHead>Name</TableHead>}
                  {isColumnVisible("type") && <TableHead>Type</TableHead>}
                  {isColumnVisible("rate") && <TableHead className="text-right">Rate/Amount</TableHead>}
                  {isColumnVisible("description") && <TableHead>Description</TableHead>}
                  {isColumnVisible("status") && <TableHead>Status</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRates.map((rate) => (
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

          <div className="space-y-4 px-6">
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
          </div>

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
    </div>
  );
};

export default Rates;
