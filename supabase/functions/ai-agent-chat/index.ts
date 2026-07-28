import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { thread_id, user_message } = body as { thread_id: string; user_message: string };
    if (!thread_id || !user_message) {
      return new Response(JSON.stringify({ error: "thread_id and user_message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load thread + verify ownership + get company_id
    const { data: thread } = await supabase.from("ai_threads").select("id, company_id, title").eq("id", thread_id).maybeSingle();
    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const companyId = thread.company_id;

    // Prior messages
    const { data: prior } = await supabase.from("ai_messages").select("role, parts").eq("thread_id", thread_id).order("created_at");

    // Company context
    const [{ data: locations }, { data: vendors }, { data: customers }, { data: products }, { data: settings }] = await Promise.all([
      supabase.from("locations").select("id, name, location_id").eq("company_id", companyId).limit(100),
      supabase.from("vendors").select("id, name, vendor_id, status").eq("company_id", companyId).limit(150),
      supabase.from("customers").select("id, name, customer_id, status").eq("company_id", companyId).limit(150),
      supabase.from("products").select("id, name, product_id, sku, unit, status").eq("company_id", companyId).limit(200),
      supabase.from("company_settings").select("setting_value").eq("company_id", companyId).eq("setting_key", "process_controls").maybeSingle(),
    ]);

    const controls = settings?.setting_value || {};

    // Save user message immediately
    await supabase.from("ai_messages").insert({
      thread_id,
      role: "user",
      parts: [{ type: "text", text: user_message }],
    });

    // Build history for the model
    const history = (prior || []).map((m: any) => ({
      role: m.role,
      content: (m.parts || []).map((p: any) => (p.type === "text" ? p.text : "")).join("\n"),
    }));

    const systemPrompt = `You are Operand AI, an assistant embedded in an ERP application. When a user describes an operation they want to perform, you propose a concrete plan of documents/transactions to create. The user reviews each step individually and clicks Approve before it executes. NEVER claim you executed anything — you only propose.

RESPOND with STRICT JSON of the shape:
{
  "message": "friendly natural-language explanation of the plan (or a question if you need clarification)",
  "steps": [
    {
      "action_type": "create_purchase_order" | "create_sales_order" | "create_requisition" | "create_transfer",
      "description": "one-line human summary of this step",
      "payload": { ... }
    }
  ]
}

If information is missing or ambiguous, return empty steps and ask a clarifying question in "message". Never invent IDs.

Supported action_type payload shapes (use UUIDs from the CONTEXT lists below):

create_purchase_order: { vendor_id, location_id (bill-to), ship_to_location_id, items: [{ product_id, quantity, price?, notes? }], notes? }
create_sales_order: { customer_id, location_id (fulfillment), items: [{ product_id, quantity, price?, notes? }], notes? }
create_requisition: { vendor_id, location_id, items: [{ product_id, quantity, notes? }], notes? }
create_transfer: { from_location_id, to_location_id, items: [{ product_id, quantity, notes? }], notes? }  // creates an outbound delivery (pending)

RULES:
- Only use ids from CONTEXT. If a referenced entity is not present, ask for clarification rather than guessing.
- Respect process controls set by the company. Currently: ${JSON.stringify(controls)}
- Keep plan concise: only the documents strictly required.
- Do NOT include markdown fences. Return raw JSON only.

CONTEXT:
LOCATIONS: ${JSON.stringify(locations || [])}
VENDORS: ${JSON.stringify((vendors || []).filter((v: any) => v.status !== 'blocked'))}
CUSTOMERS: ${JSON.stringify(customers || [])}
PRODUCTS: ${JSON.stringify(products || [])}
`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: user_message }],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${resp.status} ${t}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await resp.json();
    const raw = aiJson?.choices?.[0]?.message?.content || "{}";

    let parsed: { message?: string; steps?: Array<{ action_type: string; description: string; payload: any }> } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { message: raw, steps: [] };
    }

    const message = parsed.message || "";
    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];

    // Save assistant message
    const { data: assistantMsg } = await supabase
      .from("ai_messages")
      .insert({ thread_id, role: "assistant", parts: [{ type: "text", text: message }] })
      .select("id")
      .single();

    // Insert plan steps
    const insertedSteps: any[] = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const { data: row } = await supabase
        .from("ai_plan_steps")
        .insert({
          thread_id,
          seq: i,
          action_type: s.action_type,
          description: s.description || s.action_type,
          payload: s.payload || {},
          status: "pending",
        })
        .select("*")
        .single();
      if (row) insertedSteps.push(row);
    }

    // Bump thread title if still default
    if (thread.title === "New conversation") {
      await supabase.from("ai_threads").update({ title: user_message.slice(0, 60) }).eq("id", thread_id);
    } else {
      await supabase.from("ai_threads").update({ updated_at: new Date().toISOString() }).eq("id", thread_id);
    }

    return new Response(JSON.stringify({ message, steps: insertedSteps, assistant_message_id: assistantMsg?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-agent-chat error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
