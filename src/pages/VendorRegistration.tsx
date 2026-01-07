import { useState, useEffect } from 'react';
import { StepIndicator, registrationSteps } from '@/components/vendor/StepIndicator';
import { OrganizationStep } from '@/components/vendor/steps/OrganizationStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { StatutoryStep } from '@/components/vendor/steps/StatutoryStep';
import { BankStep } from '@/components/vendor/steps/BankStep';
import { FinancialStep } from '@/components/vendor/steps/FinancialStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { VendorFormData, ValidationResult } from '@/types/vendor';
import { useToast } from '@/hooks/use-toast';
import { useVendorRegistration } from '@/hooks/useVendorRegistration';
import { Clock, CheckCircle2, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  const [isLocked, setIsLocked] = useState(false);
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [systemFetchedData, setSystemFetchedData] = useState<{
    gstLegalName?: string;
    gstStatus?: string;
    panName?: string;
    bankAccountName?: string;
  }>({});
  const { toast } = useToast();
  
  const { 
    submitVendor, 
    runValidations, 
    isSubmitting, 
    isValidating,
    vendorId 
  } = useVendorRegistration();

  const linkExpiry = new Date();
  linkExpiry.setDate(linkExpiry.getDate() + 14);

  // Subscribe to real-time validation updates
  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-validations-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_validations',
          filter: `vendor_id=eq.${vendorId}`,
        },
        async () => {
          // Fetch updated validations
          const { data } = await supabase
            .from('vendor_validations')
            .select('*')
            .eq('vendor_id', vendorId);
          
          if (data) {
            const results: ValidationResult[] = data.map((v) => ({
              type: v.validation_type as ValidationResult['type'],
              status: v.status as ValidationResult['status'],
              message: v.message || '',
              details: v.details as Record<string, unknown> | undefined,
              timestamp: v.validated_at,
            }));
            setValidations(results);
            
            // Extract system-fetched data from validation details
            const gstValidation = data.find(v => v.validation_type === 'gst');
            const panValidation = data.find(v => v.validation_type === 'pan');
            const bankValidation = data.find(v => v.validation_type === 'bank');
            
            setSystemFetchedData({
              gstLegalName: (gstValidation?.details as any)?.registeredName,
              gstStatus: (gstValidation?.details as any)?.status,
              panName: (panValidation?.details as any)?.registeredName,
              bankAccountName: (bankValidation?.details as any)?.accountHolderName,
            });
          }
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

  const handleSubmit = async () => {
    try {
      // Submit vendor data to database
      const vendor = await submitVendor(formData);
      setIsSubmitted(true);
      setIsLocked(true); // Lock the form after submission
      
      toast({
        title: 'Registration Submitted',
        description: 'Your vendor registration has been submitted. Running validations...',
      });
      
      // Run automatic validations
      const results = await runValidations(vendor.id);
      setValidations(results);
      
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

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="container max-w-4xl py-8">
          <Alert className="mb-6 bg-success/10 border-success">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <AlertTitle className="text-success">Registration Submitted Successfully</AlertTitle>
            <AlertDescription>
              Your vendor registration has been submitted and is now being validated.
              You will receive an email notification once the review is complete.
            </AlertDescription>
          </Alert>

          <ValidationStatus validations={validations} isProcessing={isValidating} />

          {/* System Fetched Data Display */}
          {Object.keys(systemFetchedData).some(key => systemFetchedData[key as keyof typeof systemFetchedData]) && (
            <div className="form-section mt-6">
              <h3 className="form-section-title flex items-center gap-2">
                <Lock className="h-4 w-4" />
                System-Verified Information
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                The following fields have been auto-populated from government databases and are locked.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemFetchedData.gstLegalName && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-xs text-muted-foreground">GST Registered Name</p>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {systemFetchedData.gstLegalName}
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </p>
                  </div>
                )}
                {systemFetchedData.gstStatus && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-xs text-muted-foreground">GST Status</p>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {systemFetchedData.gstStatus}
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </p>
                  </div>
                )}
                {systemFetchedData.panName && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-xs text-muted-foreground">PAN Registered Name</p>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {systemFetchedData.panName}
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </p>
                  </div>
                )}
                {systemFetchedData.bankAccountName && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-xs text-muted-foreground">Bank Account Holder Name</p>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {systemFetchedData.bankAccountName}
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="form-section mt-6">
            <h3 className="form-section-title">What's Next?</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>All validations must pass before proceeding</li>
              <li>Finance team will review your submission</li>
              <li>Upon Finance approval, Purchase team will give final approval</li>
              <li>After all approvals, your vendor code will be created in SAP</li>
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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-foreground">Vendor Registration</h1>
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-xs bg-warning/10 text-warning px-2 py-1 rounded-full">
                <Lock className="h-3 w-3" />
                Form Locked
              </span>
            )}
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
