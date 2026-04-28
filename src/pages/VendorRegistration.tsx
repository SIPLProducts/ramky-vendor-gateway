import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { HorizontalStepIndicator } from '@/components/vendor/HorizontalStepIndicator';
import { SuccessScreen } from '@/components/vendor/SuccessScreen';
import { FeedbackPopup } from '@/components/vendor/FeedbackPopup';
import { OrganizationStep } from '@/components/vendor/steps/OrganizationStep';
import { AddressStep } from '@/components/vendor/steps/AddressStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { FinancialInfrastructureStep } from '@/components/vendor/steps/FinancialInfrastructureStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
import { DocumentVerificationStep, VerifiedDocumentData } from '@/components/vendor/steps/DocumentVerificationStep';
import { DynamicStep } from '@/components/vendor/DynamicStep';
import { useDynamicFormSchema } from '@/hooks/useDynamicFormSchema';
import { RegistrationStatus } from '@/components/vendor/RegistrationStatusTracker';
import { VendorFormData, OrganizationDetails, AddressDetails, ContactDetails, StatutoryDetails, BankDetails, FinancialDetails, InfrastructureDetails, QHSEDetails } from '@/types/vendor';
import { useToast } from '@/hooks/use-toast';
import { useVendorRegistration } from '@/hooks/useVendorRegistration';
import { HelpCircle, Phone, Mail, MessageSquare, X, Save, ChevronLeft, ChevronRight, Send, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AutoSaveIndicator, type AutoSaveState } from '@/components/vendor/AutoSaveIndicator';
import { CompletenessRing } from '@/components/vendor/CompletenessRing';
import { useFormCompleteness } from '@/hooks/useFormCompleteness';

// 6-step built-in registration flow — Step 1 is the OCR + verification gate.
// Custom admin-defined tabs are inserted between step 5 (Fin/Infra) and the
// final Review step at runtime.
const builtInSteps = [
  { id: 1, title: 'Document Verification', description: 'Upload & auto-verify PAN, GST, MSME, Bank' },
  { id: 2, title: 'Organization Profile', description: 'Company, statutory & memberships' },
  { id: 3, title: 'Address Information', description: 'Registered, manufacturing & branch' },
  { id: 4, title: 'Contact Details', description: 'Key contact persons' },
  { id: 5, title: 'Financial & Infrastructure', description: 'Turnover, facility & QHSE' },
  // Custom tabs slot in here at runtime (ids 6..N)
  // Review is always the last step
];
const REVIEW_TITLE = 'Review & Submit';
const REVIEW_DESCRIPTION = 'Verify and submit application';

const initialFormData: VendorFormData = {
  organization: { buyerCompanyId: '', legalName: '', tradeName: '', industryType: '', organizationType: '', ownershipType: '', productCategories: [] },
  address: { registeredAddress: '', registeredAddressLine2: '', registeredAddressLine3: '', registeredCity: '', registeredState: '', registeredPincode: '', registeredPhone: '', registeredFax: '', registeredWebsite: '', sameAsRegistered: true, manufacturingAddress: '', manufacturingAddressLine2: '', manufacturingAddressLine3: '', manufacturingCity: '', manufacturingState: '', manufacturingPincode: '', manufacturingPhone: '', manufacturingFax: '', branchName: '', branchAddress: '', branchCity: '', branchState: '', branchPincode: '', branchCountry: 'India', branchWebsite: '', branchContactName: '', branchContactDesignation: '', branchContactEmail: '', branchContactPhone: '', branchContactFax: '' },
  contact: { ceoName: '', ceoDesignation: '', ceoPhone: '', ceoEmail: '', marketingName: '', marketingDesignation: '', marketingPhone: '', marketingEmail: '', productionName: '', productionDesignation: '', productionPhone: '', productionEmail: '', customerServiceName: '', customerServiceDesignation: '', customerServicePhone: '', customerServiceEmail: '' },
  statutory: { firmRegistrationNo: '', pan: '', pfNumber: '', esiNumber: '', isGstRegistered: true, gstin: '', gstDeclarationReason: '', gstSelfDeclarationFile: null, gstConstitutionOfBusiness: '', gstPrincipalPlaceOfBusiness: '', gstAdditionalPlaces: [], gstRegistrationDate: '', gstStatus: '', gstTaxpayerType: '', gstBusinessNature: [], gstJurisdictionCentre: '', gstJurisdictionState: '', isMsmeRegistered: false, msmeNumber: '', msmeCategory: '', labourPermitNo: '', iecNo: '', entityType: '', memberships: [], enlistments: [], certifications: [], operationalNetwork: '', gstCertificateFile: null, panCardFile: null, msmeCertificateFile: null },
  bank: { bankName: '', branchName: '', accountNumber: '', confirmAccountNumber: '', accountType: 'current', accountTypeOther: '', ifscCode: '', micrCode: '', bankAddress: '', cancelledChequeFile: null },
  financial: { turnoverYear1: '', turnoverYear2: '', turnoverYear3: '', creditPeriodExpected: '', majorCustomer1: '', majorCustomer2: '', majorCustomer3: '', authorizedDistributorName: '', authorizedDistributorAddress: '', dealershipCertificateFile: null, financialDocsFile: null },
  infrastructure: { rawMaterialsUsed: '', machineryAvailability: '', equipmentAvailability: '', powerSupply: '', waterSupply: '', dgCapacity: '', productionCapacity: '', storeCapacity: '', supplyCapacity: '', manpower: '', inspectionTesting: '', nearestRailway: '', nearestBusStation: '', nearestAirport: '', nearestPort: '', productTypes: [], productTypesOther: '', productionFacilities: [], leadTimeRequired: '' },
  qhse: { qualityIssues: '', healthIssues: '', environmentalIssues: '', safetyIssues: '' },
  declaration: { selfDeclared: false, termsAccepted: false },
};

