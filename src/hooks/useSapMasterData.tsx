import { useEffect, useState, useCallback } from "react";
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

/**
 * Loads SAP master data for `masterType`. If the cache is empty after the
 * first read, automatically triggers `sap-master-fetch` for that type and
 * exposes a granular status so the UI can show:
 *   - fetching   → "Classification data fetching..."
 *   - errorMessage → "Classification fetch failed — <reason>"
 *   - retry()    → re-trigger sync from SAP
 */
export function useEnsureSapMaster(masterType: string | undefined) {
  const qc = useQueryClient();
  const query = useSapMasterData(masterType);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  const runSync = useCallback(async () => {
    if (!masterType) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const { data, error } = await supabase.functions.invoke("sap-master-fetch", {
        body: { master_type: masterType },
      });
      if (error) throw error;
      if (data && data.success === false) {
        const msg = [data.message, data.hint].filter(Boolean).join(" — ");
        setSyncError(msg || "Unknown SAP error");
      } else {
        await qc.invalidateQueries({ queryKey: ["sap_master_data", masterType] });
      }
    } catch (e: any) {
      setSyncError(e?.message || "Could not reach SAP");
    } finally {
      setSyncing(false);
    }
  }, [masterType, qc]);

  // Auto-trigger one sync if list is empty on first successful fetch.
  useEffect(() => {
    if (!masterType || autoTried) return;
    if (query.isLoading || query.isFetching) return;
    if (query.data && query.data.length === 0 && !syncing) {
      setAutoTried(true);
      runSync();
    } else if (query.data && query.data.length > 0) {
      setAutoTried(true);
    }
  }, [masterType, autoTried, query.isLoading, query.isFetching, query.data, syncing, runSync]);

  const retry = useCallback(() => {
    setAutoTried(true);
    runSync();
  }, [runSync]);

  const fetching = query.isLoading || query.isFetching || syncing;
  const errorMessage = syncError || (query.isError ? (query.error as any)?.message || "Failed to load data" : null);

  return {
    rows: query.data,
    fetching,
    errorMessage,
    retry,
  };
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
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["sap_master_data"] });
      await qc.refetchQueries({ queryKey: ["sap_master_data"], type: "active" });
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
