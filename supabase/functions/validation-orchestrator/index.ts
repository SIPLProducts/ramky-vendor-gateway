import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationConfig {
  id: string;
  validation_type: string;
  display_name: string;
  is_enabled: boolean;
  is_mandatory: boolean;
  execution_stage: string;
  matching_threshold: number | null;
  retry_count: number;
  timeout_seconds: number;
  priority_order: number;
  schedule_frequency_days: number | null;
}

interface VendorData {
  id: string;
  gstin: string | null;
  pan: string | null;
  legal_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  msme_number: string | null;
  is_gst_registered: boolean | null;
  is_msme_registered: boolean | null;
}

interface ValidationResult {
  type: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  message: string;
  details?: Record<string, unknown>;
  executionTimeMs?: number;
}

// deno-lint-ignore no-explicit-any
async function runValidationWithRetry(
  supabase: any,
  config: ValidationConfig,
  vendorData: VendorData,
  functionName: string,
  payload: Record<string, unknown>
): Promise<ValidationResult> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= config.retry_count; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });
      
      if (error) throw error;
      
      const executionTimeMs = Date.now() - startTime;
      
      // Log the API call
      await supabase.from('validation_api_logs').insert({
        vendor_id: vendorData.id,
        validation_type: config.validation_type,
        api_provider: functionName,
        request_payload: payload,
        response_payload: data,
        response_status: 200,
        execution_time_ms: executionTimeMs,
        is_success: data?.valid === true,
      });
      
      return {
        type: config.validation_type,
        status: data?.valid ? 'passed' : 'failed',
        message: data?.message || `${config.display_name} completed`,
        details: data,
        executionTimeMs,
      };
    } catch (err) {
      lastError = err as Error;
      console.log(`Attempt ${attempt}/${config.retry_count} failed for ${functionName}:`, err);
      
      if (attempt < config.retry_count) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  // All retries failed
  const executionTimeMs = Date.now() - startTime;
  await supabase.from('validation_api_logs').insert({
    vendor_id: vendorData.id,
    validation_type: config.validation_type,
    api_provider: functionName,
    request_payload: payload,
    response_status: 500,
    execution_time_ms: executionTimeMs,
    is_success: false,
    error_message: lastError?.message || 'Unknown error',
  });
  
  return {
    type: config.validation_type,
    status: 'failed',
    message: `${config.display_name} service unavailable after ${config.retry_count} attempts`,
    executionTimeMs,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { vendorId, executionStage = 'ON_SUBMIT' } = await req.json();
    
    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: 'vendorId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Starting validation orchestration for vendor: ${vendorId}, stage: ${executionStage}`);
    
    // Fetch vendor data
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();
    
    if (vendorError || !vendor) {
      return new Response(
        JSON.stringify({ error: 'Vendor not found', details: vendorError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch enabled validation configs
    const { data: configs, error: configError } = await supabase
      .from('validation_configs')
      .select('*')
      .eq('is_enabled', true)
      .or(`execution_stage.eq.${executionStage},execution_stage.eq.BOTH`)
      .order('priority_order', { ascending: true });
    
    if (configError) {
      console.error('Error fetching configs:', configError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch validation configs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${configs?.length || 0} enabled validations`);
    
    // Clear existing validations for this vendor
    await supabase
      .from('vendor_validations')
      .delete()
      .eq('vendor_id', vendorId);
    
    const validationResults: ValidationResult[] = [];
    
    // Run validations in priority order
    for (const config of (configs || [])) {
      console.log(`Running validation: ${config.validation_type}`);
      
      let result: ValidationResult;
      
      switch (config.validation_type) {
        case 'gst':
          if (vendor.is_gst_registered === false) {
            result = { type: 'gst', status: 'skipped', message: 'Vendor declared not GST registered — self-declaration on file' };
          } else if (!vendor.gstin) {
            result = {
              type: 'gst',
              status: config.is_mandatory ? 'failed' : 'skipped',
              message: config.is_mandatory ? 'GSTIN is required' : 'GSTIN not provided',
            };
          } else {
            result = await runValidationWithRetry(
              supabase,
              config,
              vendor,
              'validate-gst',
              { gstin: vendor.gstin, legalName: vendor.legal_name }
            );
          }
          break;
          
        case 'pan':
          if (!vendor.pan) {
            result = {
              type: 'pan',
              status: config.is_mandatory ? 'failed' : 'skipped',
              message: config.is_mandatory ? 'PAN is required' : 'PAN not provided',
            };
          } else {
            result = await runValidationWithRetry(
              supabase,
              config,
              vendor,
              'validate-pan',
              { pan: vendor.pan, name: vendor.legal_name }
            );
          }
          break;
          
        case 'name_match':
          if (vendor.is_gst_registered === false) {
            result = { type: 'name_match', status: 'skipped', message: 'Vendor not GST registered — name match not applicable' };
          } else if (!vendor.legal_name || !vendor.gstin) {
            result = {
              type: 'name_match',
              status: config.is_mandatory ? 'failed' : 'skipped',
              message: 'Legal name and GSTIN required for name matching',
            };
          } else {
            result = await runValidationWithRetry(
              supabase,
              config,
              vendor,
              'validate-name-match',
              {
                vendorName: vendor.legal_name,
                gstLegalName: vendor.legal_name,
                threshold: config.matching_threshold || 80,
              }
            );
          }
          break;
          
        case 'bank':
          if (!vendor.account_number || !vendor.ifsc_code) {
            result = {
              type: 'bank',
              status: config.is_mandatory ? 'failed' : 'skipped',
              message: 'Bank account details required',
            };
          } else {
            result = await runValidationWithRetry(
              supabase,
              config,
              vendor,
              'validate-bank',
              { 
                accountNumber: vendor.account_number,
                ifscCode: vendor.ifsc_code,
                accountHolderName: vendor.legal_name,
              }
            );
          }
          break;
          
        case 'msme':
          if (vendor.is_msme_registered === false) {
            result = { type: 'msme', status: 'skipped', message: 'Vendor declared not MSME registered' };
          } else if (!vendor.msme_number) {
            result = {
              type: 'msme',
              status: config.is_mandatory ? 'failed' : 'skipped',
              message: config.is_mandatory ? 'MSME number required' : 'MSME not provided',
            };
          } else {
            result = await runValidationWithRetry(
              supabase,
              config,
              vendor,
              'validate-msme',
              { msmeNumber: vendor.msme_number, enterpriseName: vendor.legal_name }
            );
          }
          break;
          
        default:
          result = {
            type: config.validation_type,
            status: 'skipped',
            message: `Unknown validation type: ${config.validation_type}`,
          };
      }
      
      validationResults.push(result);
      
      // Store validation result
      await supabase.from('vendor_validations').insert({
        vendor_id: vendorId,
        validation_type: config.validation_type,
        status: result.status,
        message: result.message,
        details: result.details || null,
      });
    }
    
    // Determine overall status based on mandatory validations
    const mandatoryConfigs = (configs || []).filter((c: ValidationConfig) => c.is_mandatory);
    const mandatoryTypes = mandatoryConfigs.map((c: ValidationConfig) => c.validation_type);
    const mandatoryResults = validationResults.filter(r => mandatoryTypes.includes(r.type));
    const hasMandatoryFailures = mandatoryResults.some(r => r.status === 'failed');
    
    const newStatus = hasMandatoryFailures ? 'validation_failed' : 'finance_review';
    
    await supabase
      .from('vendors')
      .update({ status: newStatus })
      .eq('id', vendorId);
    
    // Log the validation run
    await supabase.from('audit_logs').insert({
      vendor_id: vendorId,
      action: 'validations_orchestrated',
      details: {
        execution_stage: executionStage,
        results: validationResults.map(r => ({ type: r.type, status: r.status })),
        new_status: newStatus,
        mandatory_failures: hasMandatoryFailures,
      },
    });
    
    // Schedule periodic validations if configured
    const periodicConfigs = (configs || []).filter(
      (c: ValidationConfig) => c.execution_stage === 'SCHEDULED' || c.execution_stage === 'BOTH'
    );
    
    for (const config of periodicConfigs) {
      if (config.schedule_frequency_days) {
        const nextRun = new Date();
        nextRun.setDate(nextRun.getDate() + config.schedule_frequency_days);
        
        await supabase.from('scheduled_validations').upsert({
          vendor_id: vendorId,
          validation_type: config.validation_type,
          next_run_at: nextRun.toISOString(),
          is_active: true,
        }, { onConflict: 'vendor_id,validation_type' });
      }
    }
    
    console.log(`Validation orchestration complete. Status: ${newStatus}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        results: validationResults,
        overallStatus: newStatus,
        summary: {
          total: validationResults.length,
          passed: validationResults.filter(r => r.status === 'passed').length,
          failed: validationResults.filter(r => r.status === 'failed').length,
          skipped: validationResults.filter(r => r.status === 'skipped').length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Orchestration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});