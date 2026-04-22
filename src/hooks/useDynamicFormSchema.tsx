import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FormFieldConfig } from '@/hooks/useTenant';
import type { FormStepConfig } from '@/hooks/useFormBuilder';

export interface DynamicStepDef {
  step_key: string;
  step_label: string;
  step_description: string | null;
  step_order: number;
  is_built_in: boolean;
}

/**
 * Returns custom (non-built-in) tabs and their fields for a tenant. Vendor
 * registration uses this to render extra steps the admin has configured.
 */
export function useDynamicFormSchema(tenantId?: string | null) {
  return useQuery({
    queryKey: ['dynamic-form-schema', tenantId],
    queryFn: async (): Promise<{ steps: DynamicStepDef[]; fieldsByStep: Record<string, FormFieldConfig[]> }> => {
      if (!tenantId) return { steps: [], fieldsByStep: {} };

      const [stepsRes, fieldsRes] = await Promise.all([
        supabase
          .from('form_step_configs')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_visible', true)
          .eq('is_built_in', false)
          .order('step_order'),
        supabase
          .from('form_field_configs')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_visible', true)
          .order('display_order'),
      ]);

      if (stepsRes.error) throw stepsRes.error;
      if (fieldsRes.error) throw fieldsRes.error;

      const steps = (stepsRes.data || []) as FormStepConfig[];
      const fields = (fieldsRes.data || []) as FormFieldConfig[];

      const fieldsByStep: Record<string, FormFieldConfig[]> = {};
      for (const f of fields) {
        if (!fieldsByStep[f.step_name]) fieldsByStep[f.step_name] = [];
        fieldsByStep[f.step_name].push(f);
      }

      return {
        steps: steps.map((s) => ({
          step_key: s.step_key,
          step_label: s.step_label,
          step_description: s.step_description,
          step_order: s.step_order,
          is_built_in: s.is_built_in,
        })),
        fieldsByStep,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}
