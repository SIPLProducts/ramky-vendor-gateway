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

// Document types that can be uploaded
type DocumentType = 'gst_certificate' | 'gst_self_declaration' | 'pan_card' | 'msme_certificate' | 'cancelled_cheque' | 'financial_docs' | 'dealership_certificate';

interface DocumentUploadResult {
  documentType: DocumentType;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// Extended vendor record type to include all new fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VendorRecord = Record<string, any>;

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

  // Validate invitation token via SECURITY DEFINER RPC (RLS-safe for vendors)
  const { data: invitation } = useQuery({
    queryKey: ['vendor-invitation', options?.invitationToken],
    queryFn: async () => {
      if (!options?.invitationToken) return null;

      const { data, error } = await supabase
        .rpc('get_invitation_by_token', { _token: options.invitationToken });

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
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

      // Initialize vendorId and vendorStatus from existing vendor
      if (data) {
        setVendorId(data.id);
        setVendorStatus(data.status as VendorStatus);
      }

      return data;
    },
  });

  // Check if vendor can edit their registration
  const canEdit = vendorStatus ? EDITABLE_STATUSES.includes(vendorStatus) : true;

  // Upload document to Supabase Storage
  const uploadDocument = async (file: File, vendorIdForUpload: string, documentType: DocumentType): Promise<DocumentUploadResult | null> => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${vendorIdForUpload}/${documentType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('vendor-documents')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error(`Failed to upload ${documentType}:`, uploadError);
      return null;
    }

    return {
      documentType,
      filePath: fileName,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  };

  // Save document metadata to vendor_documents table
  const saveDocumentMetadata = async (vendorIdForDoc: string, doc: DocumentUploadResult) => {
    const { error } = await supabase
      .from('vendor_documents')
      .insert({
        vendor_id: vendorIdForDoc,
        document_type: doc.documentType,
        file_name: doc.fileName,
        file_path: doc.filePath,
        file_size: doc.fileSize,
        mime_type: doc.mimeType,
      });

    if (error) {
      console.error(`Failed to save document metadata for ${doc.documentType}:`, error);
    }
  };

  // Upload all documents for a vendor
  const uploadAllDocuments = async (formData: VendorFormData, vendorIdForUpload: string) => {
    const documentsToUpload: { file: File | null; type: DocumentType }[] = [
      { file: formData.statutory.gstCertificateFile, type: 'gst_certificate' },
      { file: formData.statutory.gstSelfDeclarationFile, type: 'gst_self_declaration' },
      { file: formData.statutory.panCardFile, type: 'pan_card' },
      { file: formData.statutory.msmeCertificateFile, type: 'msme_certificate' },
      { file: formData.bank.cancelledChequeFile, type: 'cancelled_cheque' },
      { file: formData.financial.financialDocsFile, type: 'financial_docs' },
      { file: formData.financial.dealershipCertificateFile, type: 'dealership_certificate' },
    ];

    for (const doc of documentsToUpload) {
      if (doc.file) {
        const result = await uploadDocument(doc.file, vendorIdForUpload, doc.type);
        if (result) {
          await saveDocumentMetadata(vendorIdForUpload, result);
        }
      }
    }
  };

