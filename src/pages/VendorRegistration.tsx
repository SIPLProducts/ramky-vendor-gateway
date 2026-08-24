import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { HorizontalStepIndicator } from '@/components/vendor/HorizontalStepIndicator';
import { SuccessScreen } from '@/components/vendor/SuccessScreen';
import { SubmissionSuccessDialog } from '@/components/vendor/SubmissionSuccessDialog';
import { OrganizationStep } from '@/components/vendor/steps/OrganizationStep';
import { AddressStep } from '@/components/vendor/steps/AddressStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { FinancialInfrastructureStep } from '@/components/vendor/steps/FinancialInfrastructureStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
import { DocumentVerificationStep, VerifiedDocumentData } from '@/components/vendor/steps/DocumentVerificationStep';
import { DynamicStep } from '@/components/vendor/DynamicStep';
import { useDynamicFormSchema } from '@/hooks/useDynamicFormSchema';
import { RegistrationStatus } from '@/components/vendor/RegistrationStatusTracker';
import { VendorFormData, OrganizationDetails, AddressDetails, ContactDetails, StatutoryDetails, BankDetails, FinancialDetails, InfrastructureDetails, QHSEDetails, VendorOriginType, InternationalData, InternationalDocuments, InternationalCompanyDetails, InternationalBankDetails, InternationalClassification, EMPTY_INTERNATIONAL_DATA } from '@/types/vendor';
import { VendorTypeSelector } from '@/components/vendor/steps/international/VendorTypeSelector';
import { IntlDocumentsStep } from '@/components/vendor/steps/international/IntlDocumentsStep';
import { IntlCompanyDetailsStep } from '@/components/vendor/steps/international/IntlCompanyDetailsStep';
import { IntlBankDetailsStep } from '@/components/vendor/steps/international/IntlBankDetailsStep';
import { IntlClassificationStep } from '@/components/vendor/steps/international/IntlClassificationStep';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Building2 as Building2Icon, Landmark, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useVendorRegistration } from '@/hooks/useVendorRegistration';
import { HelpCircle, Phone, Mail, MessageSquare, X, Save, ChevronLeft, ChevronRight, Send, Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogoAsset from '@/assets/ramky-group-logo.jpg.asset.json';
const ramkyLogo = ramkyLogoAsset.url;

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AutoSaveIndicator, type AutoSaveState } from '@/components/vendor/AutoSaveIndicator';

import { useTenants } from '@/hooks/useTenant';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useAuth } from '@/hooks/useAuth';
import { safeUUID } from '@/lib/uuid';


// 6-step built-in registration flow — Step 1 is the OCR + verification gate.
// Custom admin-defined tabs are inserted between step 5 (Fin/Infra) and the
// final Review step at runtime.
const builtInSteps = [
  { id: 1, title: 'Document Verification', description: '' },
  { id: 2, title: 'Organization Profile', description: '' },
  { id: 3, title: 'Contact Details', description: '' },
  { id: 4, title: 'Financial & Infrastructure', description: '' },
  // Custom tabs slot in here at runtime (ids 5..N-1)
  // Review is always the last step
];
const REVIEW_TITLE = 'Review & Submit';
const REVIEW_DESCRIPTION = 'Verify and submit application';

// International flow — 4 tabs + Review
const internationalSteps = [
  { id: 1, title: 'Documents Upload', description: 'Registration copy & SWIFT/IBAN proof', icon: FileText },
  { id: 2, title: 'Company Details', description: 'Company, address, contact & email', icon: Building2Icon },
  { id: 3, title: 'Company Bank Details', description: 'Account, SWIFT, IBAN (optional)', icon: Landmark },
  { id: 4, title: 'Classification', description: 'Material group, category & source', icon: Award },
];

const EMPTY_DOMESTIC_SLICES = {
  organization: { buyerCompanyId: '', legalName: '', tradeName: '', industryType: '', organizationType: '', ownershipType: '', productCategories: [], productCategoriesOther: '', state: '', materialGroupVendor: [], vendorCategory: [], vendorLocation: [], identificationSource: [] } as OrganizationDetails,
  address: { registeredAddress: '', registeredAddressLine2: '', registeredAddressLine3: '', registeredAddressLine4: '', registeredCity: '', registeredState: '', registeredPincode: '', registeredPhone: '', registeredFax: '', registeredWebsite: '', registeredEmail: '', registeredContact1: '', registeredContact2: '', registeredEmail2: '', sameAsRegistered: true, manufacturingAddress: '', manufacturingAddressLine2: '', manufacturingAddressLine3: '', manufacturingAddressLine4: '', manufacturingCity: '', manufacturingState: '', manufacturingPincode: '', manufacturingPhone: '', manufacturingFax: '', manufacturingEmail: '', branchName: '', branchAddress: '', branchAddressLine2: '', branchAddressLine3: '', branchAddressLine4: '', branchCity: '', branchState: '', branchPincode: '', branchCountry: 'India', branchWebsite: '', branchEmail: '', branchContactName: '', branchContactDesignation: '', branchContactEmail: '', branchContactPhone: '', branchContactFax: '' } as AddressDetails,
  contact: { ceoName: '', ceoDesignation: '', ceoPhone: '', ceoEmail: '', ceoPhone2: '', ceoEmail2: '', marketingName: '', marketingDesignation: '', marketingPhone: '', marketingEmail: '', productionName: '', productionDesignation: '', productionPhone: '', productionEmail: '', customerServiceName: '', customerServiceDesignation: '', customerServicePhone: '', customerServiceEmail: '' } as ContactDetails,
  statutory: { firmRegistrationNo: '', pan: '', panHolderName: null, panStatus: null, panAadhaarLinked: null, panComprehensiveVerifiedAt: null, pfNumber: '', esiNumber: '', isGstRegistered: true, gstin: '', gstDeclarationReason: '', gstSelfDeclarationFile: null, gstConstitutionOfBusiness: '', gstPrincipalPlaceOfBusiness: '', gstAdditionalPlaces: [], gstRegistrationDate: '', gstStatus: '', gstTaxpayerType: '', gstBusinessNature: [], gstJurisdictionCentre: '', gstJurisdictionState: '', isMsmeRegistered: false, msmeNumber: '', msmeCategory: '', msmeDeclarationReason: '', msmeSelfDeclarationFile: null, labourPermitNo: '', iecNo: '', swiftIbanCode: '', entityType: '', memberships: [], enlistments: [], certifications: [], operationalNetwork: '', gstCertificateFile: null, panCardFile: null, msmeCertificateFile: null, iecCertificateFile: null, swiftIbanProofFile: null } as StatutoryDetails,
  bank: { bankName: '', branchName: '', accountNumber: '', confirmAccountNumber: '', accountType: 'current' as const, accountTypeOther: '', ifscCode: '', micrCode: '', bankAddress: '', cancelledChequeFile: null } as BankDetails,
  financial: { turnoverYear1: '', turnoverYear2: '', turnoverYear3: '', creditPeriodExpected: '', majorCustomer1: '', majorCustomer2: '', majorCustomer3: '', authorizedDistributorName: '', authorizedDistributorAddress: '', dealershipCertificateFile: null, financialDocsFile: null } as FinancialDetails,
  infrastructure: { rawMaterialsUsed: '', machineryAvailability: '', equipmentAvailability: '', powerSupply: '', waterSupply: '', dgCapacity: '', productionCapacity: '', storeCapacity: '', supplyCapacity: '', manpower: '', inspectionTesting: '', nearestRailway: '', nearestBusStation: '', nearestAirport: '', nearestPort: '', productTypes: [], productTypesOther: '', productionFacilities: [], leadTimeRequired: '' } as InfrastructureDetails,
  qhse: { qualityIssues: '', healthIssues: '', environmentalIssues: '', safetyIssues: '' } as QHSEDetails,
};

const initialFormData: VendorFormData = {
  vendorType: 'domestic',
  ...EMPTY_DOMESTIC_SLICES,
  international: EMPTY_INTERNATIONAL_DATA,
  declaration: { selfDeclared: false, termsAccepted: false },
};

// Mandatory-field completeness for domestic steps.
// Kept in sync with each step's zod schema (mandatory subset only).
// Shared by the resume logic and pre-submit gating so both agree.
// Keep each case aligned with the corresponding step's zod schema.
// Do not require fields here that the step itself treats as optional.
function isDomesticStepComplete(
  step: number,
  data: VendorFormData,
  verified?: VerifiedDocumentData,
): boolean {
  const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  const emailOk = (v: unknown) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const phoneOk = (v: unknown) => typeof v === 'string' && /^\d{10}$/.test(v);
  const pinOk = (v: unknown) => typeof v === 'string' && /^\d{6}$/.test(v);

  switch (step) {
    case 1: {
      if (!verified) return false;
      if (verified.step1Status?.allDone) return true;
      const gstOk =
        verified.isGstRegistered === true
          ? !!verified.gst
          : verified.isGstRegistered === false
            ? !!verified.gstSelfDeclarationFile
            : false;
      const msmeOk = verified.isMsmeRegistered === false
        ? !!verified.msmeSelfDeclarationFile
        : !!verified.msme;
      return gstOk && !!verified.pan && msmeOk && !!verified.bank;
    }
    case 2: {
      const o = data.organization;
      return (
        nonEmpty(o?.legalName) &&
        nonEmpty(o?.industryType) &&
        nonEmpty(o?.organizationType)
      );
    }
    case 3: {
      const a = data.address;
      return (
        typeof a?.registeredAddress === 'string' && a.registeredAddress.trim().length >= 5 &&
        nonEmpty(a?.registeredCity) &&
        nonEmpty(a?.registeredState) &&
        pinOk(a?.registeredPincode) &&
        emailOk(a?.registeredEmail) &&
        phoneOk(a?.registeredContact1)
      );
    }
    case 4: {
      // Financial & Infrastructure has no mandatory fields. Its own tab
      // handles format validation on Continue, so blank values must not block
      // final submit.
      return true;
    }
    default:
      return true;
  }
}

