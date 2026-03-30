import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AuditHistoryTab } from "@/components/AuditHistoryTab";
import { useChangeHistorySettings } from "@/hooks/use-change-history-settings";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody,
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
import { Plus, Handshake, Trash2, Search, X, ClipboardCheck, ShoppingCart, FileText, Loader2, Percent, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";
import { useShiftSelect } from "@/hooks/use-shift-select";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { Kbd } from "@/components/ui/kbd";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useVendorSources } from "@/hooks/use-vendor-sources";

interface Agreement {
  id: string;
  agreement_id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  vendor_source: string | null;
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

interface TaxRate {
  id: string;
  rate_id: string;
  name: string;
  rate: number;
  rate_type: string;
  description: string | null;
}

type DialogMode = "create" | "edit";

interface PendingDocument {
  type: "purchase_order" | "sales_order";
  accountId: string;
  accountName: string;
  accountType: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number }[];
  reason: string;
  periodDate: string; // the date this document is for
}


const STATUS_OPTIONS = ["draft", "active", "expired", "terminated"];

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  terminated: "bg-destructive/10 text-destructive",
};

const emptyForm = { name: "", status: "draft", start_date: "", end_date: "", notes: "", vendor_source: "" };
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
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { vendorOptions, parseVendorValue, getVendorDisplayName } = useVendorSources(companyId, { includeAllLocations: true });
  const { isHistoryEnabled } = useChangeHistorySettings(companyId);

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
  const [allRates, setAllRates] = useState<TaxRate[]>([]);
  const [linkedRateIds, setLinkedRateIds] = useState<Set<string>>(new Set());
  const [rateSearch, setRateSearch] = useState("");

  // Add rows state
  const [addAccountId, setAddAccountId] = useState("");
  const [addItem, setAddItem] = useState({ ...emptyItem });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Agreement | null>(null);

  // Check / Execute
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [checking, setChecking] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Progress dialog state
  interface ProgressEntry { label: string; status: "pending" | "success" | "error"; detail?: string }
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressDone, setProgressDone] = useState(false);

  const { sortConfig, handleSort, sortedAndFilteredData } = useTableSort<Agreement>(agreements, "created_at", "desc");

  // ── Multi-select ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const orderedIds = useMemo(() => sortedAndFilteredData.map(a => a.id), [sortedAndFilteredData]);
  const { handleRowSelect } = useShiftSelect(orderedIds, selectedIds, setSelectedIds);
  const [bulkChecking, setBulkChecking] = useState(false);

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
    const [{ data: accs }, { data: prods }, { data: rates }] = await Promise.all([
      supabase.from("accounts").select("id, account_id, name, type").eq("company_id", companyId).order("name"),
      supabase.from("products").select("id, product_id, name, price").eq("company_id", companyId).order("name"),
      supabase.from("tax_rates").select("id, rate_id, name, rate, rate_type, description").eq("company_id", companyId).eq("is_active", true).order("name"),
    ]);
    setAllAccounts(accs || []);
    setAllProducts(prods || []);
    setAllRates(rates || []);
  }, [companyId]);

  const fetchLinked = useCallback(async (id: string) => {
    const [{ data: accs }, { data: items }, { data: agrRates }] = await Promise.all([
      supabase.from("agreement_accounts")
        .select("id, account_id, account:accounts(id, account_id, name, type)")
        .eq("agreement_id", id),
      supabase.from("agreement_items")
        .select("id, product_id, quantity, unit_price, notes, cadence, cadence_day, product:products(name, product_id)")
        .eq("agreement_id", id),
      supabase.from("agreement_rates" as any).select("rate_id").eq("agreement_id", id),
    ]);
    setLinkedAccounts((accs || []).map((a: any) => ({ ...a, account: a.account })));
    setLinkedItems((items || []).map((i: any) => ({ ...i, product: i.product })));
    setLinkedRateIds(new Set((agrRates || []).map((r: any) => r.rate_id)));
  }, []);

  useEffect(() => { fetchAgreements(); fetchSupportData(); }, [fetchAgreements, fetchSupportData]);

  // ── Dialog open helpers ────────────────────────────────────────────────────

  const openCreate = () => {
    setSelectedAgreement(null);
    setForm({ ...emptyForm });
    setLinkedAccounts([]);
    setLinkedItems([]);
    setLinkedRateIds(new Set());
    setRateSearch("");
    setAddAccountId("");
    setAddItem({ ...emptyItem });
    setDialogMode("create");
    setDialogTab("details");
    setDialogOpen(true);
  };

  useKeyboardShortcut('n', openCreate);
  useKeyboardShortcut('F1', () => navigate(-1));

  const openEdit = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setForm({
      name: agreement.name,
      status: agreement.status,
      start_date: agreement.start_date || "",
      end_date: agreement.end_date || "",
      notes: agreement.notes || "",
      vendor_source: agreement.vendor_source || "",
    });
    setRateSearch("");
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
          vendor_source: form.vendor_source || null,
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
        vendor_source: form.vendor_source || null,
      }).eq("id", selectedAgreement.id);
      setSaving(false);
      if (error) { toast.error("Failed to save agreement"); return; }
      toast.success("Agreement saved");
      setSelectedAgreement(a => a ? { ...a, name: form.name.trim(), status: form.status, start_date: form.start_date || null, end_date: form.end_date || null, notes: form.notes || null, vendor_source: form.vendor_source || null } : a);
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

  // ── Check / Execute ────────────────────────────────────────────────────────

  // Get all due dates for an item from startDate to today
  const getDueDates = (item: AgreementItem, startDate: Date, endDate: Date): string[] => {
    const dates: string[] = [];
    const c = item.cadence;
    const dayVal = item.cadence_day !== null ? Number(item.cadence_day) : null;

    if (!c || c === "daily") {
      // Every day
      const cur = new Date(startDate);
      while (cur <= endDate) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    } else if (c === "weekly" || c === "biweekly") {
      // dayVal = 0-6 (day of week)
      const step = c === "biweekly" ? 14 : 7;
      const cur = new Date(startDate);
      // advance to first matching day
      while (cur.getDay() !== dayVal && cur <= endDate) cur.setDate(cur.getDate() + 1);
      while (cur <= endDate) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + step);
      }
    } else if (c === "monthly") {
      // dayVal = 1-31 (day of month)
      const cur = new Date(startDate.getFullYear(), startDate.getMonth(), dayVal ?? 1);
      if (cur < startDate) cur.setMonth(cur.getMonth() + 1);
      while (cur <= endDate) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setMonth(cur.getMonth() + 1);
      }
    } else if (c === "quarterly") {
      // dayVal = 1-12 (month of quarter start: 1=Jan,4=Apr,7=Jul,10=Oct)
      const quarterMonths = [1, 4, 7, 10];
      const cur = new Date(startDate.getFullYear(), 0, 1);
      while (cur <= endDate) {
        for (const m of quarterMonths) {
          const d = new Date(cur.getFullYear(), m - 1, 1);
          if (d >= startDate && d <= endDate) {
            dates.push(d.toISOString().slice(0, 10));
          }
        }
        cur.setFullYear(cur.getFullYear() + 1);
      }
    } else if (c === "yearly") {
      // dayVal = 1-12 (month of year)
      const cur = new Date(startDate.getFullYear(), (dayVal ?? 1) - 1, 1);
      if (cur < startDate) cur.setFullYear(cur.getFullYear() + 1);
      while (cur <= endDate) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setFullYear(cur.getFullYear() + 1);
      }
    }

    return dates;
  };

  const handleCheck = async () => {
    if (!selectedAgreement || !companyId) return;
    setChecking(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = selectedAgreement.start_date ? new Date(selectedAgreement.start_date) : today;
      startDate.setHours(0, 0, 0, 0);
      const endDate = selectedAgreement.end_date ? new Date(Math.min(new Date(selectedAgreement.end_date).getTime(), today.getTime())) : today;
      endDate.setHours(0, 0, 0, 0);

      const docs: PendingDocument[] = [];
      const productIds = linkedItems.map(i => i.product_id);

      // Fetch all existing SOs and POs for this company with their items, to check against
      const [{ data: allSOs }, { data: allPOs }] = await Promise.all([
        supabase.from("sales_order_items")
          .select("sales_order_id, product_id, sales_orders!inner(order_date, created_at, company_id)")
          .eq("sales_orders.company_id", companyId)
          .in("product_id", productIds.length > 0 ? productIds : ["none"]),
        supabase.from("purchase_order_items")
          .select("purchase_order_id, product_id, purchase_orders!inner(order_date, created_at, company_id)")
          .eq("purchase_orders.company_id", companyId)
          .in("product_id", productIds.length > 0 ? productIds : ["none"]),
      ]);

      // Build lookup: date -> Set of product_ids covered by existing SO (use order_date for backdate matching)
      const soDateProducts: Record<string, Set<string>> = {};
      for (const row of (allSOs || []) as any[]) {
        const date = (row.sales_orders?.order_date || row.sales_orders?.created_at || "").slice(0, 10);
        if (!soDateProducts[date]) soDateProducts[date] = new Set();
        soDateProducts[date].add(row.product_id);
      }
      const poDateProducts: Record<string, Set<string>> = {};
      for (const row of (allPOs || []) as any[]) {
        const date = (row.purchase_orders?.order_date || row.purchase_orders?.created_at || "").slice(0, 10);
        if (!poDateProducts[date]) poDateProducts[date] = new Set();
        poDateProducts[date].add(row.product_id);
      }

      for (const la of linkedAccounts) {
        const acc = la.account;
        const isCustomer = acc.type?.toLowerCase() === "customer";
        const lookup = isCustomer ? soDateProducts : poDateProducts;

        for (const item of linkedItems) {
          if (!item.cadence && linkedItems.length === 0) continue;
          const dueDates = getDueDates(item, startDate, endDate);

          for (const dateStr of dueDates) {
            // Check if this product is covered on this date
            const covered = lookup[dateStr]?.has(item.product_id);
            if (!covered) {
              // Check if we already have a pending doc for this date+account combo
              const existing = docs.find(
                d => d.periodDate === dateStr && d.accountId === acc.id && d.type === (isCustomer ? "sales_order" : "purchase_order")
              );
              if (existing) {
                // Add item to existing pending doc if not already there
                if (!existing.items.find(i => i.productId === item.product_id)) {
                  existing.items.push({
                    productId: item.product_id,
                    productName: item.product?.name ?? item.product_id,
                    quantity: item.quantity,
                    unitPrice: item.unit_price,
                  });
                }
              } else {
                docs.push({
                  type: isCustomer ? "sales_order" : "purchase_order",
                  accountId: acc.id,
                  accountName: acc.name,
                  accountType: acc.type,
                  items: [{
                    productId: item.product_id,
                    productName: item.product?.name ?? item.product_id,
                    quantity: item.quantity,
                    unitPrice: item.unit_price,
                  }],
                  reason: `Missing ${isCustomer ? "sales order" : "purchase order"} for ${dateStr}`,
                  periodDate: dateStr,
                });
              }
            }
          }
        }
      }

      // Sort by date
      docs.sort((a, b) => a.periodDate.localeCompare(b.periodDate));
      setPendingDocs(docs);
      setCheckDialogOpen(true);
    } finally {
      setChecking(false);
    }
  };

  // ── Bulk Check ─────────────────────────────────────────────────────────────

  const handleBulkCheck = async () => {
    if (!companyId || selectedIds.size === 0) return;
    setBulkChecking(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const docs: PendingDocument[] = [];
      const selectedAgreements = agreements.filter(a => selectedIds.has(a.id));
      let lastRateIds = new Set<string>();

      for (const agr of selectedAgreements) {
        const [{ data: accs }, { data: items }, { data: agrRatesData }] = await Promise.all([
          supabase.from("agreement_accounts")
            .select("id, account_id, account:accounts(id, account_id, name, type)")
            .eq("agreement_id", agr.id),
          supabase.from("agreement_items")
            .select("id, product_id, quantity, unit_price, notes, cadence, cadence_day, product:products(name, product_id)")
            .eq("agreement_id", agr.id),
          supabase.from("agreement_rates" as any).select("rate_id").eq("agreement_id", agr.id),
        ]);

        const agrAccounts = (accs || []).map((a: any) => ({ ...a, account: a.account })) as AgreementAccount[];
        const agrItems = (items || []).map((i: any) => ({ ...i, product: i.product })) as AgreementItem[];
        const rateIds = (agrRatesData || []).map((r: any) => r.rate_id);
        for (const rid of rateIds) lastRateIds.add(rid);

        if (agrAccounts.length === 0 || agrItems.length === 0) continue;

        const startDate = agr.start_date ? new Date(agr.start_date) : new Date(today);
        startDate.setHours(0, 0, 0, 0);
        const endDate = agr.end_date ? new Date(Math.min(new Date(agr.end_date).getTime(), today.getTime())) : new Date(today);
        endDate.setHours(0, 0, 0, 0);

        const productIds = agrItems.map(i => i.product_id);

        const [{ data: allSOs }, { data: allPOs }] = await Promise.all([
          supabase.from("sales_order_items")
            .select("sales_order_id, product_id, sales_orders!inner(order_date, created_at, company_id)")
            .eq("sales_orders.company_id", companyId)
            .in("product_id", productIds.length > 0 ? productIds : ["none"]),
          supabase.from("purchase_order_items")
            .select("purchase_order_id, product_id, purchase_orders!inner(order_date, created_at, company_id)")
            .eq("purchase_orders.company_id", companyId)
            .in("product_id", productIds.length > 0 ? productIds : ["none"]),
        ]);

        const soDateProducts: Record<string, Set<string>> = {};
        for (const row of (allSOs || []) as any[]) {
          const date = (row.sales_orders?.order_date || row.sales_orders?.created_at || "").slice(0, 10);
          if (!soDateProducts[date]) soDateProducts[date] = new Set();
          soDateProducts[date].add(row.product_id);
        }
        const poDateProducts: Record<string, Set<string>> = {};
        for (const row of (allPOs || []) as any[]) {
          const date = (row.purchase_orders?.order_date || row.purchase_orders?.created_at || "").slice(0, 10);
          if (!poDateProducts[date]) poDateProducts[date] = new Set();
          poDateProducts[date].add(row.product_id);
        }

        for (const la of agrAccounts) {
          const acc = la.account;
          const isCustomer = acc.type?.toLowerCase() === "customer";
          const lookup = isCustomer ? soDateProducts : poDateProducts;

          for (const item of agrItems) {
            const dueDates = getDueDates(item, startDate, endDate);
            for (const dateStr of dueDates) {
              const covered = lookup[dateStr]?.has(item.product_id);
              if (!covered) {
                const existing = docs.find(
                  d => d.periodDate === dateStr && d.accountId === acc.id && d.type === (isCustomer ? "sales_order" : "purchase_order")
                );
                if (existing) {
                  if (!existing.items.find(i => i.productId === item.product_id)) {
                    existing.items.push({
                      productId: item.product_id,
                      productName: item.product?.name ?? item.product_id,
                      quantity: item.quantity,
                      unitPrice: item.unit_price,
                    });
                  }
                } else {
                  docs.push({
                    type: isCustomer ? "sales_order" : "purchase_order",
                    accountId: acc.id,
                    accountName: acc.name,
                    accountType: acc.type,
                    items: [{
                      productId: item.product_id,
                      productName: item.product?.name ?? item.product_id,
                      quantity: item.quantity,
                      unitPrice: item.unit_price,
                    }],
                    reason: `Missing ${isCustomer ? "sales order" : "purchase order"} for ${dateStr} (${agr.name})`,
                    periodDate: dateStr,
                  });
                }
              }
            }
          }
        }
      }

      setLinkedRateIds(lastRateIds);
      docs.sort((a, b) => a.periodDate.localeCompare(b.periodDate));
      setPendingDocs(docs);
      setSelectedAgreement(selectedAgreements[0]);
      setCheckDialogOpen(true);
    } finally {
      setBulkChecking(false);
    }
  };

  const handleExecute = async () => {
    if (!companyId) return;
    setExecuting(true);
    setCheckDialogOpen(false);

    // Initialize progress dialog
    const entries: ProgressEntry[] = pendingDocs.map(doc => ({
      label: `${doc.type === "sales_order" ? "SO" : "PO"} + Invoice — ${doc.accountName} (${doc.periodDate})`,
      status: "pending" as const,
    }));
    setProgressEntries(entries);
    setProgressCurrent(0);
    setProgressTotal(pendingDocs.length);
    setProgressDone(false);
    setProgressDialogOpen(true);

    let created = 0;
    let errors = 0;

    for (let idx = 0; idx < pendingDocs.length; idx++) {
      const doc = pendingDocs[idx];
      setProgressCurrent(idx + 1);
      try {
        // Fetch account data (ledger, vendor, location) for all doc types
        const { data: accData } = await supabase
          .from("accounts")
          .select("vendor_id, location_id, ledger_id")
          .eq("id", doc.accountId)
          .single();

        const accountLedgerId = accData?.ledger_id ?? null;
        const userId = (await supabase.auth.getUser()).data.user?.id;

        // Resolve vendor_source from the agreement for SO/PO
        const vendorSourceParsed = selectedAgreement?.vendor_source ? parseVendorValue(selectedAgreement.vendor_source) : null;
        const agreementVendorId = vendorSourceParsed?.type === 'vendor' ? vendorSourceParsed.id : null;
        const agreementLocationId = vendorSourceParsed?.type === 'location' ? vendorSourceParsed.id : null;
        const subtotal = doc.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

        // Fetch linked rates for this agreement
        const { data: agrRatesData } = await supabase
          .from("agreement_rates" as any)
          .select("rate_id")
          .eq("agreement_id", selectedAgreement!.id);
        const agrRateIds = (agrRatesData || []).map((r: any) => r.rate_id);
        let taxAmount = 0;
        if (agrRateIds.length > 0) {
          const { data: ratesData } = await supabase
            .from("tax_rates")
            .select("id, rate, rate_type")
            .in("id", agrRateIds);
          for (const r of (ratesData || [])) {
            if (r.rate_type === "flat") taxAmount += Number(r.rate);
            else taxAmount += subtotal * Number(r.rate) / 100;
          }
        }
        const total = subtotal + taxAmount;

        let docRef = "";
        if (doc.type === "sales_order") {
          const { data: soNum } = await supabase.rpc("get_next_so_number", { p_company_id: companyId });

          const { data: so, error: soErr } = await supabase
            .from("sales_orders")
            .insert({
              company_id: companyId,
              so_number: soNum,
              status: "draft",
              total_amount: total,
              subtotal: subtotal,
              tax_amount: taxAmount,
              order_date: doc.periodDate,
              created_by: userId,
              ledger_id: accountLedgerId,
              vendor_id: agreementVendorId,
            })
            .select()
            .single();

          if (soErr) throw soErr;
          docRef = soNum;

          const soItems = doc.items.map(i => ({
            sales_order_id: so.id,
            product_id: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          }));
          await supabase.from("sales_order_items").insert(soItems);

          const { data: invNum } = await supabase.rpc("get_next_invoice_number", { p_company_id: companyId });
          const { data: inv, error: invErr } = await supabase.from("invoices").insert({
            company_id: companyId,
            invoice_number: invNum,
            account_id: doc.accountId,
            sales_order_id: so.id,
            ledger_id: accountLedgerId,
            amount: total,
            subtotal: subtotal,
            tax_amount: taxAmount,
            status: "draft",
            invoice_date: doc.periodDate,
          }).select().single();
          if (invErr) throw invErr;

          const invoiceItemsSO = doc.items.map(i => ({
            invoice_id: (inv as any).id,
            product_id: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          }));
          await supabase.from("invoice_items" as any).insert(invoiceItemsSO);

          if (accountLedgerId && inv) {
            await supabase.from("ledger_transactions" as any).insert({
              ledger_id: accountLedgerId,
              transaction_type: "invoice",
              reference_id: (inv as any).id,
              reference_number: invNum,
              amount: -total,
              description: `Invoice ${invNum} for SO ${soNum}`,
              transaction_date: doc.periodDate,
            });
          }

          setProgressEntries(prev => prev.map((e, i) => i === idx ? { ...e, status: "success", detail: `${soNum} + ${invNum}` } : e));
          created++;
        } else {
          const { data: poNum } = await supabase.rpc("get_next_po_number", { p_company_id: companyId });

          const { data: po, error: poErr } = await supabase
            .from("purchase_orders")
            .insert({
              company_id: companyId,
              po_number: poNum,
              status: "draft",
              vendor_id: agreementVendorId ?? accData?.vendor_id ?? null,
              location_id: agreementLocationId ?? accData?.location_id ?? null,
              total_amount: total,
              order_date: doc.periodDate,
              created_by: userId,
              ledger_id: accountLedgerId,
            })
            .select()
            .single();

          if (poErr) throw poErr;
          docRef = poNum;

          const poItems = doc.items.map(i => ({
            purchase_order_id: po.id,
            product_id: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          }));
          await supabase.from("purchase_order_items").insert(poItems);

          const { data: invNum } = await supabase.rpc("get_next_invoice_number", { p_company_id: companyId });
          const { data: inv, error: invErr } = await supabase.from("invoices").insert({
            company_id: companyId,
            invoice_number: invNum,
            account_id: doc.accountId,
            purchase_order_id: po.id,
            ledger_id: accountLedgerId,
            amount: total,
            subtotal: subtotal,
            tax_amount: taxAmount,
            status: "draft",
            invoice_date: doc.periodDate,
          }).select().single();
          if (invErr) throw invErr;

          const invoiceItemsPO = doc.items.map(i => ({
            invoice_id: (inv as any).id,
            product_id: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          }));
          await supabase.from("invoice_items" as any).insert(invoiceItemsPO);

          if (accountLedgerId && inv) {
            await supabase.from("ledger_transactions" as any).insert({
              ledger_id: accountLedgerId,
              transaction_type: "invoice",
              reference_id: (inv as any).id,
              reference_number: invNum,
              amount: -total,
              description: `Invoice ${invNum} for PO ${poNum}`,
              transaction_date: doc.periodDate,
            });
          }

          setProgressEntries(prev => prev.map((e, i) => i === idx ? { ...e, status: "success", detail: `${poNum} + ${invNum}` } : e));
          created++;
        }
      } catch (e: any) {
        console.error("Failed to create document:", e);
        setProgressEntries(prev => prev.map((e2, i) => i === idx ? { ...e2, status: "error", detail: e?.message || "Unknown error" } : e2));
        errors++;
      }
    }

    setExecuting(false);
    setProgressDone(true);
    if (created > 0) toast.success(`Created ${created} document${created !== 1 ? "s" : ""} successfully`);
    if (errors > 0) toast.error(`${errors} document${errors !== 1 ? "s" : ""} failed`);
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

  // ── Rates ──────────────────────────────────────────────────────────────────

  const toggleRate = (rateId: string) => {
    setLinkedRateIds(prev => {
      const next = new Set(prev);
      if (next.has(rateId)) next.delete(rateId);
      else next.add(rateId);
      return next;
    });
  };

  const handleSaveRates = async () => {
    if (!selectedAgreement) return;
    await supabase.from("agreement_rates" as any).delete().eq("agreement_id", selectedAgreement.id);
    if (linkedRateIds.size > 0) {
      const rows = Array.from(linkedRateIds).map(rate_id => ({
        agreement_id: selectedAgreement.id,
        rate_id,
      }));
      const { error } = await supabase.from("agreement_rates" as any).insert(rows);
      if (error) { toast.error("Failed to save rates"); return; }
    }
    toast.success("Rates saved");
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
    <div className="flex flex-col min-h-screen bg-background">
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ChevronLeft className="h-4 w-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <Handshake className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Agreements</h1>
              <Badge variant="secondary">{agreements.length}</Badge>
            </div>
            <div className="flex items-center gap-1">
              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleBulkCheck}
                  disabled={bulkChecking}
                  title={`Check ${selectedIds.size} agreement${selectedIds.size !== 1 ? "s" : ""}`}
                >
                  {bulkChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                </Button>
              )}
              <Button onClick={openCreate} size="icon" className="relative">
                <Plus className="h-4 w-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">


      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead label="ID" sortKey="agreement_id" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Name" sortKey="name" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Status" sortKey="status" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Start Date" sortKey="start_date" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="End Date" sortKey="end_date" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Vendor / Source" sortKey="vendor_source" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
            <SortableTableHead label="Accounts" sortKey="account_count" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} className="text-right" />
            <SortableTableHead label="Items" sortKey="item_count" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} className="text-right" />
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
              <TableCell className="text-sm text-muted-foreground">{a.vendor_source ? getVendorDisplayName(a.vendor_source) : "-"}</TableCell>
              <TableCell className="text-right font-mono">{a.account_count ?? 0}</TableCell>
              <TableCell className="text-right font-mono">{a.item_count ?? 0}</TableCell>
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
            {isEditMode && selectedAgreement && (
              <div className="absolute right-10 top-2 z-10 flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={checking || linkedAccounts.length === 0 || linkedItems.length === 0}
                  onClick={handleCheck}
                >
                  {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardCheck className="h-3 w-3" />}
                  Check
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => { setDialogOpen(false); setDeleteTarget(selectedAgreement); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
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
              <TabsTrigger value="rates" disabled={!isEditMode}>
                Rates{isEditMode ? ` (${linkedRateIds.size})` : ""}
              </TabsTrigger>
              {isEditMode && isHistoryEnabled("agreement") && (
                <TabsTrigger value="history">History</TabsTrigger>
              )}
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
                  <div className="col-span-2">
                    <Label className="mb-1.5 block">Vendor / Source</Label>
                    <SearchableSelect
                      options={vendorOptions}
                      value={form.vendor_source}
                      onValueChange={v => setForm(f => ({ ...f, vendor_source: v }))}
                      placeholder="Select vendor or internal location..."
                      emptyMessage="No vendors found"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used as the vendor on Sales Orders and Purchase Orders created during execution.</p>
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
                      <Select value={addItem.cadence || "none"} onValueChange={v => setAddItem(i => ({ ...i, cadence: v === "none" ? "" : v, cadence_day: "" }))}>
                        <SelectTrigger><SelectValue placeholder="No cadence" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No cadence</SelectItem>
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

            {/* ── Rates ── */}
            <TabsContent value="rates" className="flex-1 overflow-y-auto mt-0">
              <div className="px-6 py-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search rates..."
                    value={rateSearch}
                    onChange={e => setRateSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {(() => {
                  const filteredRates = allRates.filter(r =>
                    r.name.toLowerCase().includes(rateSearch.toLowerCase()) ||
                    r.rate_id.toLowerCase().includes(rateSearch.toLowerCase()) ||
                    (r.description && r.description.toLowerCase().includes(rateSearch.toLowerCase()))
                  );
                  const formatRate = (r: TaxRate) =>
                    r.rate_type === "flat" ? `$${Number(r.rate).toFixed(2)}` : `${Number(r.rate).toFixed(2)}%`;
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{linkedRateIds.size} of {allRates.length} selected</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
                        {filteredRates.length === 0 ? (
                          <div className="flex flex-col items-center py-8 text-muted-foreground">
                            <Percent className="w-8 h-8 mb-2" />
                            <p className="text-sm">No rates found</p>
                          </div>
                        ) : filteredRates.map(rate => (
                          <label key={rate.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50">
                            <Checkbox
                              checked={linkedRateIds.has(rate.id)}
                              onCheckedChange={() => toggleRate(rate.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{rate.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {rate.rate_id} · {formatRate(rate)}
                                {rate.description ? ` · ${rate.description}` : ""}
                              </p>
                            </div>
                            <span className="text-sm font-medium shrink-0">{formatRate(rate)}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  );
                })()}
                <div className="flex justify-end">
                  <Button onClick={handleSaveRates}>Save Rates</Button>
                </div>
              </div>
            </TabsContent>

            {/* ── History ── */}
            {isEditMode && isHistoryEnabled("agreement") && selectedAgreement && (
              <TabsContent value="history" className="flex-1 overflow-y-auto mt-0">
                <div className="px-6 py-4">
                  <AuditHistoryTab
                    tableName="agreements"
                    recordId={selectedAgreement.id}
                    fieldLabels={{
                      name: "Name",
                      status: "Status",
                      start_date: "Start Date",
                      end_date: "End Date",
                      notes: "Notes",
                      vendor_source: "Vendor / Source",
                      created_by: "Created By",
                    }}
                  />
                </div>
              </TabsContent>
            )}
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

      {/* Check / Execute Dialog */}
      <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Agreement Check — {selectedAgreement?.name}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {pendingDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <ClipboardCheck className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium text-foreground">All up to date</p>
                <p className="text-xs">No documents need to be created for today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The following <span className="font-semibold text-foreground">{pendingDocs.length}</span> document{pendingDocs.length !== 1 ? "s" : ""} are missing across all agreement periods from start date to today. Review and click <strong>Execute</strong> to create them.
                </p>
                {pendingDocs.map((doc, idx) => (
                  <div key={idx} className="border border-border rounded-md overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border">
                      {doc.type === "sales_order" ? (
                        <FileText className="h-4 w-4 text-primary" />
                      ) : (
                        <ShoppingCart className="h-4 w-4 text-primary" />
                      )}
                      <span className="font-medium text-sm capitalize">
                        {doc.type === "sales_order" ? "Sales Order" : "Purchase Order"} + Invoice
                      </span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <span className="text-sm">{doc.accountName}</span>
                      <Badge variant="secondary" className="ml-auto capitalize text-xs">{doc.accountType}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{doc.periodDate}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Product</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Qty</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Unit Price</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doc.items.map((item, ii) => (
                          <tr key={ii} className={ii < doc.items.length - 1 ? "border-b border-border" : ""}>
                            <td className="px-4 py-2">{item.productName}</td>
                            <td className="px-4 py-2 text-right font-mono">{item.quantity}</td>
                            <td className="px-4 py-2 text-right font-mono">${Number(item.unitPrice).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right font-mono font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-border bg-muted/30">
                         {(() => {
                           const docSubtotal = doc.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                           const linkedRates = allRates.filter(r => linkedRateIds.has(r.id));
                           const rateLines = linkedRates.map(r => ({
                             name: r.name,
                             amount: r.rate_type === "flat" ? r.rate : docSubtotal * r.rate / 100,
                             label: r.rate_type === "flat" ? `$${r.rate.toFixed(2)}` : `${r.rate}%`,
                           }));
                           const taxTotal = rateLines.reduce((s, r) => s + r.amount, 0);
                           const grandTotal = docSubtotal + taxTotal;
                           return (
                             <>
                               {rateLines.length > 0 && (
                                 <tr>
                                   <td colSpan={3} className="px-4 py-1.5 text-right text-xs font-medium text-muted-foreground">Subtotal</td>
                                   <td className="px-4 py-1.5 text-right font-mono text-xs">${docSubtotal.toFixed(2)}</td>
                                 </tr>
                               )}
                               {rateLines.map((rl, ri) => (
                                 <tr key={ri}>
                                   <td colSpan={3} className="px-4 py-1 text-right text-xs text-muted-foreground">{rl.name} ({rl.label})</td>
                                   <td className="px-4 py-1 text-right font-mono text-xs">${rl.amount.toFixed(2)}</td>
                                 </tr>
                               ))}
                               <tr>
                                 <td colSpan={3} className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Total</td>
                                 <td className="px-4 py-2 text-right font-mono font-semibold text-sm">
                                    ${grandTotal.toFixed(2)}
                                 </td>
                               </tr>
                             </>
                           );
                         })()}
                       </tfoot>
                    </table>
                    <div className="px-4 py-2 bg-muted/20 border-t border-border">
                      <p className="text-xs text-muted-foreground">{doc.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckDialogOpen(false)} disabled={executing}>
              Cancel
            </Button>
            {pendingDocs.length > 0 && (
              <Button onClick={handleExecute} disabled={executing}>
                {executing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Executing...</> : `Execute (${pendingDocs.length})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Progress Dialog */}
      <Dialog open={progressDialogOpen} onOpenChange={open => { if (progressDone) setProgressDialogOpen(open); }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Executing Agreement — {selectedAgreement?.name}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progressDone ? "Complete" : `Processing ${progressCurrent} of ${progressTotal}...`}</span>
                  <span>{progressEntries.filter(e => e.status === "success").length} created · {progressEntries.filter(e => e.status === "error").length} failed</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Log list */}
              <div className="max-h-72 overflow-y-auto rounded-md border divide-y text-sm">
                {progressEntries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2">
                    {entry.status === "pending" && (
                      i === progressCurrent - 1 && !progressDone
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-0.5 shrink-0" />
                        : <div className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    {entry.status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />}
                    {entry.status === "error" && <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{entry.label}</p>
                      {entry.detail && (
                        <p className={`text-xs ${entry.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                          {entry.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={!progressDone}
              onClick={() => setProgressDialogOpen(false)}
            >
              {progressDone ? "Close" : <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Processing...</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
    </div>
  );
}
