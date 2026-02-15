import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMaximizedState } from "@/hooks/use-maximize-preference";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Maximize2, Minimize2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toast";
import { format, parseISO, differenceInMinutes, differenceInDays } from "date-fns";

interface TimePunch {
  id: string;
  punch_in: string;
  punch_out: string | null;
  notes: string | null;
}

interface ViewTimePunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  punch: TimePunch | null;
  employeeId: string;
  companyId: string;
}

interface ContestRecord {
  id: string;
  reason: string;
  suggested_punch_in: string | null;
  suggested_punch_out: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
}

const ViewTimePunchDialog = ({
  open,
  onOpenChange,
  punch,
  employeeId,
  companyId,
}: ViewTimePunchDialogProps) => {
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [contestEnabled, setContestEnabled] = useState(false);
  const [contestDays, setContestDays] = useState(7);
  const [showContestForm, setShowContestForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingContest, setExistingContest] = useState<ContestRecord | null>(null);
  const [contestForm, setContestForm] = useState({
    reason: "",
    suggested_punch_in: "",
    suggested_punch_out: "",
  });

  useEffect(() => {
    if (open && punch) {
      fetchContestSettings();
      fetchExistingContest();
      setShowContestForm(false);
      setContestForm({ reason: "", suggested_punch_in: "", suggested_punch_out: "" });
    }
  }, [open, punch]);

  const fetchContestSettings = async () => {
    const { data } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("company_id", companyId)
      .eq("setting_key", "process_controls")
      .maybeSingle();

    if (data?.setting_value) {
      const val = data.setting_value as Record<string, unknown>;
      setContestEnabled(val.contest_time_punch !== false);
      setContestDays(typeof val.contest_time_punch_days === "number" ? val.contest_time_punch_days : 7);
    } else {
      setContestEnabled(true);
      setContestDays(7);
    }
  };

  const fetchExistingContest = async () => {
    if (!punch) return;
    const { data } = await supabase
      .from("time_punch_contests")
      .select("id, reason, suggested_punch_in, suggested_punch_out, status, review_notes, created_at")
      .eq("time_punch_id", punch.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setExistingContest(data as ContestRecord | null);
  };

  const canContest = () => {
    if (!contestEnabled || !punch || !punch.punch_out) return false;
    const daysSince = differenceInDays(new Date(), parseISO(punch.punch_in));
    return daysSince <= contestDays;
  };

  const handleSubmitContest = async () => {
    if (!punch || !contestForm.reason.trim()) {
      toast.error("Please provide a reason for contesting");
      return;
    }
    setIsSubmitting(true);

    const { error } = await supabase.from("time_punch_contests").insert({
      time_punch_id: punch.id,
      employee_id: employeeId,
      company_id: companyId,
      reason: contestForm.reason.trim(),
      suggested_punch_in: contestForm.suggested_punch_in || null,
      suggested_punch_out: contestForm.suggested_punch_out || null,
    });

    if (error) {
      toast.error("Failed to submit contest");
      console.error(error);
    } else {
      toast.success("Contest submitted successfully");
      setShowContestForm(false);
      fetchExistingContest();
    }
    setIsSubmitting(false);
  };

  if (!punch) return null;

  const punchIn = parseISO(punch.punch_in);
  const punchOut = punch.punch_out ? parseISO(punch.punch_out) : null;
  const duration = punchOut
    ? (() => {
        const mins = differenceInMinutes(punchOut, punchIn);
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      })()
    : "Active";

  const contestAllowed = canContest();
  const hasExistingContest = !!existingContest;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMaximized ? "!max-w-full !h-full !rounded-none !m-0" : "max-w-lg"}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-10 top-4 h-6 w-6"
          onClick={() => setIsMaximized(!isMaximized)}
        >
          {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <DialogHeader>
          <DialogTitle>View Time Punch</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4 px-6">
          {/* Punch Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{format(punchIn, "EEEE, MMMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={punchOut ? "secondary" : "default"}>
                {punchOut ? "Completed" : "Active"}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Punch In</p>
              <p className="font-medium">{format(punchIn, "h:mm:ss a")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Punch Out</p>
              <p className="font-medium">{punchOut ? format(punchOut, "h:mm:ss a") : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium">{duration}</p>
            </div>
          </div>

          {punch.notes && (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{punch.notes}</p>
            </div>
          )}

          {/* Existing Contest */}
          {hasExistingContest && (
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Contest Submitted</p>
                <Badge variant={
                  existingContest.status === "approved" ? "default" :
                  existingContest.status === "denied" ? "destructive" : "secondary"
                }>
                  {existingContest.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{existingContest.reason}</p>
              {existingContest.suggested_punch_in && (
                <p className="text-xs text-muted-foreground">
                  Suggested In: {format(parseISO(existingContest.suggested_punch_in), "h:mm a")}
                </p>
              )}
              {existingContest.suggested_punch_out && (
                <p className="text-xs text-muted-foreground">
                  Suggested Out: {format(parseISO(existingContest.suggested_punch_out), "h:mm a")}
                </p>
              )}
              {existingContest.review_notes && (
                <p className="text-xs text-muted-foreground">
                  Review: {existingContest.review_notes}
                </p>
              )}
            </div>
          )}

          {/* Contest Form */}
          {showContestForm && (
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-semibold">Contest This Time Punch</h4>
              <div className="space-y-2">
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Textarea
                  value={contestForm.reason}
                  onChange={(e) => setContestForm({ ...contestForm, reason: e.target.value })}
                  rows={3}
                  placeholder="Explain why this time punch is incorrect..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Suggested Punch In</Label>
                  <Input
                    type="datetime-local"
                    value={contestForm.suggested_punch_in}
                    onChange={(e) => setContestForm({ ...contestForm, suggested_punch_in: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Suggested Punch Out</Label>
                  <Input
                    type="datetime-local"
                    value={contestForm.suggested_punch_out}
                    onChange={(e) => setContestForm({ ...contestForm, suggested_punch_out: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowContestForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSubmitContest} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Submit Contest
                </Button>
              </div>
            </div>
          )}
        </DialogBody>

        {/* Footer with Contest button */}
        {contestAllowed && !hasExistingContest && !showContestForm && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContestForm(true)}>
              <AlertTriangle className="h-4 w-4 mr-1" />
              Contest
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ViewTimePunchDialog;
