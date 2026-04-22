import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export type AppRole = 'vendor' | 'finance' | 'purchase' | 'admin' | 'sharvi_admin' | 'customer_admin' | 'approver';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantBranding {
  id: string;
  tenant_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  company_name: string | null;
  tagline: string | null;
  footer_text: string | null;
  help_email: string | null;
  help_phone: string | null;
  terms_url: string | null;
  privacy_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiProvider {
  id: string;
  tenant_id: string | null;
  provider_name: string;
  display_name: string;
  is_enabled: boolean;
  is_mandatory: boolean;
  execution_order: number;
  base_url: string;
  endpoint_path: string;
  http_method: string;
  auth_type: string;
  auth_header_name: string;
  auth_header_prefix: string;
  request_headers: Json;
  request_body_template: Json;
  response_success_path: string | null;
  response_success_value: string;
  response_message_path: string | null;
  response_data_mapping: Json;
  timeout_seconds: number;
  retry_count: number;
  retry_delay_ms: number;
  schedule_enabled: boolean;
  schedule_frequency_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface FormFieldConfig {
  id: string;
  tenant_id: string | null;
  step_name: string;
  field_name: string;
  display_label: string;
  field_type: string;
  is_visible: boolean;
  is_mandatory: boolean;
  is_editable: boolean;
  display_order: number;
  placeholder: string | null;
  help_text: string | null;
  validation_regex: string | null;
  validation_message: string | null;
  options: Array<{ value: string; label: string }> | null;
  default_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflow {
  id: string;
  tenant_id: string;
  workflow_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  step_name: string;
  required_role: AppRole;
  is_mandatory: boolean;
  can_reject: boolean;
  can_request_info: boolean;
  auto_approve_after_days: number | null;
  notify_on_pending: boolean;
  notify_on_complete: boolean;
  created_at: string;
}

// Fetch users belonging to a tenant, with their primary role
export interface TenantUserWithRole {
  user_id: string;
  full_name: string | null;
  email: string;
  role: AppRole | null;
}

export function useTenantUsersWithRoles(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ['tenant-users-with-roles', tenantId],
    queryFn: async (): Promise<TenantUserWithRole[]> => {
      if (!tenantId) return [];
      const { data: links, error: linkErr } = await supabase
        .from('user_tenants')
        .select('user_id')
        .eq('tenant_id', tenantId);
      if (linkErr) throw linkErr;
      const ids = (links ?? []).map((l) => l.user_id);
      if (ids.length === 0) return [];

      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('id', ids),
        supabase.from('user_roles').select('user_id, role').in('user_id', ids),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;

      const roleByUser = new Map<string, AppRole>();
      (roles ?? []).forEach((r) => {
        if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role as AppRole);
      });

      return (profiles ?? []).map((p) => ({
        user_id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: roleByUser.get(p.id) ?? null,
      })).sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
    },
    enabled: !!tenantId,
  });
}

// Fetch all profiles with their primary role (admin-only via RLS)
export function useAllProfilesWithRoles() {
  return useQuery({
    queryKey: ['all-profiles-with-roles'],
    queryFn: async (): Promise<TenantUserWithRole[]> => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').order('full_name'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;

      const roleByUser = new Map<string, AppRole>();
      (roles ?? []).forEach((r) => {
        if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role as AppRole);
      });

      return (profiles ?? []).map((p) => ({
        user_id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: roleByUser.get(p.id) ?? null,
      }));
    },
  });
}

// Fetch user counts per tenant (for tenant dropdown annotation)
export function useTenantUserCounts() {
  return useQuery({
    queryKey: ['tenant-user-counts'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('user_tenants').select('tenant_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        counts[r.tenant_id] = (counts[r.tenant_id] ?? 0) + 1;
      });
      return counts;
    },
  });
}

// Fetch all tenants
export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Tenant[];
    },
  });
}

// Fetch tenant branding
export function useTenantBranding(tenantId: string | null) {
  return useQuery({
    queryKey: ['tenant-branding', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as TenantBranding | null;
    },
    enabled: !!tenantId,
  });
}

