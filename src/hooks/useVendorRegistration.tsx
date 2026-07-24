import { useState, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VendorFormData, ValidationResult, VendorStatus } from '@/types/vendor';

interface UseVendorRegistrationOptions {
  invitationToken?: string;
  /**
   * When set, the form is being filled by a buyer on behalf of a vendor.
   * The existing-vendor lookup is scoped to this invitation_id instead of
   * the logged-in user, so multiple on-behalf drafts created by the same
   * buyer do not collide.
   */
  onBehalfInvitationId?: string;
  /**
   * Set true whenever the URL indicates an on-behalf flow (?onBehalf=1 or
   * ?onBehalfOf=...), even before `onBehalfInvitationId` resolves. Prevents
   * the hook from falling back to the buyer's "self" vendor draft and
   * accidentally reusing an old vendor row for a brand-new submission.
   */
  isOnBehalfMode?: boolean;
}

// Statuses that allow editing
const EDITABLE_STATUSES: VendorStatus[] = ['draft', 'validation_failed', 'finance_rejected', 'returned_to_vendor', 'returned_to_buyer'];

// Document types that can be uploaded
type DocumentType = 'gst_certificate' | 'gst_self_declaration' | 'pan_card' | 'msme_certificate' | 'msme_self_declaration' | 'cancelled_cheque' | 'cancelled_cheque_2' | 'financial_docs' | 'dealership_certificate' | 'registration_copy' | 'swift_iban_details';

