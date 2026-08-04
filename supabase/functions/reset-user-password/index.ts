import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  for (let i = 0; i < 12; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { company_id, target_email } = body;
    let target_user_id = body.target_user_id as string | undefined;

    if (!company_id || (!target_user_id && !target_email)) {
      return new Response(JSON.stringify({ error: 'company_id and target_user_id or target_email are required' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Resolve user id from email (used for pending invitations)
    if (!target_user_id && target_email) {
      const normalized = String(target_email).toLowerCase().trim();
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .ilike('email', normalized)
        .eq('company_id', company_id)
        .maybeSingle();
      if (!prof?.user_id) {
        return new Response(JSON.stringify({ error: 'No user account found for this invitation yet' }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      target_user_id = prof.user_id;
    }

    if (target_user_id === callingUser.id) {
      return new Response(JSON.stringify({ error: 'Cannot reset your own password here' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }


    // Caller must be admin or IT of the company
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: callingUser.id, _role: 'admin'
    });
    const { data: isIt } = await supabaseAdmin.rpc('has_role', {
      _user_id: callingUser.id, _role: 'it'
    });
    const { data: isOwner } = await supabaseAdmin.rpc('has_role', {
      _user_id: callingUser.id, _role: 'owner'
    });

    if (!isAdmin && !isIt && !isOwner) {
      // Fallback: check company-scoped membership
      const { data: roleRow } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callingUser.id)
        .eq('company_id', company_id)
        .maybeSingle();
      const allowed = roleRow && ['admin', 'it', 'owner'].includes(roleRow.role);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Not authorized' }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Verify the target user belongs to the same company
    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', target_user_id)
      .eq('company_id', company_id)
      .maybeSingle();
    if (!targetRole) {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('user_id', target_user_id)
        .eq('company_id', company_id)
        .maybeSingle();
      if (!targetProfile) {
        return new Response(JSON.stringify({ error: 'Target user not in this company' }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const tempPassword = generateTempPassword();
    // email_confirm ensures the user can sign in immediately without confirming email
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
      password: tempPassword,
      email_confirm: true,
    });


    if (updateError) {
      console.error('Error resetting password:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to reset password: ' + updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, temp_password: tempPassword }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('reset-user-password error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
