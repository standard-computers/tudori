import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Send, Trash2, Check, X, Loader2, ExternalLink, MessageSquare } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import logo from "@/assets/operand-ai-logo.png";

interface Thread { id: string; title: string; updated_at: string; }
interface ChatMessage { id: string; role: string; parts: Array<{ type: string; text?: string }>; created_at: string; }
interface PlanStep {
  id: string;
  thread_id: string;
  seq: number;
  action_type: string;
  description: string;
  payload: any;
  status: "pending" | "executed" | "failed" | "skipped";
  result: any;
  error: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  create_purchase_order: "Create Purchase Order",
  create_sales_order: "Create Sales Order",
  create_requisition: "Create Requisition",
  create_transfer: "Create Stock Transfer",
};

export default function OperandAI() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId?: string }>();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useKeyboardShortcut("F1", () => navigate(-1));

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle().then(({ data }) => {
      setCompanyId((data as any)?.company_id ?? null);
    });
  }, [user?.id]);

  const loadThreads = async () => {
    if (!user) return;
    const { data } = await supabase.from("ai_threads").select("id, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
    setThreads(data || []);
  };

  const loadThread = async (id: string) => {
    const [{ data: msgs }, { data: sts }] = await Promise.all([
      supabase.from("ai_messages").select("*").eq("thread_id", id).order("created_at"),
      supabase.from("ai_plan_steps").select("*").eq("thread_id", id).order("seq"),
    ]);
    setMessages((msgs || []) as any);
    setSteps((sts || []) as any);
  };

  useEffect(() => { loadThreads(); }, [user?.id]);
  useEffect(() => {
    if (threadId) loadThread(threadId);
    else { setMessages([]); setSteps([]); }
  }, [threadId]);

  useEffect(() => { textareaRef.current?.focus(); }, [threadId, sending]);

  const createThread = async () => {
    if (!user || !companyId) return;
    const { data, error } = await supabase.from("ai_threads").insert({ user_id: user.id, company_id: companyId, title: "New conversation" }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setThreads(t => [data as any, ...t]);
    navigate(`/operand-ai/${(data as any).id}`);
  };

  const deleteThread = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    await supabase.from("ai_threads").delete().eq("id", id);
    setThreads(t => t.filter(x => x.id !== id));
    if (threadId === id) navigate("/operand-ai");
  };

  const send = async () => {
    if (!input.trim()) return;
    let currentId = threadId;
    if (!currentId) {
      if (!user || !companyId) return;
      const { data, error } = await supabase.from("ai_threads").insert({ user_id: user.id, company_id: companyId, title: "New conversation" }).select("*").single();
      if (error) { toast.error(error.message); return; }
      currentId = (data as any).id;
      setThreads(t => [data as any, ...t]);
      navigate(`/operand-ai/${currentId}`, { replace: true });
    }

    const text = input.trim();
    setInput("");
    // optimistic
    setMessages(prev => [...prev, { id: `tmp-${Date.now()}`, role: "user", parts: [{ type: "text", text }], created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-agent-chat", { body: { thread_id: currentId, user_message: text } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      // reload authoritative state
      await loadThread(currentId!);
      loadThreads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const executeStep = async (step: PlanStep) => {
    setExecutingId(step.id);
    try {
      const { data, error } = await supabase.functions.invoke("ai-execute-step", { body: { step_id: step.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Executed: ${step.description}`);
      await loadThread(step.thread_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to execute");
      await loadThread(step.thread_id);
    } finally {
      setExecutingId(null);
    }
  };

  const skipStep = async (step: PlanStep) => {
    await supabase.from("ai_plan_steps").update({ status: "skipped", executed_at: new Date().toISOString() }).eq("id", step.id);
    await loadThread(step.thread_id);
  };

  // Group steps by their created_at so a plan's steps render together beneath their assistant message.
  // Simpler: render all steps at bottom of chat but grouped by their creation batch.
  const stepGroups = useMemo(() => {
    const groups: Record<string, PlanStep[]> = {};
    for (const s of steps) {
      const key = s.created_at.slice(0, 19);
      (groups[key] ||= []).push(s);
    }
    return Object.values(groups).sort((a, b) => a[0].created_at.localeCompare(b[0].created_at));
  }, [steps]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
          </Button>
          <img src={logo} alt="Operand AI" width={32} height={32} className="h-8 w-8" loading="lazy" />
          <div>
            <h1 className="text-lg font-semibold">Operand AI</h1>
            <p className="text-xs text-muted-foreground">Describe an action — approve each step before it runs</p>
          </div>
        </div>
        <Button size="sm" onClick={createThread}>
          <Plus className="mr-1 h-4 w-4" /> New chat
        </Button>
      </div>

      <div className="flex" style={{ height: "calc(100vh - 4rem - 1.75rem)" }}>
        {/* Thread list */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r bg-muted/20 p-2">
          {threads.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">No conversations yet.</p>
          )}
          {threads.map(t => (
            <div key={t.id} className="group flex items-center gap-1">
              <button
                onClick={() => navigate(`/operand-ai/${t.id}`)}
                className={`flex-1 truncate rounded px-3 py-2 text-left text-sm transition ${
                  threadId === t.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
              >
                {t.title || "Untitled"}
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteThread(t.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </aside>

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl">
              {messages.length === 0 && steps.length === 0 && (
                <ConversationEmptyState
                  icon={<img src={logo} alt="" width={64} height={64} className="h-16 w-16 opacity-80" loading="lazy" />}
                  title="What would you like to do?"
                  description={`Try: "Transfer 20 EA of cotton from Warehouse A to Warehouse B" or "Create a PO for 50 units of widget-X to Acme Supplies".`}
                />
              )}
              {messages.map(m => (
                <Message key={m.id} from={m.role as any}>
                  <MessageContent>
                    <MessageResponse>{m.parts.map(p => p.text || "").join("\n")}</MessageResponse>
                  </MessageContent>
                </Message>
              ))}
              {stepGroups.map((group, gi) => (
                <div key={gi} className="mx-auto flex w-full max-w-2xl flex-col gap-2">
                  {group.map(step => (
                    <Card key={step.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{ACTION_LABEL[step.action_type] || step.action_type}</Badge>
                            {step.status === "pending" && <Badge variant="secondary" className="text-[10px]">Pending approval</Badge>}
                            {step.status === "executed" && <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">Executed</Badge>}
                            {step.status === "failed" && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
                            {step.status === "skipped" && <Badge variant="outline" className="text-[10px]">Skipped</Badge>}
                          </div>
                          <p className="text-sm">{step.description}</p>
                          {step.result?.label && (
                            <p className="text-xs text-muted-foreground">Created: <span className="font-medium">{step.result.label}</span></p>
                          )}
                          {step.error && <p className="text-xs text-destructive">{step.error}</p>}
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer select-none">Details</summary>
                            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(step.payload, null, 2)}</pre>
                          </details>
                        </div>
                        {step.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => executeStep(step)} disabled={executingId === step.id}>
                              {executingId === step.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              <span className="ml-1">Approve</span>
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => skipStep(step)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        {step.status === "executed" && step.result?.ref_url && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(step.result.ref_url)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
              {sending && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>Planning your request...</Shimmer>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t p-3">
            <div className="mx-auto w-full max-w-3xl">
              <PromptInput onSubmit={() => { if (!sending) send(); }}>
                <PromptInputTextarea
                  ref={textareaRef as any}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe what you want to do..."
                  disabled={sending}
                />
                <PromptInputFooter className="justify-end">
                  <PromptInputSubmit status={sending ? "streaming" : undefined} disabled={sending || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </PromptInputSubmit>
                </PromptInputFooter>
              </PromptInput>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                <MessageSquare className="mr-1 inline h-3 w-3" />
                Operand AI proposes steps — nothing runs until you approve each one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
