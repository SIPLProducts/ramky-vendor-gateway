import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ValidationConfig {
  id: string;
  validation_type: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  is_mandatory: boolean;
  execution_stage: 'ON_SUBMIT' | 'SCHEDULED' | 'BOTH';
  api_provider: string | null;
  api_endpoint: string | null;
  matching_threshold: number | null;
  retry_count: number;
  timeout_seconds: number;
  schedule_frequency_days: number | null;
  priority_order: number;
  created_at: string;
  updated_at: string;
}

export interface ValidationApiLog {
  id: string;
  vendor_id: string;
  validation_type: string;
  api_provider: string | null;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  response_status: number | null;
  execution_time_ms: number | null;
  is_success: boolean;
  error_message: string | null;
  created_at: string;
}

export function useValidationConfigs() {
  return useQuery({
    queryKey: ['validation-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('validation_configs')
        .select('*')
        .order('priority_order', { ascending: true });
      
      if (error) throw error;
      return data as ValidationConfig[];
    },
  });
}

export function useUpdateValidationConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Partial<ValidationConfig> & { id: string }) => {
      const { id, ...updates } = config;
      const { error } = await supabase
        .from('validation_configs')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-configs'] });
      toast({
        title: 'Configuration Updated',
        description: 'Validation configuration has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRunOrchestrator() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ vendorId, executionStage = 'ON_SUBMIT' }: { vendorId: string; executionStage?: string }) => {
      const { data, error } = await supabase.functions.invoke('validation-orchestrator', {
        body: { vendorId, executionStage },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-validations'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      
      const { summary } = data;
      toast({
        title: 'Validations Complete',
        description: `${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`,
        variant: summary.failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Orchestration Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useValidationApiLogs(vendorId?: string) {
  return useQuery({
    queryKey: ['validation-api-logs', vendorId],
    queryFn: async () => {
      let query = supabase
        .from('validation_api_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ValidationApiLog[];
    },
    enabled: true,
  });
}