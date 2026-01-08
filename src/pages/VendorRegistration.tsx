import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EnterpriseStepIndicator, registrationSteps } from '@/components/vendor/EnterpriseStepIndicator';
import { SuccessScreen } from '@/components/vendor/SuccessScreen';
import { FeedbackPopup } from '@/components/vendor/FeedbackPopup';
import { OrganizationStep } from '@/components/vendor/steps/OrganizationStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { StatutoryStep } from '@/components/vendor/steps/StatutoryStep';
import { BankStep } from '@/components/vendor/steps/BankStep';
import { FinancialStep } from '@/components/vendor/steps/FinancialStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
import { RegistrationStatus } from '@/components/vendor/RegistrationStatusTracker';
import { VendorFormData } from '@/types/vendor';
import { useToast } from '@/hooks/use-toast';
import { useVendorRegistration } from '@/hooks/useVendorRegistration';
import { 
  Clock, 
  Info, 
  HelpCircle, 
  Phone, 
  Mail, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Send, 
  X,
  Loader2,
  MessageSquare
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const initialFormData: VendorFormData = {
  organization: {
    legalName: '',
    tradeName: '',
    registeredAddress: '',
    registeredCity: '',
    registeredState: '',
    registeredPincode: '',
    communicationAddress: '',
    communicationCity: '',
    communicationState: '',
    communicationPincode: '',
    sameAsRegistered: true,
    industryType: '',
    productCategories: [],
  },
  contact: {
    primaryContactName: '',
    primaryDesignation: '',
    primaryEmail: '',
    primaryPhone: '',
    secondaryContactName: '',
    secondaryDesignation: '',
    secondaryEmail: '',
    secondaryPhone: '',
  },
  statutory: {
    gstin: '',
    pan: '',
    msmeNumber: '',
    msmeCategory: '',
    entityType: '',
    gstCertificateFile: null,
    panCardFile: null,
    msmeCertificateFile: null,
  },
  bank: {
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    branchName: '',
    accountType: 'current',
    cancelledChequeFile: null,
  },
  financial: {
    turnoverYear1: '',
    turnoverYear2: '',
    turnoverYear3: '',
    creditPeriodExpected: '',
    financialDocsFile: null,
  },
  declaration: {
    selfDeclared: false,
    termsAccepted: false,
  },
};

export default function VendorRegistration() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [formData, setFormData] = useState<VendorFormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [vendorStatusState, setVendorStatusState] = useState<RegistrationStatus>('draft');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const formDataLoadedRef = useRef(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { 
    saveVendor,
    submitVendor,
    resubmitVendor,
    runValidations, 
    isSaving,
    isSubmitting,
    isResubmitting,
    vendorId,
    vendorStatus,
    existingFormData,
    isLoadingVendor,
    existingVendor,
  } = useVendorRegistration();

  const linkExpiry = new Date();
  linkExpiry.setDate(linkExpiry.getDate() + 14);

  useEffect(() => {
    if (existingFormData && vendorStatus && !formDataLoadedRef.current) {
      formDataLoadedRef.current = true;
      
      const editableStatuses = ['draft', 'validation_failed', 'finance_rejected', 'purchase_rejected'];
      const pendingStatuses = ['submitted', 'validation_pending', 'finance_review', 'purchase_review', 'finance_approved', 'purchase_approved', 'sap_synced'];
      
      if (editableStatuses.includes(vendorStatus)) {
        setFormData(existingFormData);
        setVendorStatusState(vendorStatus);
        
        if (vendorStatus !== 'draft') {
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

    const channel = supabase
      .channel(`vendor-status-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vendors',
          filter: `id=eq.${vendorId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as RegistrationStatus;
          setVendorStatusState(newStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId]);

  const handleStartEdit = () => {
    setIsEditMode(true);
    setIsSubmitted(false);
    setCurrentStep(1);
    setCompletedSteps([1, 2, 3, 4, 5]);
  };

  const handleStepComplete = (step: number, data: unknown) => {
    const stepKeys: Record<number, keyof VendorFormData> = {
      1: 'organization',
      2: 'contact',
      3: 'statutory',
      4: 'bank',
      5: 'financial',
    };

    const key = stepKeys[step];
    if (key) {
      setFormData((prev) => ({ ...prev, [key]: data }));
    }

    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
    setCurrentStep(step + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleStepClick = (step: number) => {
    if (completedSteps.includes(step) || step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const handleEditStep = (step: number) => {
    setCurrentStep(step);
  };

  const handleSaveAsDraft = async () => {
    try {
      await saveVendor(formData);
      toast({
        title: 'Draft Saved',
        description: 'Your progress has been saved. You can continue later.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      // Check if it's an authentication error
      if (errorMessage.includes('not authenticated')) {
        toast({
          title: 'Login Required',
          description: 'Please log in to save your draft.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }
      toast({
        title: 'Save Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    toast({
      title: 'Registration Cancelled',
      description: 'Your progress was not saved.',
    });
    navigate('/');
  };

  const handleSubmit = async () => {
    try {
      let vendor;
      
      if (isEditMode && vendorId) {
        vendor = await resubmitVendor(formData);
      } else {
        vendor = await submitVendor(formData);
      }
      
      setIsSubmitted(true);
      setIsEditMode(false);
      setVendorStatusState('validation_pending');
      
      toast({
        title: isEditMode ? 'Application Resubmitted' : 'Application Submitted',
        description: 'Your vendor registration has been submitted successfully.',
      });
      
      // Show feedback popup after submission
      setShowFeedback(true);
      
      await runValidations(vendor.id);
      
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const renderStep = () => {
    const commonProps = {
      onBack: handleBack,
    };

    switch (currentStep) {
      case 1:
        return (
          <OrganizationStep
            data={formData.organization}
            onNext={(data) => handleStepComplete(1, data)}
          />
        );
      case 2:
        return (
          <ContactStep
            data={formData.contact}
            onNext={(data) => handleStepComplete(2, data)}
            {...commonProps}
          />
        );
      case 3:
        return (
          <StatutoryStep
            data={formData.statutory}
            onNext={(data) => handleStepComplete(3, data)}
            {...commonProps}
          />
        );
      case 4:
        return (
          <BankStep
            data={formData.bank}
            onNext={(data) => handleStepComplete(4, data)}
            {...commonProps}
          />
        );
      case 5:
        return (
          <FinancialStep
            data={formData.financial}
            onNext={(data) => handleStepComplete(5, data)}
            {...commonProps}
          />
        );
      case 6:
        return (
          <ReviewStep
            data={formData}
            onSubmit={handleSubmit}
            onBack={handleBack}
            onEditStep={handleEditStep}
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === registrationSteps.length;
  const isFirstStep = currentStep === 1;

  if (isLoadingVendor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading your application...</p>
        </div>
      </div>
    );
  }

  if (isSubmitted && !isEditMode) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header for success screen */}
        <header className="h-14 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          <Link to="/" className="flex items-center gap-3">
            <img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" />
            <span className="text-sm font-semibold text-foreground hidden sm:block">Vendor Portal</span>
          </Link>
        </header>
        <SuccessScreen
          status={vendorStatusState}
          vendorId={vendorId || undefined}
          financeComments={existingVendor?.finance_comments}
          purchaseComments={existingVendor?.purchase_comments}
          onEdit={handleStartEdit}
        />
        
        {/* Feedback Popup */}
        <FeedbackPopup
          open={showFeedback}
          onOpenChange={setShowFeedback}
          vendorId={vendorId || undefined}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link to="/" className="flex items-center gap-3">
          <img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-foreground hidden sm:block">Vendor Portal</span>
        </Link>
        
        {/* Help & Support */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Help & Support</span>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Help & Support</SheetTitle>
              <SheetDescription>
                Need assistance with your registration? We're here to help.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {/* Contact Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Contact Us</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email Support</p>
                      <p className="text-sm text-muted-foreground">vendor.support@ramky.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Phone Support</p>
                      <p className="text-sm text-muted-foreground">+91 40 2354 6789</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQs */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Frequently Asked Questions</h4>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm font-medium">How long does registration take?</p>
                    <p className="text-xs text-muted-foreground mt-1">Typically 2-3 business days after submission.</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm font-medium">What documents do I need?</p>
                    <p className="text-xs text-muted-foreground mt-1">GST Certificate, PAN Card, Cancelled Cheque, and MSME Certificate (if applicable).</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm font-medium">Can I save and continue later?</p>
                    <p className="text-xs text-muted-foreground mt-1">Yes, click "Save Draft" to save your progress anytime.</p>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">Quick Links</h4>
                <div className="space-y-2">
                  <Link to="/support" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <MessageSquare className="h-4 w-4" />
                    Visit Help Center
                  </Link>
                  <Link to="/feedback" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <HelpCircle className="h-4 w-4" />
                    Share Feedback
                  </Link>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Left Sidebar - Step Indicator */}
        <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r bg-card">
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

          {/* Help & Support Link */}
          <div className="p-4 border-t">
            <Link 
              to="/support" 
              className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <HelpCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Need Help?</p>
                <p className="text-xs text-muted-foreground">Visit Help & Support</p>
              </div>
            </Link>
          </div>

          {/* Link Expiry Notice */}
          <div className="p-4 border-t bg-muted/50">
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs font-medium text-foreground">Link Expires</p>
                <p className="text-xs text-muted-foreground">
                  {linkExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Form Area */}
        <main className="flex-1 flex flex-col">
          {/* Mobile Step Indicator */}
          <div className="lg:hidden p-4 bg-card border-b">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold text-foreground">Vendor Registration</h1>
              <span className="text-sm text-muted-foreground">
                Step {currentStep} of {registrationSteps.length}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(currentStep / registrationSteps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 p-6 lg:p-8 overflow-auto">
            {/* Page Header */}
            <div className="hidden lg:block mb-6">
              <h1 className="text-xl font-semibold text-foreground">
                {registrationSteps.find(s => s.id === currentStep)?.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {registrationSteps.find(s => s.id === currentStep)?.description}
              </p>
            </div>

            {/* Info Alert */}
            {currentStep === 1 && (
              <Alert className="mb-6 bg-info/5 border-info/20">
                <Info className="h-4 w-4 text-info" />
                <AlertDescription className="text-sm">
                  Please ensure all information matches your official documents. Fields marked with * are mandatory.
                </AlertDescription>
              </Alert>
            )}

            {/* Step Content */}
            <div className="max-w-3xl">
              {renderStep()}
            </div>
          </div>

          {/* Action Bar */}
          {currentStep < 6 && (
            <div className="border-t bg-card px-6 py-4 sticky bottom-0 shadow-lg">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                {/* Left - Cancel */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancel}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>

                {/* Right - Actions */}
                <div className="flex items-center gap-3">
                  {/* Save Draft */}
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

                  {/* Previous */}
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

                  {/* Next / Submit */}
                  {isLastStep ? (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting || isResubmitting}
                      className="min-w-[140px]"
                    >
                      {(isSubmitting || isResubmitting) ? (
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
                      className="min-w-[100px]"
                    >
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
