import { useState } from 'react';
import { StepIndicator, registrationSteps } from '@/components/vendor/StepIndicator';
import { OrganizationStep } from '@/components/vendor/steps/OrganizationStep';
import { ContactStep } from '@/components/vendor/steps/ContactStep';
import { StatutoryStep } from '@/components/vendor/steps/StatutoryStep';
import { BankStep } from '@/components/vendor/steps/BankStep';
import { FinancialStep } from '@/components/vendor/steps/FinancialStep';
import { ReviewStep } from '@/components/vendor/steps/ReviewStep';
import { ValidationStatus } from '@/components/vendor/ValidationStatus';
import { Header } from '@/components/layout/Header';
import { VendorFormData, ValidationResult } from '@/types/vendor';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [isValidating, setIsValidating] = useState(false);
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const { toast } = useToast();

  const linkExpiry = new Date();
  linkExpiry.setDate(linkExpiry.getDate() + 14);

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

  const simulateValidations = async () => {
    setIsValidating(true);
    
    const mockValidations: ValidationResult[] = [
      { type: 'gst', status: 'passed', message: 'GST verified - Active status confirmed', timestamp: new Date().toISOString() },
      { type: 'pan', status: 'passed', message: 'PAN verified successfully', timestamp: new Date().toISOString() },
      { type: 'name_match', status: 'passed', message: 'Name match score: 95% (Above threshold)', timestamp: new Date().toISOString() },
      { type: 'bank', status: 'passed', message: 'Bank account verified via ₹1 penny drop', timestamp: new Date().toISOString() },
      { type: 'msme', status: formData.statutory.msmeNumber ? 'passed' : 'skipped', message: formData.statutory.msmeNumber ? 'MSME certificate verified' : 'MSME not provided', timestamp: new Date().toISOString() },
    ];

    for (let i = 0; i < mockValidations.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setValidations((prev) => [...prev, mockValidations[i]]);
    }

    setIsValidating(false);
  };

  const handleSubmit = async () => {
    setIsSubmitted(true);
    toast({
      title: 'Registration Submitted',
      description: 'Your vendor registration has been submitted for verification.',
    });
    
    await simulateValidations();
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
        <Header userRole="vendor" userName="Vendor User" />
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
      <Header userRole="vendor" userName="Vendor User" />
      
      <main className="container max-w-5xl py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Vendor Registration</h1>
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
