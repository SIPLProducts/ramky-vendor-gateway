import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EnterpriseStepIndicator } from '@/components/vendor/EnterpriseStepIndicator';
import { SuccessScreen } from '@/components/vendor/SuccessScreen';
import { FeedbackPopup } from '@/components/vendor/FeedbackPopup';
import { OrganizationStep } from '@/components/vendor/steps/OrganizationStep';
import { AddressStep } from '@/components/vendor/steps/AddressStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { CommercialStep } from '@/components/vendor/steps/CommercialStep';
import { BankDetailsStep } from '@/components/vendor/steps/BankDetailsStep';
import { FinancialInfrastructureStep } from '@/components/vendor/steps/FinancialInfrastructureStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
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

// 7-step registration flow matching PDF
const registrationSteps = [
  { id: 1, title: 'Organization Profile', description: 'Company name and type' },
  { id: 2, title: 'Address Information', description: 'Registered, manufacturing & branch' },
  { id: 3, title: 'Contact Details', description: 'Key contact persons' },
  { id: 4, title: 'Commercial Details', description: 'GST, PAN, MSME verification' },
  { id: 5, title: 'Bank Details', description: 'Bank account verification' },
  { id: 6, title: 'Financial & Infrastructure', description: 'Turnover, facility & QHSE' },
  { id: 7, title: 'Review & Submit', description: 'Verify and submit application' },
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

  const handleValidationStateChange = (step: number) => (isValid: boolean) => {
    setStepValidationState(prev => ({ ...prev, [step]: isValid }));
  };

  const canProceedFromCurrentStep = () => {
    // Steps 4 (Commercial) and 5 (Bank) require verification
    if (currentStep === 4) {
      return stepValidationState[4] !== false;
    }
    if (currentStep === 5) {
      return stepValidationState[5] === true;
    }
    return true;
  };

  const getValidationMessage = () => {
    if (currentStep === 4 && stepValidationState[4] === false) {
      return 'Please verify GST, PAN, and MSME details';
    }
    if (currentStep === 5 && stepValidationState[5] !== true) {
      return 'Please verify bank account with Penny Drop';
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
    const stepKeys: Record<number, keyof VendorFormData> = {
      1: 'organization',
      2: 'address',
      3: 'contact',
      4: 'statutory',
      5: 'bank',
    };
    const key = stepKeys[step];
    if (key) setFormData((prev) => ({ ...prev, [key]: data }));
    if (!completedSteps.includes(step)) setCompletedSteps((prev) => [...prev, step]);
    setCurrentStep(step + 1);
  };

  const handleFinancialInfraComplete = (data: { financial: FinancialDetails; infrastructure: InfrastructureDetails; qhse: QHSEDetails }) => {
    setFormData((prev) => ({
      ...prev,
      financial: data.financial,
      infrastructure: data.infrastructure,
      qhse: data.qhse,
    }));
    if (!completedSteps.includes(6)) setCompletedSteps((prev) => [...prev, 6]);
    setCurrentStep(7);
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
      case 1: 
        return <OrganizationStep data={formData.organization} onNext={(data) => handleStepComplete(1, data)} />;
      case 2: 
        return <AddressStep data={formData.address} onNext={(data) => handleStepComplete(2, data)} onBack={handleBack} />;
      case 3: 
        return <ContactStep data={formData.contact} onNext={(data) => handleStepComplete(3, data)} onBack={handleBack} />;
      case 4: 
        return <CommercialStep data={formData.statutory} legalName={legalName} onNext={(data) => handleStepComplete(4, data)} onBack={handleBack} onValidationStateChange={handleValidationStateChange(4)} />;
      case 5: 
        return <BankDetailsStep data={formData.bank} legalName={legalName} onNext={(data) => handleStepComplete(5, data)} onBack={handleBack} onValidationStateChange={handleValidationStateChange(5)} />;
      case 6: 
        return <FinancialInfrastructureStep financialData={formData.financial} infrastructureData={formData.infrastructure} qhseData={formData.qhse} onNext={handleFinancialInfraComplete} onBack={handleBack} />;
      case 7: 
        return <ReviewStep data={formData} onSubmit={handleSubmit} onBack={handleBack} onEditStep={handleEditStep} />;
      default: 
        return null;
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
                  {currentStep === 4 && <span className="text-lg">📋</span>}
                  {currentStep === 5 && <span className="text-lg">🏦</span>}
                  {currentStep === 6 && <span className="text-lg">💰</span>}
                  {currentStep === 7 && <span className="text-lg">✓</span>}
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
