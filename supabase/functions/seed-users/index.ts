import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const users = [
    { email: "elisa@cnt.com", password: "cnt2024elisa", name: "Elisa", role: "admin" },
    { email: "duda@cnt.com", password: "cnt2024duda", name: "Duda", role: "admin" },
    { email: "amanda@cnt.com", password: "cnt2024amanda", name: "Amanda", role: "restricted" },
    { email: "henrique@cnt.com", password: "cnt2024henrique", name: "Henrique", role: "restricted" },
  ];

  const results = [];

  for (const u of users) {
    // Check if user exists
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const found = existing?.users?.find((x: any) => x.email === u.email);
    
    let userId: string;
    if (found) {
      userId = found.id;
      results.push({ email: u.email, status: "already exists" });
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) {
        results.push({ email: u.email, status: "error", error: error.message });
        continue;
      }
      userId = data.user.id;
      results.push({ email: u.email, status: "created" });
    }

    // Upsert role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: u.role, display_name: u.name }, { onConflict: "user_id,role" });
    
    if (roleError) {
      results.push({ email: u.email, roleStatus: "error", error: roleError.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
