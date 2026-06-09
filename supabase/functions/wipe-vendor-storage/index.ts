import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const s = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const bucket = "vendor-documents";
  let total = 0;
  async function wipe(prefix = ""): Promise<void> {
    const { data, error } = await s.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    if (!data || data.length === 0) return;
    const files = data.filter((d: any) => d.id !== null);
    const folders = data.filter((d: any) => d.id === null);
    if (files.length) {
      const paths = files.map((f: any) => (prefix ? `${prefix}/${f.name}` : f.name));
      const { error: dErr } = await s.storage.from(bucket).remove(paths);
      if (dErr) throw dErr;
      total += paths.length;
    }
    for (const f of folders) await wipe(prefix ? `${prefix}/${f.name}` : f.name);
  }
  try {
    await wipe();
    return new Response(JSON.stringify({ deleted: total }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, deleted: total }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
