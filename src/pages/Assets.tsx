import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ArrowLeft, Plus, Loader2, Trash2, Pencil, Printer, Box } from "lucide-react";
import { toast } from "@/lib/toast";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

interface Asset {
  id: string;
  name: string;
  asset_tag: string | null;
  description: string | null;
  procurement_value: number;
  procurement_date: string;
  depreciation_rate: number;
  useful_life_years: number | null;
  salvage_value: number;
  location_id: string | null;
  status: string;
  notes: string | null;
}

interface LocationOpt { id: string; name: string; location_id: string }

const STATUSES = ["active", "in_repair", "retired", "disposed"];

function emptyForm(): Omit<Asset, "id"> {
  return {
    name: "",
    asset_tag: "",
    description: "",
    procurement_value: 0,
    procurement_date: format(new Date(), "yyyy-MM-dd"),
    depreciation_rate: 20,
    useful_life_years: 5,
    salvage_value: 0,
    location_id: null,
    status: "active",
    notes: "",
  };
}

function computeSchedule(a: Pick<Asset, "procurement_value" | "procurement_date" | "depreciation_rate" | "salvage_value" | "useful_life_years">) {
  const start = parseISO(a.procurement_date);
  const years = Math.max(1, Math.min(50, a.useful_life_years || Math.ceil(100 / Math.max(0.01, a.depreciation_rate))));
  const annual = (a.procurement_value * a.depreciation_rate) / 100;
  const points: { year: string; value: number }[] = [];
  let v = a.procurement_value;
  points.push({ year: String(start.getFullYear()), value: Math.round(v * 100) / 100 });
  for (let i = 1; i <= years; i++) {
    v = Math.max(a.salvage_value, v - annual);
    points.push({ year: String(start.getFullYear() + i), value: Math.round(v * 100) / 100 });
    if (v <= a.salvage_value) break;
  }
  return points;
}

function currentBookValue(a: Asset) {
  const start = parseISO(a.procurement_date);
  const now = new Date();
  const years = Math.max(0, (now.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000));
  const depreciated = (a.procurement_value * a.depreciation_rate / 100) * years;
  return Math.max(a.salvage_value, a.procurement_value - depreciated);
}

function barcodeDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, value, { format: "CODE128", width: 2, height: 60, displayValue: false, margin: 0 });
  } catch { return ""; }
  return canvas.toDataURL("image/png");
}

