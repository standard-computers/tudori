import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) return json({ error: "Not authenticated" }, 401);

    const { user_id, company_id } = await req.json();
    if (typeof user_id !== "string" || typeof company_id !== "string") return json({ error: "user_id and company_id are required" }, 400);
    if (user_id === caller.id) return json({ error: "Cannot remove yourself" }, 400);

    const { data: isAdmin } = await admin.rpc("is_company_admin", { _user_id: caller.id, _company_id: company_id });
    if (!isAdmin) return json({ error: "Not authorized" }, 403);

    const { data: target } = await admin.from("profiles").select("id").eq("user_id", user_id).eq("company_id", company_id).maybeSingle();
    if (!target) return json({ error: "User is not in this company" }, 404);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user_id).eq("company_id", company_id);
    if ((roles || []).some((r: any) => r.role === "owner")) return json({ error: "Cannot remove the owner" }, 400);

    await admin.from("employees").update({ user_id: null }).eq("user_id", user_id).eq("company_id", company_id);
    await admin.from("pos_assignments").delete().eq("user_id", user_id);
    await admin.from("location_users").delete().eq("user_id", user_id);
    await admin.from("user_transaction_access").delete().eq("user_id", user_id);
    await admin.from("user_roles").delete().eq("user_id", user_id).eq("company_id", company_id);

    const { error: authErr } = await admin.auth.admin.deleteUser(user_id);
    if (authErr) {
      // Fall back to detaching the profile so the user loses access
      await admin.from("profiles").update({ company_id: null }).eq("user_id", user_id);
      return json({ ok: true, account_deleted: false, warning: authErr.message });
    }
    await admin.from("profiles").delete().eq("user_id", user_id);
    return json({ ok: true, account_deleted: true });
  } catch (e) {
    console.error("delete-company-user error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
