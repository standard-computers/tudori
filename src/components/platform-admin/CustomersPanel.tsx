import { useEffect, useState } from "react";
import { platformAdminSupabase as sb } from "@/integrations/supabase/platformAdminClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { Loader2, Search, Trash2 } from "lucide-react";

type Company = Record<string, any> & { id: string; name: string; user_count: number };

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await sb.functions.invoke("platform-admin-orgs", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

const HIDDEN = new Set(["id", "user_count", "logo_url"]);

export const CustomersPanel = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCompanies((await call({ action: "list" })).companies); }
    catch (e: any) { toast.error(`Failed to load customers: ${e.message}`); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const open = async (c: Company) => {
    setSelected(c); setDetail(null);
    try { setDetail(await call({ action: "get", company_id: c.id })); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      const r = await call({ action: "delete", company_id: selected.id });
      toast.success(`Deleted ${selected.name} (${r.deleted_rows} records, ${r.deleted_users} users)`);
      setSelected(null);
      load();
    } catch (e: any) { toast.error(`Delete failed: ${e.message}`); }
    setDeleting(false);
  };

  const filtered = companies.filter((c) =>
    [c.name, c.city, c.country, c.industry].some((v) => String(v ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-4 overflow-auto flex-1">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} organizations</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead><TableHead>Industry</TableHead><TableHead>Location</TableHead>
            <TableHead>Users</TableHead><TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
          ) : filtered.map((c) => (
            <TableRow key={c.id} className="cursor-pointer" onClick={() => open(c)}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.industry || "—"}</TableCell>
              <TableCell>{[c.city, c.state, c.country].filter(Boolean).join(", ") || "—"}</TableCell>
              <TableCell><Badge variant="secondary">{c.user_count}</Badge></TableCell>
              <TableCell>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o && !deleting) setSelected(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{selected?.name} — Organization Settings</DialogTitle></DialogHeader>
          <DialogBody className="space-y-6 p-1">
            {!detail ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <section>
                  <h3 className="font-semibold mb-2">Details</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {Object.entries(detail.company || {}).filter(([k]) => !HIDDEN.has(k)).map(([k, v]) => (
                      <div key={k}><span className="text-muted-foreground">{k.replace(/_/g, " ")}: </span>{v == null || v === "" ? "—" : String(v)}</div>
                    ))}
                    <div><span className="text-muted-foreground">locations: </span>{detail.stats.locations}</div>
                    <div><span className="text-muted-foreground">products: </span>{detail.stats.products}</div>
                  </div>
                </section>
                <section>
                  <h3 className="font-semibold mb-2">Users ({detail.users.length})</h3>
                  <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {detail.users.map((u: any) => (
                        <TableRow key={u.id}><TableCell>{u.profile_id || "—"}</TableCell><TableCell>{u.first_name} {u.last_name}</TableCell><TableCell>{u.email || "—"}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
                {detail.settings.length > 0 && (
                  <section>
                    <h3 className="font-semibold mb-2">Settings</h3>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(detail.settings, null, 2)}</pre>
                  </section>
                )}
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting || !detail}>
              {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete organization and all data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