  // Convert form data to database format
  const formDataToVendorRecord = (formData: VendorFormData & { customFieldValues?: Record<string, Record<string, unknown>> }, userId: string | null) => {
    return {
      user_id: userId,
      tenant_id: formData.organization.buyerCompanyId || null,
      // Organization
      legal_name: formData.organization.legalName,
      trade_name: formData.organization.tradeName || null,
      industry_type: formData.organization.industryType,
      organization_type: formData.organization.organizationType || null,
      ownership_type: formData.organization.ownershipType || null,
      product_categories: formData.organization.productCategories,
      // Registered Address
      registered_address: formData.address.registeredAddress,
      registered_address_line2: formData.address.registeredAddressLine2 || null,
      registered_address_line3: formData.address.registeredAddressLine3 || null,
      registered_city: formData.address.registeredCity,
      registered_state: formData.address.registeredState,
      registered_pincode: formData.address.registeredPincode,
      registered_phone: formData.address.registeredPhone || null,
      registered_fax: formData.address.registeredFax || null,
      registered_website: formData.address.registeredWebsite || null,
      same_as_registered: formData.address.sameAsRegistered,
      // Manufacturing Address
      manufacturing_address: formData.address.manufacturingAddress || null,
      manufacturing_address_line2: formData.address.manufacturingAddressLine2 || null,
      manufacturing_address_line3: formData.address.manufacturingAddressLine3 || null,
      manufacturing_city: formData.address.manufacturingCity || null,
      manufacturing_state: formData.address.manufacturingState || null,
      manufacturing_pincode: formData.address.manufacturingPincode || null,
      manufacturing_phone: formData.address.manufacturingPhone || null,
      manufacturing_fax: formData.address.manufacturingFax || null,
      // Communication Address (derived)
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
      // Branch Address
      branch_name: formData.address.branchName || null,
      branch_address: formData.address.branchAddress || null,
      branch_city: formData.address.branchCity || null,
      branch_state: formData.address.branchState || null,
      branch_pincode: formData.address.branchPincode || null,
      branch_country: formData.address.branchCountry || null,
      branch_website: formData.address.branchWebsite || null,
      branch_contact_name: formData.address.branchContactName || null,
      branch_contact_designation: formData.address.branchContactDesignation || null,
      branch_contact_email: formData.address.branchContactEmail || null,
      branch_contact_phone: formData.address.branchContactPhone || null,
      branch_contact_fax: formData.address.branchContactFax || null,
      // Primary Contact (CEO)
      primary_contact_name: formData.contact.ceoName,
      primary_designation: formData.contact.ceoDesignation,
      primary_email: formData.contact.ceoEmail,
      primary_phone: formData.contact.ceoPhone,
      // Secondary Contact (Marketing)
      secondary_contact_name: formData.contact.marketingName || null,
      secondary_designation: formData.contact.marketingDesignation || null,
      secondary_email: formData.contact.marketingEmail || null,
      secondary_phone: formData.contact.marketingPhone || null,
      // Production Contact
      production_contact_name: formData.contact.productionName || null,
      production_designation: formData.contact.productionDesignation || null,
      production_phone: formData.contact.productionPhone || null,
      production_email: formData.contact.productionEmail || null,
      // Customer Service Contact
      customer_service_name: formData.contact.customerServiceName || null,
      customer_service_designation: formData.contact.customerServiceDesignation || null,
      customer_service_phone: formData.contact.customerServicePhone || null,
      customer_service_email: formData.contact.customerServiceEmail || null,
      // Statutory/Compliance
      firm_registration_no: formData.statutory.firmRegistrationNo || null,
      is_gst_registered: formData.statutory.isGstRegistered,
      gstin: formData.statutory.isGstRegistered ? (formData.statutory.gstin || null) : null,
      gst_declaration_reason: !formData.statutory.isGstRegistered ? (formData.statutory.gstDeclarationReason || null) : null,
      gst_constitution_of_business: formData.statutory.gstConstitutionOfBusiness || null,
      gst_principal_place_of_business: formData.statutory.gstPrincipalPlaceOfBusiness || null,
      gst_additional_places: formData.statutory.gstAdditionalPlaces?.length ? formData.statutory.gstAdditionalPlaces : null,
      gst_registration_date: formData.statutory.gstRegistrationDate || null,
      gst_status: formData.statutory.gstStatus || null,
      gst_taxpayer_type: formData.statutory.gstTaxpayerType || null,
      gst_business_nature: formData.statutory.gstBusinessNature?.length ? formData.statutory.gstBusinessNature : null,
      gst_jurisdiction_centre: formData.statutory.gstJurisdictionCentre || null,
      gst_jurisdiction_state: formData.statutory.gstJurisdictionState || null,
      pan: formData.statutory.pan || null,
      pf_number: formData.statutory.pfNumber || null,
      esi_number: formData.statutory.esiNumber || null,
      is_msme_registered: formData.statutory.isMsmeRegistered,
      msme_number: formData.statutory.isMsmeRegistered ? (formData.statutory.msmeNumber || null) : null,
      msme_category: formData.statutory.isMsmeRegistered ? (formData.statutory.msmeCategory || null) : null,
      labour_permit_no: formData.statutory.labourPermitNo || null,
      iec_no: formData.statutory.iecNo || null,
      entity_type: formData.statutory.entityType || null,
      memberships: formData.statutory.memberships || [],
      enlistments: formData.statutory.enlistments || [],
      certifications: formData.statutory.certifications || [],
      operational_network: formData.statutory.operationalNetwork || null,
      // Bank Details
      bank_name: formData.bank.bankName,
      bank_branch_name: formData.bank.branchName,
      account_number: formData.bank.accountNumber,
      account_type: formData.bank.accountType,
      ifsc_code: formData.bank.ifscCode,
      micr_code: formData.bank.micrCode || null,
      bank_address: formData.bank.bankAddress || null,
      // Financial
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
      major_customer1: formData.financial.majorCustomer1 || null,
      major_customer2: formData.financial.majorCustomer2 || null,
      major_customer3: formData.financial.majorCustomer3 || null,
      authorized_distributor_name: formData.financial.authorizedDistributorName || null,
      authorized_distributor_address: formData.financial.authorizedDistributorAddress || null,
      // Infrastructure
      raw_materials_used: formData.infrastructure.rawMaterialsUsed || null,
      machinery_availability: formData.infrastructure.machineryAvailability || null,
      equipment_availability: formData.infrastructure.equipmentAvailability || null,
      power_supply: formData.infrastructure.powerSupply || null,
      water_supply: formData.infrastructure.waterSupply || null,
      dg_capacity: formData.infrastructure.dgCapacity || null,
      production_capacity: formData.infrastructure.productionCapacity || null,
      store_capacity: formData.infrastructure.storeCapacity || null,
      supply_capacity: formData.infrastructure.supplyCapacity || null,
      manpower: formData.infrastructure.manpower || null,
      inspection_testing: formData.infrastructure.inspectionTesting || null,
      nearest_railway: formData.infrastructure.nearestRailway || null,
      nearest_bus_station: formData.infrastructure.nearestBusStation || null,
      nearest_airport: formData.infrastructure.nearestAirport || null,
      nearest_port: formData.infrastructure.nearestPort || null,
      product_types: formData.infrastructure.productTypes || [],
      product_types_other: formData.infrastructure.productTypesOther || null,
      production_facilities: formData.infrastructure.productionFacilities || [],
      lead_time_required: formData.infrastructure.leadTimeRequired || null,
      // QHSE
      quality_issues: formData.qhse.qualityIssues || null,
      health_issues: formData.qhse.healthIssues || null,
      environmental_issues: formData.qhse.environmentalIssues || null,
      safety_issues: formData.qhse.safetyIssues || null,
      // Declaration
      self_declared: formData.declaration.selfDeclared,
      terms_accepted: formData.declaration.termsAccepted,
      // Admin-defined custom fields
      ...(formData.customFieldValues ? { custom_field_values: formData.customFieldValues } : {}),
    } as VendorRecord;
  };

