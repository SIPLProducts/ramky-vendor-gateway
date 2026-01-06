import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VendorFormData, ValidationResult } from '@/types/vendor';

interface UseVendorRegistrationOptions {
  invitationToken?: string;
}

export function useVendorRegistration(options?: UseVendorRegistrationOptions) {
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);

  // Fetch portal configuration
  const { data: portalConfig } = useQuery({
    queryKey: ['portal-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_config')
        .select('*');
      if (error) throw error;
      
      const config: Record<string, unknown> = {};
      data?.forEach((item) => {
        config[item.config_key] = item.config_value;
      });
      return config;
    },
  });

  // Validate invitation token
  const { data: invitation, isLoading: isLoadingInvitation } = useQuery({
    queryKey: ['vendor-invitation', options?.invitationToken],
    queryFn: async () => {
      if (!options?.invitationToken) return null;
      
      const { data, error } = await supabase
        .from('vendor_invitations')
        .select('*')
        .eq('token', options.invitationToken)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!options?.invitationToken,
  });

  // Create or update vendor
  const saveVendorMutation = useMutation({
    mutationFn: async (formData: VendorFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const vendorData = {
        user_id: user.id,
        legal_name: formData.organization.legalName,
        trade_name: formData.organization.tradeName || null,
        registered_address: formData.organization.registeredAddress,
        registered_city: formData.organization.registeredCity,
        registered_state: formData.organization.registeredState,
        registered_pincode: formData.organization.registeredPincode,
        communication_address: formData.organization.sameAsRegistered 
          ? formData.organization.registeredAddress 
          : formData.organization.communicationAddress,
        communication_city: formData.organization.sameAsRegistered 
          ? formData.organization.registeredCity 
          : formData.organization.communicationCity,
        communication_state: formData.organization.sameAsRegistered 
          ? formData.organization.registeredState 
          : formData.organization.communicationState,
        communication_pincode: formData.organization.sameAsRegistered 
          ? formData.organization.registeredPincode 
          : formData.organization.communicationPincode,
        same_as_registered: formData.organization.sameAsRegistered,
        industry_type: formData.organization.industryType,
        product_categories: formData.organization.productCategories,
        primary_contact_name: formData.contact.primaryContactName,
        primary_designation: formData.contact.primaryDesignation,
        primary_email: formData.contact.primaryEmail,
        primary_phone: formData.contact.primaryPhone,
        secondary_contact_name: formData.contact.secondaryContactName || null,
        secondary_designation: formData.contact.secondaryDesignation || null,
        secondary_email: formData.contact.secondaryEmail || null,
        secondary_phone: formData.contact.secondaryPhone || null,
        gstin: formData.statutory.gstin,
        pan: formData.statutory.pan,
        entity_type: formData.statutory.entityType,
        msme_number: formData.statutory.msmeNumber || null,
        msme_category: formData.statutory.msmeCategory || null,
        bank_name: formData.bank.bankName,
        account_number: formData.bank.accountNumber,
        ifsc_code: formData.bank.ifscCode,
        branch_name: formData.bank.branchName,
        account_type: formData.bank.accountType,
        turnover_year1: formData.financial.turnoverYear1 
          ? parseFloat(formData.financial.turnoverYear1.replace(/,/g, '')) 
          : null,
        turnover_year2: formData.financial.turnoverYear2 
          ? parseFloat(formData.financial.turnoverYear2.replace(/,/g, '')) 
          : null,
        turnover_year3: formData.financial.turnoverYear3 
          ? parseFloat(formData.financial.turnoverYear3.replace(/,/g, '')) 
          : null,
        credit_period_expected: formData.financial.creditPeriodExpected 
          ? parseInt(formData.financial.creditPeriodExpected) 
          : null,
        self_declared: formData.declaration.selfDeclared,
        terms_accepted: formData.declaration.termsAccepted,
        status: 'draft' as const,
      };

      if (vendorId) {
        // Update existing vendor
        const { data, error } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', vendorId)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Create new vendor
        const { data, error } = await supabase
          .from('vendors')
          .insert(vendorData)
          .select()
          .single();
        
        if (error) throw error;
        setVendorId(data.id);
        return data;
      }
    },
    onError: (error) => {
      toast({
        title: 'Error Saving Data',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Submit vendor for validation
  const submitVendorMutation = useMutation({
    mutationFn: async (formData: VendorFormData) => {
      // First save the vendor data
      const vendor = await saveVendorMutation.mutateAsync(formData);
      
      // Update status to validation_pending
      const { error: updateError } = await supabase
        .from('vendors')
        .update({ 
          status: 'validation_pending' as const,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);
      
      if (updateError) throw updateError;

      // Log the submission
      await supabase.from('audit_logs').insert({
        vendor_id: vendor.id,
        action: 'vendor_submitted',
        details: { submitted_by: vendor.user_id },
      });

      return vendor;
    },
    onSuccess: () => {
      toast({
        title: 'Registration Submitted',
        description: 'Your vendor registration has been submitted for verification.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Submission Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Run validations
  const runValidationsMutation = useMutation({
    mutationFn: async (vendorIdToValidate: string) => {
      const validationResults: ValidationResult[] = [];
      const { data: vendor } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorIdToValidate)
        .single();

      if (!vendor) throw new Error('Vendor not found');

      // Run GST validation
      if (portalConfig?.enable_gst_validation !== false) {
        try {
          const response = await supabase.functions.invoke('validate-gst', {
            body: { gstin: vendor.gstin, legalName: vendor.legal_name },
          });
          
          const result: ValidationResult = {
            type: 'gst',
            status: response.data?.valid ? 'passed' : 'failed',
            message: response.data?.message || 'GST validation completed',
            timestamp: new Date().toISOString(),
          };
          validationResults.push(result);

          // Save to database
          await supabase.from('vendor_validations').insert({
            vendor_id: vendorIdToValidate,
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
      }

      // Run PAN validation
      if (portalConfig?.enable_pan_validation !== false) {
        try {
          const response = await supabase.functions.invoke('validate-pan', {
            body: { pan: vendor.pan, name: vendor.legal_name },
          });
          
          const result: ValidationResult = {
            type: 'pan',
            status: response.data?.valid ? 'passed' : 'failed',
            message: response.data?.message || 'PAN validation completed',
            timestamp: new Date().toISOString(),
          };
          validationResults.push(result);

          await supabase.from('vendor_validations').insert({
            vendor_id: vendorIdToValidate,
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
      }

      // Run Bank validation
      if (portalConfig?.enable_bank_validation !== false) {
        try {
          const response = await supabase.functions.invoke('validate-bank', {
            body: { 
              accountNumber: vendor.account_number, 
              ifscCode: vendor.ifsc_code,
              accountHolderName: vendor.legal_name,
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
            vendor_id: vendorIdToValidate,
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
      }

      // Run Name Match validation
      if (portalConfig?.enable_name_match_validation !== false) {
        try {
          const response = await supabase.functions.invoke('validate-name-match', {
            body: { 
              vendorName: vendor.legal_name,
              gstLegalName: vendor.legal_name, // This would come from GST API
              threshold: portalConfig?.name_match_threshold || 80,
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
            vendor_id: vendorIdToValidate,
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
      }

      // Run MSME validation if provided
      if (vendor.msme_number && portalConfig?.enable_msme_validation !== false) {
        try {
          const response = await supabase.functions.invoke('validate-msme', {
            body: { msmeNumber: vendor.msme_number },
          });
          
          const result: ValidationResult = {
            type: 'msme',
            status: response.data?.valid ? 'passed' : 'failed',
            message: response.data?.message || 'MSME validation completed',
            timestamp: new Date().toISOString(),
          };
          validationResults.push(result);

          await supabase.from('vendor_validations').insert({
            vendor_id: vendorIdToValidate,
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
      } else if (!vendor.msme_number) {
        validationResults.push({
          type: 'msme',
          status: 'skipped',
          message: 'MSME not provided',
          timestamp: new Date().toISOString(),
        });
      }

      // Determine overall status
      const hasFailures = validationResults.some(r => r.status === 'failed');
      const newStatus = hasFailures ? 'validation_failed' : 'finance_review';

      await supabase
        .from('vendors')
        .update({ status: newStatus })
        .eq('id', vendorIdToValidate);

      return validationResults;
    },
  });

  return {
    vendorId,
    invitation,
    isLoadingInvitation,
    portalConfig,
    saveVendor: saveVendorMutation.mutateAsync,
    submitVendor: submitVendorMutation.mutateAsync,
    runValidations: runValidationsMutation.mutateAsync,
    isSaving: saveVendorMutation.isPending,
    isSubmitting: submitVendorMutation.isPending,
    isValidating: runValidationsMutation.isPending,
  };
}