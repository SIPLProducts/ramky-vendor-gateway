import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EnterpriseStepIndicator } from '@/components/vendor/EnterpriseStepIndicator';
import { SuccessScreen } from '@/components/vendor/SuccessScreen';
import { FeedbackPopup } from '@/components/vendor/FeedbackPopup';
import { StickyActionBar } from '@/components/vendor/StickyActionBar';
import { OrganizationStep } from '@/components/vendor/steps/OrganizationStep';
import { AddressStep } from '@/components/vendor/steps/AddressStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { ComplianceStep } from '@/components/vendor/steps/ComplianceStep';
import { BankStep } from '@/components/vendor/steps/BankStep';
import { FinancialStep } from '@/components/vendor/steps/FinancialStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
import { RegistrationStatus } from '@/components/vendor/RegistrationStatusTracker';
import { VendorFormData } from '@/types/vendor';
import { useToast } from '@/hooks/use-toast';
import { useVendorRegistration } from '@/hooks/useVendorRegistration';
import { HelpCircle, Phone, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const registrationSteps = [
  { id: 1, title: 'Organization Profile', description: 'Company name and type' },
  { id: 2, title: 'Address', description: 'Registered and manufacturing address' },
  { id: 3, title: 'Contacts', description: 'Key contact persons' },
  { id: 4, title: 'Compliance', description: 'Statutory and legal details' },
  { id: 5, title: 'Bank Details', description: 'Bank account information' },
  { id: 6, title: 'Financials', description: 'Turnover and customers' },
  { id: 7, title: 'Review & Submit', description: 'Verify and submit' },
];

const initialFormData: VendorFormData = {
  organization: { legalName: '', tradeName: '', industryType: '', organizationType: '', ownershipType: '', productCategories: [] },
  address: { registeredAddress: '', registeredAddressLine2: '', registeredAddressLine3: '', registeredCity: '', registeredState: '', registeredPincode: '', registeredPhone: '', registeredFax: '', registeredWebsite: '', sameAsRegistered: true, manufacturingAddress: '', manufacturingAddressLine2: '', manufacturingAddressLine3: '', manufacturingCity: '', manufacturingState: '', manufacturingPincode: '', manufacturingPhone: '', manufacturingFax: '', branchName: '', branchAddress: '', branchCity: '', branchState: '', branchPincode: '', branchCountry: 'India', branchWebsite: '', branchContactName: '', branchContactDesignation: '', branchContactEmail: '', branchContactPhone: '', branchContactFax: '' },
  contact: { ceoName: '', ceoDesignation: '', ceoPhone: '', ceoEmail: '', marketingName: '', marketingDesignation: '', marketingPhone: '', marketingEmail: '', productionName: '', productionDesignation: '', productionPhone: '', productionEmail: '', customerServiceName: '', customerServiceDesignation: '', customerServicePhone: '', customerServiceEmail: '' },
  statutory: { firmRegistrationNo: '', pan: '', pfNumber: '', esiNumber: '', msmeNumber: '', msmeCategory: '', labourPermitNo: '', gstin: '', iecNo: '', entityType: '', memberships: [], enlistments: [], certifications: [], operationalNetwork: '', gstCertificateFile: null, panCardFile: null, msmeCertificateFile: null },
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
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [vendorStatusState, setVendorStatusState] = useState<RegistrationStatus>('draft');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [stepValidationState, setStepValidationState] = useState<Record<number, boolean>>({});
  const formDataLoadedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { saveVendor, submitVendor, resubmitVendor, runValidations, isSaving, isSubmitting, vendorId, vendorStatus, existingFormData, isLoadingVendor, existingVendor } = useVendorRegistration();

  // Handle validation state changes from step components
  const handleValidationStateChange = (step: number) => (isValid: boolean) => {
    setStepValidationState(prev => ({ ...prev, [step]: isValid }));
  };

  // Check if current step can proceed (validation passed)
  const canProceedFromCurrentStep = () => {
    // Steps 4 (Compliance) and 5 (Bank) require validation
    if (currentStep === 4 || currentStep === 5) {
      return stepValidationState[currentStep] !== false;
    }
    return true;
  };

  const getValidationMessage = () => {
    if (currentStep === 4 && stepValidationState[4] === false) {
      return 'Please verify GST, PAN, and MSME details';
    }
    if (currentStep === 5 && stepValidationState[5] === false) {
      return 'Please verify bank account details';
    }
    return undefined;
  };

  useEffect(() => {
    if (existingFormData && vendorStatus && !formDataLoadedRef.current) {
      formDataLoadedRef.current = true;
      const editableStatuses = ['draft', 'validation_failed', 'finance_rejected', 'purchase_rejected'];
      const pendingStatuses = ['submitted', 'validation_pending', 'finance_review', 'purchase_review', 'finance_approved', 'purchase_approved', 'sap_synced'];
      if (editableStatuses.includes(vendorStatus)) {
        setFormData(existingFormData);
        setVendorStatusState(vendorStatus);
        if (vendorStatus !== 'draft') { setIsSubmitted(true); setIsEditMode(false); }
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

  const handleStartEdit = () => { setIsEditMode(true); setIsSubmitted(false); setCurrentStep(1); setCompletedSteps([1, 2, 3, 4, 5, 6]); };

  const handleStepComplete = (step: number, data: unknown) => {
    const stepKeys: Record<number, keyof VendorFormData> = { 1: 'organization', 2: 'address', 3: 'contact', 4: 'statutory', 5: 'bank', 6: 'financial' };
    const key = stepKeys[step];
    if (key) setFormData((prev) => ({ ...prev, [key]: data }));
    if (!completedSteps.includes(step)) setCompletedSteps((prev) => [...prev, step]);
    setCurrentStep(step + 1);
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(1, prev - 1));
  const handleStepClick = (step: number) => { if (completedSteps.includes(step) || step <= currentStep) setCurrentStep(step); };
  const handleEditStep = (step: number) => setCurrentStep(step);

  const handleSaveAsDraft = async () => {
    try {
      await saveVendor(formData);
      toast({ title: 'Draft Saved', description: 'Your progress has been saved.' });
    } catch (error) {
      toast({ title: 'Save Failed', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    }
  };

  const handleCancel = () => { toast({ title: 'Registration Cancelled' }); navigate('/'); };

  const handleSubmit = async () => {
    try {
      const vendor = isEditMode && vendorId ? await resubmitVendor(formData) : await submitVendor(formData);
      setIsSubmitted(true); setIsEditMode(false); setVendorStatusState('validation_pending');
      toast({ title: isEditMode ? 'Application Resubmitted' : 'Application Submitted' });
      setShowFeedback(true);
      await runValidations(vendor.id);
    } catch (error) {
      toast({ title: 'Submission Failed', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    }
  };

  const renderStep = () => {
    const legalName = formData.organization.legalName;
    switch (currentStep) {
      case 1: return <OrganizationStep data={formData.organization} onNext={(data) => handleStepComplete(1, data)} />;
      case 2: return <AddressStep data={formData.address} onNext={(data) => handleStepComplete(2, data)} onBack={handleBack} />;
      case 3: return <ContactStep data={formData.contact} onNext={(data) => handleStepComplete(3, data)} onBack={handleBack} />;
      case 4: return <ComplianceStep data={formData.statutory} legalName={legalName} onNext={(data) => handleStepComplete(4, data)} onBack={handleBack} onValidationStateChange={handleValidationStateChange(4)} />;
      case 5: return <BankStep data={formData.bank} legalName={legalName} onNext={(data) => handleStepComplete(5, data)} onBack={handleBack} onValidationStateChange={handleValidationStateChange(5)} />;
      case 6: return <FinancialStep data={formData.financial} onNext={(data) => handleStepComplete(6, data)} onBack={handleBack} />;
      case 7: return <ReviewStep data={formData} onSubmit={handleSubmit} onBack={handleBack} onEditStep={handleEditStep} />;
      default: return null;
    }
  };

  if (isLoadingVendor) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>;

  if (isSubmitted && !isEditMode) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-14 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          <Link to="/" className="flex items-center gap-3"><img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" /><span className="text-sm font-semibold text-foreground hidden sm:block">Vendor Portal</span></Link>
        </header>
        <SuccessScreen status={vendorStatusState} vendorId={vendorId || undefined} financeComments={existingVendor?.finance_comments} purchaseComments={existingVendor?.purchase_comments} onEdit={handleStartEdit} />
        <FeedbackPopup open={showFeedback} onOpenChange={setShowFeedback} vendorId={vendorId || undefined} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-20">
      <header className="h-14 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link to="/" className="flex items-center gap-3"><img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" /><span className="text-sm font-semibold text-foreground hidden sm:block">Vendor Portal</span></Link>
        <Sheet>
          <SheetTrigger asChild><Button variant="ghost" size="sm" className="gap-2"><HelpCircle className="h-4 w-4" /><span className="hidden sm:inline">Help</span></Button></SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Help & Support</SheetTitle><SheetDescription>Need assistance?</SheetDescription></SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"><Mail className="h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Email</p><p className="text-sm text-muted-foreground">vendor.support@ramky.com</p></div></div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"><Phone className="h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Phone</p><p className="text-sm text-muted-foreground">+91 40 2354 6789</p></div></div>
              <Link to="/support" className="flex items-center gap-2 text-sm text-primary hover:underline"><MessageSquare className="h-4 w-4" />Visit Help Center</Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex flex-1">
        <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r bg-card">
          <div className="p-6 border-b"><h2 className="text-lg font-semibold">Registration Steps</h2><p className="text-sm text-muted-foreground mt-1">Complete all steps to submit</p></div>
          <div className="flex-1 p-6 overflow-auto"><EnterpriseStepIndicator steps={registrationSteps} currentStep={currentStep} completedSteps={completedSteps} onStepClick={handleStepClick} /></div>
        </aside>

        <main className="flex-1 overflow-auto"><div className="max-w-3xl mx-auto p-6 lg:p-8">{renderStep()}</div></main>
      </div>

      <StickyActionBar currentStep={currentStep} totalSteps={registrationSteps.length} onCancel={handleCancel} onSaveDraft={handleSaveAsDraft} onBack={currentStep > 1 ? handleBack : undefined} onSubmit={currentStep === registrationSteps.length ? handleSubmit : undefined} isSaving={isSaving} isSubmitting={isSubmitting} canProceed={canProceedFromCurrentStep()} validationMessage={getValidationMessage()} />
    </div>
  );
}
