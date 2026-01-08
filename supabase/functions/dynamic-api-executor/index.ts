import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApiProvider {
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
  request_headers: Record<string, string>;
  request_body_template: Record<string, unknown>;
  response_success_path: string | null;
  response_success_value: string;
  response_message_path: string | null;
  response_data_mapping: Record<string, string>;
  timeout_seconds: number;
  retry_count: number;
  retry_delay_ms: number;
}

interface ApiCredential {
  credential_name: string;
  credential_value: string;
}

interface VendorData {
  id: string;
  gstin: string | null;
  pan: string | null;
  legal_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  msme_number: string | null;
  tenant_id: string | null;
}

interface ValidationResult {
  provider_name: string;
  display_name: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  message: string;
  is_mandatory: boolean;
  response_data: Record<string, unknown> | null;
  execution_time_ms: number;
}

// Helper to get nested value from object using dot notation
function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const keys = path.split('.');
  let result: unknown = obj;
  for (const key of keys) {
    if (result === null || result === undefined) return undefined;
    result = (result as Record<string, unknown>)[key];
  }
  return result;
}

// Helper to replace placeholders in template with vendor data
function replacePlaceholders(template: unknown, vendorData: VendorData, credentials: ApiCredential[]): unknown {
  const json = JSON.stringify(template);
  
  let result = json
    .replace(/\{\{gstin\}\}/g, vendorData.gstin || '')
    .replace(/\{\{pan\}\}/g, vendorData.pan || '')
    .replace(/\{\{legal_name\}\}/g, vendorData.legal_name || '')
    .replace(/\{\{bank_name\}\}/g, vendorData.bank_name || '')
    .replace(/\{\{account_number\}\}/g, vendorData.account_number || '')
    .replace(/\{\{ifsc_code\}\}/g, vendorData.ifsc_code || '')
    .replace(/\{\{msme_number\}\}/g, vendorData.msme_number || '')
    .replace(/\{\{vendor_id\}\}/g, vendorData.id);
  
  // Replace credential placeholders
  for (const cred of credentials) {
    const regex = new RegExp(`\\{\\{${cred.credential_name}\\}\\}`, 'g');
    result = result.replace(regex, cred.credential_value);
  }
  
  return JSON.parse(result);
}

