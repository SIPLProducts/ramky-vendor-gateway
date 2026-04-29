import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type KycApiProvider = {
  id: string;
  tenant_id: string | null;
  provider_name: string;
  display_name: string;
  category: string;
  is_enabled: boolean;
  is_mandatory: boolean;
  execution_order: number;
  base_url: string;
  endpoint_path: string;
  http_method: string;
  request_mode: string;
  file_field_name: string | null;
  auth_type: string;
  auth_header_name: string;
  auth_header_prefix: string;
  request_headers: any;
  request_body_template: any;
  response_success_path: string | null;
  response_success_value: string;
  response_message_path: string | null;
  response_data_mapping: any;
  timeout_seconds: number;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

export type KycApiCredential = {
  id: string;
  api_provider_id: string;
  credential_name: string;
  credential_value: string;
  is_encrypted: boolean;
};

export function useKycApiProviders(category?: "OCR" | "VALIDATION") {
  return useQuery({
    queryKey: ["kyc_api_providers", category ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("api_providers")
        .select("*")
        .order("execution_order", { ascending: true });
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as KycApiProvider[];
    },
  });
}

export function useKycApiProvider(id: string | undefined) {
  return useQuery({
    queryKey: ["kyc_api_provider", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_providers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as KycApiProvider | null;
    },
  });
}

export function useCreateKycApiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<KycApiProvider>) => {
      const insert = {
        tenant_id: payload.tenant_id ?? null,
        provider_name: payload.provider_name || "CUSTOM",
        display_name: payload.display_name || "Untitled API",
        category: payload.category || "VALIDATION",
        base_url: payload.base_url || "",
        endpoint_path: payload.endpoint_path || "",
        http_method: payload.http_method || "POST",
        request_mode: payload.request_mode || "json",
        file_field_name: payload.file_field_name ?? null,
        auth_type: payload.auth_type || "BEARER_TOKEN",
        auth_header_name: payload.auth_header_name || "Authorization",
        auth_header_prefix: payload.auth_header_prefix || "Bearer",
        request_headers: payload.request_headers ?? {},
        request_body_template: payload.request_body_template ?? {},
        response_success_path: payload.response_success_path ?? null,
        response_success_value: payload.response_success_value ?? "true",
        response_message_path: payload.response_message_path ?? null,
        response_data_mapping: payload.response_data_mapping ?? {},
        timeout_seconds: payload.timeout_seconds ?? 30,
        retry_count: payload.retry_count ?? 3,
        is_enabled: payload.is_enabled ?? true,
        is_mandatory: payload.is_mandatory ?? false,
        execution_order: payload.execution_order ?? 1,
      };
      const { data, error } = await supabase
        .from("api_providers")
        .insert(insert as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as KycApiProvider;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc_api_providers"] });
      toast({ title: "API configuration saved" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateKycApiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<KycApiProvider> & { id: string }) => {
      const { data, error } = await supabase
        .from("api_providers")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as KycApiProvider;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["kyc_api_providers"] });
      qc.invalidateQueries({ queryKey: ["kyc_api_provider", data.id] });
      toast({ title: "Saved" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteKycApiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_providers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc_api_providers"] });
      toast({ title: "Configuration deleted" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });
}

export function useKycApiCredential(providerId: string | undefined) {
  return useQuery({
    queryKey: ["kyc_api_credential", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_credentials")
        .select("*")
        .eq("api_provider_id", providerId!)
        .eq("credential_name", "API_TOKEN")
        .maybeSingle();
      if (error) throw error;
      return data as KycApiCredential | null;
    },
  });
}

export function useSaveKycApiCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      providerId,
      value,
    }: {
      providerId: string;
      value: string;
    }) => {
      const { data: existing } = await supabase
        .from("api_credentials")
        .select("id")
        .eq("api_provider_id", providerId)
        .eq("credential_name", "API_TOKEN")
        .maybeSingle();

      if (existing?.id) {
        const { data, error } = await supabase
          .from("api_credentials")
          .update({ credential_value: value })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("api_credentials")
        .insert({
          api_provider_id: providerId,
          credential_name: "API_TOKEN",
          credential_value: value,
          is_encrypted: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kyc_api_credential", vars.providerId] });
      toast({ title: "Credential saved" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to save credential", description: e.message, variant: "destructive" }),
  });
}

export function useTestKycApi() {
  return useMutation({
    mutationFn: async (payload: {
      providerId: string;
      sampleInput?: Record<string, any>;
      fileBase64?: string;
      fileMimeType?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("kyc-api-test", {
        body: payload,
      });
      if (error) throw error;
      return data as {
        ok: boolean;
        status?: number;
        latency_ms?: number;
        response?: any;
        mappedResult?: any;
        message?: string;
      };
    },
  });
}
