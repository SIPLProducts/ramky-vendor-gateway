import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FormStepConfig {
  id: string;
  tenant_id: string | null;
  step_key: string;
  step_label: string;
  step_description: string | null;
  step_order: number;
  is_visible: boolean;
  is_built_in: boolean;
  created_at: string;
  updated_at: string;
}

// Built-in steps that always exist for every tenant. Stored locally so we can
// render them in the Form Builder without having to seed rows for each tenant.
export const BUILT_IN_STEPS: Array<Omit<FormStepConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>> = [
  { step_key: 'document_verification', step_label: 'Document Verification', step_description: 'PAN / GST / MSME / Bank — OCR + API verified', step_order: 1, is_visible: true, is_built_in: true },
  { step_key: 'organization',          step_label: 'Organization Profile',   step_description: 'Company, statutory & memberships',           step_order: 2, is_visible: true, is_built_in: true },
  { step_key: 'address',               step_label: 'Address Information',    step_description: 'Registered, manufacturing & branch',         step_order: 3, is_visible: true, is_built_in: true },
  { step_key: 'contact',               step_label: 'Contact Details',        step_description: 'Key contact persons',                        step_order: 4, is_visible: true, is_built_in: true },
  { step_key: 'financial',             step_label: 'Financial & Infrastructure', step_description: 'Turnover, facility & QHSE',              step_order: 5, is_visible: true, is_built_in: true },
  { step_key: 'review',                step_label: 'Review & Submit',        step_description: 'Verify and submit application',              step_order: 99, is_visible: true, is_built_in: true },
];

export function useFormStepConfigs(tenantId?: string | null) {
  return useQuery({
    queryKey: ['form-step-configs', tenantId],
    queryFn: async () => {
      let query = supabase.from('form_step_configs').select('*').order('step_order');
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FormStepConfig[];
    },
    enabled: !!tenantId,
  });
}

export function useUpsertFormStep() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (step: Partial<FormStepConfig> & { tenant_id: string; step_key: string; step_label: string; step_order: number }) => {
      if (step.id) {
        const { id, ...updates } = step;
        const { error } = await supabase.from('form_step_configs').update(updates).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('form_step_configs').insert({
          tenant_id: step.tenant_id,
          step_key: step.step_key,
          step_label: step.step_label,
          step_description: step.step_description ?? null,
          step_order: step.step_order,
          is_visible: step.is_visible ?? true,
          is_built_in: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-step-configs'] });
      toast({ title: 'Tab saved', description: 'Form tab configuration updated.' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteFormStep() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('form_step_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-step-configs'] });
      queryClient.invalidateQueries({ queryKey: ['form-field-configs'] });
      toast({ title: 'Tab removed' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export interface FieldConfigInput {
  id?: string;
  tenant_id: string;
  step_name: string; // matches form_step_configs.step_key
  field_name: string;
  display_label: string;
  field_type: string;
  is_visible?: boolean;
  is_mandatory?: boolean;
  is_editable?: boolean;
  display_order?: number;
  placeholder?: string | null;
  help_text?: string | null;
  validation_regex?: string | null;
  validation_message?: string | null;
  options?: Array<{ value: string; label: string }> | null;
  default_value?: string | null;
}

export function useUpsertFormField() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (field: FieldConfigInput) => {
      if (field.id) {
        const { id, ...updates } = field;
        const { error } = await supabase
          .from('form_field_configs')
          .update(updates as never)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('form_field_configs').insert(field as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-field-configs'] });
      toast({ title: 'Field saved' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useReorderFormSteps() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; step_order: number }>) => {
      // Update each in parallel; small N so this is fine
      const results = await Promise.all(
        items.map((it) =>
          supabase.from('form_step_configs').update({ step_order: it.step_order }).eq('id', it.id),
        ),
      );
      const firstErr = results.find((r) => r.error);
      if (firstErr?.error) throw firstErr.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form-step-configs'] }),
    onError: (e: Error) => toast({ title: 'Reorder failed', description: e.message, variant: 'destructive' }),
  });
}

export function useReorderFormFields() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; display_order: number }>) => {
      const results = await Promise.all(
        items.map((it) =>
          supabase.from('form_field_configs').update({ display_order: it.display_order }).eq('id', it.id),
        ),
      );
      const firstErr = results.find((r) => r.error);
      if (firstErr?.error) throw firstErr.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form-field-configs'] }),
    onError: (e: Error) => toast({ title: 'Reorder failed', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteFormField() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('form_field_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-field-configs'] });
      toast({ title: 'Field removed' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}
