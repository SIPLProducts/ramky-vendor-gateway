import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type SapMasterRow = {
  id: string;
  master_type: string;
  code: string;
  description: string | null;
  source: string;
  extra: any | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export const SAP_MASTER_TYPES = [
  { value: "vendor_account_group", label: "Vendor Account Group" },
  { value: "company_code",         label: "Company Code" },
  { value: "planning_group",       label: "Planning Group" },
  { value: "recon_account",        label: "Recon Account" },
  { value: "purchase_org",         label: "Purchase Org" },
  { value: "currency",             label: "Currency" },
] as const;

export function useSapMasterData(masterType: string | undefined) {
  return useQuery({
    queryKey: ["sap_master_data", masterType],
    enabled: !!masterType,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sap_master_data" as any)
        .select("*")
        .eq("master_type", masterType!)
        .order("code", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SapMasterRow[];
    },
  });
}

export function useUpsertSapMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id?: string; master_type: string; code: string; description?: string | null }) => {
      const payload: any = {
        master_type: row.master_type,
        code: row.code,
        description: row.description ?? null,
        source: "manual",
      };
      if (row.id) payload.id = row.id;
      const { data, error } = await supabase
        .from("sap_master_data" as any)
        .upsert(payload, { onConflict: "master_type,code" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sap_master_data", vars.master_type] });
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteSapMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sap_master_data" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sap_master_data"] });
      toast({ title: "Deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
}

export function useRefreshSapMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (masterType?: string) => {
      const body = masterType ? { master_type: masterType } : {};
      const { data, error } = await supabase.functions.invoke("sap-master-fetch", { body });
      if (error) throw error;
      return data as { success: boolean; message?: string; hint?: string; summary?: Record<string, { upserted: number; skipped: number }> };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["sap_master_data"] });
      if (res?.success) {
        const total = Object.values(res.summary || {}).reduce((s, v) => s + (v.upserted || 0), 0);
        toast({ title: "Refreshed from SAP", description: `${total} values updated.` });
      } else {
        toast({
          title: "SAP refresh failed",
          description: `${res?.message || "Unknown error"}${res?.hint ? `\n${res.hint}` : ""}`,
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => toast({ title: "Refresh failed", description: e.message, variant: "destructive" }),
  });
}
