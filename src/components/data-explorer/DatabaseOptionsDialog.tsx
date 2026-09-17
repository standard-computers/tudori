import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, AlertTriangle, RefreshCw, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStatusMessage } from "@/hooks/use-status-message";
import { cn } from "@/lib/utils";

interface DatabaseOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables: string[];
  canPurge: boolean;
  onPurged?: () => void;
}

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export function DatabaseOptionsDialog({ open, onOpenChange, tables, canPurge, onPurged }: DatabaseOptionsDialogProps) {
  const status = useStatusMessage();
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [code, setCode] = useState(generateCode());
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [log, setLog] = useState<{ table: string; ok: boolean; message: string }[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setPurgeOpen(false);
    }
  }, [open]);

  const startPurge = () => {
    setSelected(new Set());
    setFilter("");
    setCode(generateCode());
    setTyped("");
    setProcessed(0);
    setLog([]);
    setDone(false);
    setRunning(false);
    setPurgeOpen(true);
  };

  const visibleTables = useMemo(
    () => tables.filter((t) => t.includes(filter.toLowerCase())),
    [tables, filter]
  );

  const toggleTable = (table: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(table) ? next.delete(table) : next.add(table);
      return next;
    });
  };

  const allVisibleSelected = visibleTables.length > 0 && visibleTables.every((t) => selected.has(t));

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleTables.forEach((t) => next.delete(t));
      else visibleTables.forEach((t) => next.add(t));
      return next;
    });
  };

  const runPurge = async () => {
    const targets = tables.filter((t) => selected.has(t));
    if (targets.length === 0 || typed.trim().toUpperCase() !== code) return;

    setRunning(true);
    setDone(false);
    setLog([]);
    setProcessed(0);

    let remaining = [...targets];
    const results: Record<string, { ok: boolean; message: string }> = {};

    // Multiple passes so foreign-key dependent tables can be cleared in order
    for (let pass = 0; pass < 4 && remaining.length > 0; pass++) {
      const failed: string[] = [];
      for (const table of remaining) {
        const { error, count } = await supabase
          .from(table as "accounts")
          .delete({ count: "exact" })
          .not("id", "is", null);
        if (error) {
          results[table] = { ok: false, message: error.message };
          failed.push(table);
        } else {
          results[table] = { ok: true, message: `Removed ${count ?? 0} record(s)` };
        }
        if (pass === 0) setProcessed((p) => p + 1);
        setLog(Object.entries(results).map(([t, r]) => ({ table: t, ...r })));
      }
      remaining = failed;
    }

    setRunning(false);
    setDone(true);
    const failedCount = Object.values(results).filter((r) => !r.ok).length;
    if (failedCount > 0) status.error(`${failedCount} table(s) could not be fully purged`);
    else status.success(`Purged ${targets.length} table(s)`);
    onPurged?.();
  };

  const codeMatches = typed.trim().toUpperCase() === code;

  return (
    <>
      <Dialog open={open && !purgeOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Database Options
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3">
              <div className="rounded-md border p-4 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Purge Data
                </div>
                <p className="text-sm text-muted-foreground">
                  Permanently remove all records from selected tables. Requires a typed confirmation code.
                </p>
                <Button variant="destructive" size="sm" onClick={startPurge} disabled={!canPurge}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Purge all data
                </Button>
                {!canPurge && (
                  <p className="text-xs text-muted-foreground">
                    Purging requires elevated permissions and mass deletion enabled.
                  </p>
                )}
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={purgeOpen} onOpenChange={(o) => { if (!running) setPurgeOpen(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Data Purge
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tables to purge ({selected.size} selected)</Label>
                  <Button variant="ghost" size="sm" onClick={toggleAllVisible} disabled={running}>
                    {allVisibleSelected ? "Clear shown" : "Select all shown"}
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter tables..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-8"
                    disabled={running}
                  />
                </div>
                <ScrollArea className="h-52 border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-1">
                    {visibleTables.map((table) => (
                      <label
                        key={table}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent",
                          running && "pointer-events-none opacity-60"
                        )}
                      >
                        <Checkbox checked={selected.has(table)} onCheckedChange={() => toggleTable(table)} />
                        <span className="truncate">{table}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Type this confirmation code to proceed</Label>
                <div className="flex items-center gap-3">
                  <code className="px-3 py-2 rounded-md bg-muted font-mono tracking-[0.3em] text-lg select-all">
                    {code}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => { setCode(generateCode()); setTyped(""); }} disabled={running}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Enter code"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="font-mono uppercase"
                  disabled={running}
                />
              </div>

              {(running || done) && (
                <div className="space-y-2">
                  <Progress value={selected.size ? (processed / selected.size) * 100 : 0} />
                  <ScrollArea className="h-32 border rounded-md p-2">
                    {log.map((entry) => (
                      <div key={entry.table} className="text-xs flex items-center gap-2 py-0.5">
                        <span className={entry.ok ? "text-primary" : "text-destructive"}>
                          {entry.ok ? "✓" : "✕"}
                        </span>
                        <span className="font-medium">{entry.table}</span>
                        <span className="text-muted-foreground truncate">{entry.message}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={runPurge}
              disabled={running || done || selected.size === 0 || !codeMatches}
            >
              {running ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Purging...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Purge {selected.size} table(s)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