// Execute a single API call with retry logic
async function executeApiCall(
  provider: ApiProvider,
  vendorData: VendorData,
  credentials: ApiCredential[],
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<ValidationResult> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= provider.retry_count; attempt++) {
    try {
      // Build request URL
      const url = `${provider.base_url}${provider.endpoint_path}`;
      
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...provider.request_headers,
      };
      
      // Add auth header
      if (provider.auth_type === 'API_KEY' || provider.auth_type === 'BEARER_TOKEN') {
        const apiKey = credentials.find(c => c.credential_name === 'api_key')?.credential_value || '';
        headers[provider.auth_header_name] = `${provider.auth_header_prefix} ${apiKey}`.trim();
      } else if (provider.auth_type === 'BASIC') {
        const username = credentials.find(c => c.credential_name === 'username')?.credential_value || '';
        const password = credentials.find(c => c.credential_name === 'password')?.credential_value || '';
        headers[provider.auth_header_name] = `Basic ${btoa(`${username}:${password}`)}`;
      }
      
      // Build request body
      const body = provider.http_method !== 'GET' 
        ? JSON.stringify(replacePlaceholders(provider.request_body_template, vendorData, credentials))
        : undefined;
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), provider.timeout_seconds * 1000);
      
      // Make the request
      const response = await fetch(url, {
        method: provider.http_method,
        headers,
        body,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const responseData = await response.json();
      const executionTime = Date.now() - startTime;
      
      // Log the API call
      await supabase.from('validation_api_logs').insert({
        vendor_id: vendorData.id,
        validation_type: provider.provider_name,
        api_provider: provider.display_name,
        request_payload: provider.http_method !== 'GET' ? replacePlaceholders(provider.request_body_template, vendorData, []) : null,
        response_payload: responseData,
        response_status: response.status,
        execution_time_ms: executionTime,
        is_success: response.ok,
        error_message: response.ok ? null : `HTTP ${response.status}`,
      });
      
      // Check success based on configured path
      let isSuccess = response.ok;
      let message = 'Validation completed';
      
      if (provider.response_success_path) {
        const successValue = getNestedValue(responseData, provider.response_success_path);
        isSuccess = String(successValue) === provider.response_success_value;
      }
      
      if (provider.response_message_path) {
        const msgValue = getNestedValue(responseData, provider.response_message_path);
        if (msgValue) message = String(msgValue);
      }
      
      // Map response data
      const mappedData: Record<string, unknown> = {};
      for (const [internalField, responsePath] of Object.entries(provider.response_data_mapping)) {
        mappedData[internalField] = getNestedValue(responseData, responsePath);
      }
      
      return {
        provider_name: provider.provider_name,
        display_name: provider.display_name,
        status: isSuccess ? 'passed' : 'failed',
        message,
        is_mandatory: provider.is_mandatory,
        response_data: mappedData,
        execution_time_ms: executionTime,
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If not last attempt, wait before retry
      if (attempt < provider.retry_count) {
        await new Promise(resolve => setTimeout(resolve, provider.retry_delay_ms));
      }
    }
  }
  
  // All retries failed
  const executionTime = Date.now() - startTime;
  
  // Log the failed attempt
  await supabase.from('validation_api_logs').insert({
    vendor_id: vendorData.id,
    validation_type: provider.provider_name,
    api_provider: provider.display_name,
    request_payload: null,
    response_payload: null,
    response_status: null,
    execution_time_ms: executionTime,
    is_success: false,
    error_message: lastError?.message || 'Unknown error after retries',
  });
  
  return {
    provider_name: provider.provider_name,
    display_name: provider.display_name,
    status: 'error',
    message: lastError?.message || 'API call failed after retries',
    is_mandatory: provider.is_mandatory,
    response_data: null,
    execution_time_ms: executionTime,
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { vendorId, tenantId, providerNames } = await req.json();

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: 'vendorId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch vendor data
    const { data: vendorData, error: vendorError } = await supabase
      .from('vendors')
      .select('id, gstin, pan, legal_name, bank_name, account_number, ifsc_code, msme_number, tenant_id')
      .eq('id', vendorId)
      .single();

    if (vendorError || !vendorData) {
      return new Response(
        JSON.stringify({ error: 'Vendor not found', details: vendorError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine tenant ID
    const effectiveTenantId = tenantId || vendorData.tenant_id;

    // Fetch enabled API providers for this tenant
    let providersQuery = supabase
      .from('api_providers')
      .select('*')
      .eq('is_enabled', true)
      .order('execution_order');

    if (effectiveTenantId) {
      providersQuery = providersQuery.eq('tenant_id', effectiveTenantId);
    }

    // Filter by specific providers if requested
    if (providerNames && Array.isArray(providerNames) && providerNames.length > 0) {
      providersQuery = providersQuery.in('provider_name', providerNames);
    }

    const { data: providers, error: providersError } = await providersQuery;

    if (providersError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch API providers', details: providersError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!providers || providers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No API providers configured',
          results: [],
          summary: { total: 0, passed: 0, failed: 0, skipped: 0, errors: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute each provider in order
    const results: ValidationResult[] = [];
    let hasMandatoryFailure = false;

    for (const provider of providers as ApiProvider[]) {
      // Skip if previous mandatory validation failed
      if (hasMandatoryFailure && !provider.is_mandatory) {
        results.push({
          provider_name: provider.provider_name,
          display_name: provider.display_name,
          status: 'skipped',
          message: 'Skipped due to previous mandatory failure',
          is_mandatory: provider.is_mandatory,
          response_data: null,
          execution_time_ms: 0,
        });
        continue;
      }

      // Fetch credentials for this provider
      const { data: credentials } = await supabase
        .from('api_credentials')
        .select('credential_name, credential_value')
        .eq('api_provider_id', provider.id);

      const result = await executeApiCall(
        provider,
        vendorData as VendorData,
        (credentials || []) as ApiCredential[],
        supabase
      );

      results.push(result);

      // Track mandatory failures
      if (result.is_mandatory && result.status === 'failed') {
        hasMandatoryFailure = true;
      }

      // Store validation result
      await supabase.from('vendor_validations').upsert({
        vendor_id: vendorId,
        validation_type: provider.provider_name.toLowerCase() as 'gst' | 'pan' | 'bank' | 'msme' | 'name_match',
        status: result.status === 'error' ? 'failed' : result.status,
        message: result.message,
        details: result.response_data,
        validated_at: new Date().toISOString(),
      }, {
        onConflict: 'vendor_id,validation_type'
      });
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    // Update vendor status based on results
    const allMandatoryPassed = results
      .filter(r => r.is_mandatory)
      .every(r => r.status === 'passed');

    const newStatus = allMandatoryPassed ? 'finance_review' : 'validation_failed';

    await supabase
      .from('vendors')
      .update({ status: newStatus })
      .eq('id', vendorId);

    // Log audit entry
    await supabase.from('audit_logs').insert({
      vendor_id: vendorId,
      action: 'DYNAMIC_VALIDATION_EXECUTED',
      details: {
        results: summary,
        provider_count: providers.length,
        final_status: newStatus,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        vendor_id: vendorId,
        new_status: newStatus,
        results,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Dynamic API Executor error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