export default function VendorRegistration() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [formData, setFormData] = useState<VendorFormData>(initialFormData);
  const [verifiedData, setVerifiedData] = useState<VerifiedDocumentData | undefined>(undefined);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [vendorStatusState, setVendorStatusState] = useState<RegistrationStatus>('draft');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [stepValidationState, setStepValidationState] = useState<Record<number, boolean>>({});
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [isTokenMode, setIsTokenMode] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState<string>('');
  const formDataLoadedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { saveVendor, submitVendor, resubmitVendor, runValidations, isSaving, isSubmitting, vendorId, vendorStatus, existingFormData, isLoadingVendor, existingVendor } = useVendorRegistration({
    invitationToken: invitationToken || undefined,
  });

  // Custom field values keyed by step_key -> field_name -> value
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, Record<string, unknown>>>({});

  // Pull dynamic schema for this vendor's tenant (admin-defined extra tabs)
  const tenantId = (existingVendor as { tenant_id?: string } | null)?.tenant_id || formData.organization.buyerCompanyId || null;
  const { data: dynamicSchema } = useDynamicFormSchema(tenantId);
  const customSteps = dynamicSchema?.steps || [];
  const fieldsByStep = dynamicSchema?.fieldsByStep || {};

  // Build the runtime step list: built-in 1..5 + custom tabs + Review (last)
  const registrationSteps = useMemo(() => {
    const list: Array<{ id: number; title: string; description: string; stepKey?: string }> = builtInSteps.map((s) => ({ ...s }));
    customSteps.forEach((cs, i) => {
      list.push({ id: 6 + i, title: cs.step_label, description: cs.step_description || '', stepKey: cs.step_key });
    });
    list.push({ id: 6 + customSteps.length, title: REVIEW_TITLE, description: REVIEW_DESCRIPTION });
    return list;
  }, [customSteps]);

  // Hydrate custom values from existing vendor on load
  useEffect(() => {
    const v = existingVendor as { custom_field_values?: Record<string, Record<string, unknown>> } | null;
    if (v?.custom_field_values && Object.keys(v.custom_field_values).length > 0) {
      setCustomFieldValues(v.custom_field_values);
    }
  }, [existingVendor]);

  // Validate token on mount and check authentication
  useEffect(() => {
    const validateToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setTokenError('Access denied. This page requires a valid invitation link.');
        setIsValidatingToken(false);
        return;
      }

      // Validate the token via SECURITY DEFINER RPC (avoids RLS denial)
      try {
        const { data: rows, error } = await supabase
          .rpc('get_invitation_by_token', { _token: token });

        if (error) {
          console.error('Token lookup failed:', error);
          setTokenError('We could not verify your invitation right now. Please try again in a moment.');
          setIsValidatingToken(false);
          return;
        }

        const invitation = Array.isArray(rows) ? rows[0] : rows;
        if (!invitation) {
          setTokenError('Invalid invitation link. Please contact the administrator.');
          setIsValidatingToken(false);
          return;
        }

        const expiresAt = new Date(invitation.expires_at);
        if (expiresAt < new Date()) {
          setTokenError('This invitation link has expired. Please request a new one.');
          setIsValidatingToken(false);
          return;
        }

        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();

        // Always require authentication for vendor registration
        if (!session) {
          // Redirect to login page
          navigate(`/vendor/invite?token=${token}`);
          return;
        }

        // Verify the logged-in email matches the invitation email
        if (session.user.email !== invitation.email) {
          setTokenError('This invitation is for a different email. Please log in with the correct account.');
          setIsValidatingToken(false);
          return;
        }

        // Check if authenticated user already has a vendor record
        if (session) {
          const { data: existingVendorRecord } = await supabase
            .from('vendors')
            .select('id, status')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingVendorRecord) {
            // Check if it's a draft - allow editing
            if (existingVendorRecord.status === 'draft') {
              console.log('[Token] Draft vendor record found - allowing form editing');
              setInvitationToken(token);
              setInvitationEmail(invitation.email);
              setIsTokenMode(true);
              setIsValidatingToken(false);
              // Don't set isSubmitted - let the form load with existing data
              return;
            }

            // User has already submitted the form - show status screen
            console.log('[Token] Existing vendor record found - showing status screen');
            setInvitationToken(token);
            setInvitationEmail(invitation.email);
            setIsTokenMode(true);
            setIsSubmitted(true);
            setVendorStatusState(existingVendorRecord.status as RegistrationStatus);
            setIsValidatingToken(false);
            return;
          }
        }

        // Check if form has been submitted via invitation
        if (invitation.used_at) {
          // After submission, allow unlimited access to view progress
          console.log('[Token] Form already submitted - allowing access to view progress');
          setInvitationToken(token);
          setInvitationEmail(invitation.email);
          setIsTokenMode(true);
          setIsSubmitted(true); // Show success screen instead of form

          // Fetch vendor status for the authenticated user (RLS-safe)
          const { data: vendor } = await supabase
            .from('vendors')
            .select('status')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (vendor) {
            setVendorStatusState(vendor.status as RegistrationStatus);
          }

          setIsValidatingToken(false);
          return;
        }

        // Authenticated user — proceed. Access counting is handled server-side
        // by the dedicated RPC on the public login screen, so no client-side update.
        console.log('[Token] Authenticated access granted');

        // Token is valid - enable token mode
        setInvitationToken(token);
        setInvitationEmail(invitation.email);
        setIsTokenMode(true);
        setIsValidatingToken(false);

        // Token is valid - enable token mode
        setInvitationToken(token);
        setInvitationEmail(invitation.email);
        setIsTokenMode(true);
        setIsValidatingToken(false);
      } catch (err) {
        console.error('Token validation error:', err);
        setTokenError('Failed to validate invitation. Please try again.');
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [searchParams, navigate]);

  // Block navigation when in token mode
  useEffect(() => {
    if (!isTokenMode) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      toast({
        title: 'Navigation Blocked',
        description: 'Please complete the registration form.',
        variant: 'default',
      });
    };

    // Block keyboard shortcuts that might allow navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F5, Ctrl+R (refresh)
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        toast({
          title: 'Refresh Blocked',
          description: 'Please complete the registration form. Your progress is auto-saved.',
          variant: 'default',
        });
      }
      // Block Ctrl+W (close tab)
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
      }
    };

    // Push initial state
    window.history.pushState(null, '', window.location.href);

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTokenMode, toast]);

  const handleValidationStateChange = (step: number) => (isValid: boolean) => {
    setStepValidationState(prev => ({ ...prev, [step]: isValid }));
  };

  const canProceedFromCurrentStep = () => {
    // Step 1 (Document Verification) — trust the child's authoritative completion flag
    if (currentStep === 1) {
      if (!verifiedData) return false;
      // Primary source of truth: child's explicit completion status
      if (verifiedData.step1Status?.allDone) return true;
      // Defensive fallback (covers legacy snapshots without step1Status)
      const gstOk =
        verifiedData.isGstRegistered === true
          ? !!verifiedData.gst
          : verifiedData.isGstRegistered === false
            ? !!verifiedData.gstSelfDeclarationFile &&
              !!verifiedData.manualLegalName &&
              !!verifiedData.manualAddress?.address &&
              !!verifiedData.manualAddress?.city &&
              !!verifiedData.manualAddress?.state &&
              !!verifiedData.manualAddress?.pincode
            : false;
      const msmeOk = verifiedData.isMsmeRegistered === false || !!verifiedData.msme;
      return gstOk && !!verifiedData.pan && msmeOk && !!verifiedData.bank;
    }
    // Steps 2–5 are presentational — Continue is always allowed; the embedded
    // form's own validation (zod) gates submission of each step.
    return true;
  };

  const getValidationMessage = () => {
    if (currentStep === 1 && !canProceedFromCurrentStep()) {
      return 'Complete each stage in order: GST → PAN → MSME → Bank';
    }
    return undefined;
  };

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === registrationSteps.length;

  useEffect(() => {
    if (existingFormData && vendorStatus && !formDataLoadedRef.current) {
      formDataLoadedRef.current = true;
      const editableStatuses = ['draft', 'validation_failed', 'finance_rejected', 'purchase_rejected'];
      const pendingStatuses = ['submitted', 'validation_pending', 'finance_review', 'purchase_review', 'finance_approved', 'purchase_approved', 'sap_synced'];
      if (editableStatuses.includes(vendorStatus)) {
        setFormData(existingFormData);
        setVendorStatusState(vendorStatus);
        // For draft status, allow user to continue from where they left off
        // Mark steps as completed based on filled data
        if (vendorStatus === 'draft') {
          const filledSteps: number[] = [];
          // Step 1 = doc verification — assume completed if we already have key fields
          if (existingFormData.statutory?.pan && existingFormData.statutory?.gstin && existingFormData.bank?.accountNumber) {
            filledSteps.push(1);
            // Pre-seed verifiedData so Step 1 shows green tiles when revisited
            setVerifiedData({
              pan: { number: existingFormData.statutory.pan, holderName: existingFormData.organization?.legalName || '' },
              gst: { gstin: existingFormData.statutory.gstin, legalName: existingFormData.organization?.legalName || '' },
              msme: existingFormData.statutory?.msmeNumber ? { udyamNumber: existingFormData.statutory.msmeNumber, enterpriseName: existingFormData.organization?.legalName || '', enterpriseType: existingFormData.statutory?.msmeCategory ? (existingFormData.statutory.msmeCategory.charAt(0).toUpperCase() + existingFormData.statutory.msmeCategory.slice(1)) : undefined } : undefined,
              bank: { accountNumber: existingFormData.bank.accountNumber, ifsc: existingFormData.bank.ifscCode || '', bankName: existingFormData.bank.bankName || '' },
            });
          }
          if (existingFormData.organization?.legalName) filledSteps.push(2);
          if (existingFormData.address?.registeredAddress) filledSteps.push(3);
          if (existingFormData.contact?.ceoName) filledSteps.push(4);
          if (existingFormData.financial?.creditPeriodExpected || existingFormData.infrastructure?.rawMaterialsUsed) filledSteps.push(5);
          setCompletedSteps(filledSteps);
          // Go to the first incomplete step or step 1
          const allSteps = [1, 2, 3, 4, 5, 6];
          const nextStep = filledSteps.length > 0 ? Math.min(...allSteps.filter(s => !filledSteps.includes(s))) : 1;
          setCurrentStep(nextStep || 6);
        } else {
          setIsSubmitted(true);
          setIsEditMode(false);
        }
      } else if (pendingStatuses.includes(vendorStatus)) {
        setFormData(existingFormData);
        setVendorStatusState(vendorStatus);
        setIsSubmitted(true);
      }
    }
  }, [existingFormData, vendorStatus]);

  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase.channel(`vendor-status-${vendorId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vendors', filter: `id=eq.${vendorId}` }, (payload) => {
      setVendorStatusState(payload.new.status as RegistrationStatus);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendorId]);

  // -------- Auto-save (debounced) --------
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>('');
  const isFirstAutoSaveRef = useRef(true);

  useEffect(() => {
    // Skip while loading / submitted / token still validating
    if (isLoadingVendor || isValidatingToken || isSubmitted) return;
    // Need at least an invitation token (vendor will be created on first save) or an existing vendorId
    if (!invitationToken && !vendorId) return;

    // Skip the very first run after mount so we don't save unchanged loaded data
    if (isFirstAutoSaveRef.current) {
      isFirstAutoSaveRef.current = false;
      lastSavedHashRef.current = JSON.stringify(formData);
      return;
    }

    const hash = JSON.stringify(formData);
    if (hash === lastSavedHashRef.current) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaveState('saving');
        await saveVendor(formData);
        lastSavedHashRef.current = hash;
        setLastSavedAt(new Date());
        setAutoSaveState('saved');
      } catch (err) {
        console.warn('Auto-save failed:', err);
        setAutoSaveState('error');
      }
    }, 2500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [formData, invitationToken, vendorId, isLoadingVendor, isValidatingToken, isSubmitted, saveVendor]);

  // Per-step + overall completeness
  const completeness = useFormCompleteness(formData, verifiedData);


  const handleStartEdit = () => { setIsEditMode(true); setIsSubmitted(false); setCurrentStep(1); setCompletedSteps([1, 2, 3, 4, 5]); };

  // Pure helper — merges Step-1 verified data into a form snapshot.
  // Used by both live stage updates and Save Draft so they always agree.
  const mergeVerifiedDataIntoForm = (prev: VendorFormData, data: VerifiedDocumentData): VendorFormData => {
    const gstYes = data.isGstRegistered === true;
    const legalName =
      (gstYes ? data.gst?.legalName : data.manualLegalName) ||
      data.pan?.holderName ||
      '';
    const tradeName = data.gst?.tradeName || '';
    const principalPlace = data.gst?.principalPlaceOfBusiness || data.gst?.address || '';

    return {
      ...prev,
      organization: {
        ...prev.organization,
        legalName: legalName || prev.organization.legalName,
        tradeName: tradeName || prev.organization.tradeName,
      },
      address: {
        ...prev.address,
        registeredAddress: gstYes
          ? (principalPlace || prev.address.registeredAddress)
          : (data.manualAddress?.address || prev.address.registeredAddress),
        registeredCity: gstYes ? prev.address.registeredCity : (data.manualAddress?.city || prev.address.registeredCity),
        registeredState: gstYes ? prev.address.registeredState : (data.manualAddress?.state || prev.address.registeredState),
        registeredPincode: gstYes ? prev.address.registeredPincode : (data.manualAddress?.pincode || prev.address.registeredPincode),
      },
      statutory: {
        ...prev.statutory,
        isGstRegistered: data.isGstRegistered ?? prev.statutory.isGstRegistered,
        gstDeclarationReason: data.gstDeclarationReason || prev.statutory.gstDeclarationReason,
        gstSelfDeclarationFile: data.gstSelfDeclarationFile ?? prev.statutory.gstSelfDeclarationFile,
        gstin: data.gst?.gstin || prev.statutory.gstin,
        gstConstitutionOfBusiness: data.gst?.constitutionOfBusiness || prev.statutory.gstConstitutionOfBusiness,
        gstPrincipalPlaceOfBusiness: principalPlace || prev.statutory.gstPrincipalPlaceOfBusiness,
        gstAdditionalPlaces: data.gst?.additionalPlaces ?? prev.statutory.gstAdditionalPlaces,
        gstRegistrationDate: data.gst?.registrationDate || prev.statutory.gstRegistrationDate,
        gstStatus: data.gst?.status || prev.statutory.gstStatus,
        gstTaxpayerType: data.gst?.taxpayerType || prev.statutory.gstTaxpayerType,
        gstBusinessNature: data.gst?.businessNature ?? prev.statutory.gstBusinessNature,
        gstJurisdictionCentre: data.gst?.jurisdictionCentre || prev.statutory.gstJurisdictionCentre,
        gstJurisdictionState: data.gst?.jurisdictionState || prev.statutory.gstJurisdictionState,
        pan: data.pan?.number || prev.statutory.pan,
        isMsmeRegistered: data.isMsmeRegistered ?? prev.statutory.isMsmeRegistered,
        msmeNumber: data.msme?.udyamNumber || prev.statutory.msmeNumber,
        // Carry the actual uploaded files into the form so draft saves include them
        gstCertificateFile: data.gstCertificateFile ?? prev.statutory.gstCertificateFile,
        panCardFile: data.panCardFile ?? prev.statutory.panCardFile,
        msmeCertificateFile: data.msmeCertificateFile ?? prev.statutory.msmeCertificateFile,
      },
      bank: {
        ...prev.bank,
        accountNumber: data.bank?.accountNumber || prev.bank.accountNumber,
        confirmAccountNumber: data.bank?.accountNumber || prev.bank.confirmAccountNumber,
        ifscCode: data.bank?.ifsc || prev.bank.ifscCode,
        bankName: data.bank?.bankName || prev.bank.bankName,
        branchName: data.bank?.branchName || prev.bank.branchName,
        accountType: (data.bank?.accountType as BankDetails['accountType']) || prev.bank.accountType || 'current',
        bankAddress: data.bank?.bankAddress || prev.bank.bankAddress,
        cancelledChequeFile: data.cancelledChequeFile ?? prev.bank.cancelledChequeFile,
      },
    };
  };

  // Holds the most recent Step-1 snapshot from the child, even if React hasn't
  // flushed setState yet — used by Save Draft to avoid stale renders.
  const latestStep1DataRef = useRef<VerifiedDocumentData | null>(null);

  const handleDocStageChange = (data: VerifiedDocumentData) => {
    latestStep1DataRef.current = data;
    setVerifiedData(data);
    setFormData((prev) => {
      const next = mergeVerifiedDataIntoForm(prev, data);
      // Avoid no-op updates that would re-trigger autosave
      const prevKey = JSON.stringify({ o: prev.organization, a: prev.address, s: prev.statutory, b: prev.bank });
      const nextKey = JSON.stringify({ o: next.organization, a: next.address, s: next.statutory, b: next.bank });
      return prevKey === nextKey ? prev : next;
    });
  };

  const handleDocVerificationComplete = (data: VerifiedDocumentData) => {
    latestStep1DataRef.current = data;
    setVerifiedData(data);
    setFormData((prev) => mergeVerifiedDataIntoForm(prev, data));
    if (!completedSteps.includes(1)) setCompletedSteps((prev) => [...prev, 1]);
    setCurrentStep(2);
  };


  const handleStepComplete = (step: number, data: unknown) => {
    // step is the new step number; map to form key
    const stepKeys: Record<number, keyof VendorFormData> = {
      3: 'address',
      4: 'contact',
    };
    const key = stepKeys[step];
    if (key) setFormData((prev) => ({ ...prev, [key]: data }));
    if (!completedSteps.includes(step)) setCompletedSteps((prev) => [...prev, step]);
    setCurrentStep(step + 1);
  };

  // Step 2 emits both organization + statutory (statutory & memberships moved here)
  const handleOrganizationComplete = (data: { organization: OrganizationDetails; statutory: StatutoryDetails }) => {
    setFormData((prev) => ({ ...prev, organization: data.organization, statutory: data.statutory }));
    if (!completedSteps.includes(2)) setCompletedSteps((prev) => [...prev, 2]);
    setCurrentStep(3);
  };

  const handleFinancialInfraComplete = (data: { financial: FinancialDetails; infrastructure: InfrastructureDetails; qhse: QHSEDetails }) => {
    setFormData((prev) => ({
      ...prev,
      financial: data.financial,
      infrastructure: data.infrastructure,
      qhse: data.qhse,
    }));
    if (!completedSteps.includes(5)) setCompletedSteps((prev) => [...prev, 5]);
    setCurrentStep(6);
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(1, prev - 1));
  const handleStepClick = (step: number) => { if (completedSteps.includes(step) || step <= currentStep) setCurrentStep(step); };
  const handleEditStep = (step: number) => setCurrentStep(step);

  const handleSaveAsDraft = async () => {
    try {
      setAutoSaveState('saving');
      // On Step 1, build payload from the freshest lifted snapshot so we don't
      // miss the user's latest OCR edit / verification (state may not have flushed yet).
      const payload =
        currentStep === 1 && latestStep1DataRef.current
          ? mergeVerifiedDataIntoForm(formData, latestStep1DataRef.current)
          : formData;
      await saveVendor(payload);
      lastSavedHashRef.current = JSON.stringify(payload);
      setLastSavedAt(new Date());
      setAutoSaveState('saved');
      toast({ title: 'Draft Saved', description: 'Your progress has been saved.' });
    } catch (error) {
      setAutoSaveState('error');
      toast({ title: 'Save Failed', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    }
  };

  const handleCancel = () => {
    if (isTokenMode) {
      toast({
        title: 'Cannot Cancel',
        description: 'Please complete the registration or close this window.',
        variant: 'default'
      });
      return;
    }
    toast({ title: 'Registration Cancelled' });
    navigate('/');
  };

  const handleSubmit = async () => {
    try {
      const vendor = isEditMode && vendorId ? await resubmitVendor(formData) : await submitVendor(formData);

      // Mark invitation as used via SECURITY DEFINER RPC (RLS-safe)
      if (invitationToken) {
        const { error: claimErr } = await supabase.rpc('claim_invitation', {
          _token: invitationToken,
          _vendor_id: vendor.id,
        });
        if (claimErr) {
          console.warn('claim_invitation failed (non-blocking):', claimErr);
        }
      }

      setIsSubmitted(true); setIsEditMode(false); setVendorStatusState('finance_review');
      toast({ title: isEditMode ? 'Application Resubmitted' : 'Application Submitted' });
      setShowFeedback(true);
      // Skip runValidations since frontend already validated
    } catch (error) {
      // Surface the deepest message we can find — Supabase errors often nest details/hint
      const err = error as { message?: string; details?: string; hint?: string; code?: string } | null;
      const description =
        err?.message ||
        err?.details ||
        err?.hint ||
        (err?.code ? `Database error (${err.code})` : '') ||
        (typeof error === 'string' ? error : '') ||
        'An unexpected error occurred. Please check your data and try again.';
      console.error('[VendorRegistration] Submit failed:', error);
      toast({ title: 'Submission Failed', description, variant: 'destructive' });
    }
  };

  const renderStep = () => {
    // Built-in steps 1..5
    switch (currentStep) {
      case 1:
        return <DocumentVerificationStep vendorId={vendorId} initialData={verifiedData} onComplete={handleDocVerificationComplete} onStageChange={handleDocStageChange} />;
      case 2:
        return <OrganizationStep data={formData.organization} statutoryData={formData.statutory} onNext={handleOrganizationComplete} />;
      case 3:
        return <AddressStep data={formData.address} onNext={(data) => handleStepComplete(3, data)} onBack={handleBack} />;
      case 4:
        return <ContactStep data={formData.contact} onNext={(data) => handleStepComplete(4, data)} onBack={handleBack} />;
      case 5:
        return <FinancialInfrastructureStep financialData={formData.financial} infrastructureData={formData.infrastructure} qhseData={formData.qhse} onNext={handleFinancialInfraComplete} onBack={handleBack} />;
    }
    // Last step is always Review
    if (currentStep === registrationSteps.length) {
      return <ReviewStep data={formData} onSubmit={handleSubmit} onBack={handleBack} onEditStep={handleEditStep} />;
    }
    // Anything in between is an admin-defined custom tab (ids 6..N-1)
    const customIdx = currentStep - 6;
    const customStep = customSteps[customIdx];
    if (customStep) {
      const fields = fieldsByStep[customStep.step_key] || [];
      return (
        <DynamicStep
          stepKey={customStep.step_key}
          fields={fields}
          values={customFieldValues[customStep.step_key] || {}}
          onChange={(next) => setCustomFieldValues((prev) => ({ ...prev, [customStep.step_key]: next }))}
        />
      );
    }
    return null;
  };

  if (isLoadingVendor || isValidatingToken) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;

  // Show error if token validation failed
  if (tokenError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <X className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">{tokenError}</p>
          <p className="text-sm text-muted-foreground">
            Please contact the administrator for a new invitation link.
          </p>
        </div>
      </div>
    );
  }

  if (isSubmitted && !isEditMode) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-14 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          {isTokenMode ? (
            <div className="flex items-center gap-3">
              <img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" />
              <span className="text-sm font-semibold text-foreground">Vendor Portal</span>
            </div>
          ) : (
            <Link to="/" className="flex items-center gap-3">
              <img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" />
              <span className="text-sm font-semibold text-foreground hidden sm:block">Vendor Portal</span>
            </Link>
          )}
        </header>
        <SuccessScreen
          status={vendorStatusState}
          vendorId={vendorId || undefined}
          financeComments={existingVendor?.finance_comments}
          purchaseComments={existingVendor?.purchase_comments}
          onEdit={isTokenMode ? undefined : handleStartEdit}
        />
        <FeedbackPopup open={showFeedback} onOpenChange={setShowFeedback} vendorId={vendorId || undefined} />
      </div>
    );
  }

  const canProceed = canProceedFromCurrentStep();
  const validationMessage = getValidationMessage();

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)] flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        {isTokenMode ? (
          <div className="flex items-center gap-3">
            <img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" />
            <span className="text-sm font-semibold text-foreground">Vendor Registration</span>
          </div>
        ) : (
          <Link to="/" className="flex items-center gap-3">
            <img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" />
            <span className="text-sm font-semibold text-foreground hidden sm:block">Vendor Portal</span>
          </Link>
        )}
        <div className="flex items-center gap-4">
          <AutoSaveIndicator state={autoSaveState} lastSavedAt={lastSavedAt} className="hidden sm:flex" />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Help</span>
              </Button>
            </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Help & Support</SheetTitle>
              <SheetDescription>Need assistance with registration?</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Email Support</p>
                  <p className="text-sm text-muted-foreground">vendor.support@ramky.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Phone Support</p>
                  <p className="text-sm text-muted-foreground">+91 40 2354 6789</p>
                </div>
              </div>
              <Link to="/support" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <MessageSquare className="h-4 w-4" />Visit Help Center
              </Link>
            </div>
          </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col flex-1 max-w-[1280px] mx-auto w-full">
        {/* Horizontal Step Indicator (sticky bar above the form card) */}
        <div className="sticky top-14 z-40 bg-card border-b shadow-sm px-4 sm:px-6 py-3">
          {/* Desktop / tablet: full horizontal stepper */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <HorizontalStepIndicator
                steps={registrationSteps}
                currentStep={currentStep}
                completedSteps={completedSteps}
                onStepClick={handleStepClick}
              />
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 pl-4 border-l min-w-[120px]">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold text-foreground leading-none">{completeness.overall}%</span>
                <span className="text-[11px] text-muted-foreground">complete</span>
              </div>
              <AutoSaveIndicator state={autoSaveState} lastSavedAt={lastSavedAt} />
            </div>
          </div>

          {/* Mobile: compact pill + thin progress bar */}
          <div className="md:hidden space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-semibold shrink-0">
                  Step {currentStep} of {registrationSteps.length}
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  {registrationSteps[currentStep - 1]?.title}
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground shrink-0">{completeness.overall}%</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${completeness.overall}%` }}
              />
            </div>
            <AutoSaveIndicator state={autoSaveState} lastSavedAt={lastSavedAt} />
          </div>
        </div>

        {/* Form Card */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="bg-card rounded-[10px] shadow-enterprise-md border">
            {/* Form Header */}
            <div className="px-6 py-4 border-b">
              {isTokenMode && invitationEmail && (
                <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Invited Email:</span> {invitationEmail}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {currentStep === 1 && <span className="text-lg">🛡️</span>}
                  {currentStep === 2 && <span className="text-lg">🏢</span>}
                  {currentStep === 3 && <span className="text-lg">📍</span>}
                  {currentStep === 4 && <span className="text-lg">👤</span>}
                  {currentStep === 5 && <span className="text-lg">💰</span>}
                  {currentStep === 6 && <span className="text-lg">✓</span>}
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {registrationSteps[currentStep - 1]?.title}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {registrationSteps[currentStep - 1]?.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6">
              {renderStep()}
            </div>

            {/* Action Bar - Inside Card */}
            <div className="px-6 py-4 border-t bg-muted/30 rounded-b-[10px]">
              {/* Validation Warning */}
              {!canProceed && validationMessage && (
                <div className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-warning/10 text-warning-foreground rounded-lg border border-warning/30">
                  <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-sm font-medium">{validationMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                {/* Left side - Cancel (hidden in token mode) */}
                {!isTokenMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancel}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
                {isTokenMode && <div />} {/* Spacer */}

                {/* Right side - Navigation and Actions */}
                <div className="flex items-center gap-3">
                  {/* Save as Draft */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAsDraft}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Draft
                  </Button>

                  {/* Back Button */}
                  {!isFirstStep && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                  )}

                  {/* Next / Submit Button */}
                  {isLastStep ? (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="min-w-[160px]"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Submit Application
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      form="step-form"
                      disabled={!canProceed}
                      className={cn(
                        "min-w-[120px]",
                        !canProceed && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
