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
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: pa } = await admin.from("platform_admins").select("id").eq("user_id", user.id).maybeSingle();
    if (!pa) return json({ error: "Forbidden" }, 403);

    const { action, company_id } = await req.json();

    if (action === "list") {
      const { data: companies, error } = await admin.from("companies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: profiles } = await admin.from("profiles").select("company_id");
      const counts: Record<string, number> = {};
      (profiles || []).forEach((p: any) => { if (p.company_id) counts[p.company_id] = (counts[p.company_id] || 0) + 1; });
      return json({ companies: (companies || []).map((c: any) => ({ ...c, user_count: counts[c.id] || 0 })) });
    }

    if (action === "get") {
      const { data: company } = await admin.from("companies").select("*").eq("id", company_id).maybeSingle();
      const { data: settings } = await admin.from("company_settings").select("*").eq("company_id", company_id);
      const { data: users } = await admin.from("profiles").select("id, user_id, first_name, last_name, profile_id").eq("company_id", company_id);
      const withEmail = await Promise.all((users || []).map(async (u: any) => {
        const { data } = await admin.auth.admin.getUserById(u.user_id);
        return { ...u, email: data?.user?.email ?? null };
      }));
      const { count: locations } = await admin.from("locations").select("id", { count: "exact", head: true }).eq("company_id", company_id);
      const { count: products } = await admin.from("products").select("id", { count: "exact", head: true }).eq("company_id", company_id);
      return json({ company, settings: settings || [], users: withEmail, stats: { locations: locations ?? 0, products: products ?? 0 } });
    }

    if (action === "delete") {
      if (!company_id) return json({ error: "company_id required" }, 400);
      const { data: users } = await admin.from("profiles").select("user_id").eq("company_id", company_id);
      const { data: result, error } = await admin.rpc("platform_delete_company", { p_company_id: company_id });
      if (error) throw error;
      let removedUsers = 0;
      for (const u of users || []) {
        if (!u.user_id || u.user_id === user.id) continue;
        const { error: e } = await admin.auth.admin.deleteUser(u.user_id);
        if (!e) removedUsers++;
      }
      return json({ ok: true, ...(result as object), deleted_users: removedUsers });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
