import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DynamicValidationResult {
  provider_name: string;
  display_name: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  message: string;
  is_mandatory: boolean;
  response_data: Record<string, unknown> | null;
  execution_time_ms: number;
}

interface DynamicValidationResponse {
  success: boolean;
  vendor_id: string;
  new_status: string;
  results: DynamicValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  };
}

interface RunDynamicValidationOptions {
  vendorId: string;
  tenantId?: string;
  providerNames?: string[]; // Optional: specific providers to run
}

export function useDynamicValidation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ vendorId, tenantId, providerNames }: RunDynamicValidationOptions) => {
      const { data, error } = await supabase.functions.invoke('dynamic-api-executor', {
        body: { vendorId, tenantId, providerNames },
      });

      if (error) throw error;
      return data as DynamicValidationResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-validations'] });
      queryClient.invalidateQueries({ queryKey: ['validation-api-logs'] });

      const { summary, new_status } = data;
      
      if (summary.failed > 0 || summary.errors > 0) {
        toast({
          title: 'Validations Completed with Issues',
          description: `${summary.passed} passed, ${summary.failed} failed, ${summary.errors} errors`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Validations Completed Successfully',
          description: `All ${summary.passed} validations passed. Status: ${new_status}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Validation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Re-export types for use in components
export type { DynamicValidationResult, DynamicValidationResponse, RunDynamicValidationOptions };
