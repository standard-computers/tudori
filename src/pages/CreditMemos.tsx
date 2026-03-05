import { useEffect, useState, useMemo } from "react";
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useTableSort } from "@/hooks/use-table-sort";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/SortableTableHead";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { SearchableSelect, SearchableSelectOption } from "@/components/SearchableSelect";
import { MemoItemsEditor, MemoItem } from "@/components/accounts/MemoItemsEditor";
import { ArrowLeft, Minus, Plus, Loader2, MoreHorizontal, Trash2, Eye, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { format, parseISO } from "date-fns";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { useExcel } from "@/hooks/use-excel";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { ImportProgressDialog, ImportResult } from "@/components/ImportProgressDialog";

interface CreditMemo {
  id: string;
  memo_number: string;
  account_id: string;
  invoice_id: string | null;
  ledger_id: string | null;
  memo_date: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  account?: { name: string; account_id: string } | null;
  invoice?: { invoice_number: string; ledger_id: string | null } | null;
  ledger?: { name: string } | null;
}

interface Account {
  id: string;
  name: string;
  account_id: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  ledger_id: string | null;
  account_id: string;
}

interface Ledger {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  product_id: string;
  base_price?: number;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  applied: "bg-green-500",
  cancelled: "bg-red-500",
};

const CreditMemos = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState<CreditMemo[]>([]);

  // Auto-open view dialog when navigated here with openRef state (e.g. from Ledgers)
  useEffect(() => {
    const ref = (location.state as any)?.openRef;
    if (!ref || !memos.length) return;
    const match = memos.find(m => m.memo_number === ref);
    if (match) {
      handleView(match);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state, memos]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMemo, setViewMemo] = useState<CreditMemo | null>(null);
  const [viewMemoItems, setViewMemoItems] = useState<MemoItem[]>([]);

  // Import/Export
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);
  const { exportToExcel, readExcel } = useExcel();
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importProcessed, setImportProcessed] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImportComplete, setIsImportComplete] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    account_id: "",
    invoice_id: "",
    ledger_id: "",
    notes: "",
  });
  const [items, setItems] = useState<MemoItem[]>([]);

  const totalFromItems = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [items]);

  const { sortConfig, filters, sortedAndFilteredData, handleSort, setFilter, clearAllFilters } =
    useTableSort<CreditMemo>(memos, "memo_number", "desc");

  useEffect(() => {
    if (isCreateDialogOpen) {
      setTransaction("cm/new");
    } else if (isViewDialogOpen) {
      setTransaction("cm/view");
    } else {
      setTransaction("cm");
    }
  }, [isCreateDialogOpen, isViewDialogOpen, setTransaction]);

  useSaveShortcut(() => {
    if (isCreateDialogOpen && !isSubmitting) {
      handleCreate();
    }
  }, isCreateDialogOpen);

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
      fetchMemos();
      fetchAccounts();
      fetchInvoices();
      fetchLedgers();
      fetchProducts();
    }
  }, [companyId]);

  const fetchCompanyId = async () => {
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
    if (profile?.company_id) {
      setCompanyId(profile.company_id);
    }
    setLoading(false);
  };

  const fetchMemos = async () => {
    const { data, error } = await supabase
      .from("credit_memos" as any)
      .select(`
        *,
        account:accounts(name, account_id),
        invoice:invoices(invoice_number, ledger_id),
        ledger:ledgers(name)
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching credit memos:", error);
      toast.error("Failed to load credit memos");
      return;
    }
    setMemos((data as any) || []);
  };

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from("accounts" as any)
      .select("id, name, account_id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");
    setAccounts((data as any) || []);
  };

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("invoices" as any)
      .select("id, invoice_number, amount, ledger_id, account_id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setInvoices((data as any) || []);
  };

  const fetchLedgers = async () => {
    const { data } = await supabase
      .from("ledgers" as any)
      .select("id, name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");
    setLedgers((data as any) || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products" as any)
      .select("id, name, product_id, base_price")
      .eq("company_id", companyId)
      .order("name");
    setProducts((data as any) || []);
  };

  const accountOptions: SearchableSelectOption[] = useMemo(() => {
    return accounts.map((a) => ({
      value: a.id,
      label: a.name,
      sublabel: a.account_id,
    }));
  }, [accounts]);

  const filteredInvoices = useMemo(() => {
    if (!formData.account_id) return invoices;
    return invoices.filter((inv) => inv.account_id === formData.account_id);
  }, [invoices, formData.account_id]);

  const invoiceOptions: SearchableSelectOption[] = useMemo(() => {
    return filteredInvoices.map((inv) => ({
      value: inv.id,
      label: inv.invoice_number,
      sublabel: `$${inv.amount.toFixed(2)}`,
    }));
  }, [filteredInvoices]);

  const ledgerOptions: SearchableSelectOption[] = useMemo(() => {
    return ledgers.map((l) => ({
      value: l.id,
      label: l.name,
    }));
  }, [ledgers]);

  const filteredMemos = useMemo(() => {
    if (!searchQuery) return sortedAndFilteredData;
    const query = searchQuery.toLowerCase();
    return sortedAndFilteredData.filter(
      (memo) =>
        memo.memo_number.toLowerCase().includes(query) ||
        memo.account?.name?.toLowerCase().includes(query) ||
        memo.status.toLowerCase().includes(query),
    );
  }, [sortedAndFilteredData, searchQuery]);

  const handleCreateClick = () => {
    setFormData({
      account_id: "",
      invoice_id: "",
      ledger_id: "",
      notes: "",
    });
    setItems([]);
    setIsCreateDialogOpen(true);
  };

  useKeyboardShortcut("n", handleCreateClick);
  useTransactionAction("new", handleCreateClick);

  const handleCreate = async () => {
    if (!formData.account_id) {
      toast.error("Please select an account");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const invalidItems = items.filter((i) => !i.product_id || i.quantity <= 0 || i.unit_price <= 0);
    if (invalidItems.length > 0) {
      toast.error("Please fill in all item fields correctly");
      return;
    }

    const selectedInvoice = invoices.find((inv) => inv.id === formData.invoice_id);
    const ledgerId = selectedInvoice?.ledger_id || formData.ledger_id;

    if (!ledgerId) {
      toast.error("Please select an invoice or ledger");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: memoNumber } = await supabase.rpc("get_next_credit_memo_number", {
        p_company_id: companyId,
      });

      const { data: memo, error: memoError } = await supabase
        .from("credit_memos" as any)
        .insert({
          company_id: companyId,
          memo_number: memoNumber,
          account_id: formData.account_id,
          invoice_id: formData.invoice_id || null,
          ledger_id: ledgerId,
          amount: totalFromItems,
          notes: formData.notes || null,
          status: "applied",
        })
        .select()
        .single();

      if (memoError) throw memoError;

      // Insert memo items
      const memoItems = items.map((item) => ({
        credit_memo_id: (memo as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes || null,
      }));

      await supabase.from("credit_memo_items" as any).insert(memoItems);

      // Create ledger transaction (negative for credit memo)
      await supabase.from("ledger_transactions" as any).insert({
        ledger_id: ledgerId,
        transaction_type: "credit_memo",
        reference_id: (memo as any).id,
        reference_number: memoNumber,
        amount: -totalFromItems,
        description: formData.notes || `Credit memo ${memoNumber}`,
        transaction_date: new Date().toISOString().split("T")[0],
      });

      toast.success("Credit memo created successfully");
      setIsCreateDialogOpen(false);
      fetchMemos();
    } catch (error: any) {
      console.error("Error creating credit memo:", error);
      toast.error(error.message || "Failed to create credit memo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleView = async (memo: CreditMemo) => {
    setViewMemo(memo);
    // Fetch memo items
    const { data } = await supabase
      .from("credit_memo_items" as any)
      .select("id, product_id, quantity, unit_price, notes")
      .eq("credit_memo_id", memo.id);
    setViewMemoItems(
      ((data as any) || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        notes: item.notes || "",
      })),
    );
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (memo: CreditMemo) => {
    if (!confirm(`Are you sure you want to delete credit memo "${memo.memo_number}"?`)) {
      return;
    }

    try {
      await supabase
        .from("ledger_transactions" as any)
        .delete()
        .eq("reference_id", memo.id)
        .eq("transaction_type", "credit_memo");

      const { error } = await supabase.from("credit_memos" as any).delete().eq("id", memo.id);

      if (error) throw error;

      toast.success("Credit memo deleted successfully");
      fetchMemos();
    } catch (error: any) {
      console.error("Error deleting credit memo:", error);
      toast.error(error.message || "Failed to delete credit memo");
    }
  };

  // --- Import/Export handlers ---
  const handleDownloadTemplate = () => {
    exportToExcel([], 'credit_memos_template.xlsx', 'Credit Memos', [
      { header: 'Account', key: 'Account', width: 20 },
      { header: 'Amount', key: 'Amount', width: 15 },
      { header: 'Notes', key: 'Notes', width: 30 },
    ]);
  };

  const handleExportMemos = () => {
    const exportData = filteredMemos.map(m => ({
      'Memo #': m.memo_number,
      'Date': format(parseISO(m.memo_date), 'yyyy-MM-dd'),
      'Account': m.account?.name || '',
      'Invoice': m.invoice?.invoice_number || '',
      'Amount': m.amount,
      'Ledger': m.ledger?.name || '',
      'Status': m.status,
      'Notes': m.notes || '',
    }));
    exportToExcel(exportData, 'credit_memos.xlsx', 'Credit Memos');
  };

  const handleImportMemos = async (file: File) => {
    if (!companyId) return;
    try {
      const rows = await readExcel(file);
      if (rows.length === 0) { toast.error('No data found in file'); return; }

      setImportResults([]); setImportTotal(rows.length); setImportProcessed(0);
      setIsImportComplete(false); setIsImportDialogOpen(true);
      const results: ImportResult[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]; const rowNum = i + 2;
        try {
          const accountName = row['Account']?.toString().trim();
          if (!accountName) { results.push({ row: rowNum, status: 'error', message: 'Account is required' }); setImportResults([...results]); setImportProcessed(i + 1); continue; }
          const account = accounts.find(a => a.name.toLowerCase() === accountName.toLowerCase());
          if (!account) { results.push({ row: rowNum, status: 'error', message: `Account "${accountName}" not found` }); setImportResults([...results]); setImportProcessed(i + 1); continue; }
          const amount = Number(row['Amount']) || 0;
          if (amount <= 0) { results.push({ row: rowNum, status: 'error', message: 'Amount must be > 0' }); setImportResults([...results]); setImportProcessed(i + 1); continue; }
          const notes = row['Notes']?.toString().trim() || null;

          const { data: memoNumber } = await supabase.rpc('get_next_credit_memo_number', { p_company_id: companyId });
          const { error: insertError } = await supabase.from('credit_memos' as any).insert({
            company_id: companyId, memo_number: memoNumber, account_id: account.id,
            amount, notes, status: 'pending',
          });
          if (insertError) throw insertError;
          results.push({ row: rowNum, status: 'success', message: `Credit memo created for "${accountName}"` });
        } catch (err: any) {
          results.push({ row: rowNum, status: 'error', message: err.message || 'Failed' });
        }
        setImportResults([...results]); setImportProcessed(i + 1);
      }
      setIsImportComplete(true); fetchMemos();
    } catch (err: any) { toast.error(err.message || 'Failed to read file'); }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div>
        <div className="flex items-center justify-between px-4 pr-16 h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
              <ArrowLeft className="h-5 w-5" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
            </Button>
            <Minus className="h-6 w-6 text-green-500" />
            <h1 className="text-2xl font-bold">Credit Memos</h1>
          </div>
          <div className="flex items-center gap-2">
            <ImportExportButtons
              importEnabled={isImportEnabled('credit_memo')}
              exportEnabled={isExportEnabled('credit_memo')}
              onImport={handleImportMemos}
              onExport={handleExportMemos}
              onDownloadTemplate={handleDownloadTemplate}
              entityName="Credit Memos"
            />
            <Button onClick={handleCreateClick} size="icon" className="relative">
              <Plus className="h-4 w-4" />
              <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {Object.values(filters).filter(Boolean).length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="text-sm text-muted-foreground">
              Showing {filteredMemos.length} of {memos.length} memos
            </span>
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
              <X className="w-3 h-3 mr-1" />
              Clear filters
            </Button>
            {Object.entries(filters).map(
              ([key, value]) =>
                value && (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {value}
                    <button onClick={() => setFilter(key, "")} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ),
            )}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead label="Memo #" sortKey="memo_number" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterValue={filters["memo_number"]} onFilter={(value) => setFilter("memo_number", value)} />
              <SortableTableHead label="Date" sortKey="memo_date" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
              <SortableTableHead label="Account" sortKey="account.name" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterValue={filters["account.name"]} onFilter={(value) => setFilter("account.name", value)} />
              <SortableTableHead label="Invoice" sortKey="invoice.invoice_number" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterValue={filters["invoice.invoice_number"]} onFilter={(value) => setFilter("invoice.invoice_number", value)} />
              <SortableTableHead label="Amount" sortKey="amount" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
              <SortableTableHead label="Ledger" sortKey="ledger.name" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterValue={filters["ledger.name"]} onFilter={(value) => setFilter("ledger.name", value)} />
              <SortableTableHead label="Status" sortKey="status" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterValue={filters["status"]} onFilter={(value) => setFilter("status", value)} />
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMemos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {memos.length === 0 ? "No credit memos found. Create your first credit memo to get started." : "No memos match your filters"}
                </TableCell>
              </TableRow>
            ) : (
              filteredMemos.map((memo) => (
                <TableRow key={memo.id}>
                  <TableCell className="font-mono cursor-pointer hover:underline" onClick={() => handleView(memo)}>{memo.memo_number}</TableCell>
                  <TableCell>{format(parseISO(memo.memo_date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{memo.account?.name || "-"}</TableCell>
                  <TableCell>{memo.invoice?.invoice_number || "-"}</TableCell>
                  <TableCell className="font-medium text-green-600">-${memo.amount.toFixed(2)}</TableCell>
                  <TableCell>{memo.ledger?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[memo.status]} text-white`}>{memo.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => handleView(memo)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(memo)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Credit Memo</DialogTitle>
            <DialogDescription>Create a credit memo to reduce the amount owed on an account.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account *</Label>
                <SearchableSelect
                  options={accountOptions}
                  value={formData.account_id}
                  onValueChange={(value) => setFormData({ ...formData, account_id: value, invoice_id: "" })}
                  placeholder="Select account"
                />
              </div>
              <div>
                <Label>Invoice (Optional)</Label>
                <SearchableSelect
                  options={invoiceOptions}
                  value={formData.invoice_id}
                  onValueChange={(value) => {
                    const inv = invoices.find((i) => i.id === value);
                    setFormData({
                      ...formData,
                      invoice_id: value,
                      ledger_id: inv?.ledger_id || formData.ledger_id,
                    });
                  }}
                  placeholder="Select invoice"
                />
              </div>
            </div>

            {!formData.invoice_id && (
              <div>
                <Label>Ledger *</Label>
                <SearchableSelect
                  options={ledgerOptions}
                  value={formData.ledger_id}
                  onValueChange={(value) => setFormData({ ...formData, ledger_id: value })}
                  placeholder="Select ledger"
                />
              </div>
            )}

            <MemoItemsEditor items={items} onItemsChange={setItems} products={products} />

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Reason for credit memo..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 pt-4">
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Credit Memo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Credit Memo {viewMemo?.memo_number}</DialogTitle>
            <DialogDescription>Credit memo details</DialogDescription>
          </DialogHeader>

          {viewMemo && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{format(parseISO(viewMemo.memo_date), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={`${statusColors[viewMemo.status]} text-white`}>{viewMemo.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Account</p>
                  <p className="font-medium">{viewMemo.account?.name}</p>
                </div>
                {viewMemo.invoice && (
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice</p>
                    <p className="font-medium">{viewMemo.invoice.invoice_number}</p>
                  </div>
                )}
              </div>

              <MemoItemsEditor items={viewMemoItems} onItemsChange={() => {}} products={products} readOnly />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium text-green-600 text-xl">-${viewMemo.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ledger</p>
                  <p className="font-medium">{viewMemo.ledger?.name || "-"}</p>
                </div>
              </div>

              {viewMemo.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p>{viewMemo.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Importing Credit Memos"
        totalRows={importTotal}
        processedRows={importProcessed}
        results={importResults}
        isComplete={isImportComplete}
      />
    </div>
  );
};

export default CreditMemos;
