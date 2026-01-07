import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StepIndicator, registrationSteps } from '@/components/vendor/StepIndicator';
import { OrganizationStep } from '@/components/vendor/steps/OrganizationStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { StatutoryStep } from '@/components/vendor/steps/StatutoryStep';
import { BankStep } from '@/components/vendor/steps/BankStep';
import { FinancialStep } from '@/components/vendor/steps/FinancialStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
import { RegistrationStatusTracker, RegistrationStatus } from '@/components/vendor/RegistrationStatusTracker';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { VendorFormData } from '@/types/vendor';
import { useToast } from '@/hooks/use-toast';
import { useVendorRegistration } from '@/hooks/useVendorRegistration';
import { Clock, CheckCircle2, Save, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
  const [vendorStatus, setVendorStatus] = useState<RegistrationStatus>('draft');
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { 
    saveVendor,
    submitVendor, 
    runValidations, 
    isSaving,
    isSubmitting, 
    isValidating,
    vendorId 
  } = useVendorRegistration();

  const linkExpiry = new Date();
  linkExpiry.setDate(linkExpiry.getDate() + 14);

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
          setVendorStatus(newStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId]);

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

  const handleEditStep = (step: number) => {
    setCurrentStep(step);
  };

  const handleSaveAsDraft = async () => {
    try {
      await saveVendor(formData);
      toast({
        title: 'Draft Saved',
        description: 'Your registration progress has been saved. You can continue later.',
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
      const vendor = await submitVendor(formData);
      setIsSubmitted(true);
      setVendorStatus('validation_pending');
      
      toast({
        title: 'Registration Submitted',
        description: 'Your vendor registration has been submitted successfully.',
      });
      
      // Run automatic validations in the background
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
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <StatutoryStep
            data={formData.statutory}
            onNext={(data) => handleStepComplete(3, data)}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <BankStep
            data={formData.bank}
            onNext={(data) => handleStepComplete(4, data)}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <FinancialStep
            data={formData.financial}
            onNext={(data) => handleStepComplete(5, data)}
            onBack={handleBack}
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

  // Show success page after submission
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="container max-w-4xl py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 mb-4">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Registration Submitted Successfully
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your vendor registration has been submitted. You will receive email notifications as your application progresses through the approval process.
            </p>
          </div>

          {/* Status Tracker */}
          <div className="bg-card rounded-lg border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-6 text-center">Registration Progress</h2>
            <RegistrationStatusTracker status={vendorStatus} />
          </div>

          {/* What's Next */}
          <div className="bg-card rounded-lg border p-6">
            <h3 className="font-semibold mb-4">What Happens Next?</h3>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-medium">1</span>
                <div>
                  <p className="font-medium text-foreground">Document Verification</p>
                  <p className="text-sm text-muted-foreground">Your submitted documents will be verified automatically.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-medium">2</span>
                <div>
                  <p className="font-medium text-foreground">Finance Team Review</p>
                  <p className="text-sm text-muted-foreground">Our finance team will review your financial details and documents.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-medium">3</span>
                <div>
                  <p className="font-medium text-foreground">Purchase Team Approval</p>
                  <p className="text-sm text-muted-foreground">Final approval from the purchase team to complete onboarding.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-medium">4</span>
                <div>
                  <p className="font-medium text-foreground">SAP Vendor Code</p>
                  <p className="text-sm text-muted-foreground">Your vendor code will be created in SAP upon final approval.</p>
                </div>
              </li>
            </ol>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <main className="container max-w-5xl py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-foreground">Vendor Registration</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAsDraft}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save as Draft'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Complete all steps to submit your vendor onboarding application
          </p>
        </div>

        <Alert className="mb-6">
          <Clock className="h-4 w-4" />
          <AlertTitle>Registration Link Validity</AlertTitle>
          <AlertDescription>
            This registration link expires on{' '}
            <strong>{linkExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
            Please complete your registration before the expiry date.
          </AlertDescription>
        </Alert>

        <div className="mb-8">
          <StepIndicator
            steps={registrationSteps}
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        {renderStep()}
      </main>
    </div>
  );
}
