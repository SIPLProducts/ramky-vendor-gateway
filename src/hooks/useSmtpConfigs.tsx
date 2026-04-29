import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SmtpConfig {
  id: string;
  user_email: string;
  smtp_host: string;
  smtp_port: number;
  encryption: "none" | "ssl" | "tls" | "starttls";
  smtp_username: string;
  from_name: string | null;
  is_active: boolean;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface SmtpConfigInput {
  id?: string;
  user_email: string;
  smtp_host: string;
  smtp_port: number;
  encryption: "none" | "ssl" | "tls" | "starttls";
  smtp_username: string;
  app_password?: string;
  from_name?: string | null;
  is_active?: boolean;
}

export function useSmtpConfigs() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["smtp_configs"],
    queryFn: async (): Promise<SmtpConfig[]> => {
      const { data, error } = await supabase.rpc("list_smtp_configs");
      if (error) throw error;
      return (data ?? []) as SmtpConfig[];
    },
  });

  const save = useMutation({
    mutationFn: async (input: SmtpConfigInput) => {
      const { data, error } = await supabase.functions.invoke(
        "smtp-config-save",
        { body: input },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smtp_configs"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke(
        "smtp-config-delete",
        { body: { id } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smtp_configs"] }),
  });

  const test = useMutation({
    mutationFn: async ({ id, to }: { id: string; to?: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "smtp-config-test",
        { body: { id, to } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { success: boolean; sentTo?: string };
    },
  });

  return { list, save, remove, test };
}

export function useUserEmails() {
  return useQuery({
    queryKey: ["profile_emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, full_name")
        .order("email");
      if (error) throw error;
      return (data ?? []) as { email: string; full_name: string | null }[];
    },
  });
}