function printAssetBarcode(a: Asset) {
  const labelW = 100, labelH = 50;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [labelW, labelH] });
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  const name = a.name.length > 36 ? a.name.slice(0, 36) + "…" : a.name;
  doc.text(name, 3, 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Tag: ${a.asset_tag || a.id.slice(0, 8)}`, 3, 13);
  const code = a.asset_tag || a.id;
  const url = barcodeDataUrl(code);
  if (url) doc.addImage(url, "PNG", 10, 17, 80, 22);
  doc.setFontSize(8);
  doc.text(code, labelW / 2, 44, { align: "center" });
  doc.save(`asset-${a.asset_tag || a.id.slice(0, 8)}.pdf`);
}

const Assets = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<Asset | null>(null);

  useEffect(() => {
    if (!companyId) return;
    void load();
    void loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("assets" as any)
      .select("*")
      .eq("company_id", companyId!)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setAssets((data || []) as any);
    setLoading(false);
  }

  async function loadLocations() {
    const { data } = await supabase
      .from("locations")
      .select("id, name, location_id")
      .eq("company_id", companyId!)
      .order("name");
    setLocations((data || []) as any);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setCreateOpen(true);
  }

  function openEdit(a: Asset) {
    setEditingId(a.id);
    setForm({
      name: a.name, asset_tag: a.asset_tag || "", description: a.description || "",
      procurement_value: a.procurement_value, procurement_date: a.procurement_date,
      depreciation_rate: a.depreciation_rate, useful_life_years: a.useful_life_years,
      salvage_value: a.salvage_value, location_id: a.location_id, status: a.status,
      notes: a.notes || "",
    });
    setCreateOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload: any = {
      ...form,
      company_id: companyId,
      asset_tag: form.asset_tag || null,
      location_id: form.location_id || null,
      useful_life_years: form.useful_life_years || null,
    };
    const q = editingId
      ? supabase.from("assets" as any).update(payload).eq("id", editingId)
      : supabase.from("assets" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Asset updated" : "Asset created");
    setCreateOpen(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this asset?")) return;
    const { error } = await supabase.from("assets" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); await load(); if (viewing?.id === id) setViewing(null); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return assets;
    return assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.asset_tag || "").toLowerCase().includes(q) ||
      (a.description || "").toLowerCase().includes(q)
    );
  }, [assets, search]);

  const locationLabel = (id: string | null) => locations.find(l => l.id === id)?.name || "—";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b sticky top-0 z-50 bg-background">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
            <ArrowLeft className="h-4 w-4" />
            <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
          </Button>
          <Box className="h-5 w-5 text-fuchsia-500" />
          <h1 className="text-xl font-semibold">Assets</h1>
          <div className="ml-auto flex items-center gap-2">
            <Input
              placeholder="Search assets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64"
            />
            <Button onClick={openCreate} size="icon" className="relative">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Box className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No assets yet. Create your first asset to get started.</p>
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Procurement</TableHead>
                  <TableHead className="text-right">Depr. %</TableHead>
                  <TableHead className="text-right">Book Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => setViewing(a)}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="font-mono text-xs">{a.asset_tag || "—"}</TableCell>
                    <TableCell>{locationLabel(a.location_id)}</TableCell>
                    <TableCell className="text-right">${a.procurement_value.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{a.depreciation_rate}%</TableCell>
                    <TableCell className="text-right">${currentBookValue(a).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary">{a.status}</Badge></TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => printAssetBarcode(a)} title="Print barcode">
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(a.id)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="!w-screen !h-screen max-w-none">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Asset" : "Create Asset"}</DialogTitle>
            <DialogDescription>Capture procurement details and depreciation settings.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <div className="md:col-span-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Asset Tag</Label>
                <Input value={form.asset_tag || ""} onChange={e => setForm({ ...form, asset_tag: e.target.value })} placeholder="e.g. AST-0001" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Procurement Value</Label>
                <Input type="number" step="0.01" value={form.procurement_value}
                  onChange={e => setForm({ ...form, procurement_value: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Procurement Date</Label>
                <Input type="date" value={form.procurement_date}
                  onChange={e => setForm({ ...form, procurement_date: e.target.value })} />
              </div>
              <div>
                <Label>Depreciation Rate (% per year)</Label>
                <Input type="number" step="0.01" value={form.depreciation_rate}
                  onChange={e => setForm({ ...form, depreciation_rate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Useful Life (years)</Label>
                <Input type="number" value={form.useful_life_years || ""}
                  onChange={e => setForm({ ...form, useful_life_years: parseInt(e.target.value) || null })} />
              </div>
              <div>
                <Label>Salvage Value</Label>
                <Input type="number" step="0.01" value={form.salvage_value}
                  onChange={e => setForm({ ...form, salvage_value: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Location</Label>
                <SearchableSelect
                  options={locations.map(l => ({ value: l.id, label: l.name, sublabel: l.location_id }))}
                  value={form.location_id || ""}
                  onValueChange={v => setForm({ ...form, location_id: v || null })}
                  placeholder="Select location"
                  allowClear
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Create Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Asset Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <DialogContent className="!w-screen !h-screen max-w-none">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5 text-fuchsia-500" />
                  {viewing.name}
                  <Badge variant="secondary">{viewing.status}</Badge>
                </DialogTitle>
                <DialogDescription>
                  Tag: <span className="font-mono">{viewing.asset_tag || viewing.id.slice(0, 8)}</span>
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Stat label="Procurement Value" value={`$${viewing.procurement_value.toFixed(2)}`} />
                      <Stat label="Procurement Date" value={format(parseISO(viewing.procurement_date), "MMM d, yyyy")} />
                      <Stat label="Depreciation Rate" value={`${viewing.depreciation_rate}% / yr`} />
                      <Stat label="Salvage Value" value={`$${viewing.salvage_value.toFixed(2)}`} />
                      <Stat label="Useful Life" value={viewing.useful_life_years ? `${viewing.useful_life_years} yrs` : "—"} />
                      <Stat label="Location" value={locationLabel(viewing.location_id)} />
                      <Stat label="Current Book Value" value={`$${currentBookValue(viewing).toFixed(2)}`} highlight />
                    </div>
                    {viewing.description && (
                      <div className="mt-6">
                        <h3 className="font-medium mb-1">Description</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewing.description}</p>
                      </div>
                    )}
                    {viewing.notes && (
                      <div className="mt-4">
                        <h3 className="font-medium mb-1">Notes</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewing.notes}</p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="depreciation" className="mt-4">
                    <div className="rounded-md border p-4 bg-card">
                      <h3 className="font-medium mb-3">Depreciation Schedule (Straight-line)</h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={computeSchedule(viewing)}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="year" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                              formatter={(v: any) => `$${Number(v).toFixed(2)}`}
                            />
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow><TableHead>Year</TableHead><TableHead className="text-right">Book Value</TableHead></TableRow>
                          </TableHeader>
                          <TableBody>
                            {computeSchedule(viewing).map(p => (
                              <TableRow key={p.year}>
                                <TableCell>{p.year}</TableCell>
                                <TableCell className="text-right">${p.value.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => printAssetBarcode(viewing)}>
                  <Printer className="h-4 w-4 mr-2" />Print Barcode
                </Button>
                <Button variant="outline" onClick={() => { setViewing(null); openEdit(viewing); }}>
                  <Pencil className="h-4 w-4 mr-2" />Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

export default Assets;
