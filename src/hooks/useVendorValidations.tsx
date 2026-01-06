import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ValidationResult } from '@/types/vendor';

interface RunValidationsOptions {
  vendorId: string;
  gstin?: string | null;
  pan?: string | null;
  legalName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  msmeNumber?: string | null;
}

export function useRunValidations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: RunValidationsOptions) => {
      const { vendorId, gstin, pan, legalName, accountNumber, ifscCode, msmeNumber } = options;
      const validationResults: ValidationResult[] = [];

      // Clear existing validations first
      await supabase
        .from('vendor_validations')
        .delete()
        .eq('vendor_id', vendorId);

      // Run GST validation
      try {
        const response = await supabase.functions.invoke('validate-gst', {
          body: { gstin, legalName },
        });
        
        const result: ValidationResult = {
          type: 'gst',
          status: response.data?.valid ? 'passed' : 'failed',
          message: response.data?.message || 'GST validation completed',
          timestamp: new Date().toISOString(),
        };
        validationResults.push(result);

        await supabase.from('vendor_validations').insert({
          vendor_id: vendorId,
          validation_type: 'gst',
          status: result.status,
          message: result.message,
          details: response.data,
        });
      } catch {
        validationResults.push({
          type: 'gst',
          status: 'failed',
          message: 'GST validation service unavailable',
          timestamp: new Date().toISOString(),
        });
      }

      // Run PAN validation
      try {
        const response = await supabase.functions.invoke('validate-pan', {
          body: { pan, name: legalName },
        });
        
        const result: ValidationResult = {
          type: 'pan',
          status: response.data?.valid ? 'passed' : 'failed',
          message: response.data?.message || 'PAN validation completed',
          timestamp: new Date().toISOString(),
        };
        validationResults.push(result);

        await supabase.from('vendor_validations').insert({
          vendor_id: vendorId,
          validation_type: 'pan',
          status: result.status,
          message: result.message,
          details: response.data,
        });
      } catch {
        validationResults.push({
          type: 'pan',
          status: 'failed',
          message: 'PAN validation service unavailable',
          timestamp: new Date().toISOString(),
        });
      }

      // Run Name Match validation
      try {
        const response = await supabase.functions.invoke('validate-name-match', {
          body: { 
            vendorName: legalName,
            gstLegalName: legalName, // Would come from GST API response
            threshold: 80,
          },
        });
        
        const result: ValidationResult = {
          type: 'name_match',
          status: response.data?.valid ? 'passed' : 'failed',
          message: response.data?.message || 'Name match validation completed',
          timestamp: new Date().toISOString(),
        };
        validationResults.push(result);

        await supabase.from('vendor_validations').insert({
          vendor_id: vendorId,
          validation_type: 'name_match',
          status: result.status,
          message: result.message,
          details: response.data,
        });
      } catch {
        validationResults.push({
          type: 'name_match',
          status: 'failed',
          message: 'Name match validation failed',
          timestamp: new Date().toISOString(),
        });
      }

      // Run Bank validation
      try {
        const response = await supabase.functions.invoke('validate-bank', {
          body: { 
            accountNumber, 
            ifscCode,
            accountHolderName: legalName,
          },
        });
        
        const result: ValidationResult = {
          type: 'bank',
          status: response.data?.valid ? 'passed' : 'failed',
          message: response.data?.message || 'Bank verification completed',
          timestamp: new Date().toISOString(),
        };
        validationResults.push(result);

        await supabase.from('vendor_validations').insert({
          vendor_id: vendorId,
          validation_type: 'bank',
          status: result.status,
          message: result.message,
          details: response.data,
        });
      } catch {
        validationResults.push({
          type: 'bank',
          status: 'failed',
          message: 'Bank validation service unavailable',
          timestamp: new Date().toISOString(),
        });
      }

      // Run MSME validation if provided
      if (msmeNumber) {
        try {
          const response = await supabase.functions.invoke('validate-msme', {
            body: { msmeNumber },
          });
          
          const result: ValidationResult = {
            type: 'msme',
            status: response.data?.valid ? 'passed' : 'failed',
            message: response.data?.message || 'MSME validation completed',
            timestamp: new Date().toISOString(),
          };
          validationResults.push(result);

          await supabase.from('vendor_validations').insert({
            vendor_id: vendorId,
            validation_type: 'msme',
            status: result.status,
            message: result.message,
            details: response.data,
          });
        } catch {
          validationResults.push({
            type: 'msme',
            status: 'failed',
            message: 'MSME validation service unavailable',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        const result: ValidationResult = {
          type: 'msme',
          status: 'skipped',
          message: 'MSME not provided',
          timestamp: new Date().toISOString(),
        };
        validationResults.push(result);

        await supabase.from('vendor_validations').insert({
          vendor_id: vendorId,
          validation_type: 'msme',
          status: 'skipped',
          message: result.message,
        });
      }

      // Determine overall status
      const hasFailures = validationResults.some(r => r.status === 'failed');
      const newStatus = hasFailures ? 'validation_failed' : 'finance_review';

      await supabase
        .from('vendors')
        .update({ status: newStatus })
        .eq('id', vendorId);

      // Log the validation run
      await supabase.from('audit_logs').insert({
        vendor_id: vendorId,
        action: 'validations_run',
        details: { 
          results: validationResults.map(r => ({ type: r.type, status: r.status })),
          triggered_by: 'manual',
        },
      });

      return validationResults;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-validations'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      
      toast({
        title: 'Validations Complete',
        description: `${passed} passed, ${failed} failed out of ${results.length} validations`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Validation Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
