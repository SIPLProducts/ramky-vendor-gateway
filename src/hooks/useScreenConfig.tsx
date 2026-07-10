import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ReportsScreenConfig {
  report_type_vendor: boolean;
  report_type_approval: boolean;
  report_type_both: boolean;
  scope_single: boolean;
  scope_all: boolean;
  filter_from_date: boolean;
  filter_to_date: boolean;
  filter_vendor_status: boolean;
  action_run: boolean;
  action_reset: boolean;
  action_excel: boolean;
  action_pdf: boolean;
}

export const DEFAULT_REPORTS_SCREEN_CONFIG: ReportsScreenConfig = {
  report_type_vendor: true,
  report_type_approval: true,
  report_type_both: true,
  scope_single: true,
  scope_all: true,
  filter_from_date: true,
  filter_to_date: true,
  filter_vendor_status: true,
  action_run: true,
  action_reset: true,
  action_excel: true,
  action_pdf: true,
};

const CONFIG_KEY = 'screen_config_reports';

export function useReportsScreenConfig() {
  return useQuery({
    queryKey: ['screen-config', 'reports'],
    queryFn: async (): Promise<ReportsScreenConfig> => {
      const { data, error } = await supabase
        .from('portal_config')
        .select('config_value')
        .eq('config_key', CONFIG_KEY)
        .maybeSingle();
      if (error) throw error;
      const v = (data?.config_value ?? {}) as Partial<ReportsScreenConfig>;
      return { ...DEFAULT_REPORTS_SCREEN_CONFIG, ...v };
    },
    staleTime: 30_000,
  });
}

export function useSaveReportsScreenConfig() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (cfg: ReportsScreenConfig) => {
      const { error } = await supabase
        .from('portal_config')
        .upsert(
          {
            config_key: CONFIG_KEY,
            config_value: cfg as unknown as Record<string, boolean>,
            description: 'Visibility toggles for the Reports screen',
          },
          { onConflict: 'config_key' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screen-config', 'reports'] });
      toast({ title: 'Screen Configuration Saved', description: 'Reports screen updated.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });
}
