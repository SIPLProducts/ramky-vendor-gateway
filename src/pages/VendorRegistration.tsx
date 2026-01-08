import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnterpriseStepIndicator, registrationSteps } from '@/components/vendor/EnterpriseStepIndicator';
import { EnterpriseHeader } from '@/components/layout/EnterpriseHeader';
import { StickyActionBar } from '@/components/vendor/StickyActionBar';
import { SuccessScreen } from '@/components/vendor/SuccessScreen';
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
import { Clock, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

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

  // Load existing form data if vendor exists
  useEffect(() => {
    if (existingFormData && vendorStatus && !formDataLoadedRef.current) {
      formDataLoadedRef.current = true;
      setFormData(existingFormData);
      setVendorStatusState(vendorStatus);
      
      if (vendorStatus === 'validation_failed' || vendorStatus === 'finance_rejected' || vendorStatus === 'purchase_rejected') {
        setIsSubmitted(true);
        setIsEditMode(false);
      } else if (vendorStatus !== 'draft') {
        setIsSubmitted(true);
      }
    }
  }, [existingFormData, vendorStatus]);

  // Subscribe to real-time vendor status updates
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
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      navigate('/');
    }
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

  // Loading state
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

  // Success/Status screen
  if (isSubmitted && !isEditMode) {
    return (
      <div className="min-h-screen bg-background">
        <EnterpriseHeader />
        <SuccessScreen
          status={vendorStatusState}
          vendorId={vendorId || undefined}
          financeComments={existingVendor?.finance_comments}
          purchaseComments={existingVendor?.purchase_comments}
          onEdit={handleStartEdit}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <EnterpriseHeader />
      
      {/* Main Content */}
      <div className="flex">
        {/* Left Sidebar - Step Indicator */}
        <aside className="hidden lg:block w-72 flex-shrink-0 border-r bg-card p-6 min-h-[calc(100vh-3rem)] sticky top-12">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Registration Steps</h2>
            <p className="text-sm text-muted-foreground mt-1">Complete all steps to submit</p>
          </div>
          
          <EnterpriseStepIndicator
            steps={registrationSteps}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
          />

          {/* Link Expiry Notice */}
          <div className="mt-8 p-4 bg-muted rounded-lg">
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
        <main className="flex-1 p-6 lg:p-8 max-w-4xl">
          {/* Mobile Step Indicator */}
          <div className="lg:hidden mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-semibold text-foreground">Vendor Registration</h1>
              <span className="text-sm text-muted-foreground">
                Step {currentStep} of {registrationSteps.length}
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(currentStep / registrationSteps.length) * 100}%` }}
              />
            </div>
          </div>

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
          <div id="step-form">
            {renderStep()}
          </div>
        </main>
      </div>

      {/* Sticky Action Bar */}
      {currentStep < 6 && (
        <StickyActionBar
          currentStep={currentStep}
          totalSteps={registrationSteps.length}
          onCancel={handleCancel}
          onSaveDraft={handleSaveAsDraft}
          onBack={currentStep > 1 ? handleBack : undefined}
          isSaving={isSaving}
          isSubmitting={isSubmitting || isResubmitting}
        />
      )}
    </div>
  );
}