// Create tenant
export function useCreateTenant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tenant: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tenants')
        .insert(tenant)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-companies'] });
      toast({ title: 'Tenant Created', description: 'New buyer company has been created.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Update tenant
export function useUpdateTenant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tenant> & { id: string }) => {
      const { data, error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-companies'] });
      toast({ title: 'Tenant Updated', description: 'Buyer company has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Delete tenant
export function useDeleteTenant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-companies'] });
      toast({ title: 'Tenant Deleted', description: 'Buyer company has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Update tenant branding
export function useUpdateTenantBranding() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tenantId, branding }: { tenantId: string; branding: Partial<TenantBranding> }) => {
      const { data: existing } = await supabase
        .from('tenant_branding')
        .select('id')
        .eq('tenant_id', tenantId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('tenant_branding')
          .update(branding)
          .eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_branding')
          .insert({ tenant_id: tenantId, ...branding });
        if (error) throw error;
      }
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-branding', tenantId] });
      toast({ title: 'Branding Updated', description: 'Tenant branding has been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Fetch API providers
export function useApiProviders(tenantId?: string | null) {
  return useQuery({
    queryKey: ['api-providers', tenantId],
    queryFn: async () => {
      let query = supabase
        .from('api_providers')
        .select('*')
        .order('execution_order');
      
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ApiProvider[];
    },
  });
}

// Create/Update API provider
export function useUpsertApiProvider() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (provider: {
      id?: string;
      tenant_id?: string | null;
      provider_name: string;
      display_name: string;
      base_url: string;
      endpoint_path: string;
      is_enabled?: boolean;
      is_mandatory?: boolean;
      execution_order?: number;
      http_method?: string;
      auth_type?: string;
      auth_header_name?: string;
      auth_header_prefix?: string;
      request_headers?: Json;
      request_body_template?: Json;
      response_success_path?: string | null;
      response_success_value?: string;
      response_message_path?: string | null;
      response_data_mapping?: Json;
      timeout_seconds?: number;
      retry_count?: number;
      retry_delay_ms?: number;
      schedule_enabled?: boolean;
      schedule_frequency_days?: number | null;
    }) => {
      if (provider.id) {
        const { id, ...updates } = provider;
        const { error } = await supabase
          .from('api_providers')
          .update(updates as never)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('api_providers')
          .insert(provider as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-providers'] });
      toast({ title: 'API Provider Saved', description: 'Configuration has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Fetch form field configs
export function useFormFieldConfigs(tenantId?: string | null, stepName?: string) {
  return useQuery({
    queryKey: ['form-field-configs', tenantId, stepName],
    queryFn: async () => {
      let query = supabase
        .from('form_field_configs')
        .select('*')
        .order('display_order');
      
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      if (stepName) {
        query = query.eq('step_name', stepName);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as FormFieldConfig[];
    },
  });
}

// Update form field config
export function useUpdateFormFieldConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Partial<FormFieldConfig> & { id: string }) => {
      const { id, ...updates } = config;
      const { error } = await supabase
        .from('form_field_configs')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-field-configs'] });
      toast({ title: 'Field Updated', description: 'Form field configuration saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Fetch approval workflows
export function useApprovalWorkflows(tenantId?: string) {
  return useQuery({
    queryKey: ['approval-workflows', tenantId],
    queryFn: async () => {
      let query = supabase
        .from('approval_workflows')
        .select(`
          *,
          approval_workflow_steps (*)
        `)
        .order('created_at');
      
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (ApprovalWorkflow & { approval_workflow_steps: ApprovalWorkflowStep[] })[];
    },
    enabled: !!tenantId,
  });
}

// Create/Update approval workflow
export function useUpsertApprovalWorkflow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      workflow, 
      steps 
    }: { 
      workflow: Partial<ApprovalWorkflow> & { tenant_id: string; workflow_name: string }; 
      steps: {
        step_order: number;
        step_name: string;
        required_role: AppRole;
        is_mandatory: boolean;
        can_reject: boolean;
        can_request_info: boolean;
        auto_approve_after_days: number | null;
        notify_on_pending: boolean;
        notify_on_complete: boolean;
      }[];
    }) => {
      let workflowId = workflow.id;

      if (workflowId) {
        const { error } = await supabase
          .from('approval_workflows')
          .update({ workflow_name: workflow.workflow_name, is_active: workflow.is_active })
          .eq('id', workflowId);
        if (error) throw error;

        // Delete existing steps and recreate
        await supabase.from('approval_workflow_steps').delete().eq('workflow_id', workflowId);
      } else {
        const { data, error } = await supabase
          .from('approval_workflows')
          .insert({ tenant_id: workflow.tenant_id, workflow_name: workflow.workflow_name, is_active: workflow.is_active ?? true })
          .select()
          .single();
        if (error) throw error;
        workflowId = data.id;
      }

      // Insert steps
      if (steps.length > 0 && workflowId) {
        const stepsToInsert = steps.map(step => ({ 
          ...step, 
          workflow_id: workflowId as string
        }));
        const { error } = await supabase.from('approval_workflow_steps').insert(stepsToInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] });
      toast({ title: 'Workflow Saved', description: 'Approval workflow has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