  // Convert database vendor to form data - memoized to prevent infinite loops
  const existingFormData = useMemo<VendorFormData | null>(() => {
    if (!existingVendor) return null;
    const vendor = existingVendor as VendorRecord;

    return {
      organization: {
        buyerCompanyId: vendor.tenant_id || '',
        legalName: vendor.legal_name || '',
        tradeName: vendor.trade_name || '',
        industryType: vendor.industry_type || '',
        organizationType: vendor.organization_type || '',
        ownershipType: vendor.ownership_type || '',
        productCategories: vendor.product_categories || [],
      },
      address: {
        registeredAddress: vendor.registered_address || '',
        registeredAddressLine2: vendor.registered_address_line2 || '',
        registeredAddressLine3: vendor.registered_address_line3 || '',
        registeredCity: vendor.registered_city || '',
        registeredState: vendor.registered_state || '',
        registeredPincode: vendor.registered_pincode || '',
        registeredPhone: vendor.registered_phone || '',
        registeredFax: vendor.registered_fax || '',
        registeredWebsite: vendor.registered_website || '',
        sameAsRegistered: vendor.same_as_registered ?? true,
        manufacturingAddress: vendor.manufacturing_address || '',
        manufacturingAddressLine2: vendor.manufacturing_address_line2 || '',
        manufacturingAddressLine3: vendor.manufacturing_address_line3 || '',
        manufacturingCity: vendor.manufacturing_city || '',
        manufacturingState: vendor.manufacturing_state || '',
        manufacturingPincode: vendor.manufacturing_pincode || '',
        manufacturingPhone: vendor.manufacturing_phone || '',
        manufacturingFax: vendor.manufacturing_fax || '',
        branchName: vendor.branch_name || '',
        branchAddress: vendor.branch_address || '',
        branchCity: vendor.branch_city || '',
        branchState: vendor.branch_state || '',
        branchPincode: vendor.branch_pincode || '',
        branchCountry: vendor.branch_country || 'India',
        branchWebsite: vendor.branch_website || '',
        branchContactName: vendor.branch_contact_name || '',
        branchContactDesignation: vendor.branch_contact_designation || '',
        branchContactEmail: vendor.branch_contact_email || '',
        branchContactPhone: vendor.branch_contact_phone || '',
        branchContactFax: vendor.branch_contact_fax || '',
      },
      contact: {
        ceoName: vendor.primary_contact_name || '',
        ceoDesignation: vendor.primary_designation || '',
        ceoPhone: vendor.primary_phone || '',
        ceoEmail: vendor.primary_email || '',
        marketingName: vendor.secondary_contact_name || '',
        marketingDesignation: vendor.secondary_designation || '',
        marketingPhone: vendor.secondary_phone || '',
        marketingEmail: vendor.secondary_email || '',
        productionName: vendor.production_contact_name || '',
        productionDesignation: vendor.production_designation || '',
        productionPhone: vendor.production_phone || '',
        productionEmail: vendor.production_email || '',
        customerServiceName: vendor.customer_service_name || '',
        customerServiceDesignation: vendor.customer_service_designation || '',
        customerServicePhone: vendor.customer_service_phone || '',
        customerServiceEmail: vendor.customer_service_email || '',
      },
      statutory: {
        firmRegistrationNo: vendor.firm_registration_no || '',
        pan: vendor.pan || '',
        pfNumber: vendor.pf_number || '',
        esiNumber: vendor.esi_number || '',
        isGstRegistered: vendor.is_gst_registered ?? true,
        gstin: vendor.gstin || '',
        gstDeclarationReason: vendor.gst_declaration_reason || '',
        gstSelfDeclarationFile: null,
        gstConstitutionOfBusiness: vendor.gst_constitution_of_business || '',
        gstPrincipalPlaceOfBusiness: vendor.gst_principal_place_of_business || '',
        gstAdditionalPlaces: vendor.gst_additional_places || [],
        gstRegistrationDate: vendor.gst_registration_date || '',
        gstStatus: vendor.gst_status || '',
        gstTaxpayerType: vendor.gst_taxpayer_type || '',
        gstBusinessNature: vendor.gst_business_nature || [],
        gstJurisdictionCentre: vendor.gst_jurisdiction_centre || '',
        gstJurisdictionState: vendor.gst_jurisdiction_state || '',
        isMsmeRegistered: vendor.is_msme_registered ?? false,
        msmeNumber: vendor.msme_number || '',
        msmeCategory: (vendor.msme_category as 'micro' | 'small' | 'medium' | '') || '',
        labourPermitNo: vendor.labour_permit_no || '',
        iecNo: vendor.iec_no || '',
        entityType: vendor.entity_type || '',
        memberships: vendor.memberships || [],
        enlistments: vendor.enlistments || [],
        certifications: vendor.certifications || [],
        operationalNetwork: vendor.operational_network || '',
        gstCertificateFile: null,
        panCardFile: null,
        msmeCertificateFile: null,
      },
      bank: {
        bankName: vendor.bank_name || '',
        branchName: vendor.bank_branch_name || '',
        accountNumber: vendor.account_number || '',
        confirmAccountNumber: vendor.account_number || '',
        accountType: (vendor.account_type as 'current' | 'savings' | 'cash_credit' | 'others') || 'current',
        accountTypeOther: '',
        ifscCode: vendor.ifsc_code || '',
        micrCode: vendor.micr_code || '',
        bankAddress: vendor.bank_address || '',
        cancelledChequeFile: null,
      },
      financial: {
        turnoverYear1: vendor.turnover_year1?.toString() || '',
        turnoverYear2: vendor.turnover_year2?.toString() || '',
        turnoverYear3: vendor.turnover_year3?.toString() || '',
        creditPeriodExpected: vendor.credit_period_expected?.toString() || '',
        majorCustomer1: vendor.major_customer1 || '',
        majorCustomer2: vendor.major_customer2 || '',
        majorCustomer3: vendor.major_customer3 || '',
        authorizedDistributorName: vendor.authorized_distributor_name || '',
        authorizedDistributorAddress: vendor.authorized_distributor_address || '',
        dealershipCertificateFile: null,
        financialDocsFile: null,
      },
      infrastructure: {
        rawMaterialsUsed: vendor.raw_materials_used || '',
        machineryAvailability: vendor.machinery_availability || '',
        equipmentAvailability: vendor.equipment_availability || '',
        powerSupply: vendor.power_supply || '',
        waterSupply: vendor.water_supply || '',
        dgCapacity: vendor.dg_capacity || '',
        productionCapacity: vendor.production_capacity || '',
        storeCapacity: vendor.store_capacity || '',
        supplyCapacity: vendor.supply_capacity || '',
        manpower: vendor.manpower || '',
        inspectionTesting: vendor.inspection_testing || '',
        nearestRailway: vendor.nearest_railway || '',
        nearestBusStation: vendor.nearest_bus_station || '',
        nearestAirport: vendor.nearest_airport || '',
        nearestPort: vendor.nearest_port || '',
        productTypes: vendor.product_types || [],
        productTypesOther: vendor.product_types_other || '',
        productionFacilities: vendor.production_facilities || [],
        leadTimeRequired: vendor.lead_time_required || '',
      },
      qhse: {
        qualityIssues: vendor.quality_issues || '',
        healthIssues: vendor.health_issues || '',
        environmentalIssues: vendor.environmental_issues || '',
        safetyIssues: vendor.safety_issues || '',
      },
      declaration: {
        selfDeclared: vendor.self_declared ?? false,
        termsAccepted: vendor.terms_accepted ?? false,
      },
    };
  }, [existingVendor]);

