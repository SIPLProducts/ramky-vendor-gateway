import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SaveBody {
  id?: string;
  user_email: string;
  smtp_host: string;
  smtp_port: number;
  encryption: "none" | "ssl" | "tls" | "starttls";
  smtp_username: string;
  app_password?: string; // optional on update if unchanged
  from_name?: string | null;
  is_active?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role check via has_role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const roleCheck = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    const roles = (roleCheck.data ?? []).map((r: any) => r.role);
    const allowed = roles.some((r: string) =>
      ["sharvi_admin", "admin", "customer_admin"].includes(r),
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SaveBody = await req.json();
    if (
      !body.user_email ||
      !body.smtp_host ||
      !body.smtp_port ||
      !body.smtp_username ||
      !body.encryption
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (body.id) {
      const update: Record<string, unknown> = {
        user_email: body.user_email.trim().toLowerCase(),
        smtp_host: body.smtp_host.trim(),
        smtp_port: Number(body.smtp_port),
        encryption: body.encryption,
        smtp_username: body.smtp_username.trim(),
        from_name: body.from_name ?? null,
        is_active: body.is_active ?? true,
      };
      if (body.app_password && body.app_password.length > 0) {
        update.app_password = body.app_password;
      }
      const { data, error } = await adminClient
        .from("smtp_email_configs")
        .update(update)
        .eq("id", body.id)
        .select("id")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.app_password) {
      return new Response(
        JSON.stringify({ error: "App password is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data, error } = await adminClient
      .from("smtp_email_configs")
      .insert({
        user_email: body.user_email.trim().toLowerCase(),
        smtp_host: body.smtp_host.trim(),
        smtp_port: Number(body.smtp_port),
        encryption: body.encryption,
        smtp_username: body.smtp_username.trim(),
        app_password: body.app_password,
        from_name: body.from_name ?? null,
        is_active: body.is_active ?? true,
        created_by: userRes.user.id,
      })
      .select("id")
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("smtp-config-save error", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