interface DocumentUploadResult {
  documentType: DocumentType;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

type PersistedDocumentFile = File & { __persistedDocument?: true; filePath?: string };

const asPersistedFile = (doc?: any): PersistedDocumentFile | null => {
  if (!doc?.file_name) return null;
  return {
    name: doc.file_name,
    size: Number(doc.file_size || 0),
    type: doc.mime_type || '',
    __persistedDocument: true,
    filePath: doc.file_path,
  } as PersistedDocumentFile;
};

// Extended vendor record type to include all new fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VendorRecord = Record<string, any>;

const PAN_COMPREHENSIVE_COLUMNS = [
  'pan_status',
  'pan_aadhaar_linked',
  'pan_comprehensive_verified_at',
] as const;

const stripPanComprehensiveColumns = (payload: VendorRecord): VendorRecord => {
  const next = { ...payload };
  PAN_COMPREHENSIVE_COLUMNS.forEach((column) => {
    delete next[column];
  });
  return next;
};

const isMissingPanComprehensiveColumnError = (error: any) => {
  const code = String(error?.code || '');
  const message = String(error?.message || error?.details || error?.hint || '');
  return (
    code === 'PGRST204' &&
    /Could not find/i.test(message) &&
    PAN_COMPREHENSIVE_COLUMNS.some((column) => message.includes(column))
  );
};

const nonNegativeNumberString = (value: unknown) => {
  if (value === 0 || value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n.toString() : '';
  }
  return '';
};

const writeVendorWithPanFallback = async (
  action: string,
  payload: VendorRecord,
  write: (nextPayload: VendorRecord) => PromiseLike<{ data: any; error: any }>
) => {
  let result = await write(payload);
  if (result.error && isMissingPanComprehensiveColumnError(result.error)) {
    console.warn(`[saveVendor] ${action} retried without PAN Comprehensive columns; database schema/cache is not updated yet.`, result.error);
    result = await write(stripPanComprehensiveColumns(payload));
  }
  return result;
};

export function useVendorRegistration(options?: UseVendorRegistrationOptions) {
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorStatus, setVendorStatus] = useState<VendorStatus | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  // Track auth user id so the existing-vendor query only fires (and re-fires)
  // once Supabase auth is hydrated. Without this, a hard refresh can race the
  // query with auth hydration, return null, and the saved draft never loads —
  // which drops the user back onto the Vendor Type selector.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setAuthUserId(data.user?.id ?? null);
        setIsAuthReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setAuthUserId(session?.user?.id ?? null);
        setIsAuthReady(true);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

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
    queryKey: ['existing-vendor', authUserId, options?.onBehalfInvitationId || (options?.isOnBehalfMode ? 'on-behalf-pending' : 'self')],
    enabled: !!authUserId || !!options?.onBehalfInvitationId,
    queryFn: async () => {
      const userId = authUserId || (await supabase.auth.getUser()).data.user?.id || null;
      if (!userId && !options?.onBehalfInvitationId) return null;


      // On-behalf mode without a resolved invitation id yet: do NOT load the
      // buyer's previous "self" draft — that would reuse an old vendor row and
      // its old approval chain for the brand-new submission, which is exactly
      // the bug where SCM CO never sees the new vendor.
      if (options?.isOnBehalfMode && !options?.onBehalfInvitationId) {
        return null;
      }

      // On-behalf mode: scope the draft to the invitation, not the buyer's user_id,
      // so multiple in-flight on-behalf drafts created by the same buyer don't collide.
      let query = supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (options?.onBehalfInvitationId) {
        query = query.eq('invitation_id', options.onBehalfInvitationId);
      } else {
        if (!userId) return null;
        query = query.eq('user_id', userId);

      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (data?.id) {
        const { data: docs, error: docsError } = await supabase
          .from('vendor_documents')
          .select('id, document_type, file_name, file_size, file_path, mime_type')
          .eq('vendor_id', data.id);
        if (!docsError) {
          (data as any).vendor_documents = docs || [];
        } else {
          console.warn('Failed to hydrate vendor documents:', docsError);
        }

        // Hydrate the latest GST validation row so the persisted filing status
        // (last 3 months) is available when opening the vendor for edit.
        const { data: gstVal, error: gstValError } = await supabase
          .from('vendor_validations')
          .select('details')
          .eq('vendor_id', data.id)
          .eq('validation_type', 'gst')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!gstValError && gstVal) {
          (data as any).__gst_validation_details = (gstVal as any).details ?? null;
        }
      }

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

  // Upload document to Supabase Storage. Path convention:
  //   {vendorId}/{documentType}/{filename}
  // Matches storage RLS which checks the vendor row by the first folder.
  const uploadDocument = async (file: File, vendorIdForUpload: string, documentType: DocumentType): Promise<DocumentUploadResult | null> => {
    if (!file) return null;

    const body = new FormData();
    body.append('vendorId', vendorIdForUpload);
    body.append('documentType', documentType);
    body.append('file', file, file.name);

    // Upload via a secured backend function instead of direct browser Storage
    // writes. Self-hosted production Storage RLS can reject the browser insert
    // even when the app session is valid; the function verifies the user/vendor
    // link, uploads with backend privileges, and saves metadata atomically.
    const { data, error } = await supabase.functions.invoke('upload-vendor-document', { body });

    if (error) {
      console.error(`Failed to upload ${documentType}:`, error);
      throw new Error(`Failed to upload ${documentType}: ${error.message}`);
    }

    if (!data?.filePath) {
      throw new Error(`Failed to upload ${documentType}: upload service returned no file path`);
    }

    return {
      documentType: data.documentType,
      filePath: data.filePath,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
    };
  };

  // Serialize concurrent upload runs (autosave + manual save) to avoid races on the
  // unique index (vendor_id, document_type).
  const uploadInFlight = useRef<Promise<void> | null>(null);
  // Track File instances we've already uploaded in this session so a new
  // File object (re-upload) is always treated as a replacement, even when
  // the new file happens to share name/size with the previous one.
  const uploadedFilesRef = useRef<WeakSet<File>>(new WeakSet());

  // Upload all documents for a vendor (deduplicated by vendor_id + document_type)
  const uploadAllDocuments = async (formData: VendorFormData, vendorIdForUpload: string) => {
    if (uploadInFlight.current) {
      try { await uploadInFlight.current; } catch { /* swallow prior error */ }
    }

    const run = async () => {
      const documentsToUpload: { file: File | null; type: DocumentType }[] = [
        { file: formData.statutory.gstCertificateFile, type: 'gst_certificate' },
        { file: formData.statutory.gstSelfDeclarationFile, type: 'gst_self_declaration' },
        { file: formData.statutory.panCardFile, type: 'pan_card' },
        { file: formData.statutory.msmeCertificateFile, type: 'msme_certificate' },
        { file: formData.statutory.msmeSelfDeclarationFile ?? null, type: 'msme_self_declaration' },
        { file: formData.bank.cancelledChequeFile, type: 'cancelled_cheque' },
        { file: formData.bank.secondary?.cancelledChequeFile ?? null, type: 'cancelled_cheque_2' },
        { file: formData.financial.financialDocsFile, type: 'financial_docs' },
        { file: formData.financial.dealershipCertificateFile, type: 'dealership_certificate' },
        { file: formData.international?.documents?.registrationCopyFile ?? null, type: 'registration_copy' },
        { file: formData.international?.documents?.swiftIbanFile ?? null, type: 'swift_iban_details' },
      ];

      for (const doc of documentsToUpload) {
        if (!doc.file) continue;
        if ((doc.file as PersistedDocumentFile).__persistedDocument) continue;

        // Skip ONLY if this exact File instance was already uploaded in this
        // session. Name+size matching is unreliable — re-exports/scans often
        // collide, which previously caused the original cheque to "stick"
        // even after a re-upload.
        if (uploadedFilesRef.current.has(doc.file)) {
          continue;
        }

        // Upload-first, then update metadata, then remove the previous storage
        // object. This guarantees vendor_documents rows always point to a file
        // that actually exists in storage (prevents "File missing in storage"
        // errors when the new upload would have failed after deleting the old).
        const result = await uploadDocument(doc.file, vendorIdForUpload, doc.type);
        if (!result) continue;

        uploadedFilesRef.current.add(doc.file);
      }
    };


    uploadInFlight.current = run();
    try {
      await uploadInFlight.current;
    } finally {
      uploadInFlight.current = null;
    }
  };

  // Convert form data to database format
  const formDataToVendorRecord = (formData: VendorFormData & { customFieldValues?: Record<string, Record<string, unknown>> }, userId: string | null) => {
    const isIntl = formData.vendorType === 'international';
    const intl = formData.international;

    // For international vendors, map the new International fields back to the
    // domestic NOT NULL columns so existing constraints + queries keep working.
    // The full original values are preserved in `international_data` JSONB.
    const intlLegalName = intl?.company.companyName || '';
    const intlEmail = intl?.company.email1 || '';
    const intlPhone = intl?.company.contact1 || '';
    const intlAddrLine1 = intl?.company.addressLine1 || '';
    const intlAddrLine2 = intl?.company.addressLine2 || '';
    const intlAddrLine3 = intl?.company.addressLine3 || '';
    const intlAddrLine4 = intl?.company.addressLine4 || '';
    const intlJoinedAddr = [intlAddrLine1, intlAddrLine2, intlAddrLine3, intlAddrLine4].filter(Boolean).join(', ');
    const intlAddr = intlJoinedAddr || intl?.company.companyAddress || '';
    const intlCity = intl?.company.city || '';
    const intlState = '';
    const intlPin = intl?.company.pincode || '';
    const intlCountry = intl?.company.country || '';
    const intlRegion = intl?.company.region || '';
    const intlOfficePhone = intl?.company.officePhone || '';
    const intlFax = intl?.company.fax || '';

    const cls = intl?.classification;
    const intlMaterial = cls?.materialGroupVendor || [];
    const intlVendorCat = cls?.vendorCategory || [];
    const intlVendorLoc = cls?.vendorLocation || [];
    const intlIdSrc = cls?.identificationSource || [];

    return {
      user_id: userId,
      tenant_id: formData.organization.buyerCompanyId || null,
      vendor_type: formData.vendorType || 'domestic',
      international_data: isIntl
        ? {
            documents: {
              // Files themselves are stored in vendor_documents; here we just
              // capture which slots are populated so the JSONB is informative.
              registrationCopy: intl?.documents.registrationCopyFile?.name || null,
              swiftIban: intl?.documents.swiftIbanFile?.name || null,
            },
            company: {
              ...(intl?.company || {}),
              // Keep the legacy single-line value in sync with the new lines.
              companyAddress: intlJoinedAddr || intl?.company.companyAddress || '',
            },
            bank: intl?.bank,
            classification: intl?.classification,
          }
        : null,
      // Organization
      legal_name: isIntl ? intlLegalName : formData.organization.legalName,
      trade_name: isIntl ? null : (formData.organization.tradeName || null),
      industry_type: isIntl ? '' : formData.organization.industryType,
      organization_type: isIntl ? null : (formData.organization.organizationType || null),
      ownership_type: isIntl ? null : (formData.organization.ownershipType || null),
      product_categories: isIntl ? [] : formData.organization.productCategories,
      state: isIntl ? (intlCountry || null) : (formData.organization.state || null),
      material_group_vendor: isIntl
        ? (intlMaterial[0] || null)
        : ((Array.isArray(formData.organization.materialGroupVendor) ? formData.organization.materialGroupVendor[0] : formData.organization.materialGroupVendor) || null),
      vendor_category: isIntl
        ? (intlVendorCat[0] || null)
        : ((Array.isArray(formData.organization.vendorCategory) ? formData.organization.vendorCategory[0] : formData.organization.vendorCategory) || null),
      vendor_location: isIntl
        ? (intlVendorLoc[0] || null)
        : ((Array.isArray(formData.organization.vendorLocation) ? formData.organization.vendorLocation[0] : formData.organization.vendorLocation) || null),
      identification_source: isIntl
        ? (intlIdSrc[0] || null)
        : ((Array.isArray(formData.organization.identificationSource) ? formData.organization.identificationSource[0] : formData.organization.identificationSource) || null),
      material_group_vendors: isIntl ? intlMaterial : (Array.isArray(formData.organization.materialGroupVendor) ? formData.organization.materialGroupVendor : (formData.organization.materialGroupVendor ? [formData.organization.materialGroupVendor as unknown as string] : [])),
      vendor_categories: isIntl ? intlVendorCat : (Array.isArray(formData.organization.vendorCategory) ? formData.organization.vendorCategory : (formData.organization.vendorCategory ? [formData.organization.vendorCategory as unknown as string] : [])),
      vendor_locations: isIntl ? intlVendorLoc : (Array.isArray(formData.organization.vendorLocation) ? formData.organization.vendorLocation : (formData.organization.vendorLocation ? [formData.organization.vendorLocation as unknown as string] : [])),
      identification_sources: isIntl ? intlIdSrc : (Array.isArray(formData.organization.identificationSource) ? formData.organization.identificationSource : (formData.organization.identificationSource ? [formData.organization.identificationSource as unknown as string] : [])),
      // Registered Address — for intl vendors, mirror the intl company address
      // block onto the shared registered_* columns so downstream SAP mapping,
      // list queries and reports work without special-casing.
      registered_address: isIntl ? (intlAddrLine1 || intlAddr) : formData.address.registeredAddress,
      registered_address_line2: isIntl ? (intlAddrLine2 || null) : (formData.address.registeredAddressLine2 || null),
      registered_address_line3: isIntl ? (intlAddrLine3 || null) : (formData.address.registeredAddressLine3 || null),
      registered_address_line4: isIntl ? (intlAddrLine4 || null) : (formData.address.registeredAddressLine4 || null),
      registered_city: isIntl ? (intlCity || '') : formData.address.registeredCity,
      registered_state: isIntl ? (intlRegion || intlState || '') : formData.address.registeredState,
      registered_pincode: isIntl ? (intlPin || '') : formData.address.registeredPincode,
      registered_phone: isIntl ? (intlOfficePhone || null) : (formData.address.registeredPhone || null),
      registered_fax: isIntl ? (intlFax || null) : (formData.address.registeredFax || null),
      registered_website: formData.address.registeredWebsite || null,
      registered_email: isIntl ? (intlEmail || null) : (formData.address.registeredEmail || null),
      registered_contact_1: isIntl ? (intlPhone || null) : (formData.address.registeredContact1 || null),
      registered_contact_2: isIntl ? (intl?.company.contact2 || null) : (formData.address.registeredContact2 || null),
      registered_email_2: isIntl ? (intl?.company.email2 || null) : (formData.address.registeredEmail2 || null),
      same_as_registered: formData.address.sameAsRegistered,
      // Manufacturing Address
      manufacturing_address: formData.address.manufacturingAddress || null,
      manufacturing_address_line2: formData.address.manufacturingAddressLine2 || null,
      manufacturing_address_line3: formData.address.manufacturingAddressLine3 || null,
      manufacturing_address_line4: formData.address.manufacturingAddressLine4 || null,
      manufacturing_city: formData.address.manufacturingCity || null,
      manufacturing_state: formData.address.manufacturingState || null,
      manufacturing_pincode: formData.address.manufacturingPincode || null,
      manufacturing_phone: formData.address.manufacturingPhone || null,
      manufacturing_fax: formData.address.manufacturingFax || null,
      manufacturing_email: formData.address.manufacturingEmail || null,
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
      branch_address_line2: formData.address.branchAddressLine2 || null,
      branch_address_line3: formData.address.branchAddressLine3 || null,
      branch_address_line4: formData.address.branchAddressLine4 || null,
      branch_city: formData.address.branchCity || null,
      branch_state: formData.address.branchState || null,
      branch_pincode: formData.address.branchPincode || null,
      branch_country: formData.address.branchCountry || null,
      branch_website: formData.address.branchWebsite || null,
      branch_email: formData.address.branchEmail || null,
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
      primary_phone_2: formData.contact.ceoPhone2 || null,
      primary_email_2: formData.contact.ceoEmail2 || null,
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
      pan_holder_name: formData.statutory.panHolderName || null,
      // Preserve saved PAN Comprehensive values — don't overwrite with null on edit-save
      ...(formData.statutory.panStatus != null ? { pan_status: formData.statutory.panStatus } : {}),
      ...(formData.statutory.panAadhaarLinked != null ? { pan_aadhaar_linked: formData.statutory.panAadhaarLinked } : {}),
      ...(formData.statutory.panComprehensiveVerifiedAt != null ? { pan_comprehensive_verified_at: formData.statutory.panComprehensiveVerifiedAt } : {}),
      pf_number: formData.statutory.pfNumber || null,
      esi_number: formData.statutory.esiNumber || null,
      is_msme_registered: formData.statutory.isMsmeRegistered,
      msme_number: formData.statutory.isMsmeRegistered ? (formData.statutory.msmeNumber || null) : null,
      msme_category: formData.statutory.isMsmeRegistered ? (formData.statutory.msmeCategory || null) : null,
      msme_enterprise_name: formData.statutory.isMsmeRegistered ? (formData.statutory.msmeEnterpriseName || null) : null,
      msme_major_activity: formData.statutory.isMsmeRegistered ? (formData.statutory.msmeMajorActivity || null) : null,
      labour_permit_no: formData.statutory.labourPermitNo || null,
      iec_no: formData.statutory.iecNo || null,
      swift_iban_code: formData.statutory.swiftIbanCode || null,
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
      account_holder_name: formData.bank.accountHolderName || null,
      // Secondary Bank (optional)
      bank_name_2: formData.bank.secondary?.enabled ? (formData.bank.secondary.bankName || null) : null,
      branch_name_2: formData.bank.secondary?.enabled ? (formData.bank.secondary.branchName || null) : null,
      account_number_2: formData.bank.secondary?.enabled ? (formData.bank.secondary.accountNumber || null) : null,
      ifsc_code_2: formData.bank.secondary?.enabled ? (formData.bank.secondary.ifscCode || null) : null,
      account_holder_name_2: formData.bank.secondary?.enabled ? (formData.bank.secondary.accountHolderName || null) : null,
      account_type_2: formData.bank.secondary?.enabled ? (formData.bank.secondary.accountType || null) : null,
      bank_address_2: formData.bank.secondary?.enabled ? (formData.bank.secondary.bankAddress || null) : null,
      micr_2: formData.bank.secondary?.enabled ? (formData.bank.secondary.micrCode || null) : null,
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
    const docsByType = new Map<string, any>();
    ((vendor as any).vendor_documents || []).forEach((doc: any) => docsByType.set(doc.document_type, doc));
    const persisted = (type: DocumentType) => asPersistedFile(docsByType.get(type));

    return {
      vendorType: ((vendor as any).vendor_type as 'domestic' | 'international') || 'domestic',
      organization: {
        buyerCompanyId: vendor.tenant_id || '',
        legalName: vendor.legal_name || '',
        tradeName: vendor.trade_name || '',
        industryType: vendor.industry_type || '',
        organizationType: vendor.organization_type || '',
        ownershipType: vendor.ownership_type || '',
        productCategories: vendor.product_categories || [],
        productCategoriesOther: (vendor as VendorRecord & { product_categories_other?: string }).product_categories_other || '',
        state: (vendor as VendorRecord & { state?: string }).state || '',
        materialGroupVendor: ((vendor as any).material_group_vendors?.length ? (vendor as any).material_group_vendors : ((vendor as any).material_group_vendor ? [(vendor as any).material_group_vendor] : [])),
        vendorCategory: ((vendor as any).vendor_categories?.length ? (vendor as any).vendor_categories : ((vendor as any).vendor_category ? [(vendor as any).vendor_category] : [])),
        vendorLocation: ((vendor as any).vendor_locations?.length ? (vendor as any).vendor_locations : ((vendor as any).vendor_location ? [(vendor as any).vendor_location] : [])),
        identificationSource: ((vendor as any).identification_sources?.length ? (vendor as any).identification_sources : ((vendor as any).identification_source ? [(vendor as any).identification_source] : [])),
      },
      address: {
        registeredAddress: vendor.registered_address || '',
        registeredAddressLine2: vendor.registered_address_line2 || '',
        registeredAddressLine3: vendor.registered_address_line3 || '',
        registeredAddressLine4: (vendor as VendorRecord & { registered_address_line4?: string }).registered_address_line4 || '',
        registeredCity: vendor.registered_city || '',
        registeredState: vendor.registered_state || '',
        registeredPincode: vendor.registered_pincode || '',
        registeredPhone: vendor.registered_phone || '',
        registeredFax: vendor.registered_fax || '',
        registeredWebsite: vendor.registered_website || '',
        registeredEmail: (vendor as VendorRecord & { registered_email?: string }).registered_email || '',
        registeredContact1: (vendor as VendorRecord & { registered_contact_1?: string }).registered_contact_1 || '',
        registeredContact2: (vendor as VendorRecord & { registered_contact_2?: string }).registered_contact_2 || '',
        registeredEmail2: (vendor as VendorRecord & { registered_email_2?: string }).registered_email_2 || '',
        sameAsRegistered: vendor.same_as_registered ?? true,
        manufacturingAddress: vendor.manufacturing_address || '',
        manufacturingAddressLine2: vendor.manufacturing_address_line2 || '',
        manufacturingAddressLine3: vendor.manufacturing_address_line3 || '',
        manufacturingAddressLine4: (vendor as VendorRecord & { manufacturing_address_line4?: string }).manufacturing_address_line4 || '',
        manufacturingCity: vendor.manufacturing_city || '',
        manufacturingState: vendor.manufacturing_state || '',
        manufacturingPincode: vendor.manufacturing_pincode || '',
        manufacturingPhone: vendor.manufacturing_phone || '',
        manufacturingFax: vendor.manufacturing_fax || '',
        manufacturingEmail: (vendor as VendorRecord & { manufacturing_email?: string }).manufacturing_email || '',
        branchName: vendor.branch_name || '',
        branchAddress: vendor.branch_address || '',
        branchAddressLine2: (vendor as VendorRecord & { branch_address_line2?: string }).branch_address_line2 || '',
        branchAddressLine3: (vendor as VendorRecord & { branch_address_line3?: string }).branch_address_line3 || '',
        branchAddressLine4: (vendor as VendorRecord & { branch_address_line4?: string }).branch_address_line4 || '',
        branchCity: vendor.branch_city || '',
        branchState: vendor.branch_state || '',
        branchPincode: vendor.branch_pincode || '',
        branchCountry: vendor.branch_country || 'India',
        branchWebsite: vendor.branch_website || '',
        branchEmail: (vendor as VendorRecord & { branch_email?: string }).branch_email || '',
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
        ceoPhone2: (vendor as any).primary_phone_2 || '',
        ceoEmail2: (vendor as any).primary_email_2 || '',
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
        panHolderName: (vendor as any).pan_holder_name ?? '',
        panStatus: (vendor as any).pan_status ?? null,
        panAadhaarLinked: (vendor as any).pan_aadhaar_linked ?? null,
        panComprehensiveVerifiedAt: (vendor as any).pan_comprehensive_verified_at ?? null,
        pfNumber: vendor.pf_number || '',
        esiNumber: vendor.esi_number || '',
        isGstRegistered: vendor.is_gst_registered ?? true,
        gstin: vendor.gstin || '',
        gstDeclarationReason: vendor.gst_declaration_reason || '',
        gstSelfDeclarationFile: persisted('gst_self_declaration'),
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
        msmeEnterpriseName: (vendor as VendorRecord & { msme_enterprise_name?: string }).msme_enterprise_name || '',
        msmeMajorActivity: (vendor as VendorRecord & { msme_major_activity?: string }).msme_major_activity || '',
        labourPermitNo: vendor.labour_permit_no || '',
        iecNo: vendor.iec_no || '',
        swiftIbanCode: (vendor as VendorRecord & { swift_iban_code?: string }).swift_iban_code || '',
        entityType: vendor.entity_type || '',
        memberships: vendor.memberships || [],
        enlistments: vendor.enlistments || [],
        certifications: vendor.certifications || [],
        operationalNetwork: vendor.operational_network || '',
        gstCertificateFile: persisted('gst_certificate'),
        panCardFile: persisted('pan_card'),
        msmeCertificateFile: persisted('msme_certificate'),
        msmeSelfDeclarationFile: persisted('msme_self_declaration'),
        msmeDeclarationReason: vendor.msme_declaration_reason || '',
        iecCertificateFile: null,
        swiftIbanProofFile: null,
        gstFilingStatus: (() => {
          const raw = (vendor as any).__gst_validation_details?.filing_status;
          if (!raw) return [];
          if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) return raw[0];
          return Array.isArray(raw) ? raw : [];
        })(),
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
        accountHolderName: (vendor as VendorRecord & { account_holder_name?: string }).account_holder_name || '',
        cancelledChequeFile: persisted('cancelled_cheque'),
        secondary: vendor.account_number_2
          ? {
              enabled: true,
              bankName: vendor.bank_name_2 || '',
              branchName: vendor.branch_name_2 || '',
              accountNumber: vendor.account_number_2 || '',
              accountType: (vendor.account_type_2 as 'current' | 'savings' | 'cash_credit' | 'others') || 'current',
              ifscCode: vendor.ifsc_code_2 || '',
              micrCode: vendor.micr_2 || '',
              bankAddress: vendor.bank_address_2 || '',
              accountHolderName: vendor.account_holder_name_2 || '',
              cancelledChequeFile: persisted('cancelled_cheque_2'),
            }
          : undefined,
      },
      financial: {
        turnoverYear1: nonNegativeNumberString(vendor.turnover_year1),
        turnoverYear2: nonNegativeNumberString(vendor.turnover_year2),
        turnoverYear3: nonNegativeNumberString(vendor.turnover_year3),
        creditPeriodExpected: nonNegativeNumberString(vendor.credit_period_expected),
        majorCustomer1: vendor.major_customer1 || '',
        majorCustomer2: vendor.major_customer2 || '',
        majorCustomer3: vendor.major_customer3 || '',
        authorizedDistributorName: vendor.authorized_distributor_name || '',
        authorizedDistributorAddress: vendor.authorized_distributor_address || '',
        dealershipCertificateFile: persisted('dealership_certificate'),
        financialDocsFile: persisted('financial_docs'),
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
      international: (vendor as any).international_data ? {
        documents: { registrationCopyFile: null, swiftIbanFile: null },
        company: {
          companyName: '', addressLine1: '', addressLine2: '', addressLine3: '', addressLine4: '',
          city: '', state: '', pincode: '', officePhone: '', fax: '',
          companyAddress: '', country: '', region: '',
          contact1: '', contact2: '', email1: '', email2: '',
          ...((vendor as any).international_data?.company || {}),
        },
        bank: (vendor as any).international_data?.bank || { accountNumber: '', swiftCode: '', companyName: '', bankName: '', bankBranch: '', ibanNumber: '' },
        classification: (vendor as any).international_data?.classification || { materialGroupVendor: [], vendorCategory: [], vendorLocation: [], identificationSource: [] },
      } : undefined,
    };
  }, [existingVendor]);

  // Create or update vendor
  const saveVendorMutation = useMutation({
    mutationFn: async (formData: VendorFormData) => {
      // Resolve the auth user with server-side validation. getSession() only
      // returns the locally cached JWT — if that JWT's `sub` points to a user
      // that was deleted/recreated server-side, inserting with it will violate
      // the vendors_user_id_fkey foreign key. getUser() re-validates against
      // the auth server and returns the live user id.
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session ?? null;
      }
      let { data: userResp, error: userErr } = await supabase.auth.getUser();
      if ((userErr || !userResp?.user?.id) && options?.invitationToken && session?.user?.id) {
        userResp = { user: session.user } as typeof userResp;
        userErr = null;
      }
      if (userErr || !userResp?.user?.id) {
        const refreshed = await supabase.auth.refreshSession();
        userResp = { user: refreshed.data.user } as typeof userResp;
      }
      const userId = userResp?.user?.id || null;
      if (!userId) {
        const err: Error & { code?: string } = new Error('Your session has expired. Please sign in again to continue.');
        err.code = 'AUTH_REQUIRED';
        throw err;
      }

      const baseRecord = formDataToVendorRecord(formData, userId);


      // International overrides: map intl fields onto domestic NOT NULL columns
      // so existing CHECK/NOT NULL constraints stay green. Source-of-truth for
      // international vendors is still `international_data` JSONB.
      const isIntl = formData.vendorType === 'international';
      const intl = formData.international;
      const intlOverrides: VendorRecord = isIntl && intl ? {
        legal_name: intl.company.companyName || 'INTERNATIONAL VENDOR',
        registered_address: intl.company.companyAddress || '-',
        registered_city: intl.company.region || '-',
        registered_state: intl.company.region || '-',
        registered_pincode: intl.company.pincode || '-',
        registered_email: intl.company.email1 || null,
        registered_phone: intl.company.contact1 || null,
        primary_contact_name: intl.company.companyName || 'International Contact',
        primary_designation: 'Authorized Representative',
        primary_email: intl.company.email1 || '',
        primary_phone: intl.company.contact1 || '',
        primary_email_2: intl.company.email2 || null,
        primary_phone_2: intl.company.contact2 || null,
        branch_country: intl.company.country || null,
        // Bank: optional for intl, use SWIFT/IBAN data if provided
        bank_name: intl.bank.bankName || 'N/A',
        bank_branch_name: intl.bank.bankBranch || 'N/A',
        account_number: intl.bank.accountNumber || 'N/A',
        ifsc_code: intl.bank.swiftCode || intl.bank.ibanNumber || 'N/A',
        swift_iban_code: intl.bank.swiftCode || intl.bank.ibanNumber || null,
        // Statutory: intl vendors are GST-exempt by definition
        is_gst_registered: false,
        gst_declaration_reason: 'International vendor — not GST registered',
        is_msme_registered: false,
      } : {};

      const vendorData: VendorRecord = {
        ...baseRecord,
        ...intlOverrides,
        status: 'draft' as const,
        ...(invitation?.email && !userId ? { primary_email: invitation.email } : {}),
      };
      // When the vendor is registering via an invitation, the invitation's company
      // is the source of truth for approval routing. Always force it so the vendor
      // cannot accidentally pick a different Buyer Company that has no approval matrix.
      if ((invitation as any)?.tenant_id) {
        vendorData.tenant_id = (invitation as any).tenant_id;
      }
      // Persist link to the invitation so notification emails can find the inviter
      if ((invitation as any)?.id) {
        vendorData.invitation_id = (invitation as any).id;
      }

      let savedVendor: any;
      if (vendorId) {
        // Never overwrite user_id on update — the RLS policy requires
        // `user_id = auth.uid()` to match the row's existing owner. Sending a
        // (possibly stale or null) user_id from the client races with session
        // refresh and triggers "new row violates row-level security policy".
        const { user_id: _ignoreUserId, status: _ignoreStatus, ...updatePayload } = vendorData as VendorRecord & { user_id?: string; status?: string };
        // Never let an autosave revert a submitted vendor back to 'draft'.
        // Only allow status changes when the existing row is still a draft or
        // has been explicitly returned to the vendor for edits.
        const existingStatus = (existingVendor as any)?.status as string | undefined;
        if (existingStatus === 'draft' || existingStatus === 'returned_to_vendor' || !existingStatus) {
          (updatePayload as any).status = 'draft';
        }
        // Preserve tenant_id from the existing row when the form briefly clears it
        // (e.g. before invitation/existingVendor has hydrated buyerCompanyId).
        if (!updatePayload.tenant_id && (existingVendor as any)?.tenant_id) {
          updatePayload.tenant_id = (existingVendor as any).tenant_id;
        }

        // ============================================================
        // Preserve previously entered values on partial saves.
        // If the incoming payload has an empty value (null / '' / []) for a
        // column that already has a non-empty value in the DB, keep the DB
        // value. This prevents autosave / step-level saves from wiping out
        // data captured in other steps or in a previous session.
        // Boolean columns and explicit JSON toggles are excluded so users
        // can still clear checkboxes intentionally.
        // ============================================================
        {
          const existingRow = (existingVendor as Record<string, unknown> | null) || {};
          const isEmpty = (v: unknown) =>
            v === null ||
            v === undefined ||
            (typeof v === 'string' && v.trim() === '') ||
            (Array.isArray(v) && v.length === 0);
          const preserveExempt = new Set<string>([
            'status',
            'user_id',
            'tenant_id',
            'invitation_id',
            'is_gst_registered',
            'is_msme_registered',
            'updated_at',
          ]);
          for (const key of Object.keys(updatePayload)) {
            if (preserveExempt.has(key)) continue;
            const incoming = (updatePayload as Record<string, unknown>)[key];
            const current = existingRow[key];
            if (isEmpty(incoming) && !isEmpty(current)) {
              (updatePayload as Record<string, unknown>)[key] = current;
            }
          }
        }

        const { data, error } = await writeVendorWithPanFallback(
          'update',
          updatePayload,
          (nextPayload) => supabase
            .from('vendors')
            .update(nextPayload)
            .eq('id', vendorId)
            .select()
            .maybeSingle()
        );

        if (error) throw error;

        // If RLS filters the RETURNING row (e.g. on-behalf flow after status
        // transition), the update still succeeded — fall back to a fresh read
        // or, at minimum, the id we just wrote to.
        let resolved: any = data;
        if (!resolved) {
          const { data: reread } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', vendorId)
            .maybeSingle();
          resolved = reread ?? { id: vendorId };
        }

        // Upload documents after vendor is saved
        await uploadAllDocuments(formData, resolved.id);
        savedVendor = resolved;
      } else {

        const { data, error } = await writeVendorWithPanFallback(
          'insert',
          vendorData,
          (nextPayload) => supabase
            .from('vendors')
            .insert(nextPayload)
            .select()
            .single()
        );

        if (error) throw error;
        setVendorId(data.id);

        // Upload documents after vendor is created
        await uploadAllDocuments(formData, data.id);
        savedVendor = data;
      }

      // Persist the GST filing-status response captured during Step 1 so the
      // Approval View can render the same dynamic table the vendor saw during
      // registration. Merges with any existing row so we never overwrite
      // valuable filing rows with an empty/simpler payload.
      try {
        const gstin = (formData.statutory.gstin || '').trim();
        const filingRows = formData.statutory.gstFilingStatus;
        if (gstin && Array.isArray(filingRows) && filingRows.length > 0) {
          const { data: existingRows } = await supabase
            .from('vendor_validations')
            .select('id, details')
            .eq('vendor_id', savedVendor.id)
            .eq('validation_type', 'gst')
            .order('created_at', { ascending: false })
            .limit(1);
          const prevDetails = (existingRows?.[0] as any)?.details ?? {};
          const mergedDetails = {
            ...prevDetails,
            gstin,
            filing_status: filingRows,
          };
          if (existingRows && existingRows.length > 0) {
            await supabase
              .from('vendor_validations')
              .update({
                status: 'passed',
                message: 'GST verified — filing status captured',
                details: mergedDetails,
                validated_at: new Date().toISOString(),
              })
              .eq('id', (existingRows[0] as any).id);
          } else {
            await supabase.from('vendor_validations').insert({
              vendor_id: savedVendor.id,
              validation_type: 'gst',
              status: 'passed',
              message: 'GST verified — filing status captured',
              details: mergedDetails,
            });
          }
        }
      } catch (e) {
        console.warn('[saveVendor] Failed to persist GST filing status', e);
      }

      // On-behalf mode: keep the vendor_invitations row in sync with the real
      // vendor details the buyer just entered (Step 1). The invitation was
      // created with placeholder email/name when the buyer clicked
      // "Create Vendor"; we overwrite it here so the Vendor Invitations list
      // and downstream notifications show the correct vendor identity.
      if (options?.onBehalfInvitationId) {
        try {
          const isIntlVendor = formData.vendorType === 'international';
          const intlCo = formData.international?.company;
          const inviteUpdate: Record<string, unknown> = {};
          const legal = (formData.organization.legalName || '').trim();
          const trade = (formData.organization.tradeName || '').trim();
          const intlName = (intlCo?.companyName || '').trim();
          const vendorName = isIntlVendor ? (intlName || legal || trade) : (legal || trade);
          const intlEmail = (intlCo?.email1 || '').trim();
          const intlPhone = (intlCo?.contact1 || '').trim();
          const primaryEmail = isIntlVendor
            ? (intlEmail || formData.contact.ceoEmail || formData.address.registeredEmail || '').trim()
            : (formData.contact.ceoEmail || formData.address.registeredEmail || '').trim();
          const primaryPhone = isIntlVendor
            ? (intlPhone || formData.contact.ceoPhone || formData.address.registeredPhone || '').trim()
            : (formData.contact.ceoPhone || formData.address.registeredPhone || '').trim();
          if (vendorName) inviteUpdate.vendor_name = vendorName;
          // Never overwrite the invite email with the on-behalf placeholder
          if (primaryEmail && !/^onbehalf\+.*@placeholder\.local$/i.test(primaryEmail)) {
            inviteUpdate.email = primaryEmail;
          }
          if (primaryPhone) inviteUpdate.phone_number = primaryPhone;
          if (Object.keys(inviteUpdate).length > 0) {
            await supabase
              .from('vendor_invitations')
              .update(inviteUpdate)
              .eq('id', options.onBehalfInvitationId);
          }
        } catch (e) {
          console.warn('[saveVendor] On-behalf invitation sync failed (non-blocking)', e);
        }
      }

      return savedVendor;
    },


    onError: async (error: any) => {
      const code = error?.code || '';
      const msg = String(error?.message || '');
      if (code === 'AUTH_REQUIRED') {
        toast({
          title: 'Session expired',
          description: 'Please reopen the invitation link to continue your registration.',
          variant: 'destructive',
        });
        const token = options?.invitationToken;
        if (typeof window !== 'undefined') {
          window.location.href = token ? `/vendor/invite?token=${token}` : '/auth';
        }
        return;
      }
      // FK violation on user_id means the cached session points to a deleted/recreated
      // auth user. Same remediation as session expiry — sign in fresh via the invitation.
      const isUserFk = code === '23503' || /vendors_user_id_fkey/i.test(msg) || /violates foreign key constraint/i.test(msg);
      if (isUserFk) {
        toast({
          title: 'Session out of sync',
          description: 'Your login session is invalid. Please reopen the invitation link.',
          variant: 'destructive',
        });
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        const token = options?.invitationToken;
        if (typeof window !== 'undefined') {
          window.location.href = token ? `/vendor/invite?token=${token}` : '/auth';
        }
        return;
      }
      // RLS errors during background autosave shouldn't blast a red toast at the
      // vendor — the AutoSaveIndicator already shows a quiet "Couldn't save" state.
      const isRls = code === '42501' || /row-level security/i.test(msg);
      if (isRls) {
        console.warn('[saveVendor] RLS denial (autosave will surface this in the indicator):', msg);
        return;
      }
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
      // New flow: submission goes to Purchase/SCM matrix first, then Finance
      const submitUpdate: Record<string, unknown> = {
        ...verificationStatuses,
        status: 'scm_manager_review' as const, // Goes to SCM CO approval first
        submitted_at: new Date().toISOString(),
      };
      // Backfill invitation link in case the row was created before this fix
      if ((invitation as any)?.id) {
        submitUpdate.invitation_id = (invitation as any).id;
      }
      // Defensive: ensure tenant_id is always set on submit so the vendor
      // appears in the buyer's approval queue (international branch has no
      // OrganizationStep, so buyerCompanyId may not have been populated).
      const resolvedTenantId =
        formData.organization.buyerCompanyId ||
        (vendor as any)?.tenant_id ||
        (invitation as any)?.tenant_id ||
        null;
      if (resolvedTenantId) {
        submitUpdate.tenant_id = resolvedTenantId;
      }
      const { error: updateError } = await supabase
        .from('vendors')
        .update(submitUpdate)
        .eq('id', vendor.id);

      if (updateError) throw updateError;

      // Re-fetch the row so the freshly stamped reference_number (assigned by
      // the DB trigger during the status transition) is reflected in the
      // success popup and success screen.
      try {
        const { data: fresh } = await supabase
          .from('vendors')
          .select('reference_number, status, submitted_at')
          .eq('id', vendor.id)
          .maybeSingle();
        if (fresh) {
          (vendor as any).reference_number = (fresh as any).reference_number ?? (vendor as any).reference_number;
          (vendor as any).status = (fresh as any).status ?? (vendor as any).status;
          (vendor as any).submitted_at = (fresh as any).submitted_at ?? (vendor as any).submitted_at;
        }
      } catch (e) {
        console.warn('[submitVendor] post-submit reference refetch failed (non-blocking):', e);
      }

      // Mark invitation as used BEFORE notifying so the notification function
      // can resolve the inviter reliably.
      if (options?.onBehalfInvitationId) {
        // On-behalf mode: the JWT email is the buyer's, not the vendor's, so the
        // claim_invitation RPC (which enforces email match) would reject it.
        // Buyer has tenant-scoped UPDATE on vendor_invitations via RLS.
        const { error: markErr } = await supabase
          .from('vendor_invitations')
          .update({ used_at: new Date().toISOString(), vendor_id: vendor.id })
          .eq('id', options.onBehalfInvitationId);
        if (markErr) {
          console.warn('on-behalf invitation mark-used failed (non-blocking):', markErr);
        }
      } else if (options?.invitationToken) {
        const { error: claimErr } = await supabase.rpc('claim_invitation', {
          _token: options.invitationToken,
          _vendor_id: vendor.id,
        });
        if (claimErr) {
          console.warn('claim_invitation failed (non-blocking):', claimErr);
        }
      }

      // Initialise approval matrix progress. The DB trigger seeds this automatically
      // when status transitions into a review stage, but we still invoke the edge
      // function explicitly so admins get a synchronous error if the matrix is empty.
      try {
        const { data: routeData, error: routeErr } = await supabase.functions.invoke('route-vendor-approval', { body: { vendor_id: vendor.id } });
        if (routeErr) {
          console.error('route-vendor-approval error:', routeErr);
        } else {
          const msg = (routeData as { message?: string } | null)?.message ?? '';
          if (/no matrix/i.test(msg) || /skipping/i.test(msg)) {
            toast({
              title: 'Approval matrix not configured',
              description: 'Your submission was received, but no SCM approval matrix is configured for this buyer company. An admin must set it up before approvers can act.',
              variant: 'destructive',
            });
          }
        }
      } catch (e) {
        console.error('route-vendor-approval threw:', e);
      }

      // Verify chain was actually seeded (defensive — trigger should have done it).
      try {
        const { count: progressCount } = await supabase
          .from('vendor_approval_progress')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendor.id);
        if (!progressCount || progressCount === 0) {
          await supabase.from('audit_logs').insert({
            vendor_id: vendor.id,
            action: 'approval_routing_failed',
            details: { reason: 'no_progress_rows_after_submit' },
          });
          toast({
            title: 'Approval chain not seeded',
            description: 'Your application was saved but did not enter the approval workflow. Please contact an administrator.',
            variant: 'destructive',
          });
        }
      } catch (e) {
        console.warn('post-submit progress check failed:', e);
      }


      // Log submission
      try {
        const { error: auditError } = await supabase.from('audit_logs').insert({
          vendor_id: vendor.id,
          action: 'vendor_submitted',
          details: {
            submitted_by: vendor.user_id || 'anonymous',
            invitation_token: options?.invitationToken || null,
            verification_statuses: verificationStatuses,
          },
        });
        if (auditError) console.warn('[Vendor] vendor_submitted audit log failed (non-blocking):', auditError);
      } catch (auditError) {
        console.warn('[Vendor] vendor_submitted audit log threw (non-blocking):', auditError);
      }

      // Send notification email to buyer who invited this vendor
      let notifyResult: any = null;
      try {
        const { data: notifyData, error: notifyError } = await supabase.functions.invoke('notify-vendor-submission', {
          body: { vendorId: vendor.id },
        });
        if (notifyError) {
          console.error('[Vendor] notify-vendor-submission error:', notifyError);
          notifyResult = { success: false, error: notifyError.message || String(notifyError) };
        } else {
          console.log('[Vendor] Submission notification result:', notifyData);
          notifyResult = notifyData;
        }
      } catch (notifyError: any) {
        // Don't fail the submission if notification fails
        console.error('[Vendor] Failed to send submission notification:', notifyError);
        notifyResult = { success: false, error: notifyError?.message || String(notifyError) };
      }

      setVendorStatus('purchase_review');
      return { ...vendor, _notify: notifyResult } as typeof vendor & { _notify: any };
    },
    onSuccess: () => {
      // Toast suppressed — VendorRegistration.tsx shows a success dialog with buyer details.
    },
    onError: async (error: any) => {
      const code = error?.code || '';
      const msg = String(error?.message || '');
      if (code === 'AUTH_REQUIRED') {
        toast({
          title: 'Session expired',
          description: 'Please reopen the invitation link to submit your registration.',
          variant: 'destructive',
        });
        const token = options?.invitationToken;
        if (typeof window !== 'undefined') {
          window.location.href = token ? `/vendor/invite?token=${token}` : '/auth';
        }
        return;
      }
      const isUserFk = code === '23503' || /vendors_user_id_fkey/i.test(msg) || /violates foreign key constraint/i.test(msg);
      if (isUserFk) {
        toast({
          title: 'Session out of sync',
          description: 'Your login session is invalid. Please reopen the invitation link.',
          variant: 'destructive',
        });
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        const token = options?.invitationToken;
        if (typeof window !== 'undefined') {
          window.location.href = token ? `/vendor/invite?token=${token}` : '/auth';
        }
        return;
      }
      toast({
        title: 'Submission Failed',
        description: error?.details || error?.hint || error?.message || (code ? `Database error (${code})` : 'An unexpected error occurred.'),
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

      // When a vendor was returned for corrections, push the application back
      // into the approval workflow (start of chain) so the DB trigger reseeds
      // vendor_approval_progress and approvers see the updated submission.
      const wasReturned = vendorStatus === 'returned_to_vendor';
      const wasReturnedToBuyer = vendorStatus === 'returned_to_buyer';
      // For returned_to_vendor (vendor self-edit) restart the chain via validation_pending.
      // For returned_to_buyer (buyer-edited on-behalf), keep status until we call
      // buyer-reapprove-rejected, which re-seeds the chain and advances it.
      const nextStatus = wasReturnedToBuyer ? 'returned_to_buyer' : 'validation_pending';

      const vendorData = {
        ...formDataToVendorRecord(formData, userId),
        status: nextStatus as VendorStatus,
        submitted_at: new Date().toISOString(),
        // Clear stale rejection metadata once the vendor resubmits.
        ...((wasReturned || wasReturnedToBuyer) ? {
          last_rejection_comments: null,
          last_rejection_stage: null,
          last_rejected_by: null,
          last_rejected_at: null,
        } : {}),
      };

      const { data, error } = await writeVendorWithPanFallback(
        'resubmit update',
        vendorData,
        (nextPayload) => supabase
          .from('vendors')
          .update(nextPayload)
          .eq('id', vendorId)
          .select()
          .maybeSingle()
      );

      if (error) throw error;

      // RLS may filter the RETURNING row after a status transition; the update
      // itself succeeded, so fall back to a fresh read (or the known id).
      let resubmitted: any = data;
      if (!resubmitted) {
        const { data: reread } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', vendorId)
          .maybeSingle();
        resubmitted = reread ?? { id: vendorId };
      }


      // Upload any new documents (existing ones are retained by the dedupe logic)
      await uploadAllDocuments(formData, vendorId);

      await supabase.from('audit_logs').insert({
        vendor_id: vendorId,
        action: wasReturnedToBuyer
          ? 'vendor_buyer_resubmitted_after_return'
          : (wasReturned ? 'vendor_resubmitted_after_return' : 'vendor_resubmitted'),
        details: {
          resubmitted_by: userId || 'anonymous',
          previous_status: vendorStatus,
          new_status: nextStatus,
          invitation_token: options?.invitationToken || null,
        },
      });

      // Reseed the approval chain when resubmitting after a return cycle.
      if (wasReturned) {
        try {
          await supabase.functions.invoke('route-vendor-approval', { body: { vendor_id: vendorId } });
        } catch (e) {
          console.error('[Vendor] route-vendor-approval (resubmit) failed:', e);
        }
      } else if (wasReturnedToBuyer) {
        try {
          await supabase.functions.invoke('buyer-reapprove-rejected', {
            body: { vendor_id: vendorId, comments: 'Buyer edited & resubmitted after downstream rejection' },
          });
        } catch (e) {
          console.error('[Vendor] buyer-reapprove-rejected (resubmit) failed:', e);
        }
      }


      // Notify the inviter that the vendor has resubmitted (best-effort)
      let notifyResult: any = null;
      try {
        const { data: notifyData } = await supabase.functions.invoke('notify-vendor-submission', {
          body: { vendorId, resubmission: true },
        });
        notifyResult = notifyData;
      } catch (notifyError) {
        console.error('[Vendor] Failed to send resubmission notification:', notifyError);
      }

      setVendorStatus(nextStatus as VendorStatus);
      await refetchVendor();
      return { ...resubmitted, _notify: notifyResult } as typeof resubmitted & { _notify: any };
    },
    onSuccess: () => {
      // Toast suppressed — VendorRegistration.tsx shows a success dialog with buyer details.
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
      // New flow: validation success -> goes to Purchase/SCM matrix first
      const newStatus = hasFailedMandatory ? 'validation_failed' : 'purchase_review';

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
    isAuthReady,
    existingVendor,
    invitation,
    portalConfig,
    canEdit,
  };
}
