import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { step_id } = await req.json();
    if (!step_id) return json({ error: "step_id required" }, 400);

    const { data: step } = await supabase.from("ai_plan_steps").select("*, thread:ai_threads!inner(company_id, user_id)").eq("id", step_id).maybeSingle();
    if (!step) return json({ error: "Step not found" }, 404);
    if (step.status !== "pending") return json({ error: `Step already ${step.status}` }, 400);

    const companyId = (step as any).thread.company_id;
    const payload = step.payload || {};
    let result: any = null;
    let refUrl: string | null = null;

    try {
      switch (step.action_type) {
        case "create_purchase_order":
          result = await createPurchaseOrder(supabase, companyId, payload);
          refUrl = "/orders";
          break;
        case "create_sales_order":
          result = await createSalesOrder(supabase, companyId, payload);
          refUrl = "/sales-orders";
          break;
        case "create_requisition":
          result = await createRequisition(supabase, companyId, payload);
          refUrl = "/requisitions";
          break;
        case "create_transfer":
          result = await createTransfer(supabase, companyId, payload);
          refUrl = "/deliveries";
          break;
        default:
          throw new Error(`Unsupported action_type: ${step.action_type}`);
      }

      await supabase
        .from("ai_plan_steps")
        .update({ status: "executed", result: { ...result, ref_url: refUrl }, executed_at: new Date().toISOString() })
        .eq("id", step_id);

      return json({ ok: true, result });
    } catch (e) {
      const msg = (e as Error).message;
      await supabase.from("ai_plan_steps").update({ status: "failed", error: msg, executed_at: new Date().toISOString() }).eq("id", step_id);
      return json({ error: msg }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function createPurchaseOrder(supabase: any, companyId: string, p: any) {
  const { data: po_number } = await supabase.rpc("get_next_po_number", { p_company_id: companyId });
  const { data: po, error } = await supabase.from("purchase_orders").insert({
    company_id: companyId,
    po_number,
    vendor_id: p.vendor_id,
    location_id: p.location_id,
    ship_to_location_id: p.ship_to_location_id || p.location_id,
    status: "pending",
    notes: p.notes || null,
  }).select("*").single();
  if (error) throw new Error(`PO insert failed: ${error.message}`);

  const items = (p.items || []).map((it: any) => ({
    purchase_order_id: po.id,
    product_id: it.product_id,
    quantity: it.quantity,
    unit_price: it.price ?? 0,
    notes: it.notes || null,
  }));
  if (items.length) {
    const { error: ie } = await supabase.from("purchase_order_items").insert(items);
    if (ie) throw new Error(`PO items failed: ${ie.message}`);
  }
  return { id: po.id, po_number: po.po_number, label: `PO ${po.po_number}` };
}

async function createSalesOrder(supabase: any, companyId: string, p: any) {
  const { data: so_number } = await supabase.rpc("get_next_so_number", { p_company_id: companyId });
  const { data: so, error } = await supabase.from("sales_orders").insert({
    company_id: companyId,
    so_number,
    customer_id: p.customer_id,
    location_id: p.location_id,
    status: "pending",
    notes: p.notes || null,
  }).select("*").single();
  if (error) throw new Error(`SO insert failed: ${error.message}`);

  const items = (p.items || []).map((it: any) => ({
    sales_order_id: so.id,
    product_id: it.product_id,
    quantity: it.quantity,
    unit_price: it.price ?? 0,
    notes: it.notes || null,
  }));
  if (items.length) {
    const { error: ie } = await supabase.from("sales_order_items").insert(items);
    if (ie) throw new Error(`SO items failed: ${ie.message}`);
  }
  return { id: so.id, so_number: so.so_number, label: `SO ${so.so_number}` };
}

async function createRequisition(supabase: any, companyId: string, p: any) {
  const { data: requisition_id } = await supabase.rpc("get_next_requisition_id", { p_company_id: companyId });
  const { data: req, error } = await supabase.from("requisitions").insert({
    company_id: companyId,
    requisition_id,
    vendor_id: p.vendor_id,
    location_id: p.location_id,
    status: "pending",
    notes: p.notes || null,
  }).select("*").single();
  if (error) throw new Error(`Requisition insert failed: ${error.message}`);

  const items = (p.items || []).map((it: any) => ({
    requisition_id: req.id,
    product_id: it.product_id,
    quantity: it.quantity,
    notes: it.notes || null,
  }));
  if (items.length) {
    const { error: ie } = await supabase.from("requisition_items").insert(items);
    if (ie) throw new Error(`Requisition items failed: ${ie.message}`);
  }
  return { id: req.id, requisition_id: req.requisition_id, label: `Req ${req.requisition_id}` };
}

async function createTransfer(supabase: any, companyId: string, p: any) {
  const { data, error } = await supabase.rpc("create_outbound_delivery", {
    p_company_id: companyId,
    p_purchase_order_id: null,
    p_from_location_id: p.from_location_id,
    p_to_location_id: p.to_location_id,
    p_status: "pending",
    p_notes: p.notes || null,
    p_customer_id: null,
    p_sales_order_id: null,
    p_carrier: null,
    p_tracking_number: null,
  });
  if (error) throw new Error(`Transfer failed: ${error.message}`);
  const delivery = data as any;
  const deliveryId = delivery?.id || delivery?.delivery_id || delivery?.outbound_delivery_id;
  const deliveryNumber = delivery?.delivery_number || delivery?.number;

  const items = (p.items || []).map((it: any) => ({
    outbound_delivery_id: deliveryId,
    product_id: it.product_id,
    quantity: it.quantity,
    notes: it.notes || null,
  }));
  if (items.length && deliveryId) {
    const { error: ie } = await supabase.from("outbound_delivery_items").insert(items);
    if (ie) throw new Error(`Transfer items failed: ${ie.message}`);
  }
  return { id: deliveryId, delivery_number: deliveryNumber, label: `Transfer ${deliveryNumber || ""}`.trim() };
}
