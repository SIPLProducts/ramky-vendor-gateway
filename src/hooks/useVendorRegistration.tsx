import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VendorFormData, ValidationResult, VendorStatus } from '@/types/vendor';

interface UseVendorRegistrationOptions {
  invitationToken?: string;
}

// Statuses that allow editing
const EDITABLE_STATUSES: VendorStatus[] = ['draft', 'validation_failed', 'finance_rejected'];

export function useVendorRegistration(options?: UseVendorRegistrationOptions) {
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorStatus, setVendorStatus] = useState<VendorStatus | null>(null);

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
  const { data: invitation } = useQuery({
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

  // Fetch existing vendor data for the current user
  const { data: existingVendor, isLoading: isLoadingVendor, refetch: refetchVendor } = useQuery({
    queryKey: ['existing-vendor'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Check if vendor can edit their registration
  const canEdit = vendorStatus ? EDITABLE_STATUSES.includes(vendorStatus) : true;

  // Convert database vendor to form data - memoized to prevent infinite loops
  const existingFormData = useMemo<VendorFormData | null>(() => {
    if (!existingVendor) return null;
    
    return {
      organization: {
        legalName: existingVendor.legal_name || '',
        tradeName: existingVendor.trade_name || '',
        industryType: existingVendor.industry_type || '',
        organizationType: existingVendor.entity_type || '',
        ownershipType: '',
        productCategories: existingVendor.product_categories || [],
      },
      address: {
        registeredAddress: existingVendor.registered_address || '',
        registeredAddressLine2: '',
        registeredAddressLine3: '',
        registeredCity: existingVendor.registered_city || '',
        registeredState: existingVendor.registered_state || '',
        registeredPincode: existingVendor.registered_pincode || '',
        registeredPhone: '',
        registeredFax: '',
        registeredWebsite: '',
        sameAsRegistered: existingVendor.same_as_registered ?? true,
        manufacturingAddress: '',
        manufacturingAddressLine2: '',
        manufacturingAddressLine3: '',
        manufacturingCity: '',
        manufacturingState: '',
        manufacturingPincode: '',
        manufacturingPhone: '',
        manufacturingFax: '',
        branchName: '',
        branchAddress: '',
        branchCity: '',
        branchState: '',
        branchPincode: '',
        branchCountry: 'India',
        branchWebsite: '',
        branchContactName: '',
        branchContactDesignation: '',
        branchContactEmail: '',
        branchContactPhone: '',
        branchContactFax: '',
      },
      contact: {
        ceoName: existingVendor.primary_contact_name || '',
        ceoDesignation: existingVendor.primary_designation || '',
        ceoPhone: existingVendor.primary_phone || '',
        ceoEmail: existingVendor.primary_email || '',
        marketingName: existingVendor.secondary_contact_name || '',
        marketingDesignation: existingVendor.secondary_designation || '',
        marketingPhone: existingVendor.secondary_phone || '',
        marketingEmail: existingVendor.secondary_email || '',
        productionName: '',
        productionDesignation: '',
        productionPhone: '',
        productionEmail: '',
        customerServiceName: '',
        customerServiceDesignation: '',
        customerServicePhone: '',
        customerServiceEmail: '',
      },
      statutory: {
        firmRegistrationNo: '',
        pan: existingVendor.pan || '',
        pfNumber: '',
        esiNumber: '',
        msmeNumber: existingVendor.msme_number || '',
        msmeCategory: (existingVendor.msme_category as 'micro' | 'small' | 'medium' | '') || '',
        labourPermitNo: '',
        gstin: existingVendor.gstin || '',
        iecNo: '',
        entityType: existingVendor.entity_type || '',
        memberships: [],
        enlistments: [],
        certifications: [],
        operationalNetwork: '',
        gstCertificateFile: null,
        panCardFile: null,
        msmeCertificateFile: null,
      },
      bank: {
        bankName: existingVendor.bank_name || '',
        branchName: existingVendor.branch_name || '',
        accountNumber: existingVendor.account_number || '',
        confirmAccountNumber: existingVendor.account_number || '',
        accountType: (existingVendor.account_type as 'current' | 'savings' | 'cash_credit' | 'others') || 'current',
        accountTypeOther: '',
        ifscCode: existingVendor.ifsc_code || '',
        micrCode: '',
        bankAddress: '',
        cancelledChequeFile: null,
      },
      financial: {
        turnoverYear1: existingVendor.turnover_year1?.toString() || '',
        turnoverYear2: existingVendor.turnover_year2?.toString() || '',
        turnoverYear3: existingVendor.turnover_year3?.toString() || '',
        creditPeriodExpected: existingVendor.credit_period_expected?.toString() || '',
        majorCustomer1: '',
        majorCustomer2: '',
        majorCustomer3: '',
        authorizedDistributorName: '',
        authorizedDistributorAddress: '',
        dealershipCertificateFile: null,
        financialDocsFile: null,
      },
      infrastructure: {
        rawMaterialsUsed: '',
        machineryAvailability: '',
        equipmentAvailability: '',
        powerSupply: '',
        waterSupply: '',
        dgCapacity: '',
        productionCapacity: '',
        storeCapacity: '',
        supplyCapacity: '',
        manpower: '',
        inspectionTesting: '',
        nearestRailway: '',
        nearestBusStation: '',
        nearestAirport: '',
        nearestPort: '',
        productTypes: [],
        productTypesOther: '',
        productionFacilities: [],
        leadTimeRequired: '',
      },
      qhse: {
        qualityIssues: '',
        healthIssues: '',
        environmentalIssues: '',
        safetyIssues: '',
      },
      declaration: {
        selfDeclared: existingVendor.self_declared ?? false,
        termsAccepted: existingVendor.terms_accepted ?? false,
      },
    };
  }, [existingVendor]);

  // Create or update vendor
  const saveVendorMutation = useMutation({
    mutationFn: async (formData: VendorFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const vendorData = {
        user_id: user.id,
        legal_name: formData.organization.legalName,
        trade_name: formData.organization.tradeName || null,
        registered_address: formData.address.registeredAddress,
        registered_city: formData.address.registeredCity,
        registered_state: formData.address.registeredState,
        registered_pincode: formData.address.registeredPincode,
        communication_address: formData.address.sameAsRegistered 
          ? formData.address.registeredAddress 
          : formData.address.manufacturingAddress,
        communication_city: formData.address.sameAsRegistered 
          ? formData.address.registeredCity 
          : formData.address.manufacturingCity,
        communication_state: formData.address.sameAsRegistered 
          ? formData.address.registeredState 
          : formData.address.manufacturingState,
        communication_pincode: formData.address.sameAsRegistered 
          ? formData.address.registeredPincode 
          : formData.address.manufacturingPincode,
        same_as_registered: formData.address.sameAsRegistered,
        industry_type: formData.organization.industryType,
        product_categories: formData.organization.productCategories,
        primary_contact_name: formData.contact.ceoName,
        primary_designation: formData.contact.ceoDesignation,
        primary_email: formData.contact.ceoEmail,
        primary_phone: formData.contact.ceoPhone,
        secondary_contact_name: formData.contact.marketingName || null,
        secondary_designation: formData.contact.marketingDesignation || null,
        secondary_email: formData.contact.marketingEmail || null,
        secondary_phone: formData.contact.marketingPhone || null,
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
        const { data, error } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', vendorId)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
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
      const vendor = await saveVendorMutation.mutateAsync(formData);
      
      const { error: updateError } = await supabase
        .from('vendors')
        .update({ 
          status: 'validation_pending' as const,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);
      
      if (updateError) throw updateError;

      await supabase.from('audit_logs').insert({
        vendor_id: vendor.id,
        action: 'vendor_submitted',
        details: { submitted_by: vendor.user_id },
      });

      setVendorStatus('validation_pending');
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

  // Resubmit vendor after editing
  const resubmitVendorMutation = useMutation({
    mutationFn: async (formData: VendorFormData) => {
      if (!vendorId) throw new Error('No vendor to resubmit');
      if (!canEdit) throw new Error('Vendor cannot be edited in current status');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const vendorData = {
        legal_name: formData.organization.legalName,
        trade_name: formData.organization.tradeName || null,
        registered_address: formData.address.registeredAddress,
        registered_city: formData.address.registeredCity,
        registered_state: formData.address.registeredState,
        registered_pincode: formData.address.registeredPincode,
        communication_address: formData.address.sameAsRegistered 
          ? formData.address.registeredAddress 
          : formData.address.manufacturingAddress,
        communication_city: formData.address.sameAsRegistered 
          ? formData.address.registeredCity 
          : formData.address.manufacturingCity,
        communication_state: formData.address.sameAsRegistered 
          ? formData.address.registeredState 
          : formData.address.manufacturingState,
        communication_pincode: formData.address.sameAsRegistered 
          ? formData.address.registeredPincode 
          : formData.address.manufacturingPincode,
        same_as_registered: formData.address.sameAsRegistered,
        industry_type: formData.organization.industryType,
        product_categories: formData.organization.productCategories,
        primary_contact_name: formData.contact.ceoName,
        primary_designation: formData.contact.ceoDesignation,
        primary_email: formData.contact.ceoEmail,
        primary_phone: formData.contact.ceoPhone,
        secondary_contact_name: formData.contact.marketingName || null,
        secondary_designation: formData.contact.marketingDesignation || null,
        secondary_email: formData.contact.marketingEmail || null,
        secondary_phone: formData.contact.marketingPhone || null,
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
        status: 'validation_pending' as const,
        submitted_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('vendors')
        .update(vendorData)
        .eq('id', vendorId)
        .select()
        .single();
      
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        vendor_id: vendorId,
        action: 'vendor_resubmitted',
        details: { resubmitted_by: user.id, previous_status: vendorStatus },
      });

      setVendorStatus('validation_pending');
      await refetchVendor();
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Registration Resubmitted',
        description: 'Your updated registration has been submitted for verification.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Resubmission Failed',
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
            message: response.data?.message || 'Bank validation completed',
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

      // Check validation results
      const hasFailedMandatory = validationResults.some(
        r => r.status === 'failed' && ['gst', 'pan', 'bank'].includes(r.type)
      );

      // Update vendor status based on validation results
      const newStatus = hasFailedMandatory ? 'validation_failed' : 'finance_review';
      
      await supabase
        .from('vendors')
        .update({ status: newStatus })
        .eq('id', vendorIdToValidate);

      setVendorStatus(newStatus);

      return validationResults;
    },
    onError: (error) => {
      toast({
        title: 'Validation Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    saveVendor: saveVendorMutation.mutateAsync,
    submitVendor: submitVendorMutation.mutateAsync,
    resubmitVendor: resubmitVendorMutation.mutateAsync,
    runValidations: runValidationsMutation.mutateAsync,
    isSaving: saveVendorMutation.isPending,
    isSubmitting: submitVendorMutation.isPending,
    isResubmitting: resubmitVendorMutation.isPending,
    isValidating: runValidationsMutation.isPending,
    vendorId,
    vendorStatus,
    existingFormData,
    isLoadingVendor,
    existingVendor,
    invitation,
    portalConfig,
    canEdit,
  };
}
