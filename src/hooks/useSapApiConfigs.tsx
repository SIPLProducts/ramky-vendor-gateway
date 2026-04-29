import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type SapApiConfig = {
  id: string;
  name: string;
  description: string | null;
  base_url: string;
  endpoint_path: string;
  http_method: string;
  auth_type: string;
  sap_client: string | null;
  timeout_ms: number;
  connection_mode: string;
  deployment_mode: string;
  middleware_url: string | null;
  middleware_port: number | null;
  proxy_secret: string | null;
  list_endpoint: string | null;
  create_endpoint: string | null;
  update_endpoint: string | null;
  update_method: string | null;
  key_field: string | null;
  api_type: string;
  auto_sync_enabled: boolean;
  schedule_cron: string | null;
  last_synced_at: string | null;
  next_sync_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function useSapApiConfigs() {
  return useQuery({
    queryKey: ["sap_api_configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sap_api_configs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SapApiConfig[];
    },
  });
}

export function useSapApiConfig(id: string | undefined) {
  return useQuery({
    queryKey: ["sap_api_config", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sap_api_configs")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as SapApiConfig | null;
    },
  });
}

export function useCreateSapApiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SapApiConfig>) => {
      const { data: userRes } = await supabase.auth.getUser();
      const insertPayload = {
        name: payload.name || "Untitled API",
        description: payload.description ?? null,
        base_url: payload.base_url ?? "",
        endpoint_path: payload.endpoint_path ?? "",
        http_method: payload.http_method ?? "POST",
        auth_type: payload.auth_type ?? "Basic",
        sap_client: payload.sap_client ?? "100",
        timeout_ms: payload.timeout_ms ?? 30000,
        connection_mode: payload.connection_mode ?? "proxy",
        deployment_mode: payload.deployment_mode ?? "cloud",
        middleware_url: payload.middleware_url ?? null,
        middleware_port: payload.middleware_port ?? null,
        proxy_secret: payload.proxy_secret ?? null,
        list_endpoint: payload.list_endpoint ?? null,
        create_endpoint: payload.create_endpoint ?? null,
        update_endpoint: payload.update_endpoint ?? null,
        update_method: payload.update_method ?? "PATCH",
        key_field: payload.key_field ?? null,
        api_type: payload.api_type ?? "sync",
        auto_sync_enabled: payload.auto_sync_enabled ?? false,
        schedule_cron: payload.schedule_cron ?? null,
        is_active: payload.is_active ?? true,
        created_by: userRes?.user?.id ?? null,
      };
      const { data, error } = await supabase
        .from("sap_api_configs")
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      return data as SapApiConfig;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sap_api_configs"] });
      toast({ title: "API configuration saved" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    },
  });
}

export function useUpdateSapApiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SapApiConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from("sap_api_configs")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SapApiConfig;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sap_api_configs"] });
      qc.invalidateQueries({ queryKey: ["sap_api_config", data.id] });
      toast({ title: "Saved" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteSapApiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sap_api_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sap_api_configs"] });
      toast({ title: "Configuration deleted" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });
}

// Request fields
export function useSapRequestFields(configId: string | undefined) {
  return useQuery({
    queryKey: ["sap_api_request_fields", configId],
    enabled: !!configId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sap_api_request_fields")
        .select("*")
        .eq("config_id", configId!)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSapResponseFields(configId: string | undefined) {
  return useQuery({
    queryKey: ["sap_api_response_fields", configId],
    enabled: !!configId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sap_api_response_fields")
        .select("*")
        .eq("config_id", configId!)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSapCredentials(configId: string | undefined) {
  return useQuery({
    queryKey: ["sap_api_credentials", configId],
    enabled: !!configId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sap_api_credentials")
        .select("*")
        .eq("config_id", configId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveSapCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { config_id: string; username?: string; password_encrypted?: string; extra_headers?: any }) => {
      const { data, error } = await supabase
        .from("sap_api_credentials")
        .upsert(payload, { onConflict: "config_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["sap_api_credentials", data.config_id] });
      toast({ title: "Credentials saved" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to save credentials", description: e.message, variant: "destructive" }),
  });
}

export function useReplaceSapRequestFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ configId, rows }: { configId: string; rows: Array<{ field_name: string; source?: string; default_value?: string; required?: boolean }> }) => {
      await supabase.from("sap_api_request_fields").delete().eq("config_id", configId);
      if (rows.length === 0) return [];
      const payload = rows.map((r, i) => ({
        config_id: configId,
        field_name: r.field_name,
        source: r.source || null,
        default_value: r.default_value || null,
        required: !!r.required,
        order_index: i,
      }));
      const { data, error } = await supabase.from("sap_api_request_fields").insert(payload).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sap_api_request_fields", vars.configId] });
      toast({ title: "Request fields saved" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });
}

export function useReplaceSapResponseFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ configId, rows }: { configId: string; rows: Array<{ field_name: string; target_column?: string }> }) => {
      await supabase.from("sap_api_response_fields").delete().eq("config_id", configId);
      if (rows.length === 0) return [];
      const payload = rows.map((r, i) => ({
        config_id: configId,
        field_name: r.field_name,
        target_column: r.target_column || null,
        order_index: i,
      }));
      const { data, error } = await supabase.from("sap_api_response_fields").insert(payload).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sap_api_response_fields", vars.configId] });
      toast({ title: "Response fields saved" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });
}

export function useTestSapConnection() {
  return useMutation({
    mutationFn: async (configId: string) => {
      const { data, error } = await supabase.functions.invoke("sap-api-test-connection", {
        body: { configId },
      });
      if (error) throw error;
      return data as { ok: boolean; status?: number; latency_ms?: number; message?: string };
    },
  });
}
