import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { PAYMENT_COLUMNS } from "@/config/column-layouts";
import { ColumnToggle } from "@/components/ColumnToggle";
import { SortableTableHead } from "@/components/SortableTableHead";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { ArrowLeft, Banknote, Loader2, X } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  account_id: string;
  invoice_id: string;
  account?: { id: string; name: string; account_id: string; type: string | null } | null;
  invoice?: { invoice_number: string } | null;
}

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
};

const Payments = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => { setTransaction("pay"); }, [setTransaction]);
  useKeyboardShortcut("F1", () => navigate(-1));

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (profile?.company_id) {
        const { data } = await supabase
          .from("payments")
          .select("*, account:accounts!payments_account_id_fkey(id, name, account_id, type), invoice:invoices!payments_invoice_id_fkey(invoice_number)")
          .eq("company_id", profile.company_id)
          .order("payment_date", { ascending: false });
        setPayments((data as any) || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const { sortConfig, filters, sortedAndFilteredData, handleSort, setFilter, clearAllFilters } =
    useTableSort<Payment>(payments, "payment_number", "desc");
  const { isColumnVisible, toggleColumn, resetToDefaults, showAll, hideAll, visibleColumns } =
    useColumnVisibility("payments", PAYMENT_COLUMNS);
  const colCount = PAYMENT_COLUMNS.filter((c) => isColumnVisible(c.key)).length || 1;

  const head = (key: string, label: string, sortKey: string, filterable = true) =>
    isColumnVisible(key) && (
      <SortableTableHead
        label={label}
        sortKey={sortKey}
        currentSortKey={sortConfig.key}
        currentSortDirection={sortConfig.direction}
        onSort={handleSort}
        {...(filterable
          ? { filterValue: filters[sortKey], onFilter: (v: string) => setFilter(sortKey, v) }
          : { filterable: false })}
      />
    );

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const total = useMemo(() => sortedAndFilteredData.reduce((s, p) => s + Number(p.amount || 0), 0), [sortedAndFilteredData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-4 pr-16 h-16">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
            <ArrowLeft className="h-5 w-5" />
            <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
          </Button>
          <Banknote className="h-6 w-6 text-emerald-500" />
          <h1 className="text-2xl font-bold">Payments</h1>
        </div>
        <div className="flex items-center gap-2">
          <ColumnToggle
            columns={PAYMENT_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            onResetToDefaults={resetToDefaults}
            onShowAll={showAll}
            onHideAll={hideAll}
          />
        </div>
      </div>

      <div className="space-y-2">
        {activeFilters > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="text-sm text-muted-foreground">
              Showing {sortedAndFilteredData.length} of {payments.length} payments
            </span>
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
              <X className="w-3 h-3 mr-1" /> Clear filters
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              {head("payment_number", "Payment #", "payment_number")}
              {head("payment_date", "Date", "payment_date", false)}
              {head("account_id", "Account ID", "account.account_id")}
              {head("account", "Account", "account.name")}
              {head("account_type", "Account Type", "account.type")}
              {head("invoice", "Invoice", "invoice.invoice_number")}
              {head("amount", "Amount", "amount", false)}
              {head("status", "Status", "status")}
              {head("notes", "Notes", "notes")}
              {head("created_at", "Created", "created_at", false)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">
                  {payments.length === 0 ? "No payments found." : "No payments match your filters"}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sortedAndFilteredData.map((p) => (
                  <TableRow key={p.id}>
                    {isColumnVisible("payment_number") && <TableCell className="font-mono">{p.payment_number}</TableCell>}
                    {isColumnVisible("payment_date") && <TableCell>{fmtDate(p.payment_date)}</TableCell>}
                    {isColumnVisible("account_id") && (
                      <TableCell
                        className="font-mono cursor-pointer hover:underline"
                        onClick={() => p.account && navigate(`/accounts/${p.account.id}`)}
                      >
                        {p.account?.account_id || "-"}
                      </TableCell>
                    )}
                    {isColumnVisible("account") && <TableCell>{p.account?.name || "-"}</TableCell>}
                    {isColumnVisible("account_type") && <TableCell className="capitalize">{p.account?.type || "-"}</TableCell>}
                    {isColumnVisible("invoice") && <TableCell className="font-mono">{p.invoice?.invoice_number || "-"}</TableCell>}
                    {isColumnVisible("amount") && <TableCell className="font-medium">${Number(p.amount).toFixed(2)}</TableCell>}
                    {isColumnVisible("status") && <TableCell><Badge variant="secondary" className="capitalize">{p.status}</Badge></TableCell>}
                    {isColumnVisible("notes") && <TableCell className="max-w-[240px] truncate">{p.notes || "-"}</TableCell>}
                    {isColumnVisible("created_at") && <TableCell>{fmtDate(p.created_at)}</TableCell>}
                  </TableRow>
                ))}
                {isColumnVisible("amount") && (
                  <TableRow className="font-semibold">
                    <TableCell colSpan={colCount}>
                      Total: ${total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Payments;
