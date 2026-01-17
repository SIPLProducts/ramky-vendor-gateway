import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, FileCheck, CreditCard, Landmark, BadgeCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { VerificationField } from '@/components/vendor/VerificationField';
import { VerificationStatusBanner } from '@/components/vendor/VerificationStatusBanner';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { 
  INDUSTRY_TYPES, 
  ORGANIZATION_TYPES, 
  OWNERSHIP_TYPES, 
  PRODUCT_CATEGORIES 
} from '@/types/vendor';

// Combined schema for Organization + Verification
const schema = z.object({
  // Organization Details
  legalName: z.string().min(2, 'Legal name is required'),
  tradeName: z.string().optional(),
  industryType: z.string().min(1, 'Industry type is required'),
  organizationType: z.string().min(1, 'Organization type is required'),
  ownershipType: z.string().min(1, 'Ownership type is required'),
  productCategories: z.array(z.string()).min(1, 'Select at least one category'),
  
  // Verification Fields
  gstin: z.string().min(1, 'GSTIN is required'),
  pan: z.string().min(1, 'PAN is required'),
  msmeNumber: z.string().min(1, 'MSME/Udyam number is required'),
  
  // Bank Details
  bankAccountNumber: z.string().min(8, 'Account number is required'),
  confirmAccountNumber: z.string().min(8, 'Confirm account number'),
  ifscCode: z.string().min(11, 'IFSC code is required'),
  accountHolderName: z.string().optional(),
}).refine((data) => data.bankAccountNumber === data.confirmAccountNumber, {
  message: "Account numbers don't match",
  path: ["confirmAccountNumber"],
});

type FormData = z.infer<typeof schema>;

export interface EnterpriseOrganizationData {
  legalName: string;
  tradeName: string;
  industryType: string;
  organizationType: string;
  ownershipType: string;
  productCategories: string[];
  gstin: string;
  pan: string;
  msmeNumber: string;
  bankAccountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  accountHolderName: string;
}

interface EnterpriseOrganizationStepProps {
  data: EnterpriseOrganizationData;
  onNext: (data: EnterpriseOrganizationData) => void;
  onValidationStateChange?: (isValid: boolean) => void;
}

