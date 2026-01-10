import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EnterpriseStepIndicator } from '@/components/vendor/EnterpriseStepIndicator';
import { SuccessScreen } from '@/components/vendor/SuccessScreen';
import { FeedbackPopup } from '@/components/vendor/FeedbackPopup';
import { EnterpriseOrganizationStep, EnterpriseOrganizationData } from '@/components/vendor/steps/EnterpriseOrganizationStep';
import { AddressStep } from '@/components/vendor/steps/AddressStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { FinancialStep } from '@/components/vendor/steps/FinancialStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
import { RegistrationStatus } from '@/components/vendor/RegistrationStatusTracker';
import { VendorFormData } from '@/types/vendor';
import { useToast } from '@/hooks/use-toast';
import { useVendorRegistration } from '@/hooks/useVendorRegistration';
import { HelpCircle, Phone, Mail, MessageSquare, X, Save, ChevronLeft, ChevronRight, Send, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// New consolidated 5-step flow
const registrationSteps = [
  { id: 1, title: 'Organization Profile', description: 'Company details and verification' },
  { id: 2, title: 'Address Information', description: 'Registered and branch addresses' },
  { id: 3, title: 'Contact Information', description: 'Key contact persons' },
  { id: 4, title: 'Financial Information', description: 'Turnover and credit terms' },
  { id: 5, title: 'Review & Submit', description: 'Verify and submit application' },
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

const initialExtendedOrgData: EnterpriseOrganizationData = {
  legalName: '',
  tradeName: '',
  industryType: '',
  organizationType: '',
  ownershipType: '',
  productCategories: [],
  gstin: '',
  pan: '',
  msmeNumber: '',
  bankAccountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
  accountHolderName: '',
};

export default function VendorRegistration() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [formData, setFormData] = useState<VendorFormData>(initialFormData);
  const [extendedOrgData, setExtendedOrgData] = useState<EnterpriseOrganizationData>(initialExtendedOrgData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [vendorStatusState, setVendorStatusState] = useState<RegistrationStatus>('draft');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [stepValidationState, setStepValidationState] = useState<Record<number, boolean>>({});
  const formDataLoadedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { saveVendor, submitVendor, resubmitVendor, runValidations, isSaving, isSubmitting, vendorId, vendorStatus, existingFormData, isLoadingVendor, existingVendor } = useVendorRegistration();

  const handleValidationStateChange = (step: number) => (isValid: boolean) => {
    setStepValidationState(prev => ({ ...prev, [step]: isValid }));
  };

  const canProceedFromCurrentStep = () => {
    if (currentStep === 1) {
      return stepValidationState[1] === true;
    }
    return true;
  };

  const getValidationMessage = () => {
    if (currentStep === 1 && stepValidationState[1] !== true) {
      return 'Please complete all mandatory verifications to proceed';
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
        setExtendedOrgData({
          legalName: existingFormData.organization.legalName || '',
          tradeName: existingFormData.organization.tradeName || '',
          industryType: existingFormData.organization.industryType || '',
          organizationType: existingFormData.organization.organizationType || '',
          ownershipType: existingFormData.organization.ownershipType || '',
          productCategories: existingFormData.organization.productCategories || [],
          gstin: existingFormData.statutory.gstin || '',
          pan: existingFormData.statutory.pan || '',
          msmeNumber: existingFormData.statutory.msmeNumber || '',
          bankAccountNumber: existingFormData.bank.accountNumber || '',
          confirmAccountNumber: existingFormData.bank.confirmAccountNumber || '',
          ifscCode: existingFormData.bank.ifscCode || '',
          accountHolderName: '',
        });
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

  const handleStartEdit = () => { setIsEditMode(true); setIsSubmitted(false); setCurrentStep(1); setCompletedSteps([1, 2, 3, 4]); };

  const handleOrganizationComplete = (data: EnterpriseOrganizationData) => {
    setExtendedOrgData(data);
    setFormData((prev) => ({
      ...prev,
      organization: {
        legalName: data.legalName,
        tradeName: data.tradeName,
        industryType: data.industryType,
        organizationType: data.organizationType,
        ownershipType: data.ownershipType,
        productCategories: data.productCategories,
      },
      statutory: {
        ...prev.statutory,
        gstin: data.gstin,
        pan: data.pan,
        msmeNumber: data.msmeNumber,
      },
      bank: {
        ...prev.bank,
        accountNumber: data.bankAccountNumber,
        confirmAccountNumber: data.confirmAccountNumber,
        ifscCode: data.ifscCode,
      },
    }));
    if (!completedSteps.includes(1)) setCompletedSteps((prev) => [...prev, 1]);
    setCurrentStep(2);
  };

  const handleStepComplete = (step: number, data: unknown) => {
    const stepKeys: Record<number, keyof VendorFormData> = { 2: 'address', 3: 'contact', 4: 'financial' };
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
    switch (currentStep) {
      case 1: 
        return (
          <EnterpriseOrganizationStep 
            data={extendedOrgData} 
            onNext={handleOrganizationComplete}
            onValidationStateChange={handleValidationStateChange(1)}
          />
        );
      case 2: return <AddressStep data={formData.address} onNext={(data) => handleStepComplete(2, data)} onBack={handleBack} />;
      case 3: return <ContactStep data={formData.contact} onNext={(data) => handleStepComplete(3, data)} onBack={handleBack} />;
      case 4: return <FinancialStep data={formData.financial} onNext={(data) => handleStepComplete(4, data)} onBack={handleBack} />;
      case 5: return <ReviewStep data={formData} onSubmit={handleSubmit} onBack={handleBack} onEditStep={handleEditStep} />;
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

  const canProceed = canProceedFromCurrentStep();
  const validationMessage = getValidationMessage();

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)] flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link to="/" className="flex items-center gap-3">
          <img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-foreground hidden sm:block">Vendor Portal</span>
        </Link>
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
      </header>

      {/* Main Content */}
      <div className="flex flex-1 max-w-[1280px] mx-auto w-full">
        {/* Left Panel - Registration Steps */}
        <aside className="hidden lg:flex flex-col w-[280px] flex-shrink-0 border-r bg-card">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-foreground">Registration Steps</h2>
            <p className="text-sm text-muted-foreground mt-1">Complete all steps to submit</p>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <EnterpriseStepIndicator 
              steps={registrationSteps} 
              currentStep={currentStep} 
              completedSteps={completedSteps} 
              onStepClick={handleStepClick} 
            />
          </div>
        </aside>

        {/* Right Panel - Form Card */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="bg-card rounded-[10px] shadow-enterprise-md border">
            {/* Form Header */}
            <div className="px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {currentStep === 1 && <span className="text-lg">🏢</span>}
                  {currentStep === 2 && <span className="text-lg">📍</span>}
                  {currentStep === 3 && <span className="text-lg">👤</span>}
                  {currentStep === 4 && <span className="text-lg">💰</span>}
                  {currentStep === 5 && <span className="text-lg">✓</span>}
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
                {/* Left side - Cancel */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancel}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>

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
