import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTransaction } from '@/contexts/StatusBarContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft,
  CreditCard,
  BookOpen,
  PackagePlus,
  PackageMinus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface KpiData {
  totalAccounts: number;
  activeAccounts: number;
  totalLedgers: number;
  ledgerBalance: number;
  grCount: number;
  grValue: number;
  giCount: number;
  giValue: number;
}

interface RecentAccount {
  id: string;
  account_id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface RecentLedger {
  id: string;
  ledger_id: string;
  name: string;
  is_active: boolean;
  transaction_count: number;
}

interface RecentGR {
  id: string;
  receipt_number: string;
  status: string;
  created_at: string;
  total_amount: number;
  location?: { name: string } | null;
}

interface RecentGI {
  id: string;
  issue_number: string;
  status: string;
  created_at: string;
  total_amount: number;
  location?: { name: string } | null;
}

const KpiCard = ({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconClass: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="text-left w-full bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-lg bg-muted group-hover:scale-105 transition-transform ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </button>
);

const statusColor = (status: string) => {
  const s = status?.toLowerCase();
  if (s === 'posted' || s === 'active') return 'default';
  if (s === 'draft') return 'secondary';
  if (s === 'reversed' || s === 'cancelled' || s === 'inactive') return 'destructive';
  return 'outline';
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const Accounting = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  useTransaction('acct');

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [accounts, setAccounts] = useState<RecentAccount[]>([]);
  const [ledgers, setLedgers] = useState<RecentLedger[]>([]);
  const [receipts, setReceipts] = useState<RecentGR[]>([]);
  const [issues, setIssues] = useState<RecentGI[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.company_id) setCompanyId(data.company_id);
        });
    }
  }, [user]);

  useEffect(() => {
    if (companyId) fetchAll(false);
  }, [companyId]);

  const fetchAll = async (isRefresh = false) => {
    if (!companyId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: acctData } = await supabase
        .from('accounts')
        .select('id, account_id, name, type, is_active')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      const { data: ledgerData } = await supabase
        .from('ledgers')
        .select('id, ledger_id, name, is_active')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      const { data: grData } = await supabase
        .from('goods_receipts')
        .select('id, receipt_number, status, created_at, total_amount, location:locations!goods_receipts_location_id_fkey(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: giData } = await supabase
        .from('goods_issues')
        .select('id, issue_number, status, created_at, total_amount, location:locations!goods_issues_location_id_fkey(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10);

      const ledgerTxResult = await (supabase
        .from('ledger_transactions')
        .select('id, ledger_id, amount')
        .eq('company_id', companyId) as any);
      const ledgerTxData: Array<{ id: string; ledger_id: string; amount: number }> = ledgerTxResult.data || [];

      // Build ledger balance map
      const balanceMap: Record<string, number> = {};
      const countMap: Record<string, number> = {};
      (ledgerTxData || []).forEach((tx: any) => {
        balanceMap[tx.ledger_id] = (balanceMap[tx.ledger_id] || 0) + (tx.amount || 0);
        countMap[tx.ledger_id] = (countMap[tx.ledger_id] || 0) + 1;
      });

      const totalLedgerBalance = Object.values(balanceMap).reduce((s, v) => s + v, 0);

      const grItems = grData as unknown as RecentGR[];
      const giItems = giData as unknown as RecentGI[];

      const grValue = grItems?.reduce((s, r) => s + (r.total_amount || 0), 0) || 0;
      const giValue = giItems?.reduce((s, r) => s + (r.total_amount || 0), 0) || 0;

      setKpi({
        totalAccounts: acctData?.length || 0,
        activeAccounts: acctData?.filter((a: any) => a.is_active).length || 0,
        totalLedgers: ledgerData?.length || 0,
        ledgerBalance: totalLedgerBalance,
        grCount: grItems?.length || 0,
        grValue,
        giCount: giItems?.length || 0,
        giValue,
      });

      setAccounts((acctData || []).slice(0, 8) as RecentAccount[]);
      setLedgers(
        (ledgerData || []).slice(0, 8).map((l: any) => ({
          ...l,
          transaction_count: countMap[l.id] || 0,
        })) as RecentLedger[]
      );
      setReceipts(grItems?.slice(0, 8) || []);
      setIssues(giItems?.slice(0, 8) || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const SectionHeader = ({
    title,
    path,
    icon: Icon,
  }: {
    title: string;
    path: string;
    icon: React.ElementType;
  }) => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate(path)}>
        View all <ExternalLink className="w-3 h-3" />
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Accounting</h1>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="relative h-8 w-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Accounts"
              value={kpi?.totalAccounts ?? 0}
              sub={`${kpi?.activeAccounts ?? 0} active`}
              icon={CreditCard}
              iconClass="text-indigo-500"
              onClick={() => navigate('/accounts')}
            />
            <KpiCard
              label="Ledger Balance"
              value={fmt(kpi?.ledgerBalance ?? 0)}
              sub={`${kpi?.totalLedgers ?? 0} ledgers`}
              icon={BookOpen}
              iconClass="text-stone-500"
              onClick={() => navigate('/ledgers')}
            />
            <KpiCard
              label="Goods Received"
              value={fmt(kpi?.grValue ?? 0)}
              sub={`${kpi?.grCount ?? 0} recent receipts`}
              icon={PackagePlus}
              iconClass="text-emerald-500"
              onClick={() => navigate('/goods-receipts')}
            />
            <KpiCard
              label="Goods Issued"
              value={fmt(kpi?.giValue ?? 0)}
              sub={`${kpi?.giCount ?? 0} recent issues`}
              icon={PackageMinus}
              iconClass="text-orange-500"
              onClick={() => navigate('/goods-issues')}
            />
          </div>
        )}

        {/* Balance indicator */}
        {!loading && kpi && (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              {kpi.ledgerBalance >= 0 ? (
                <TrendingUp className="w-5 h-5 text-chart-2" />
              ) : (
                <TrendingDown className="w-5 h-5 text-destructive" />
              )}
              <span className="text-sm font-medium text-foreground">Overall Ledger Position</span>
            </div>
            <span
              className={`text-lg font-bold ml-auto ${kpi.ledgerBalance >= 0 ? 'text-chart-2' : 'text-destructive'}`}
            >
              {fmt(kpi.ledgerBalance)}
            </span>
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground border-l border-border pl-4">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-chart-2" />
                In: {fmt(kpi.grValue)}
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 rotate-90 text-chart-4" />
                Out: {fmt(kpi.giValue)}
              </span>
            </div>
          </div>
        )}

        {/* Two-column grid: Accounts + Ledgers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accounts */}
          <div className="bg-card border border-border rounded-xl p-4">
            <SectionHeader title="Accounts" path="/accounts" icon={CreditCard} />
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                        No accounts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts.map((a) => (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/accounts/${a.id}`)}
                      >
                        <TableCell className="font-mono text-xs">{a.account_id}</TableCell>
                        <TableCell className="text-sm font-medium truncate max-w-[140px]">{a.name}</TableCell>
                        <TableCell className="text-xs capitalize">{a.type}</TableCell>
                        <TableCell>
                          <Badge variant={a.is_active ? 'default' : 'secondary'} className="text-xs">
                            {a.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Ledgers */}
          <div className="bg-card border border-border rounded-xl p-4">
            <SectionHeader title="Ledgers" path="/ledgers" icon={BookOpen} />
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs text-right">Transactions</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                        No ledgers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgers.map((l) => (
                      <TableRow
                        key={l.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate('/ledgers')}
                      >
                        <TableCell className="font-mono text-xs">{l.ledger_id}</TableCell>
                        <TableCell className="text-sm font-medium truncate max-w-[140px]">{l.name}</TableCell>
                        <TableCell className="text-xs text-right">{l.transaction_count.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={l.is_active ? 'default' : 'secondary'} className="text-xs">
                            {l.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Two-column grid: Goods Receipts + Goods Issues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Goods Receipts */}
          <div className="bg-card border border-border rounded-xl p-4">
            <SectionHeader title="Recent Goods Receipts" path="/goods-receipts" icon={PackagePlus} />
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Receipt #</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                        No goods receipts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    receipts.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate('/goods-receipts')}
                      >
                        <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                        <TableCell className="text-xs truncate max-w-[100px]">
                          {(r.location as any)?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(r.status)} className="text-xs">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">{fmt(r.total_amount || 0)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Goods Issues */}
          <div className="bg-card border border-border rounded-xl p-4">
            <SectionHeader title="Recent Goods Issues" path="/goods-issues" icon={PackageMinus} />
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Issue #</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                        No goods issues found
                      </TableCell>
                    </TableRow>
                  ) : (
                    issues.map((g) => (
                      <TableRow
                        key={g.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate('/goods-issues')}
                      >
                        <TableCell className="font-mono text-xs">{g.issue_number}</TableCell>
                        <TableCell className="text-xs truncate max-w-[100px]">
                          {(g.location as any)?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(g.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(g.status)} className="text-xs">
                            {g.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">{fmt(g.total_amount || 0)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Accounting;
