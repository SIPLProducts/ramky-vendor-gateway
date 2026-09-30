export interface FunctionInvokeResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export async function invokeFunctionJson<T = Record<string, unknown>>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<FunctionInvokeResult<T>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, status: 500, data: null, error: "Email service credentials are unavailable." };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    let data: T | null = null;
    try {
      data = raw ? JSON.parse(raw) as T : null;
    } catch {
      data = null;
    }
    const result = data as Record<string, unknown> | null;
    const error = typeof result?.error === "string"
      ? result.error
      : response.ok
        ? null
        : `Email service returned HTTP ${response.status}.`;
    const succeeded = response.ok && result?.success !== false;
    return { ok: succeeded, status: response.status, data, error: succeeded ? null : error ?? "Email delivery failed." };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      data: null,
      error: error instanceof Error ? error.message : "Email service could not be reached.",
    };
  }
}