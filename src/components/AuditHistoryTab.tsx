import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  changed_fields: string[] | null;
  created_at: string;
  user?: { first_name: string; last_name: string } | null;
}

type DbAuditLog = {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id: string | null;
  old_value: unknown;
  new_value: unknown;
  changed_fields: string[] | null;
  created_at: string;
};

interface AuditHistoryTabProps {
  tableName: string;
  recordId: string;
  fieldLabels?: Record<string, string>;
}

const actionColors: Record<string, string> = {
  INSERT: "bg-green-500",
  UPDATE: "bg-blue-500",
  DELETE: "bg-red-500",
};

export function AuditHistoryTab({ tableName, recordId, fieldLabels = {} }: AuditHistoryTabProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching audit history:", error);
        setLoading(false);
        return;
      }

      // Transform data to match our types
      const transformEntry = (entry: typeof data[0], user: { first_name: string; last_name: string } | null = null): AuditLogEntry => ({
        id: entry.id,
        table_name: entry.table_name,
        record_id: entry.record_id,
        action: entry.action,
        user_id: entry.user_id,
        old_value: entry.old_value as Record<string, unknown> | null,
        new_value: entry.new_value as Record<string, unknown> | null,
        changed_fields: entry.changed_fields,
        created_at: entry.created_at,
        user,
      });

      // Fetch user profiles for entries with user_id
      const userIds = [...new Set((data || []).filter(e => e.user_id).map(e => e.user_id))] as string[];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, { first_name: p.first_name, last_name: p.last_name }]) || []);
        
        setEntries((data || []).map(entry => 
          transformEntry(entry, entry.user_id ? profileMap.get(entry.user_id) || null : null)
        ));
      } else {
        setEntries((data || []).map(entry => transformEntry(entry)));
      }
      
      setLoading(false);
    };

    if (recordId) {
      fetchHistory();
    }
  }, [tableName, recordId]);

  const formatFieldName = (field: string): string => {
    return fieldLabels[field] || field.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getActionLabel = (action: string, changedFields: string[] | null): string => {
    if (action === "INSERT") return "Created";
    if (action === "DELETE") return "Deleted";
    if (changedFields?.includes("status")) return "Status Changed";
    if (changedFields?.includes("purchase_order_id")) return "Converted to PO";
    return "Updated";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <History className="w-12 h-12 mb-2 opacity-20" />
        <p>No history available</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={actionColors[entry.action] || "bg-gray-500"}>
                  {getActionLabel(entry.action, entry.changed_fields)}
                </Badge>
                {entry.changed_fields && entry.changed_fields.length > 0 && entry.action !== "INSERT" && (
                  <span className="text-xs text-muted-foreground">
                    {entry.changed_fields.map(f => formatFieldName(f)).join(", ")}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                <div>{new Date(entry.created_at).toLocaleDateString()}</div>
                <div>{new Date(entry.created_at).toLocaleTimeString()}</div>
              </div>
            </div>
            
            {entry.user && (
              <div className="text-xs text-muted-foreground">
                By: {entry.user.first_name} {entry.user.last_name}
              </div>
            )}

            {entry.action === "UPDATE" && entry.old_value && entry.new_value && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Field</TableHead>
                    <TableHead className="w-1/3">Previous</TableHead>
                    <TableHead className="w-1/3">New</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entry.changed_fields || []).map((field) => (
                    <TableRow key={field}>
                      <TableCell className="font-medium">{formatFieldName(field)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatValue(entry.old_value?.[field])}
                      </TableCell>
                      <TableCell className="flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        {formatValue(entry.new_value?.[field])}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {entry.action === "INSERT" && entry.new_value && (
              <div className="text-sm text-muted-foreground">
                Initial values recorded
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