export default function VendorRegistration() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [formData, setFormData] = useState<VendorFormData>(initialFormData);
  const [vendorTypeChosen, setVendorTypeChosen] = useState(false);
  const [pendingChoiceType, setPendingChoiceType] = useState<VendorOriginType>('domestic');
  const [verifiedData, setVerifiedData] = useState<VerifiedDocumentData | undefined>(undefined);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [vendorStatusState, setVendorStatusState] = useState<RegistrationStatus>('draft');
  const [submittedReferenceNumber, setSubmittedReferenceNumber] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    open: boolean;
    inviter: { name?: string; email?: string } | null;
    status: 'success' | 'failure';
    vendorIdentity: {
      vendorName?: string;
      vendorEmail?: string;
      vendorPhone?: string;
      contactPerson?: string;
      vendorRef?: string;
    } | null;
    errorMessage: string | null;
  }>({ open: false, inviter: null, status: 'success', vendorIdentity: null, errorMessage: null });
  const [pendingPostSubmit, setPendingPostSubmit] = useState(false);
  const [pendingPostSubmitStatus, setPendingPostSubmitStatus] = useState<RegistrationStatus | null>(null);
  const [stepValidationState, setStepValidationState] = useState<Record<number, boolean>>({});
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [isTokenMode, setIsTokenMode] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState<string>('');
  const [onBehalfInvitationId, setOnBehalfInvitationId] = useState<string | null>(null);
  const [isBootstrappingOnBehalf, setIsBootstrappingOnBehalf] = useState(false);
  const [showTypeBackConfirm, setShowTypeBackConfirm] = useState(false);
  const [isClearingForBack, setIsClearingForBack] = useState(false);
  const onBehalfBootstrapStartedRef = useRef(false);
  const formDataLoadedRef = useRef(false);
  const [resetNonce, setResetNonce] = useState(0);
  // Bumped whenever a GST identity change reset fires — child step forms
  // watch this to force-accept cleared parent values (bypassing the
  // react-hook-form `keepDirtyValues` behavior for that one cycle).
  const [gstResetKey, setGstResetKey] = useState(0);
  const gstIdentityRef = useRef<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userRole } = useAuth();
  const { data: allTenants } = useTenants();
  const { myTenants, activeTenantId } = useTenantContext();
  const isSuperAdmin = userRole === 'sharvi_admin' || userRole === 'admin';
  const allowedTenants = isSuperAdmin ? (allTenants ?? []) : myTenants;

  // Auto-create the on-behalf invitation when the buyer clicks "Create Vendor"
  // on the Vendor Invitations screen and lands here with ?onBehalf=1. No dialog
  // is shown — the buyer goes straight to the registration form. The vendor's
  // real name/email/phone are captured inside the form and synced back to the
  // invitation row on first save (see useVendorRegistration).
  useEffect(() => {
    if (onBehalfBootstrapStartedRef.current) return;
    if (searchParams.get('onBehalf') !== '1') return;
    if (searchParams.get('onBehalfOf')) return;
    if (!user?.id) return;
    if (allowedTenants.length === 0) return;

    onBehalfBootstrapStartedRef.current = true;
    setIsBootstrappingOnBehalf(true);

    (async () => {
      try {
        const headerTenantId =
          activeTenantId && allowedTenants.some((t) => t.id === activeTenantId)
            ? activeTenantId
            : null;
        if (!headerTenantId && allowedTenants.length > 1) {
          onBehalfBootstrapStartedRef.current = false;
          setIsBootstrappingOnBehalf(false);
          toast({
            title: 'Select a company',
            description: 'Please select a company in the header before creating a vendor.',
            variant: 'destructive',
          });
          navigate('/admin/invitations');
          return;
        }
        const tenantId = headerTenantId ?? allowedTenants[0].id;
        const token = safeUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60);
        const placeholderEmail = `onbehalf+${token.slice(0, 8)}@placeholder.local`;
        const { data: inv, error } = await supabase
          .from('vendor_invitations')
          .insert({
            email: placeholderEmail,
            token,
            expires_at: expiresAt.toISOString(),
            tenant_id: tenantId,
            vendor_name: null,
            phone_number: null,
            created_by: user.id,
            created_on_behalf: true,
          })
          .select('*')
          .single();
        if (error) throw error;
        setOnBehalfInvitationId(inv.id);
        setInvitationToken(inv.token);
        setInvitationEmail(inv.email);
        setFormData((prev) => ({
          ...prev,
          organization: { ...prev.organization, buyerCompanyId: tenantId },
        }));
        const next = new URLSearchParams(searchParams);
        next.delete('onBehalf');
        next.set('onBehalfOf', inv.id);
        setSearchParams(next, { replace: true });
      } catch (err: any) {
        onBehalfBootstrapStartedRef.current = false;
        toast({
          title: 'Could not start on-behalf registration',
          description: err?.message || 'Failed to create invitation',
          variant: 'destructive',
        });
        navigate('/admin/invitations');
      } finally {
        setIsBootstrappingOnBehalf(false);
      }
    })();
  }, [searchParams, user?.id, allowedTenants, activeTenantId, navigate, toast, setSearchParams]);





  // True whenever the URL indicates we're in an on-behalf flow, even before
  // the new invitation row finishes bootstrapping. Keeps useVendorRegistration
  // from loading the buyer's previous "self" vendor draft into this session.
  const isOnBehalfMode =
    searchParams.get('onBehalf') === '1' || !!searchParams.get('onBehalfOf');

  // Pick up the on-behalf invitation id from the URL on mount/refresh so the
  // hook below scopes correctly even when the bootstrap effect didn't run
  // (e.g. user refreshed the page after the initial Create Vendor click).
  useEffect(() => {
    const fromUrl = searchParams.get('onBehalfOf');
    if (fromUrl && !onBehalfInvitationId) {
      setOnBehalfInvitationId(fromUrl);
    }
  }, [searchParams, onBehalfInvitationId]);

  // Load the on-behalf invitation row so we can recover the buyer's tenant
  // (Buyer Company) on refresh — the bootstrap effect only runs on the very
  // first ?onBehalf=1 visit, after which the URL becomes ?onBehalfOf=<id>.
  const { data: onBehalfInvitation } = useQuery({
    queryKey: ['on-behalf-invitation', onBehalfInvitationId],
    enabled: !!onBehalfInvitationId && isOnBehalfMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_invitations')
        .select('id, tenant_id, email, token')
        .eq('id', onBehalfInvitationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Seed buyerCompanyId from the invitation once it loads, so the Buyer Company
  // display on the international Company Details step is populated on refresh.
  useEffect(() => {
    const invTenantId = (onBehalfInvitation as { tenant_id?: string } | null)?.tenant_id;
    if (!invTenantId) return;
    setFormData((prev) =>
      prev.organization.buyerCompanyId
        ? prev
        : { ...prev, organization: { ...prev.organization, buyerCompanyId: invTenantId } },
    );
  }, [onBehalfInvitation]);

  const { saveVendor, submitVendor, resubmitVendor, runValidations, isSaving, isSubmitting, vendorId, vendorStatus, existingFormData, isLoadingVendor, isAuthReady, existingVendor } = useVendorRegistration({
    invitationToken: invitationToken || undefined,
    onBehalfInvitationId: onBehalfInvitationId || undefined,
    isOnBehalfMode,
  });

  // Custom field values keyed by step_key -> field_name -> value
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, Record<string, unknown>>>({});

  // Pull dynamic schema for this vendor's tenant (admin-defined extra tabs)
  const tenantId =
    (existingVendor as { tenant_id?: string } | null)?.tenant_id
    || formData.organization.buyerCompanyId
    || (onBehalfInvitation as { tenant_id?: string } | null)?.tenant_id
    || null;
  const { data: dynamicSchema } = useDynamicFormSchema(tenantId);
  const customSteps = dynamicSchema?.steps || [];
  const fieldsByStep = dynamicSchema?.fieldsByStep || {};

  const isInternational = formData.vendorType === 'international';

  // Build the runtime step list:
  //   Domestic — built-in 1..5 + custom tabs + Review (last)
  //   International — 4 fixed tabs + Review (no custom tabs)
  const registrationSteps = useMemo(() => {
    if (isInternational) {
      const list = internationalSteps.map((s) => ({ id: s.id, title: s.title, description: s.description }));
      list.push({ id: internationalSteps.length + 1, title: REVIEW_TITLE, description: REVIEW_DESCRIPTION });
      return list;
    }
    const list: Array<{ id: number; title: string; description: string; stepKey?: string }> = builtInSteps.map((s) => ({ ...s }));
    customSteps.forEach((cs, i) => {
      list.push({ id: 5 + i, title: cs.step_label, description: cs.step_description || '', stepKey: cs.step_key });
    });
    list.push({ id: 5 + customSteps.length, title: REVIEW_TITLE, description: REVIEW_DESCRIPTION });
    return list;
  }, [customSteps, isInternational]);

  // Hydrate custom values from existing vendor on load
  useEffect(() => {
    const v = existingVendor as { custom_field_values?: Record<string, Record<string, unknown>>; tenant_id?: string } | null;
    if (v?.custom_field_values && Object.keys(v.custom_field_values).length > 0) {
      setCustomFieldValues(v.custom_field_values);
    }
    // Seed Buyer Company from the existing draft so it never appears empty when
    // the vendor reopens the invitation link.
    if (v?.tenant_id) {
      setFormData((prev) => prev.organization.buyerCompanyId === v.tenant_id
        ? prev
        : { ...prev, organization: { ...prev.organization, buyerCompanyId: v.tenant_id! } });
    }
  }, [existingVendor]);

  // If the auth session is lost while the form is open, redirect back to the
  // invite/login page so subsequent saves don't fail with confusing RLS errors.
  useEffect(() => {
    let sawInitial = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip the first INITIAL_SESSION event — it fires during hydration and
      // can race the magic-link sign-in, causing a false "Session expired".
      if (!sawInitial) { sawInitial = true; return; }
      // Only react to an explicit sign-out. A TOKEN_REFRESHED with no session
      // is a transient state during hydration, not a real logout.
      if (event !== 'SIGNED_OUT') return;
      const tokenParam = invitationToken || searchParams.get('token');
      let isFreshInviteHandoff = false;
      try {
        isFreshInviteHandoff = !!tokenParam && window.sessionStorage.getItem('vendorInviteJustSignedIn') === tokenParam;
      } catch { /* ignore */ }
      if (!isFreshInviteHandoff) {
        toast({
          title: 'Session expired',
          description: 'Please reopen the invitation link to continue your registration.',
          variant: 'destructive',
        });
      }
      if (tokenParam) {
        navigate(`/vendor/invite?token=${tokenParam}`);
      } else {
        navigate('/auth');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [invitationToken, navigate, toast, searchParams]);



  // Validate token on mount and check authentication
  useEffect(() => {
    const validateToken = async () => {
      const onBehalfId = searchParams.get('onBehalfOf');
      const token = searchParams.get('token');

      // ─── On-behalf mode (buyer fills the form for a vendor) ──────────────
      if (onBehalfId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            navigate('/auth');
            return;
          }
          const { data: invRow, error: invErr } = await supabase
            .from('vendor_invitations')
            .select('id, token, email, tenant_id, expires_at, created_on_behalf, vendor_name, phone_number')
            .eq('id', onBehalfId)
            .maybeSingle();
          if (invErr || !invRow) {
            setTokenError('On-behalf invitation not found or you do not have access.');
            setIsValidatingToken(false);
            return;
          }
          setOnBehalfInvitationId(invRow.id);
          setInvitationToken(invRow.token);
          setInvitationEmail(invRow.email);
          setIsTokenMode(false); // do NOT block navigation for buyer
          setIsValidatingToken(false);
          if (invRow.tenant_id) {
            setFormData((prev) =>
              prev.organization.buyerCompanyId === invRow.tenant_id
                ? prev
                : { ...prev, organization: { ...prev.organization, buyerCompanyId: invRow.tenant_id as string } },
            );
          }
          return;
        } catch (err) {
          console.error('On-behalf init error:', err);
          setTokenError('Failed to load on-behalf invitation.');
          setIsValidatingToken(false);
          return;
        }
      }

      // ─── On-behalf bootstrap (buyer launched from Vendor Invitations) ─────
      // Buyer clicked "Create Vendor" and was navigated straight into the form.
      // The invitation row is created automatically by a dedicated effect above
      // (no dialog). Just verify the session and unblock the loading guard so
      // that effect can run and replace the URL with ?onBehalfOf=<id>.
      if (searchParams.get('onBehalf') === '1') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/auth');
          return;
        }
        setIsTokenMode(false);
        setIsValidatingToken(false);
        return;
      }


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

        // Check if user is authenticated. Poll generously because the silent
        // invite sign-in can finish before the auth client has fully persisted
        // and rehydrated the session on this route.
        let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;
        let userReady = false;
        let isFreshInviteHandoff = false;
        try {
          isFreshInviteHandoff = window.sessionStorage.getItem('vendorInviteJustSignedIn') === token;
        } catch { /* ignore */ }

        const maxAuthChecks = isFreshInviteHandoff ? 80 : 30;
        for (let i = 0; i < maxAuthChecks; i++) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (isFreshInviteHandoff && sessionData.session?.access_token && sessionData.session.user?.id) {
            session = sessionData.session;
            userReady = true;
            break;
          }
          const { data: userData } = await supabase.auth.getUser();
          if (sessionData.session?.access_token && userData.user?.id) {
            session = sessionData.session;
            userReady = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }

        // Always require authentication for vendor registration
        if (!session || !userReady) {
          // Redirect back to the invite handler (never to /auth for vendors)
          navigate(`/vendor/invite?token=${token}`);
          return;
        }

        // Verify the logged-in email matches the invitation email
        if (session.user.email !== invitation.email) {
          setTokenError('This invitation is for a different email. Please log in with the correct account.');
          setIsValidatingToken(false);
          return;
        }

        try {
          if (window.sessionStorage.getItem('vendorInviteJustSignedIn') === token) {
            window.sessionStorage.removeItem('vendorInviteJustSignedIn');
          }
        } catch { /* ignore */ }

        // Best-effort bind of invitation → verified user. Not blocking:
        // possession of a valid, unexpired invitation token combined with a
        // matching authenticated email is enough to open the form.
        let claimData: any = null;
        try {
          const { data } = await supabase.functions.invoke('claim-vendor-invite', {
            body: { token, redirectOrigin: window.location.origin, attempt: 2 },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          claimData = data;
          if (data?.status === 'denied') {
            setTokenError('Access Denied. This invitation belongs to a different email address.');
            setIsValidatingToken(false);
            return;
          }
        } catch (e) {
          console.warn('claim-vendor-invite bind failed (non-blocking):', e);
        }


        const claimedVendorId = (claimData as any)?.vendor_id as string | undefined;

        // Check if this invitation already has a vendor record for this user.
        // Important: do not load an unrelated old vendor row just because the
        // same email/user received a new invitation later.
        if (session) {
          let existingVendorRecord: { id: string; status: string } | null = null;

          if (claimedVendorId) {
            const { data } = await supabase
              .from('vendors')
              .select('id, status')
              .eq('id', claimedVendorId)
              .eq('user_id', session.user.id)
              .maybeSingle();
            existingVendorRecord = data as typeof existingVendorRecord;
          }

          if (!existingVendorRecord && invitation.id) {
            const { data } = await supabase
              .from('vendors')
              .select('id, status')
              .eq('invitation_id', invitation.id)
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            existingVendorRecord = data as typeof existingVendorRecord;
          }

          if (existingVendorRecord) {
            // Editable statuses: vendor can continue/edit the same application.
            const EDITABLE = ['draft', 'returned_to_vendor', 'returned_to_buyer', 'validation_failed', 'finance_rejected', 'purchase_rejected'];
            if (EDITABLE.includes(existingVendorRecord.status as string)) {
              console.log('[Token] Editable vendor record found - allowing form editing', existingVendorRecord.status);
              setInvitationToken(token);
              setInvitationEmail(invitation.email);
              setIsTokenMode(true);
              setIsValidatingToken(false);
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
          let vendor: { status: string } | null = null;
          if (claimedVendorId) {
            const { data } = await supabase
              .from('vendors')
              .select('status')
              .eq('id', claimedVendorId)
              .eq('user_id', session.user.id)
              .maybeSingle();
            vendor = data as typeof vendor;
          }
          if (!vendor && invitation.id) {
            const { data } = await supabase
              .from('vendors')
              .select('status')
              .eq('invitation_id', invitation.id)
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            vendor = data as typeof vendor;
          }

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

        // Seed Buyer Company id from the invitation immediately so Step 1 shows
        // the assigned company and the first autosave persists tenant_id.
        if (invitation.tenant_id) {
          setFormData((prev) =>
            prev.organization.buyerCompanyId === invitation.tenant_id
              ? prev
              : { ...prev, organization: { ...prev.organization, buyerCompanyId: invitation.tenant_id as string } },
          );
        }
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

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTokenMode, toast]);

  const handleValidationStateChange = (step: number) => (isValid: boolean) => {
    setStepValidationState(prev => ({ ...prev, [step]: isValid }));
  };

  const canProceedFromCurrentStep = () => {
    // International flow — no OCR gate; per-step zod validation handles it.
    if (isInternational) return true;
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
            ? !!verifiedData.gstSelfDeclarationFile
            : false;
      const msmeOk = verifiedData.isMsmeRegistered === false
        ? !!verifiedData.msmeSelfDeclarationFile
        : !!verifiedData.msme;
      return gstOk && !!verifiedData.pan && msmeOk && !!verifiedData.bank;
    }
    // Steps 2–5 are presentational — Continue is always allowed; the embedded
    // form's own validation (zod) gates submission of each step.
    return true;
  };

  const getValidationMessage = () => {
    if (!isInternational && currentStep === 1 && !canProceedFromCurrentStep()) {
      return 'Complete each stage in order: GST → PAN → MSME → Bank';
    }
    return undefined;
  };

  const isFirstStep = currentStep === 1;
  const lastStepId = registrationSteps[registrationSteps.length - 1]?.id ?? 5;
  const isLastStep = currentStep === lastStepId;

  useEffect(() => {
    if (existingFormData && vendorStatus && !formDataLoadedRef.current) {
      formDataLoadedRef.current = true;
      const editableStatuses = ['draft', 'validation_failed', 'finance_rejected', 'purchase_rejected', 'returned_to_vendor', 'returned_to_buyer'];
      const pendingStatuses = ['submitted', 'validation_pending', 'finance_review', 'purchase_review', 'finance_approved', 'purchase_approved', 'sap_synced'];

      if (editableStatuses.includes(vendorStatus)) {
        setFormData(existingFormData);
        setVendorStatusState(vendorStatus);
        setVendorTypeChosen(true);
        setPendingChoiceType(existingFormData.vendorType);
        // For returned_to_vendor / returned_to_buyer we want to land on the
        // Review step so the vendor/buyer can immediately see remarks +
        // resubmit after editing.
        const isReturned = vendorStatus === 'returned_to_vendor' || vendorStatus === 'returned_to_buyer';
        if (vendorStatus === 'draft' || isReturned) {
          const filledSteps: number[] = [];
          if (existingFormData.vendorType === 'international') {
            const i = existingFormData.international;
            if (i?.documents?.registrationCopyFile || i?.documents?.swiftIbanFile) filledSteps.push(1);
            if (i?.company?.companyName) filledSteps.push(2);
            if (i?.bank?.accountNumber || i?.bank?.swiftCode || i?.bank?.ibanNumber) filledSteps.push(3);
            if ((i?.classification?.materialGroupVendor?.length || 0) > 0) filledSteps.push(4);
            setCompletedSteps(filledSteps);
            const allSteps = [1, 2, 3, 4, 5];
            const nextStep = filledSteps.length > 0 ? Math.min(...allSteps.filter(s => !filledSteps.includes(s))) : 1;
            setCurrentStep(isReturned ? 5 : (nextStep || 5));
          } else {
            // Step 1 = doc verification — restore whatever was already captured.
            // Each KYC block is rebuilt independently so partial progress
            // (e.g. only GST done) comes back verified without re-running OCR.
            let step1Seed: VerifiedDocumentData | undefined = undefined;
            const st = existingFormData.statutory;
            const bk = existingFormData.bank;
            const hasAnyKyc = !!(st?.gstin || st?.pan || st?.msmeNumber || bk?.accountNumber
              || st?.gstCertificateFile || st?.panCardFile || st?.msmeCertificateFile || bk?.cancelledChequeFile
              || st?.isGstRegistered === false || st?.isMsmeRegistered === false);
            if (hasAnyKyc) {
              step1Seed = {
                isGstRegistered: existingFormData.statutory?.isGstRegistered ?? (existingFormData.statutory?.gstin ? true : null),
                isMsmeRegistered: existingFormData.statutory?.isMsmeRegistered ?? (existingFormData.statutory?.msmeNumber ? true : null),
                pan: existingFormData.statutory?.pan
                  ? {
                      number: existingFormData.statutory.pan,
                      holderName: existingFormData.organization?.legalName || '',
                      apiName: existingFormData.organization?.legalName || '',
                      nameMatchScore: 100,
                    }
                  : undefined,
                panStatus: existingFormData.statutory.panStatus ?? null,
                panAadhaarLinked: existingFormData.statutory.panAadhaarLinked ?? null,
                panComprehensiveVerifiedAt: existingFormData.statutory.panComprehensiveVerifiedAt ?? null,
                panCardFile: existingFormData.statutory?.panCardFile ?? null,
                gst: existingFormData.statutory?.gstin
                  ? {
                      gstin: existingFormData.statutory.gstin,
                      legalName: existingFormData.organization?.legalName || '',
                      tradeName: existingFormData.organization?.tradeName || '',
                      apiName: existingFormData.organization?.legalName || '',
                      nameMatchScore: 100,
                      constitutionOfBusiness: existingFormData.statutory?.gstConstitutionOfBusiness || '',
                      principalPlaceOfBusiness: existingFormData.statutory?.gstPrincipalPlaceOfBusiness || '',
                      additionalPlaces: existingFormData.statutory?.gstAdditionalPlaces || [],
                      registrationDate: existingFormData.statutory?.gstRegistrationDate || '',
                      status: existingFormData.statutory?.gstStatus || '',
                      taxpayerType: existingFormData.statutory?.gstTaxpayerType || '',
                      businessNature: existingFormData.statutory?.gstBusinessNature || [],
                      jurisdictionCentre: existingFormData.statutory?.gstJurisdictionCentre || '',
                      jurisdictionState: existingFormData.statutory?.gstJurisdictionState || '',
                      filing_status: existingFormData.statutory?.gstFilingStatus || [],
                    }
                  : undefined,
                gstCertificateFile: existingFormData.statutory?.gstCertificateFile ?? null,
                gstSelfDeclarationFile: existingFormData.statutory?.gstSelfDeclarationFile ?? null,
                gstDeclarationReason: existingFormData.statutory?.gstDeclarationReason || '',
                manualLegalName: existingFormData.statutory?.isGstRegistered === false ? (existingFormData.organization?.legalName || '') : '',
                manualAddress: existingFormData.statutory?.isGstRegistered === false ? {
                  address: existingFormData.address?.registeredAddress || '',
                  city: existingFormData.address?.registeredCity || '',
                  state: existingFormData.address?.registeredState || '',
                  pincode: existingFormData.address?.registeredPincode || '',
                } : undefined,
                msme: existingFormData.statutory?.msmeNumber ? { udyamNumber: existingFormData.statutory.msmeNumber, enterpriseName: existingFormData.organization?.legalName || '', enterpriseType: existingFormData.statutory?.msmeCategory ? (existingFormData.statutory.msmeCategory.charAt(0).toUpperCase() + existingFormData.statutory.msmeCategory.slice(1)) : undefined } : undefined,
                msmeCertificateFile: existingFormData.statutory?.msmeCertificateFile ?? null,
                msmeSelfDeclarationFile: existingFormData.statutory?.msmeSelfDeclarationFile ?? null,
                msmeDeclarationReason: existingFormData.statutory?.msmeDeclarationReason || '',
                bank: existingFormData.bank?.accountNumber
                  ? {
                      accountNumber: existingFormData.bank.accountNumber,
                      ifsc: existingFormData.bank.ifscCode || '',
                      bankName: existingFormData.bank.bankName || '',
                      branchName: existingFormData.bank.branchName || '',
                      accountHolderName: existingFormData.organization?.legalName || '',
                      accountType: existingFormData.bank.accountType || 'current',
                      bankAddress: existingFormData.bank.bankAddress || '',
                    }
                  : undefined,
                cancelledChequeFile: existingFormData.bank?.cancelledChequeFile ?? null,
                bank2: existingFormData.bank?.secondary?.enabled && existingFormData.bank.secondary?.accountNumber
                  ? {
                      accountNumber: existingFormData.bank.secondary.accountNumber,
                      ifsc: existingFormData.bank.secondary.ifscCode || '',
                      bankName: existingFormData.bank.secondary.bankName || '',
                      branchName: existingFormData.bank.secondary.branchName || '',
                      accountHolderName: existingFormData.bank.secondary.accountHolderName || '',
                      accountType: existingFormData.bank.secondary.accountType || 'current',
                      bankAddress: existingFormData.bank.secondary.bankAddress || '',
                    }
                  : undefined,
                cancelledChequeFile2: existingFormData.bank?.secondary?.cancelledChequeFile ?? null,
              } as any;
              setVerifiedData(step1Seed);
            }
            // True completeness — mandatory fields only (matches per-step zod).
            // Presence-based checks used to skip Address/Contact when their
            // fields were auto-seeded from GST OCR / organization data.
            // Only mark a step complete if every previous step is also complete —
            // prevents e.g. step 5 showing a tick while step 2/3/4 are still blank.
            const filled: number[] = [];
            for (const s of [1, 2, 3, 4]) {
              if (!isDomesticStepComplete(s, existingFormData, step1Seed)) break;
              filled.push(s);
            }
            setCompletedSteps(filled);
            const reviewId = 5 + customSteps.length;
            // For returned_to_vendor mark all completed and jump to Review
            if (isReturned) {
              setCompletedSteps([1, 2, 3, 4]);
              setIsEditMode(true);
              setCurrentStep(reviewId);
            } else {
              const firstMissing = [1, 2, 3, 4].find(s => !filled.includes(s));
              setCurrentStep(firstMissing ?? reviewId);
            }


          }
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
    // Wait until existing vendor data (if any) has been hydrated into formData before autosaving.
    // Prevents empty/partial form state from overwriting saved DB values on refresh.
    if ((vendorId || existingFormData) && !formDataLoadedRef.current) return;
    // Need at least an invitation token (vendor will be created on first save) or an existing vendorId
    if (!invitationToken && !vendorId) return;

    // Skip the very first run after mount so we don't save unchanged loaded data
    if (isFirstAutoSaveRef.current) {
      isFirstAutoSaveRef.current = false;
      lastSavedHashRef.current = JSON.stringify(formData);
      return;
    }

    const hash = JSON.stringify({ formData, customFieldValues });
    if (hash === lastSavedHashRef.current) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaveState('saving');
        await saveVendor({ ...formData, customFieldValues });
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
  }, [formData, customFieldValues, invitationToken, vendorId, isLoadingVendor, isValidatingToken, isSubmitted, saveVendor, existingFormData]);

  // Warn on refresh / tab-close if there are unsaved changes.
  // Compares the current formData hash to the last auto-saved hash — silent
  // when everything is saved, when the form is submitted, or when the user
  // is still on the Vendor Type selector.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSubmitted || !vendorTypeChosen) return;
      const currentHash = JSON.stringify(formData);
      const dirty =
        autoSaveState === 'saving' ||
        (lastSavedHashRef.current !== '' && lastSavedHashRef.current !== currentHash);
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [formData, autoSaveState, isSubmitted, vendorTypeChosen]);



  const handleStartEdit = () => { setIsEditMode(true); setIsSubmitted(false); setCurrentStep(1); setCompletedSteps([1, 2, 3, 4, 5]); };

  // Pure helper — merges Step-1 verified data into a form snapshot.
  // Used by both live stage updates and Save Draft so they always agree.
  // RULE: vendor-typed values always win. OCR only fills fields the vendor
  // has left blank. We treat "" / null / undefined as blank.
  const mergeVerifiedDataIntoForm = (prev: VendorFormData, data: VerifiedDocumentData): VendorFormData => {
    // Fill-only-if-empty: vendor edits in later steps win over Stage-1 OCR.
    const fill = <T,>(p: T, n: T | undefined | null): T =>
      (p !== undefined && p !== null && p !== '') ? p : ((n ?? p) as T);
    // Latest-verified wins: Stage-1 verified value (whether OCR or manual
    // entry) overrides the previously stored value. Used for fields where
    // the document/registry is the authoritative source so that re-verifying
    // a document never leaves stale data in the form / vendor record / DMS.
    const overwrite = <T,>(p: T, n: T | undefined | null): T =>
      (n !== undefined && n !== null && (n as unknown) !== '') ? (n as T) : p;

    const gstYes = data.isGstRegistered === true;
    // Legal / Trade name precedence: GST registry name (when GST=Yes) →
    // PAN Holder name (when GST is not registered / not yet verified) →
    // manual entry fallback. These are the ONLY sources; the vendor cannot
    // override them from the Organization step (fields are read-only there).
    const panHolderName = data.pan?.apiName || data.pan?.holderName || '';
    const ocrLegalName = gstYes
      ? (data.gst?.apiName || data.gst?.legalName || panHolderName || '')
      : (panHolderName || data.manualLegalName || '');
    const ocrTradeName = gstYes
      ? (data.gst?.tradeName || '')
      : (panHolderName || '');
    const principalPlace = data.gst?.principalPlaceOfBusiness || data.gst?.address || '';
    // Address parts extracted from the GST registry (when GST=yes) or the
    // MSME / manual address fallback. When GST changes we OVERWRITE the
    // Address step fields so no stale value from a previous GST persists.
    const gstAddrParts = data.gst?.addressParts;
    const msmeAddrParts = data.msme?.addressParts;
    const addrLineFromDoc =
      (gstYes ? principalPlace : data.manualAddress?.address) ||
      msmeAddrParts?.address ||
      '';
    const cityFromDoc =
      (gstYes ? gstAddrParts?.city : data.manualAddress?.city) ||
      msmeAddrParts?.city ||
      '';
    const stateFromDoc =
      (gstYes ? (gstAddrParts?.state || data.gst?.jurisdictionState) : data.manualAddress?.state) ||
      msmeAddrParts?.state ||
      '';
    const pinFromDoc =
      (gstYes ? gstAddrParts?.pincode : data.manualAddress?.pincode) ||
      msmeAddrParts?.pincode ||
      '';

    // Only carry the secondary bank into form state when the vendor has
    // already opted-in OR the verified payload itself carries a bank2 (which
    // only happens after the vendor enabled it in Step 1).
    const wantsSecondary = prev.bank.secondary?.enabled === true || !!data.bank2;

    // GST cascade — clear ALL GST-derived fields whenever the GST "identity"
    // changes so no previous vendor's data ever bleeds into the new response.
    // Every scenario that must trigger a full reset:
    //   - New / replaced GST certificate (different verified GSTIN)
    //   - GST toggle flipped Yes → No or No → Yes
    //   - Non-GST manual Legal Name / Address changed
    const prevGstin = (prev.statutory.gstin || '').toUpperCase();
    const newGstin = (data.gst?.gstin || '').toUpperCase();
    const toggleChanged = data.isGstRegistered !== undefined && prev.statutory.isGstRegistered !== data.isGstRegistered;
    const manualLegalChanged = !gstYes && (data.manualLegalName || '') !== '' && (data.manualLegalName || '') !== (prev.organization.legalName || '');
    const manualAddrChanged = !gstYes && (data.manualAddress?.address || '') !== '' && (data.manualAddress?.address || '') !== (prev.address.registeredAddress || '');
    const gstChanged = prevGstin !== newGstin || toggleChanged || manualLegalChanged || manualAddrChanged;

    // On any GST identity change, clear derived fields to blank BEFORE applying
    // the new values so Vendor A's data never leaks into Vendor B's form when
    // a different GST is uploaded without refreshing the page.
    const orgLegalBase = gstChanged ? '' : prev.organization.legalName;
    const orgTradeBase = gstChanged ? '' : prev.organization.tradeName;
    const orgStateBase = gstChanged ? '' : prev.organization.state;
    const orgIndustryBase = gstChanged ? '' : prev.organization.industryType;
    const orgOrgTypeBase = gstChanged ? '' : prev.organization.organizationType;
    const orgOwnershipBase = gstChanged ? '' : prev.organization.ownershipType;
    const addrLineBase = gstChanged ? '' : prev.address.registeredAddress;
    const addrLine2Base = gstChanged ? '' : prev.address.registeredAddressLine2;
    const addrLine3Base = gstChanged ? '' : prev.address.registeredAddressLine3;
    const addrLine4Base = gstChanged ? '' : prev.address.registeredAddressLine4;
    const addrCityBase = gstChanged ? '' : prev.address.registeredCity;
    const addrStateBase = gstChanged ? '' : prev.address.registeredState;
    const addrPinBase = gstChanged ? '' : prev.address.registeredPincode;
    const addrDistrictBase = gstChanged ? '' : (prev.address as any).registeredDistrict;
    const addrEmailBase = gstChanged ? '' : prev.address.registeredEmail;
    const addrEmail2Base = gstChanged ? '' : prev.address.registeredEmail2;
    const addrContact1Base = gstChanged ? '' : prev.address.registeredContact1;
    const addrContact2Base = gstChanged ? '' : prev.address.registeredContact2;
    const addrPhoneBase = gstChanged ? '' : prev.address.registeredPhone;

    return {
      ...prev,
      organization: {
        ...prev.organization,
        // GST/PAN-derived — latest verified always wins; fields are read-only in the UI.
        legalName: ocrLegalName || orgLegalBase,
        tradeName: ocrTradeName || orgTradeBase,
        state: stateFromDoc || orgStateBase,
        industryType: orgIndustryBase,
        organizationType: orgOrgTypeBase,
        ownershipType: orgOwnershipBase,
      },

      address: {
        ...prev.address,
        registeredAddress: (gstYes ? addrLineFromDoc : '') || addrLineBase,
        registeredAddressLine2: addrLine2Base,
        registeredAddressLine3: addrLine3Base,
        registeredAddressLine4: addrLine4Base,
        registeredCity: (gstYes ? cityFromDoc : '') || addrCityBase,
        registeredState: (gstYes ? stateFromDoc : '') || addrStateBase,
        registeredPincode: (gstYes ? pinFromDoc : '') || addrPinBase,
        registeredEmail: addrEmailBase,
        registeredEmail2: addrEmail2Base,
        registeredContact1: addrContact1Base,
        registeredContact2: addrContact2Base,
        registeredPhone: addrPhoneBase,
        ...(gstChanged ? { registeredDistrict: addrDistrictBase || '' } : {}),
      },

      contact: {
        ...prev.contact,
        // PAN holder name is a reasonable seed for the primary CEO contact;
        // never override a name the vendor has already typed.
        ceoName: fill(prev.contact.ceoName, data.pan?.holderName),
      },
      statutory: {
        ...prev.statutory,
        isGstRegistered: data.isGstRegistered ?? prev.statutory.isGstRegistered,
        gstDeclarationReason: fill(prev.statutory.gstDeclarationReason, data.gstDeclarationReason),
        gstSelfDeclarationFile: data.gstSelfDeclarationFile ?? prev.statutory.gstSelfDeclarationFile,
        // Stage-1 verified values — always reflect the latest verification so
        // DMS / approval / downstream validators never see stale OCR data
        // after the vendor re-verifies (whether by re-upload or manual entry).
        gstin: overwrite(prev.statutory.gstin, data.gst?.gstin),
        gstConstitutionOfBusiness: overwrite(prev.statutory.gstConstitutionOfBusiness, data.gst?.constitutionOfBusiness),
        gstPrincipalPlaceOfBusiness: overwrite(prev.statutory.gstPrincipalPlaceOfBusiness, principalPlace),
        gstAdditionalPlaces: (Array.isArray(data.gst?.additionalPlaces) && data.gst?.additionalPlaces.length > 0)
          ? data.gst.additionalPlaces
          : prev.statutory.gstAdditionalPlaces,
        gstRegistrationDate: overwrite(prev.statutory.gstRegistrationDate, data.gst?.registrationDate),
        gstStatus: overwrite(prev.statutory.gstStatus, data.gst?.status),
        gstTaxpayerType: overwrite(prev.statutory.gstTaxpayerType, data.gst?.taxpayerType),
        gstBusinessNature: (Array.isArray(data.gst?.businessNature) && data.gst?.businessNature.length > 0)
          ? data.gst.businessNature
          : prev.statutory.gstBusinessNature,
        gstJurisdictionCentre: overwrite(prev.statutory.gstJurisdictionCentre, data.gst?.jurisdictionCentre),
        gstJurisdictionState: overwrite(prev.statutory.gstJurisdictionState, data.gst?.jurisdictionState),
        gstFilingStatus: Array.isArray(data.gst?.filing_status) && data.gst?.filing_status.length > 0
          ? data.gst.filing_status
          : prev.statutory.gstFilingStatus,
        pan: overwrite(prev.statutory.pan, data.pan?.number),
        panHolderName: (data.pan?.apiName || data.pan?.holderName) ?? prev.statutory.panHolderName ?? null,
        panStatus: (data as any).panStatus ?? prev.statutory.panStatus ?? null,
        panAadhaarLinked: (data as any).panAadhaarLinked ?? prev.statutory.panAadhaarLinked ?? null,
        panComprehensiveVerifiedAt: (data as any).panComprehensiveVerifiedAt ?? prev.statutory.panComprehensiveVerifiedAt ?? null,
        isMsmeRegistered: data.isMsmeRegistered ?? prev.statutory.isMsmeRegistered,
        msmeNumber: overwrite(prev.statutory.msmeNumber, data.msme?.udyamNumber),
        msmeCategory: ((): StatutoryDetails['msmeCategory'] => {
          const t = (data.msme?.enterpriseType || '').toLowerCase();
          if (t === 'micro' || t === 'small' || t === 'medium') return t;
          return prev.statutory.msmeCategory;
        })(),
        msmeEnterpriseName: overwrite(prev.statutory.msmeEnterpriseName, data.msme?.enterpriseName),
        msmeMajorActivity: overwrite(prev.statutory.msmeMajorActivity, data.msme?.majorActivity),
        // Carry the actual uploaded files into the form so draft saves include them
        gstCertificateFile: data.gstCertificateFile ?? prev.statutory.gstCertificateFile,
        panCardFile: data.panCardFile ?? prev.statutory.panCardFile,
        msmeCertificateFile: data.msmeCertificateFile ?? prev.statutory.msmeCertificateFile,
        msmeSelfDeclarationFile: (data as any).msmeSelfDeclarationFile ?? prev.statutory.msmeSelfDeclarationFile ?? null,
        msmeDeclarationReason: fill(prev.statutory.msmeDeclarationReason ?? '', (data as any).msmeDeclarationReason),
      },
      bank: {
        ...prev.bank,
        // Same latest-verified semantics for bank fields — re-running penny
        // drop with corrected account/IFSC must update the form, vendor row,
        // and any downstream SAP / DMS payload.
        accountNumber: overwrite(prev.bank.accountNumber, data.bank?.accountNumber),
        confirmAccountNumber: overwrite(prev.bank.confirmAccountNumber, data.bank?.accountNumber),
        ifscCode: overwrite(prev.bank.ifscCode, data.bank?.ifsc),
        bankName: overwrite(prev.bank.bankName, data.bank?.bankName),
        branchName: overwrite(prev.bank.branchName, data.bank?.branchName),
        accountType: (prev.bank.accountType || (data.bank?.accountType as BankDetails['accountType']) || 'current') as BankDetails['accountType'],
        bankAddress: fill(prev.bank.bankAddress, data.bank?.bankAddress),
        accountHolderName: overwrite(prev.bank.accountHolderName ?? '', data.bank?.accountHolderName),
        cancelledChequeFile: data.cancelledChequeFile ?? prev.bank.cancelledChequeFile,
        secondary: wantsSecondary
          ? {
              enabled: true,
              accountNumber: overwrite(prev.bank.secondary?.accountNumber ?? '', data.bank2?.accountNumber),
              ifscCode: overwrite(prev.bank.secondary?.ifscCode ?? '', data.bank2?.ifsc),
              bankName: overwrite(prev.bank.secondary?.bankName ?? '', data.bank2?.bankName),
              branchName: overwrite(prev.bank.secondary?.branchName ?? '', data.bank2?.branchName),
              accountHolderName: overwrite(prev.bank.secondary?.accountHolderName ?? '', data.bank2?.accountHolderName),
              accountType: ((prev.bank.secondary?.accountType) || (data.bank2?.accountType as BankDetails['accountType']) || 'current') as BankDetails['accountType'],
              bankAddress: fill(prev.bank.secondary?.bankAddress ?? '', data.bank2?.bankAddress),
              micrCode: prev.bank.secondary?.micrCode || '',
              cancelledChequeFile: data.cancelledChequeFile2 ?? prev.bank.secondary?.cancelledChequeFile ?? null,
            }
          : prev.bank.secondary,
      },
    };
  };




  // Holds the most recent Step-1 snapshot from the child, even if React hasn't
  // flushed setState yet — used by Save Draft to avoid stale renders.
  const latestStep1DataRef = useRef<VerifiedDocumentData | null>(null);

  const handleDocStageChange = (data: VerifiedDocumentData) => {
    latestStep1DataRef.current = data;
    setVerifiedData(data);
    // Detect GST-identity changes so child step forms can force-reset.
    const nextIdentity = `${data.isGstRegistered ? 'Y' : 'N'}|${(data.gst?.gstin || '').toUpperCase()}|${data.manualLegalName || ''}|${data.manualAddress?.address || ''}`;
    if (gstIdentityRef.current && gstIdentityRef.current !== nextIdentity) {
      setGstResetKey((k) => k + 1);
    }
    gstIdentityRef.current = nextIdentity;
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
    if (!completedSteps.includes(4)) setCompletedSteps((prev) => [...prev, 4]);
    setCurrentStep(5);
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(1, prev - 1));
  const handleStepClick = (step: number) => {
    // Free navigation backward; forward only if all preceding steps are complete.
    if (step <= currentStep) { setCurrentStep(step); return; }
    if (isInternational) {
      if (completedSteps.includes(step)) setCurrentStep(step);
      return;
    }
    const allPrevComplete = Array.from({ length: step - 1 }, (_, i) => i + 1)
      .every((s) => isDomesticStepComplete(s, formData, verifiedData));
    if (allPrevComplete) setCurrentStep(step);
  };
  const [pendingDocTab, setPendingDocTab] = useState<'gst' | 'pan' | 'msme' | 'bank' | undefined>(undefined);
  const handleEditStep = (step: number, tab?: 'gst' | 'pan' | 'msme' | 'bank') => {
    if (step === 1 && tab) setPendingDocTab(tab);
    setCurrentStep(step);
  };

  // ----- Vendor type switching -----


  const purgeVendorArtifacts = async (vId: string) => {
    try {
      // List & delete all files under the vendor's storage folder
      const { data: folders } = await supabase.storage.from('vendor-documents').list(vId);
      if (folders && folders.length) {
        const allPaths: string[] = [];
        for (const entry of folders) {
          const { data: files } = await supabase.storage.from('vendor-documents').list(`${vId}/${entry.name}`);
          if (files) {
            for (const f of files) allPaths.push(`${vId}/${entry.name}/${f.name}`);
          }
        }
        if (allPaths.length) {
          await supabase.storage.from('vendor-documents').remove(allPaths);
        }
      }
      await supabase.from('vendor_documents').delete().eq('vendor_id', vId);
      await supabase.from('vendor_validations').delete().eq('vendor_id', vId);
    } catch (err) {
      console.error('purgeVendorArtifacts failed', err);
    }
  };

  const applyVendorTypeSwitch = async (next: VendorOriginType) => {
    // Cancel any pending auto-save so it cannot re-persist stale data
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setAutoSaveState('idle');

    const cleared: VendorFormData = {
      vendorType: next,
      ...EMPTY_DOMESTIC_SLICES,
      international: EMPTY_INTERNATIONAL_DATA,
      declaration: { selfDeclared: false, termsAccepted: false },
    };
    setFormData(cleared);
    setCompletedSteps([]);
    setCurrentStep(1);
    setVerifiedData(undefined);
    setCustomFieldValues({});
    setPendingChoiceType(next);
    latestStep1DataRef.current = null;
    setResetNonce((n) => n + 1);

    if (vendorId) {
      await purgeVendorArtifacts(vendorId);
      // Persist cleared payload so the draft row matches the UI
      try {
        await saveVendor(cleared);
      } catch (err) {
        console.error('Failed to persist cleared vendor draft', err);
      }
    }

    toast({
      title: `Switched to ${next === 'international' ? 'International' : 'Domestic'}`,
      description: 'Previous data has been cleared.',
    });
  };

  const handleVendorTypeChange = (next: VendorOriginType) => {
    void applyVendorTypeSwitch(next);
  };

  const handleBackToTypeSelector = async () => {
    await applyVendorTypeSwitch(formData.vendorType);
    setVendorTypeChosen(false);
  };

  const confirmBackToTypeSelector = async () => {
    setIsClearingForBack(true);
    try {
      await handleBackToTypeSelector();
    } finally {
      setIsClearingForBack(false);
      setShowTypeBackConfirm(false);
    }
  };



  // ----- International step setters -----
  const setIntlSlice = <K extends keyof InternationalData>(key: K, value: InternationalData[K]) => {
    setFormData((prev) => ({
      ...prev,
      international: { ...(prev.international ?? EMPTY_INTERNATIONAL_DATA), [key]: value },
    }));
  };

  const handleIntlDocsContinue = () => {
    if (!completedSteps.includes(1)) setCompletedSteps((p) => [...p, 1]);
    setCurrentStep(2);
  };
  const handleIntlCompanyComplete = (d: InternationalCompanyDetails) => {
    setIntlSlice('company', d);
    if (!completedSteps.includes(2)) setCompletedSteps((p) => [...p, 2]);
    setCurrentStep(3);
  };
  const handleIntlBankComplete = (d: InternationalBankDetails) => {
    setIntlSlice('bank', d);
    if (!completedSteps.includes(3)) setCompletedSteps((p) => [...p, 3]);
    setCurrentStep(4);
  };
  const handleIntlClassificationComplete = (d: InternationalClassification) => {
    setIntlSlice('classification', d);
    if (!completedSteps.includes(4)) setCompletedSteps((p) => [...p, 4]);
    setCurrentStep(5);
  };


  const handleSaveAsDraft = async () => {
    try {
      setAutoSaveState('saving');
      // On Step 1, build payload from the freshest lifted snapshot so we don't
      // miss the user's latest OCR edit / verification (state may not have flushed yet).
      const base =
        currentStep === 1 && latestStep1DataRef.current
          ? mergeVerifiedDataIntoForm(formData, latestStep1DataRef.current)
          : formData;
      // Custom (admin-defined) tabs live in separate state — persist them too.
      const payload = { ...base, customFieldValues };
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
    // Pre-submit gating — bounce user back to the first tab with missing
    // mandatory fields so they can see the inline errors immediately.
    if (!isInternational) {
      const firstMissing = [1, 2, 3, 4].find(s => !isDomesticStepComplete(s, formData, verifiedData));
      if (firstMissing) {
        const title = registrationSteps.find(s => s.id === firstMissing)?.title || `Step ${firstMissing}`;
        toast({
          title: 'Please complete required fields',
          description: `${title} is incomplete. Fill the highlighted fields and try again.`,
          variant: 'destructive',
        });
        setCurrentStep(firstMissing);
        return;
      }
    }
    try {
      const submitPayload = { ...formData, customFieldValues } as VendorFormData;
      const vendor = isEditMode && vendorId
        ? await resubmitVendor(submitPayload)
        : await submitVendor(submitPayload);

      setSubmittedReferenceNumber((vendor as any)?.reference_number ?? null);

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

      const notify = (vendor as any)?._notify ?? null;
      const inviter = notify?.inviter ?? null;
      const vendorIdentity = notify?.vendorIdentity ?? null;
      const notifyOk = !!notify && notify?.success !== false;
      const errorMessage = notify?.error ?? (notify?.skipped ? `Notification skipped: ${notify.skipped}` : null);

      // Defer success-screen transition until the user closes the dialog,
      // so the popup is shown before the form is replaced.
      // Defer success-screen transition until the user closes the dialog,
      // so the popup is shown before the form is replaced.
      setPendingPostSubmit(true);
      setPendingPostSubmitStatus(((vendor as any)?.status as RegistrationStatus) ?? 'scm_manager_review');
      setSubmissionSuccess({
        open: true,
        inviter,
        status: notifyOk ? 'success' : 'failure',
        vendorIdentity,
        errorMessage,
      });
    } catch (error) {
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

  const handleSubmissionDialogClose = () => {
    setSubmissionSuccess((s) => ({ ...s, open: false }));
    if (pendingPostSubmit) {
      setIsSubmitted(true);
      setIsEditMode(false);
      setVendorStatusState(pendingPostSubmitStatus ?? 'scm_manager_review');
      setPendingPostSubmit(false);
      setPendingPostSubmitStatus(null);
    }
  };

  // Step 1 is rendered persistently (see JSX below) so its internal KYC
  // state (MSME tab manual entry, picked files, OCR previews, etc.) is
  // preserved when the user navigates to another step and returns.
  const renderStep = () => {
    // International flow
    if (isInternational) {
      const intl = formData.international ?? EMPTY_INTERNATIONAL_DATA;
      if (currentStep === lastStepId) {
        return <ReviewStep data={formData} onSubmit={handleSubmit} onBack={handleBack} onEditStep={handleEditStep} onDeclarationChange={(d) => setFormData(prev => ({ ...prev, declaration: d }))} />;
      }
      switch (currentStep) {
        case 1:
          return null; // rendered persistently outside renderStep
        case 2:
          return <IntlCompanyDetailsStep tenantId={tenantId} data={intl.company} onSubmit={handleIntlCompanyComplete} onLiveUpdate={(d) => setIntlSlice('company', d)} />;
        case 3:
          return <IntlBankDetailsStep data={intl.bank} onSubmit={handleIntlBankComplete} onLiveUpdate={(d) => setIntlSlice('bank', d)} />;
        case 4:
          return <IntlClassificationStep data={intl.classification} onSubmit={handleIntlClassificationComplete} onLiveUpdate={(d) => setIntlSlice('classification', d)} />;
      }
      return null;
    }
    // Built-in domestic steps 1..4
    switch (currentStep) {
      case 1:
        return null; // rendered persistently outside renderStep
      case 2:
        return <OrganizationStep resetKey={gstResetKey} tenantId={tenantId} data={formData.organization} statutoryData={formData.statutory} vendorId={vendorId || undefined} showClassification={isOnBehalfMode} onNext={handleOrganizationComplete} onLiveUpdate={(d) => setFormData((prev) => ({ ...prev, organization: d.organization, statutory: d.statutory }))} />;
      case 3:
        return <AddressStep resetKey={gstResetKey} tenantId={tenantId} data={formData.address} onNext={(data) => handleStepComplete(3, data)} onBack={handleBack} />;
      case 4:
        return (
          <FinancialInfrastructureStep
            tenantId={tenantId}
            financialData={formData.financial}
            infrastructureData={formData.infrastructure}
            qhseData={formData.qhse}
            onNext={handleFinancialInfraComplete}
            onLiveUpdate={(data) => setFormData((prev) => ({
              ...prev,
              financial: data.financial,
              infrastructure: data.infrastructure,
              qhse: data.qhse,
            }))}
            onBack={handleBack}
          />
        );
    }
    // Last step is always Review
    if (currentStep === lastStepId) {
      return <ReviewStep data={formData} onSubmit={handleSubmit} onBack={handleBack} onEditStep={handleEditStep} onDeclarationChange={(d) => setFormData(prev => ({ ...prev, declaration: d }))} />;
    }
    // Anything in between is an admin-defined custom tab (ids 5..N-1)
    const customIdx = currentStep - 5;
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


  if (!isAuthReady || isLoadingVendor || isValidatingToken || isBootstrappingOnBehalf) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;




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
        <header className="h-16 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          {isTokenMode ? (
            <div className="flex w-full items-center justify-between gap-3 flex-row-reverse">
              <img src={ramkyLogo} alt="Ramky" className="h-10 w-auto object-contain mix-blend-multiply" />
              <span className="text-sm font-semibold text-black">Vypaar Portal</span>
            </div>
          ) : (
            <Link to="/" className="flex w-full items-center justify-between gap-3 flex-row-reverse">
              <img src={ramkyLogo} alt="Ramky" className="h-10 w-auto object-contain mix-blend-multiply" />
              <span className="text-sm font-semibold text-black hidden sm:block">Vypaar Portal</span>
            </Link>
          )}
        </header>
        <SuccessScreen
          status={vendorStatusState}
          vendorId={vendorId || undefined}
          referenceNumber={submittedReferenceNumber ?? (existingVendor as any)?.reference_number ?? undefined}
          financeComments={existingVendor?.finance_comments}
          purchaseComments={existingVendor?.purchase_comments}
          onEdit={isTokenMode ? undefined : handleStartEdit}
          onBack={isTokenMode ? undefined : () => navigate('/admin/invitations')}
        />
      </div>
    );
  }

  const canProceed = canProceedFromCurrentStep();
  const validationMessage = getValidationMessage();

  // Gating screen — choose vendor type BEFORE showing the registration tabs
  if (!vendorTypeChosen && !isSubmitted) {
    const confirmChoice = () => {
      if (pendingChoiceType !== formData.vendorType) {
        handleVendorTypeChange(pendingChoiceType);
      }
      setVendorTypeChosen(true);
      setCurrentStep(1);
    };
    return (
      <div className="ramky-brand-bg h-screen overflow-hidden flex flex-col">
        <header className="h-16 shrink-0 border-b bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50">
          {isTokenMode ? (
            <div className="flex w-full items-center justify-between gap-3 flex-row-reverse">
              <img src={ramkyLogo} alt="Ramky" className="h-10 w-auto object-contain mix-blend-multiply" />
              <span className="text-sm font-semibold text-black">Vendor Registration</span>
            </div>
          ) : (
            <Link to="/" className="flex w-full items-center justify-between gap-3 flex-row-reverse">
              <img src={ramkyLogo} alt="Ramky" className="h-10 w-auto object-contain mix-blend-multiply" />
              <span className="text-sm font-semibold text-black hidden sm:block">Vypaar Portal</span>
            </Link>
          )}
        </header>
        <main className="h-[calc(100vh-4rem)] min-h-0 flex items-center justify-center p-1.5 sm:p-2 overflow-hidden">
          <div className="relative w-[min(92vw,300px)] rounded-[12px] bg-white/25 backdrop-blur-[2px] border border-white/50 shadow-lg flex flex-col">
            <div className="relative p-2 space-y-0.5 flex flex-col overflow-hidden min-w-0">

              {isTokenMode && invitationEmail && (
                <div className="p-1.5 bg-white/70 border border-blue-100 rounded-lg shrink-0 min-w-0">
                  <p className="text-xs text-slate-700 break-all">
                    <span className="font-medium text-slate-900">Invited Email:</span> {invitationEmail}
                  </p>
                </div>
              )}
              <div className="shrink-0">
                <h1 className="text-sm sm:text-base md:text-lg font-semibold text-slate-900 leading-tight">Select Vendor Type</h1>
              </div>

              <VendorTypeSelector
                value={pendingChoiceType}
                onChange={setPendingChoiceType}
                disabled={isSubmitting}
              />
              <div className="flex justify-end pt-0.5 shrink-0">
                <Button type="button" onClick={confirmChoice} disabled={isSubmitting} className="min-w-[128px] h-9">
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </main>





      </div>
    );
  }


  return (
    <div className="ramky-brand-bg min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        {isTokenMode ? (
          <span className="text-sm font-semibold text-black">Vendor Registration</span>
        ) : (
          <Link to="/" className="flex items-center">
            <span className="text-sm font-semibold text-black">Vypaar Portal</span>
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
          <img src={ramkyLogo} alt="Ramky" className="h-10 w-auto object-contain mix-blend-multiply" />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col flex-1 max-w-[1280px] mx-auto w-full">
        {onBehalfInvitationId && (
          <div className="mx-4 sm:mx-6 mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              You are filling this form on behalf of{' '}
              <span className="font-semibold">{invitationEmail}</span>. The vendor will not receive a login until you submit; the submission follows the standard approval workflow.
            </span>
          </div>
        )}
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
          </div>

          {/* Mobile: compact pill + thin progress bar */}
          <div className="md:hidden space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-semibold shrink-0">
                  Step {Math.max(1, registrationSteps.findIndex(s => s.id === currentStep) + 1)} of {registrationSteps.length}
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  {registrationSteps.find(s => s.id === currentStep)?.title}
                </span>
              </div>
            </div>
            <AutoSaveIndicator state={autoSaveState} lastSavedAt={lastSavedAt} />
          </div>
        </div>

        {/* Vendor Type chip (shown after type is chosen) */}
        {!isSubmitted && (
          <div className="px-3 sm:px-6 pt-2 md:pt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Vendor Type: {isInternational ? 'International' : 'Domestic'}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs rounded-lg gap-1.5"
              disabled={isSubmitting}
              onClick={() => setShowTypeBackConfirm(true)}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to main screen
            </Button>

          </div>
        )}

        {/* Form Card */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          {/* Rejection remarks banner — shown when a buyer/approver has returned the application to the vendor */}
          {(vendorStatusState === 'returned_to_vendor' || vendorStatusState === 'returned_to_buyer') && (existingVendor as any)?.last_rejection_comments && (
            <div className="mb-3 rounded-[10px] border border-destructive/40 bg-destructive/5 p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-destructive">
                    Application returned for corrections
                    {(existingVendor as any)?.last_rejection_stage && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (from {String((existingVendor as any).last_rejection_stage).replace(/_/g, ' ')})
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                    {(existingVendor as any).last_rejection_comments}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Update the necessary fields and resubmit. Your previously uploaded documents are retained.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="bg-card rounded-[10px] shadow-enterprise-md border">

            {/* Optional invited-email banner (only in token mode) */}
            {isTokenMode && invitationEmail && (
              <div className="px-4 sm:px-6 pt-3">
                <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Invited Email:</span> {invitationEmail}
                  </p>
                </div>
              </div>
            )}

            {/* Form Content */}
            <div className="p-3 sm:p-5" key={`step-${formData.vendorType}-${resetNonce}`}>
              {/* Step 1 stays mounted across navigation so in-progress KYC
                  inputs (MSME manual entry, picked files, OCR previews, etc.)
                  survive when the user moves to another step and returns. */}
              <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
                {isInternational ? (
                  <IntlDocumentsStep
                    vendorId={vendorId}
                    data={(formData.international ?? EMPTY_INTERNATIONAL_DATA).documents}
                    onChange={(d) => setIntlSlice('documents', d)}
                  />
                ) : (
                  <DocumentVerificationStep
                    vendorId={vendorId}
                    initialData={verifiedData}
                    initialTab={pendingDocTab}
                    onComplete={handleDocVerificationComplete}
                    onStageChange={handleDocStageChange}
                  />
                )}
              </div>
              {currentStep !== 1 && renderStep()}
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
                      disabled={isSubmitting || !formData.declaration?.selfDeclared || !formData.declaration?.termsAccepted}
                      className={cn(
                        "min-w-[160px]",
                        (!formData.declaration?.selfDeclared || !formData.declaration?.termsAccepted) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Submit
                    </Button>
                  ) : (
                    isInternational && currentStep === 1 ? (
                      <Button
                        type="button"
                        onClick={handleIntlDocsContinue}
                        className="min-w-[120px]"
                      >
                        Continue
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        form={isInternational ? "step-form" : currentStep === 1 ? "step-form-1" : currentStep === 2 ? "step-form-2" : "step-form"}
                        disabled={!canProceed}
                        className={cn(
                          "min-w-[120px]",
                          !canProceed && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Continue
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <SubmissionSuccessDialog
        open={submissionSuccess.open}
        inviter={submissionSuccess.inviter}
        status={submissionSuccess.status}
        vendorIdentity={submissionSuccess.vendorIdentity}
        errorMessage={submissionSuccess.errorMessage}
        onClose={handleSubmissionDialogClose}
      />
      <AlertDialog
        open={showTypeBackConfirm}
        onOpenChange={(o) => { if (!isClearingForBack) setShowTypeBackConfirm(o); }}
      >
        <AlertDialogContent onEscapeKeyDown={(e) => { if (isClearingForBack) e.preventDefault(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Go back to main screen?</AlertDialogTitle>
            <AlertDialogDescription>
              If you go back, the data entered will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingForBack}>No</AlertDialogCancel>
            <AlertDialogAction
              disabled={isClearingForBack}
              onClick={(e) => { e.preventDefault(); void confirmBackToTypeSelector(); }}
            >
              {isClearingForBack ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Clearing…</>
              ) : (
                'Yes'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isClearingForBack && (
        <div className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Clearing your data…</p>
        </div>
      )}
    </div>
  );
}
