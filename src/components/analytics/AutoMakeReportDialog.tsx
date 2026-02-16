import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { entities } from "./entities";
import { ReportTab, ReportField } from "./types";

interface AutoMakeReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReportCreated: (tab: ReportTab) => void;
}

export function AutoMakeReportDialog({
  open,
  onOpenChange,
  onReportCreated,
}: AutoMakeReportDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe the report you want");
      return;
    }

    setLoading(true);
    try {
      // Build a slim schema for the AI
      const entitiesSchema = entities.map((e) => ({
        name: e.name,
        table: e.table,
        fields: e.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
        })),
        relationships: e.relationships.map((r) => ({
          targetEntity: r.targetEntity,
          foreignKey: r.foreignKey,
        })),
      }));

      const { data, error } = await supabase.functions.invoke("build-report", {
        body: { prompt: prompt.trim(), entitiesSchema },
      });

      if (error) throw new Error(error.message || "Failed to generate report");
      if (data?.error) throw new Error(data.error);

      const reportConfig = data.report;
      if (!reportConfig?.fields?.length) {
        throw new Error("AI could not generate a valid report from your description. Try being more specific.");
      }

      // Build a ReportTab from the AI response
      const fields: ReportField[] = reportConfig.fields.map((f: any) => ({
        id: crypto.randomUUID(),
        entityName: f.entityName,
        fieldKey: f.fieldKey,
        fieldLabel: f.fieldLabel,
        fieldType: f.fieldType,
        aggregate: f.aggregate || "none",
        filter: f.filter
          ? { fieldKey: f.fieldKey, operator: f.filter.operator, value: f.filter.value }
          : undefined,
      }));

      const tab: ReportTab = {
        id: crypto.randomUUID(),
        name: reportConfig.name || "AI Report",
        isNew: true,
        entities: reportConfig.entities || [...new Set(fields.map((f: ReportField) => f.entityName))],
        fields,
        calculatedColumns: [],
        results: [],
      };

      onReportCreated(tab);
      onOpenChange(false);
      setPrompt("");
      toast.success("Report created — click Run to execute");
    } catch (err) {
      console.error("AutoMake error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AutoMake Report
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-6">
          <p className="text-sm text-muted-foreground">
            Describe the report you want and AI will configure the entities, fields, aggregations, and filters.
          </p>
          <Textarea
            placeholder="e.g. Show me total purchase order amounts by vendor, only for active vendors"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Press Ctrl+Enter to submit
          </p>
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button onClick={handleSubmit} disabled={loading || !prompt.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
