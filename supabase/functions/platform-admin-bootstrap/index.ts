import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // One-time bootstrap: refuse once a platform admin exists
    const { count } = await supabaseAdmin
      .from("platform_admins")
      .select("id", { count: "exact", head: true });

    if ((count ?? 0) > 0) {
      return new Response(JSON.stringify({ error: "Platform admin already exists" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { platform_admin: true },
    });

    let userId = created?.user?.id;

    if (createError && !userId) {
      // User may already exist in auth - find them
      let page = 1;
      while (page <= 20 && !userId) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (!list?.users?.length) break;
        const match = list.users.find(
          (u: { id: string; email?: string | null }) =>
            (u.email || "").toLowerCase() === String(email).toLowerCase(),
        );
        if (match) userId = match.id;
        if (list.users.length < 200) break;
        page++;
      }
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("platform_admins")
      .insert({ user_id: userId, email });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("platform-admin-bootstrap error:", error);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
