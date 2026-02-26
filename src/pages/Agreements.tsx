import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { SortableTableHead } from "@/components/SortableTableHead";
import { useTableSort } from "@/hooks/use-table-sort";
import { toast } from "@/lib/toast";
import { Plus, Handshake, Trash2, Search, X } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface Agreement {
  id: string;
  agreement_id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  account_count?: number;
  item_count?: number;
}

interface Account {
  id: string;
  account_id: string;
  name: string;
  type: string;
}

interface Product {
  id: string;
  product_id: string;
  name: string;
  price: number | null;
}

interface AgreementAccount {
  id: string;
  account_id: string;
  account: Account;
}

interface AgreementItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  cadence: string | null;
  cadence_day: string | null;
  product: { name: string; product_id: string };
}

type DialogMode = "create" | "edit";

const STATUS_OPTIONS = ["draft", "active", "expired", "terminated"];

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  terminated: "bg-destructive/10 text-destructive",
};

const emptyForm = { name: "", status: "draft", start_date: "", end_date: "", notes: "" };
const CADENCE_OPTIONS = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"];
const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS_OF_YEAR = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const getCadenceDayOptions = (cadence: string) => {
  if (cadence === "weekly" || cadence === "biweekly")
    return DAYS_OF_WEEK.map((d, i) => ({ value: String(i), label: d }));
  if (cadence === "monthly" || cadence === "bimonthly")
    return Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Day ${i + 1}` }));
  if (cadence === "quarterly" || cadence === "yearly")
    return MONTHS_OF_YEAR.map((m, i) => ({ value: String(i + 1), label: m }));
  return [];
};

const getCadenceDayLabel = (cadence: string) => {
  if (cadence === "weekly" || cadence === "biweekly") return "Day of Week";
  if (cadence === "monthly" || cadence === "bimonthly") return "Day of Month";
  if (cadence === "quarterly" || cadence === "yearly") return "Month";
  return null;
};

const emptyItem = { product_id: "", quantity: "1", unit_price: "0", notes: "", cadence: "", cadence_day: "" };

export default function Agreements() {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").select("company_id").eq("user_id", data.user.id).single().then(({ data: p }) => {
          if (p) setCompanyId(p.company_id);
        });
      }
    });
  }, []);

  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Unified dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [dialogTab, setDialogTab] = useState("details");
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [linkedAccounts, setLinkedAccounts] = useState<AgreementAccount[]>([]);
  const [linkedItems, setLinkedItems] = useState<AgreementItem[]>([]);

  // Add rows state
  const [addAccountId, setAddAccountId] = useState("");
  const [addItem, setAddItem] = useState({ ...emptyItem });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Agreement | null>(null);

  const { sortConfig, handleSort, sortedAndFilteredData } = useTableSort<Agreement>(agreements, "created_at", "desc");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAgreements = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("agreements")
      .select("*, agreement_accounts(count), agreement_items(count)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) { toast.error("Failed to load agreements"); setLoading(false); return; }
    setAgreements(
      (data || []).map((a: any) => ({
        ...a,
        account_count: a.agreement_accounts?.[0]?.count ?? 0,
        item_count: a.agreement_items?.[0]?.count ?? 0,
      }))
    );
    setLoading(false);
  }, [companyId]);

  const fetchSupportData = useCallback(async () => {
    if (!companyId) return;
    const [{ data: accs }, { data: prods }] = await Promise.all([
      supabase.from("accounts").select("id, account_id, name, type").eq("company_id", companyId).order("name"),
      supabase.from("products").select("id, product_id, name, price").eq("company_id", companyId).order("name"),
    ]);
    setAllAccounts(accs || []);
    setAllProducts(prods || []);
  }, [companyId]);

  const fetchLinked = useCallback(async (id: string) => {
    const [{ data: accs }, { data: items }] = await Promise.all([
      supabase.from("agreement_accounts")
        .select("id, account_id, account:accounts(id, account_id, name, type)")
        .eq("agreement_id", id),
      supabase.from("agreement_items")
        .select("id, product_id, quantity, unit_price, notes, cadence, cadence_day, product:products(name, product_id)")
        .eq("agreement_id", id),
    ]);
    setLinkedAccounts((accs || []).map((a: any) => ({ ...a, account: a.account })));
    setLinkedItems((items || []).map((i: any) => ({ ...i, product: i.product })));
  }, []);

  useEffect(() => { fetchAgreements(); fetchSupportData(); }, [fetchAgreements, fetchSupportData]);

  // ── Dialog open helpers ────────────────────────────────────────────────────

  const openCreate = () => {
    setSelectedAgreement(null);
    setForm({ ...emptyForm });
    setLinkedAccounts([]);
    setLinkedItems([]);
    setAddAccountId("");
    setAddItem({ ...emptyItem });
    setDialogMode("create");
    setDialogTab("details");
    setDialogOpen(true);
  };

  const openEdit = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setForm({
      name: agreement.name,
      status: agreement.status,
      start_date: agreement.start_date || "",
      end_date: agreement.end_date || "",
      notes: agreement.notes || "",
    });
    setAddAccountId("");
    setAddItem({ ...emptyItem });
    setDialogMode("edit");
    setDialogTab("details");
    setDialogOpen(true);
    fetchLinked(agreement.id);
  };

  // ── Save details ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (dialogMode === "create") {
      if (!companyId) { setSaving(false); return; }
      const { data: idData } = await supabase.rpc("get_next_agreement_id", { p_company_id: companyId });
      const { data: newRow, error } = await supabase
        .from("agreements")
        .insert({
          company_id: companyId,
          agreement_id: idData,
          name: form.name.trim(),
          status: form.status,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          notes: form.notes || null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();
      setSaving(false);
      if (error) { toast.error("Failed to create agreement"); return; }
      toast.success("Agreement created — add accounts and items below");
      setSelectedAgreement({ ...(newRow as any), account_count: 0, item_count: 0 });
      setDialogMode("edit");
      setDialogTab("accounts");
      fetchAgreements();
    } else {
      if (!selectedAgreement) { setSaving(false); return; }
      const { error } = await supabase.from("agreements").update({
        name: form.name.trim(),
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      }).eq("id", selectedAgreement.id);
      setSaving(false);
      if (error) { toast.error("Failed to save agreement"); return; }
      toast.success("Agreement saved");
      setSelectedAgreement(a => a ? { ...a, name: form.name.trim(), status: form.status, start_date: form.start_date || null, end_date: form.end_date || null, notes: form.notes || null } : a);
      fetchAgreements();
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // CASCADE delete handles agreement_accounts and agreement_items automatically
    const { error } = await supabase.from("agreements").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to delete agreement"); return; }
    toast.success("Agreement deleted");
    setDeleteTarget(null);
    if (dialogOpen && selectedAgreement?.id === deleteTarget.id) setDialogOpen(false);
    fetchAgreements();
  };

  // ── Accounts ───────────────────────────────────────────────────────────────

  const handleAddAccount = async () => {
    if (!selectedAgreement || !addAccountId) return;
    const { error } = await supabase.from("agreement_accounts").insert({
      agreement_id: selectedAgreement.id,
      account_id: addAccountId,
    });
    if (error) { toast.error(error.code === "23505" ? "Account already linked" : "Failed to add account"); return; }
    setAddAccountId("");
    fetchLinked(selectedAgreement.id);
    fetchAgreements();
  };

  const handleRemoveAccount = async (id: string) => {
    const { error } = await supabase.from("agreement_accounts").delete().eq("id", id);
    if (error) { toast.error("Failed to remove account"); return; }
    if (selectedAgreement) fetchLinked(selectedAgreement.id);
    fetchAgreements();
  };

  // ── Items ──────────────────────────────────────────────────────────────────

  const handleAddItem = async () => {
    if (!selectedAgreement || !addItem.product_id) return;
    const { error } = await supabase.from("agreement_items").insert({
      agreement_id: selectedAgreement.id,
      product_id: addItem.product_id,
      quantity: Number(addItem.quantity) || 1,
      unit_price: Number(addItem.unit_price) || 0,
      notes: addItem.notes || null,
      cadence: addItem.cadence || null,
      cadence_day: addItem.cadence_day || null,
    });
    if (error) { toast.error("Failed to add item"); return; }
    setAddItem({ ...emptyItem });
    fetchLinked(selectedAgreement.id);
    fetchAgreements();
  };

  const handleRemoveItem = async (id: string) => {
    const { error } = await supabase.from("agreement_items").delete().eq("id", id);
    if (error) { toast.error("Failed to remove item"); return; }
    if (selectedAgreement) fetchLinked(selectedAgreement.id);
    fetchAgreements();
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = sortedAndFilteredData;

  const isEditMode = dialogMode === "edit";

  // SearchableSelect options
  const accountOptions = useMemo(() =>
    allAccounts
      .filter(a => !linkedAccounts.some(la => la.account_id === a.id))
      .map(a => ({
        value: a.id,
        label: a.name,
        sublabel: `${a.account_id} · ${a.type}`,
      })),
    [allAccounts, linkedAccounts]
  );

  const productOptions = useMemo(() =>
    allProducts.map(p => ({
      value: p.id,
      label: p.name,
      sublabel: `${p.product_id}${p.price != null ? ` · $${Number(p.price).toFixed(2)}` : ""}`,
    })),
    [allProducts]
  );

  const itemsTotal = useMemo(() =>
    linkedItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0),
    [linkedItems]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pr-16">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Agreements</h1>
          <Badge variant="secondary">{agreements.length}</Badge>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Agreement
        </Button>
      </div>


      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead label="ID" sortKey="agreement_id" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Name" sortKey="name" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Status" sortKey="status" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Start Date" sortKey="start_date" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="End Date" sortKey="end_date" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Accounts" sortKey="account_count" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} className="text-right" />
            <SortableTableHead label="Items" sortKey="item_count" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} className="text-right" />
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No agreements found</TableCell></TableRow>
          ) : filtered.map(a => (
            <TableRow key={a.id} className="cursor-pointer" onClick={() => openEdit(a)}>
              <TableCell className="font-mono text-xs">{a.agreement_id}</TableCell>
              <TableCell className="font-medium">{a.name}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor[a.status] || ""}`}>
                  {a.status}
                </span>
              </TableCell>
              <TableCell className="text-sm">{a.start_date || "-"}</TableCell>
              <TableCell className="text-sm">{a.end_date || "-"}</TableCell>
              <TableCell className="text-right font-mono">{a.account_count ?? 0}</TableCell>
              <TableCell className="text-right font-mono">{a.item_count ?? 0}</TableCell>
              <TableCell onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(a)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Unified Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {isEditMode ? (
                <>
                  <span className="font-mono text-sm text-muted-foreground font-normal">{selectedAgreement?.agreement_id}</span>
                  <span>{form.name || selectedAgreement?.name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor[form.status] || ""}`}>
                    {form.status}
                  </span>
                </>
              ) : "New Agreement"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab} className="flex flex-col flex-1 min-h-0">
            <div className="px-6 pt-2 shrink-0">
              <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="accounts" disabled={!isEditMode}>
                Accounts{isEditMode ? ` (${linkedAccounts.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="items" disabled={!isEditMode}>
                Items{isEditMode ? ` (${linkedItems.length})` : ""}
              </TabsTrigger>
            </TabsList>
            </div>

            {/* ── Details ── */}
            <TabsContent value="details" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4 space-y-4">
                {!isEditMode && (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    Create the agreement first — you'll be taken straight to the Accounts tab to link accounts and items.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="mb-1.5 block">Name <span className="text-destructive">*</span></Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Agreement name" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div />
                  <div>
                    <Label className="mb-1.5 block">Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">End Date</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="mb-1.5 block">Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4} placeholder="Optional notes about this agreement..." />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                    {saving ? "Saving..." : isEditMode ? "Save Changes" : "Create Agreement"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ── Accounts ── */}
            <TabsContent value="accounts" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4 space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Search and select an account</Label>
                    <SearchableSelect
                      options={accountOptions}
                      value={addAccountId}
                      onValueChange={setAddAccountId}
                      placeholder="Search accounts..."
                      emptyMessage="No accounts found"
                    />
                  </div>
                  <Button onClick={handleAddAccount} disabled={!addAccountId} className="shrink-0">
                    <Plus className="h-4 w-4 mr-1" /> Link Account
                  </Button>
                </div>

                {linkedAccounts.length === 0 ? (
                  <div className="border border-dashed rounded-lg py-12 flex flex-col items-center gap-2 text-muted-foreground">
                    <p className="text-sm">No accounts linked to this agreement yet</p>
                    <p className="text-xs">Use the search above to add accounts</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Account ID</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {linkedAccounts.map((la, i) => (
                          <tr key={la.id} className={i < linkedAccounts.length - 1 ? "border-b border-border" : ""}>
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{la.account?.account_id}</td>
                            <td className="px-4 py-2.5 font-medium">{la.account?.name}</td>
                            <td className="px-4 py-2.5 capitalize text-muted-foreground">{la.account?.type}</td>
                            <td className="px-2 py-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveAccount(la.id)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Items ── */}
            <TabsContent value="items" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4 space-y-4">
                {/* Add item row */}
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_90px_120px] gap-2">
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Product</Label>
                      <SearchableSelect
                        options={productOptions}
                        value={addItem.product_id}
                        onValueChange={v => {
                          const p = allProducts.find(x => x.id === v);
                          setAddItem(i => ({ ...i, product_id: v, unit_price: p?.price?.toString() ?? "0" }));
                        }}
                        placeholder="Search products..."
                        emptyMessage="No products found"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Qty</Label>
                      <Input type="number" value={addItem.quantity} onChange={e => setAddItem(i => ({ ...i, quantity: e.target.value }))} min="0" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Unit Price ($)</Label>
                      <Input type="number" value={addItem.unit_price} onChange={e => setAddItem(i => ({ ...i, unit_price: e.target.value }))} min="0" step="0.01" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Cadence</Label>
                      <Select value={addItem.cadence} onValueChange={v => setAddItem(i => ({ ...i, cadence: v, cadence_day: "" }))}>
                        <SelectTrigger><SelectValue placeholder="No cadence" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No cadence</SelectItem>
                          {CADENCE_OPTIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {addItem.cadence && getCadenceDayLabel(addItem.cadence) && (
                      <div>
                        <Label className="mb-1.5 block text-xs text-muted-foreground">{getCadenceDayLabel(addItem.cadence)}</Label>
                        <Select value={addItem.cadence_day} onValueChange={v => setAddItem(i => ({ ...i, cadence_day: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {getCadenceDayOptions(addItem.cadence).map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Notes (optional)</Label>
                      <Input value={addItem.notes} onChange={e => setAddItem(i => ({ ...i, notes: e.target.value }))} placeholder="e.g. special terms for this product" />
                    </div>
                    <Button onClick={handleAddItem} disabled={!addItem.product_id} className="shrink-0">
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>
                </div>

                {/* Items list */}
                {linkedItems.length === 0 ? (
                  <div className="border border-dashed rounded-lg py-12 flex flex-col items-center gap-2 text-muted-foreground">
                    <p className="text-sm">No items in scope yet</p>
                    <p className="text-xs">Use the search above to add products</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qty</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Unit Price</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cadence</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Notes</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {linkedItems.map((item, i) => {
                          const dayOpts = item.cadence ? getCadenceDayOptions(item.cadence) : [];
                          const dayLabel = item.cadence_day ? (dayOpts.find(o => o.value === item.cadence_day)?.label ?? item.cadence_day) : null;
                          return (
                            <tr key={item.id} className={i < linkedItems.length - 1 ? "border-b border-border" : ""}>
                              <td className="px-4 py-2.5">
                                <span className="font-mono text-xs text-muted-foreground mr-2">{item.product?.product_id}</span>
                                <span className="font-medium">{item.product?.name}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono">{item.quantity}</td>
                              <td className="px-4 py-2.5 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-medium">${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                {item.cadence ? (
                                  <span className="capitalize">{item.cadence}{dayLabel ? ` · ${dayLabel}` : ""}</span>
                                ) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.notes || "—"}</td>
                              <td className="px-2 py-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {linkedItems.length > 0 && (
                        <tfoot className="border-t border-border bg-muted/40">
                          <tr>
                            <td colSpan={3} className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Agreement Total</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold">${itemsTotal.toFixed(2)}</td>
                            <td colSpan={3} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Agreement"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? All linked accounts and items will be removed.`}
      />
    </div>
  );
}