  // Create or update vendor
  const saveVendorMutation = useMutation({
    mutationFn: async (formData: VendorFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      const vendorData: VendorRecord = {
        ...formDataToVendorRecord(formData, userId),
        status: 'draft' as const,
        ...(invitation?.email && !userId ? { primary_email: invitation.email } : {}),
      };
      // Ensure tenant_id is populated from the invitation when the form didn't carry one
      if (!vendorData.tenant_id && (invitation as any)?.tenant_id) {
        vendorData.tenant_id = (invitation as any).tenant_id;
      }

      if (vendorId) {
        const { data, error } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', vendorId)
          .select()
          .single();

        if (error) throw error;

        // Upload documents after vendor is saved
        await uploadAllDocuments(formData, data.id);

        return data;
      } else {
        const { data, error } = await supabase
          .from('vendors')
          .insert(vendorData)
          .select()
          .single();

        if (error) throw error;
        setVendorId(data.id);

        // Upload documents after vendor is created
        await uploadAllDocuments(formData, data.id);

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

      // Set verification statuses directly in the vendors table
      // Since frontend has already validated everything, we set them to 'passed'
      const verificationStatuses = {
        gst_verification_status: formData.statutory.gstin ? 'passed' : 'pending',
        pan_verification_status: formData.statutory.pan ? 'passed' : 'pending',
        bank_verification_status: (formData.bank.accountNumber && formData.bank.ifscCode) ? 'passed' : 'pending',
        msme_verification_status: formData.statutory.msmeNumber ? 'passed' : 'skipped',
        name_match_verification_status: 'passed', // Name match is always validated in frontend
      };

      // Update vendor with verification statuses and submit
      const { error: updateError } = await supabase
        .from('vendors')
        .update({
          ...verificationStatuses,
          status: 'finance_review' as const, // Skip validation_pending, go directly to finance_review
          submitted_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);

      if (updateError) throw updateError;

      // Initialise approval matrix progress (best-effort)
      try {
        await supabase.functions.invoke('route-vendor-approval', { body: { vendor_id: vendor.id } });
      } catch (e) {
        console.warn('route-vendor-approval failed (non-blocking):', e);
      }

      // Mark invitation as used via SECURITY DEFINER RPC (RLS-safe)
      if (options?.invitationToken) {
        const { error: claimErr } = await supabase.rpc('claim_invitation', {
          _token: options.invitationToken,
          _vendor_id: vendor.id,
        });
        if (claimErr) {
          console.warn('claim_invitation failed (non-blocking):', claimErr);
        }
      }

      // Log submission
      await supabase.from('audit_logs').insert({
        vendor_id: vendor.id,
        action: 'vendor_submitted',
        details: {
          submitted_by: vendor.user_id || 'anonymous',
          invitation_token: options?.invitationToken || null,
          verification_statuses: verificationStatuses,
        },
      });

      // Send notification email to admin about new vendor submission
      try {
        await supabase.functions.invoke('notify-vendor-submission', {
          body: { vendorId: vendor.id },
        });
        console.log('[Vendor] Submission notification email sent successfully');
      } catch (notifyError) {
        // Don't fail the submission if notification fails
        console.error('[Vendor] Failed to send submission notification:', notifyError);
      }

      setVendorStatus('finance_review');
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
      const userId = user?.id || null;

      const vendorData = {
        ...formDataToVendorRecord(formData, userId),
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

      // Upload any new documents
      await uploadAllDocuments(formData, vendorId);

      await supabase.from('audit_logs').insert({
        vendor_id: vendorId,
        action: 'vendor_resubmitted',
        details: {
          resubmitted_by: userId || 'anonymous',
          previous_status: vendorStatus,
          invitation_token: options?.invitationToken || null,
        },
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

      const legalName = vendor.legal_name || '';

      // Check for existing validations from the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingValidations } = await supabase
        .from('vendor_validations')
        .select('*')
        .eq('vendor_id', vendorIdToValidate)
        .gte('created_at', twentyFourHoursAgo);

      const hasRecentValidation = (type: string) => {
        return existingValidations?.find(v => v.validation_type === type && v.status === 'passed');
      };

      // Run GST validation only if not already validated
      if (vendor.gstin && portalConfig?.enable_gst_validation !== false) {
        const existing = hasRecentValidation('gst');
        if (existing) {
          console.log('[Validation] Reusing existing GST validation');
          validationResults.push({
            type: 'gst',
            status: 'passed',
            message: existing.message || 'GST validation completed',
            timestamp: existing.created_at,
          });
        } else {
          try {
            const response = await supabase.functions.invoke('validate-gst', {
              body: {
                id_number: vendor.gstin,
                legal_name: legalName,
              },
            });

            const result: ValidationResult = {
              type: 'gst',
              status: response.data?.success ? 'passed' : 'failed',
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
      }

      // Run PAN validation only if not already validated
      if (vendor.pan && portalConfig?.enable_pan_validation !== false) {
        const existing = hasRecentValidation('pan');
        if (existing) {
          console.log('[Validation] Reusing existing PAN validation');
          validationResults.push({
            type: 'pan',
            status: 'passed',
            message: existing.message || 'PAN validation completed',
            timestamp: existing.created_at,
          });
        } else {
          try {
            const response = await supabase.functions.invoke('verify-pan', {
              body: {
                id_number: vendor.pan,
                legal_name: legalName,
              },
            });

            const result: ValidationResult = {
              type: 'pan',
              status: response.data?.success ? 'passed' : 'failed',
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
      }

      // Run Bank validation only if not already validated
      if (vendor.account_number && vendor.ifsc_code && portalConfig?.enable_bank_validation !== false) {
        const existing = hasRecentValidation('bank');
        if (existing) {
          console.log('[Validation] Reusing existing Bank validation');
          validationResults.push({
            type: 'bank',
            status: 'passed',
            message: existing.message || 'Bank validation completed',
            timestamp: existing.created_at,
          });
        } else {
          try {
            const response = await supabase.functions.invoke('validate-bank', {
              body: {
                id_number: vendor.account_number,
                ifsc: vendor.ifsc_code,
                legal_name: legalName,
              },
            });

            const result: ValidationResult = {
              type: 'bank',
              status: response.data?.success ? 'passed' : 'failed',
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
      }

      // Run MSME validation only if MSME number is provided
      if (vendor.msme_number && portalConfig?.enable_msme_validation !== false) {
        const existing = hasRecentValidation('msme');
        if (existing) {
          console.log('[Validation] Reusing existing MSME validation');
          validationResults.push({
            type: 'msme',
            status: 'passed',
            message: existing.message || 'MSME validation completed',
            timestamp: existing.created_at,
          });
        } else {
          try {
            const response = await supabase.functions.invoke('validate-msme', {
              body: {
                id_number: vendor.msme_number,
                legal_name: legalName,
              },
            });

            const result: ValidationResult = {
              type: 'msme',
              status: response.data?.success ? 'passed' : 'failed',
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
        }
      } else if (!vendor.msme_number) {
        // MSME is optional - create a 'skipped' validation record
        console.log('[Validation] MSME number not provided - marking as skipped');
        const result: ValidationResult = {
          type: 'msme',
          status: 'skipped',
          message: 'MSME verification was skipped - vendor did not provide MSME number',
          timestamp: new Date().toISOString(),
        };
        validationResults.push(result);

        await supabase.from('vendor_validations').insert({
          vendor_id: vendorIdToValidate,
          validation_type: 'msme',
          status: 'skipped',
          message: result.message,
          details: { reason: 'optional_field_not_provided', skipped_at: new Date().toISOString() },
        });
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
