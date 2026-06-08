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
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the calling user
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, role, company_id, first_name, last_name, send_invite } = await req.json();

    if (!email || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Email and company_id are required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify calling user is admin of the company
    const { data: isAdmin } = await supabaseAdmin.rpc('is_company_admin', {
      _user_id: callingUser.id,
      _company_id: company_id,
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const tempPassword = generateTempPassword();

    // Create the user in auth with auto-confirm
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) {
      // If user already exists, that's okay - just create the invitation
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists. They can log in and will be associated on next login.' }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user: ' + createError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user!.id;

    // Create profile for the new user
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        company_id: company_id,
        first_name: first_name || normalizedEmail.split('@')[0],
        last_name: last_name || '',
        email: normalizedEmail,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        company_id: company_id,
        role: role || 'member',
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
    }

    // Create invitation record (temp password is NOT stored for security)
    const { error: inviteError } = await supabaseAdmin
      .from('invitations')
      .insert({
        email: normalizedEmail,
        company_id: company_id,
        role: role || 'member',
        invited_by: callingUser.id,
      });

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        temp_password: tempPassword,
        user_id: userId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("create-invited-user error:", error);
    return new Response(
      JSON.stringify({ error: 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