export function EnterpriseOrganizationStep({ 
  data, 
  onNext, 
  onValidationStateChange 
}: EnterpriseOrganizationStepProps) {
  const { 
    validationStates, 
    validateGST, 
    validatePAN, 
    validateMSME,
    validateBank,
    resetValidation 
  } = useFieldValidation();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalName: data.legalName || '',
      tradeName: data.tradeName || '',
      industryType: data.industryType || '',
      organizationType: data.organizationType || '',
      ownershipType: data.ownershipType || '',
      productCategories: data.productCategories || [],
      gstin: data.gstin || '',
      pan: data.pan || '',
      msmeNumber: data.msmeNumber || '',
      bankAccountNumber: data.bankAccountNumber || '',
      confirmAccountNumber: data.confirmAccountNumber || '',
      ifscCode: data.ifscCode || '',
      accountHolderName: data.accountHolderName || '',
    },
  });

  const watchedValues = watch();
  const legalName = watchedValues.legalName;

  // Check all verifications are passed
  const allVerificationsPassed = 
    validationStates.gst.status === 'passed' &&
    validationStates.pan.status === 'passed' &&
    validationStates.msme.status === 'passed' &&
    validationStates.bank.status === 'passed';

  // Update parent about validation state
  useEffect(() => {
    onValidationStateChange?.(allVerificationsPassed);
  }, [allVerificationsPassed, onValidationStateChange]);

  // Reset validations when values change
  useEffect(() => {
    if (validationStates.gst.status !== 'idle') resetValidation('gst');
  }, [watchedValues.gstin]);

  useEffect(() => {
    if (validationStates.pan.status !== 'idle') resetValidation('pan');
  }, [watchedValues.pan]);

  useEffect(() => {
    if (validationStates.msme.status !== 'idle') resetValidation('msme');
  }, [watchedValues.msmeNumber]);

  useEffect(() => {
    if (validationStates.bank.status !== 'idle') resetValidation('bank');
  }, [watchedValues.bankAccountNumber, watchedValues.ifscCode]);

  const handleVerifyGST = async () => {
    const result = await validateGST(watchedValues.gstin, legalName);
    if (result && validationStates.gst.data?.legalName) {
      // Compare with entered legal name
    }
  };

  const handleVerifyPAN = async () => {
    await validatePAN(watchedValues.pan, legalName);
  };

  const handleVerifyMSME = async () => {
    await validateMSME(watchedValues.msmeNumber, legalName);
  };

  const handleVerifyBank = async () => {
    const result = await validateBank(
      watchedValues.bankAccountNumber,
      watchedValues.ifscCode,
      legalName
    );
    if (result && validationStates.bank.data?.accountHolderName) {
      setValue('accountHolderName', validationStates.bank.data.accountHolderName as string);
    }
  };

  const handleFormSubmit = (formData: FormData) => {
    if (!allVerificationsPassed) {
      return; // Don't submit without all verifications
    }
    onNext(formData as EnterpriseOrganizationData);
  };

  const canVerifyBank = 
    watchedValues.bankAccountNumber?.length >= 8 && 
    watchedValues.ifscCode?.length === 11 &&
    watchedValues.bankAccountNumber === watchedValues.confirmAccountNumber;

  return (
    <div className="space-y-6">
      {/* Verification Status Banner */}
      <VerificationStatusBanner validationStates={validationStates} />

      <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Section 1: Organization Details */}
        <div className="form-section">
          <h3 className="form-section-title">
            <Building2 className="h-5 w-5 text-primary" />
            Organization Details
          </h3>

          <div className="grid gap-5">
            {/* Legal Name - Full Width */}
            <div className="grid gap-1.5">
              <Label htmlFor="legalName">
                Legal Name of Organization <span className="text-destructive">*</span>
              </Label>
              <Input
                id="legalName"
                {...register('legalName')}
                placeholder="Enter legal name as per registration"
                className={errors.legalName ? 'border-destructive' : ''}
              />
              {errors.legalName && (
                <p className="text-xs text-destructive">{errors.legalName.message}</p>
              )}
            </div>

            {/* Trade Name - Full Width */}
            <div className="grid gap-1.5">
              <Label htmlFor="tradeName">Trade Name / Brand Name</Label>
              <Input
                id="tradeName"
                {...register('tradeName')}
                placeholder="Enter trade name or brand name (if different)"
              />
            </div>

            {/* Two Column Grid */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="industryType">
                  Type of Industry <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="industryType"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={errors.industryType ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select industry type" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.industryType && (
                  <p className="text-xs text-destructive">{errors.industryType.message}</p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="organizationType">
                  Type of Organization <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="organizationType"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={errors.organizationType ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select organization type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORGANIZATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.organizationType && (
                  <p className="text-xs text-destructive">{errors.organizationType.message}</p>
                )}
              </div>
            </div>

            {/* Ownership Type */}
            <div className="grid gap-1.5">
              <Label htmlFor="ownershipType">
                Type of Ownership <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="ownershipType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={errors.ownershipType ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select ownership type" />
                    </SelectTrigger>
                    <SelectContent>
                      {OWNERSHIP_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.ownershipType && (
                <p className="text-xs text-destructive">{errors.ownershipType.message}</p>
              )}
            </div>

            {/* Product Categories - Full Width */}
            <div className="grid gap-1.5">
              <Label>
                Product / Service Categories <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="productCategories"
                control={control}
                render={({ field }) => (
                  <MultiSelect
                    options={PRODUCT_CATEGORIES.map((cat) => ({ label: cat, value: cat }))}
                    selected={field.value || []}
                    onChange={field.onChange}
                    placeholder="Select product/service categories"
                  />
                )}
              />
              {errors.productCategories && (
                <p className="text-xs text-destructive">{errors.productCategories.message}</p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 2: Statutory & Bank Verification */}
        <div className="form-section">
          <h3 className="form-section-title">
            <FileCheck className="h-5 w-5 text-primary" />
            Statutory & Bank Verification
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            This section is mandatory. All verifications must be completed to proceed.
          </p>

          <div className="space-y-6">
            {/* GST Verification */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">GST Verification</span>
              </div>
              <VerificationField
                id="gstin"
                label="GSTIN"
                placeholder="22AAAAA0000A1Z5"
                value={watchedValues.gstin || ''}
                onChange={(val) => setValue('gstin', val)}
                validationState={validationStates.gst}
                onVerify={handleVerifyGST}
                disabled={!watchedValues.gstin || watchedValues.gstin.length !== 15}
                maxLength={15}
                error={errors.gstin?.message}
                required
                helperText="Enter 15-character GSTIN to verify"
              />
            </div>

            {/* PAN Verification */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">PAN Verification</span>
              </div>
              <VerificationField
                id="pan"
                label="PAN"
                placeholder="ABCDE1234F"
                value={watchedValues.pan || ''}
                onChange={(val) => setValue('pan', val)}
                validationState={validationStates.pan}
                onVerify={handleVerifyPAN}
                disabled={!watchedValues.pan || watchedValues.pan.length !== 10}
                maxLength={10}
                error={errors.pan?.message}
                required
                helperText="Enter 10-character PAN to verify"
              />
            </div>

            {/* Bank Account Verification */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-4">
                <Landmark className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Bank Account Verification</span>
              </div>
              
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="bankAccountNumber">
                      Bank Account Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="bankAccountNumber"
                      {...register('bankAccountNumber')}
                      placeholder="Enter account number"
                      className={errors.bankAccountNumber ? 'border-destructive' : ''}
                    />
                    {errors.bankAccountNumber && (
                      <p className="text-xs text-destructive">{errors.bankAccountNumber.message}</p>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="confirmAccountNumber">
                      Confirm Account Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="confirmAccountNumber"
                      {...register('confirmAccountNumber')}
                      placeholder="Re-enter account number"
                      className={errors.confirmAccountNumber ? 'border-destructive' : ''}
                    />
                    {errors.confirmAccountNumber && (
                      <p className="text-xs text-destructive">{errors.confirmAccountNumber.message}</p>
                    )}
                  </div>
                </div>

                <VerificationField
                  id="ifscCode"
                  label="IFSC Code"
                  placeholder="SBIN0001234"
                  value={watchedValues.ifscCode || ''}
                  onChange={(val) => setValue('ifscCode', val)}
                  validationState={validationStates.bank}
                  onVerify={handleVerifyBank}
                  disabled={!canVerifyBank}
                  maxLength={11}
                  error={errors.ifscCode?.message}
                  required
                  helperText="₹1 Penny Drop verification will be performed"
                />

                {validationStates.bank.status === 'passed' && watchedValues.accountHolderName && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="accountHolderName">Account Holder Name (Auto-filled)</Label>
                    <Input
                      id="accountHolderName"
                      {...register('accountHolderName')}
                      readOnly
                      className="bg-success/5 border-success/30"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* MSME Verification */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-4">
                <BadgeCheck className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">MSME Verification</span>
              </div>
              <VerificationField
                id="msmeNumber"
                label="Udyam Registration Number"
                placeholder="UDYAM-XX-00-0000000"
                value={watchedValues.msmeNumber || ''}
                onChange={(val) => setValue('msmeNumber', val)}
                validationState={validationStates.msme}
                onVerify={handleVerifyMSME}
                disabled={!watchedValues.msmeNumber}
                error={errors.msmeNumber?.message}
                required
                helperText="Enter your Udyam registration number"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
