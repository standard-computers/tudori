import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  product: { name: string; product_id: string };
}

const STATUS_OPTIONS = ["draft", "active", "expired", "terminated"];

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  terminated: "bg-destructive/10 text-destructive",
};

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

  // Detail dialog
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("accounts");
  const [agreementAccounts, setAgreementAccounts] = useState<AgreementAccount[]>([]);
  const [agreementItems, setAgreementItems] = useState<AgreementItem[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", status: "draft", start_date: "", end_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  // Add account to agreement
  const [addAccountId, setAddAccountId] = useState("");
  // Add item to agreement
  const [addItem, setAddItem] = useState({ product_id: "", quantity: "1", unit_price: "0", notes: "" });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Agreement | null>(null);

  const { sortConfig, handleSort, sortedAndFilteredData } = useTableSort<Agreement>(agreements, "created_at", "desc");

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

  useEffect(() => { fetchAgreements(); fetchSupportData(); }, [fetchAgreements, fetchSupportData]);

  const fetchAgreementDetail = useCallback(async (id: string) => {
    const [{ data: accs }, { data: items }] = await Promise.all([
      supabase.from("agreement_accounts").select("id, account_id, account:accounts(id, account_id, name, type)").eq("agreement_id", id),
      supabase.from("agreement_items").select("id, product_id, quantity, unit_price, notes, product:products(name, product_id)").eq("agreement_id", id),
    ]);
    setAgreementAccounts((accs || []).map((a: any) => ({ ...a, account: a.account })));
    setAgreementItems((items || []).map((i: any) => ({ ...i, product: i.product })));
  }, []);

  const openDetail = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setDetailTab("accounts");
    setDetailOpen(true);
    fetchAgreementDetail(agreement.id);
  };

  const handleCreate = async () => {
    if (!companyId || !form.name.trim()) return;
    setSaving(true);
    const { data: idData } = await supabase.rpc("get_next_agreement_id", { p_company_id: companyId });
    const { error } = await supabase.from("agreements").insert({
      company_id: companyId,
      agreement_id: idData,
      name: form.name.trim(),
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes || null,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    setSaving(false);
    if (error) { toast.error("Failed to create agreement"); return; }
    toast.success("Agreement created");
    setCreateOpen(false);
    setForm({ name: "", status: "draft", start_date: "", end_date: "", notes: "" });
    fetchAgreements();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("agreements").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to delete agreement"); return; }
    toast.success("Agreement deleted");
    setDeleteTarget(null);
    fetchAgreements();
  };

  const handleAddAccount = async () => {
    if (!selectedAgreement || !addAccountId) return;
    const { error } = await supabase.from("agreement_accounts").insert({ agreement_id: selectedAgreement.id, account_id: addAccountId });
    if (error) { toast.error(error.code === "23505" ? "Account already linked" : "Failed to add account"); return; }
    toast.success("Account linked");
    setAddAccountId("");
    fetchAgreementDetail(selectedAgreement.id);
    fetchAgreements();
  };

  const handleRemoveAccount = async (id: string) => {
    const { error } = await supabase.from("agreement_accounts").delete().eq("id", id);
    if (error) { toast.error("Failed to remove account"); return; }
    toast.success("Account removed");
    if (selectedAgreement) fetchAgreementDetail(selectedAgreement.id);
    fetchAgreements();
  };

  const handleAddItem = async () => {
    if (!selectedAgreement || !addItem.product_id) return;
    const { error } = await supabase.from("agreement_items").insert({
      agreement_id: selectedAgreement.id,
      product_id: addItem.product_id,
      quantity: Number(addItem.quantity) || 1,
      unit_price: Number(addItem.unit_price) || 0,
      notes: addItem.notes || null,
    });
    if (error) { toast.error("Failed to add item"); return; }
    toast.success("Item added");
    setAddItem({ product_id: "", quantity: "1", unit_price: "0", notes: "" });
    fetchAgreementDetail(selectedAgreement.id);
    fetchAgreements();
  };

  const handleRemoveItem = async (id: string) => {
    const { error } = await supabase.from("agreement_items").delete().eq("id", id);
    if (error) { toast.error("Failed to remove item"); return; }
    toast.success("Item removed");
    if (selectedAgreement) fetchAgreementDetail(selectedAgreement.id);
    fetchAgreements();
  };

  const filtered = useMemo(() => sortedAndFilteredData.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.agreement_id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  }), [sortedAndFilteredData, search, statusFilter]);

  const availableAccounts = allAccounts.filter(a => !agreementAccounts.some(aa => aa.account_id === a.id));

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pr-16">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Agreements</h1>
          <Badge variant="secondary">{agreements.length}</Badge>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Agreement
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search agreements..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
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
            <TableRow key={a.id} className="cursor-pointer" onClick={() => openDetail(a)}>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Agreement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Agreement name" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>{saving ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground">{selectedAgreement?.agreement_id}</span>
              <DialogTitle>{selectedAgreement?.name}</DialogTitle>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor[selectedAgreement?.status || ""] || ""}`}>
                {selectedAgreement?.status}
              </span>
            </div>
            {(selectedAgreement?.start_date || selectedAgreement?.end_date) && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedAgreement?.start_date || "—"} → {selectedAgreement?.end_date || "—"}
              </p>
            )}
          </DialogHeader>

          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList>
              <TabsTrigger value="accounts">Accounts ({agreementAccounts.length})</TabsTrigger>
              <TabsTrigger value="items">Items ({agreementItems.length})</TabsTrigger>
            </TabsList>

            {/* Accounts Tab */}
            <TabsContent value="accounts" className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Select value={addAccountId} onValueChange={setAddAccountId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select an account to link..." /></SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="font-mono text-xs mr-2 text-muted-foreground">{a.account_id}</span>{a.name}
                        <span className="ml-2 text-xs text-muted-foreground capitalize">({a.type})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddAccount} disabled={!addAccountId}><Plus className="h-4 w-4 mr-1" />Link</Button>
              </div>
              {agreementAccounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">No accounts linked yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreementAccounts.map(aa => (
                      <TableRow key={aa.id}>
                        <TableCell className="font-mono text-xs">{aa.account?.account_id}</TableCell>
                        <TableCell>{aa.account?.name}</TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{aa.account?.type}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveAccount(aa.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Items Tab */}
            <TabsContent value="items" className="mt-3 space-y-3">
              <div className="grid grid-cols-[1fr_80px_100px_1fr_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">Product</Label>
                  <Select value={addItem.product_id} onValueChange={v => {
                    const p = allProducts.find(x => x.id === v);
                    setAddItem(i => ({ ...i, product_id: v, unit_price: p?.price?.toString() || "0" }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                    <SelectContent>
                      {allProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono text-xs mr-2 text-muted-foreground">{p.product_id}</span>{p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Qty</Label><Input type="number" value={addItem.quantity} onChange={e => setAddItem(i => ({ ...i, quantity: e.target.value }))} min="0" /></div>
                <div><Label className="text-xs">Unit Price</Label><Input type="number" value={addItem.unit_price} onChange={e => setAddItem(i => ({ ...i, unit_price: e.target.value }))} min="0" /></div>
                <div><Label className="text-xs">Notes</Label><Input value={addItem.notes} onChange={e => setAddItem(i => ({ ...i, notes: e.target.value }))} placeholder="Optional" /></div>
                <Button size="sm" onClick={handleAddItem} disabled={!addItem.product_id} className="mt-5"><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
              {agreementItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">No items in scope yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreementItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="font-mono text-xs mr-2 text-muted-foreground">{item.product?.product_id}</span>
                          {item.product?.name}
                        </TableCell>
                        <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono">${Number(item.unit_price).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.notes || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will also remove all linked accounts and items.`}
      />
    </div>
  );
}
