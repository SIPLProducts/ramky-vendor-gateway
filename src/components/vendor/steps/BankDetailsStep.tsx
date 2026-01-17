import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Landmark, CreditCard, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/vendor/FileUpload';
import { VerifyButton } from '@/components/vendor/VerifyButton';
import { ValidationMessage } from '@/components/vendor/ValidationMessage';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { BankDetails } from '@/types/vendor';

const schema = z.object({
  bankName: z.string().min(2, 'Bank name is required'),
  branchName: z.string().min(2, 'Branch name is required'),
  accountNumber: z.string().min(8, 'Valid account number required'),
  confirmAccountNumber: z.string().min(8, 'Please confirm account number'),
  accountType: z.enum(['current', 'savings', 'cash_credit', 'others']),
  accountTypeOther: z.string().optional(),
  ifscCode: z.string().min(11, 'IFSC code is required'),
  micrCode: z.string().optional(),
  bankAddress: z.string().optional(),
}).refine((data) => data.accountNumber === data.confirmAccountNumber, {
  message: "Account numbers don't match",
  path: ["confirmAccountNumber"],
});

interface BankDetailsStepProps {
  data: BankDetails;
  legalName?: string;
  vendorId?: string;
  onNext: (data: BankDetails) => void;
  onBack: () => void;
  onValidationStateChange?: (isValid: boolean) => void;
}

export function BankDetailsStep({ data, legalName, vendorId, onNext, onValidationStateChange }: BankDetailsStepProps) {
  const [cancelledChequeFile, setCancelledChequeFile] = useState<File | null>(data.cancelledChequeFile);
  
  const { validationStates, validateBank, resetValidation } = useFieldValidation(vendorId);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<BankDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  const accountNumber = watch('accountNumber');
  const confirmAccountNumber = watch('confirmAccountNumber');
  const ifscCode = watch('ifscCode');
  const accountType = watch('accountType');

  // Reset validation when values change
  useEffect(() => {
    if (validationStates.bank.status !== 'idle') {
      resetValidation('bank');
    }
  }, [accountNumber, ifscCode, resetValidation]);

  // Update parent about validation state
  useEffect(() => {
    const bankValid = validationStates.bank.status === 'passed';
    onValidationStateChange?.(bankValid);
  }, [validationStates.bank.status, onValidationStateChange]);

  const canVerify = 
    accountNumber?.length >= 1 && 
    confirmAccountNumber?.length >= 1 &&
    confirmAccountNumber === accountNumber &&
    ifscCode?.length >= 1;

  const handleVerifyBank = async () => {
    await validateBank(accountNumber, ifscCode, legalName);
  };

  const handleFormSubmit = (formData: BankDetails) => {
    if (validationStates.bank.status !== 'passed') {
      return;
    }
    // Check if cancelled cheque is uploaded
    if (!cancelledChequeFile) {
      return;
    }
    onNext({
      ...formData,
      cancelledChequeFile,
    });
  };

  // Bypass form validation if bank is already verified
  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if cancelled cheque is uploaded - mandatory
    if (!cancelledChequeFile) {
      return;
    }
    
    if (validationStates.bank.status === 'passed') {
      // Bank is verified, bypass Zod validation and submit directly
      const formData: BankDetails = {
        bankName: watch('bankName'),
        branchName: watch('branchName'),
        accountNumber: watch('accountNumber'),
        confirmAccountNumber: watch('confirmAccountNumber'),
        accountType: watch('accountType'),
        accountTypeOther: watch('accountTypeOther'),
        ifscCode: watch('ifscCode'),
        micrCode: watch('micrCode'),
        bankAddress: watch('bankAddress'),
        cancelledChequeFile,
      };
      onNext(formData);
    } else {
      // Bank not verified, run normal validation
      handleSubmit(handleFormSubmit)(e);
    }
  };

  return (
    <form id="step-form" onSubmit={handleContinue} className="space-y-6">
      {/* Validation Notice */}
      {validationStates.bank.status !== 'passed' && (
        <Alert className="border-warning bg-warning/10">
          <AlertDescription className="text-warning-foreground">
            Bank account verification is mandatory. Please verify your account details.
          </AlertDescription>
        </Alert>
      )}

      {validationStates.bank.status === 'passed' && (
        <Alert className="border-success bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="text-success ml-2">
            Bank account verified successfully!
          </AlertDescription>
        </Alert>
      )}

      <div className="form-section">
        <h3 className="form-section-title">
          <Landmark className="h-5 w-5 text-primary" />
          Bank Account Details
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="bankName">Bank Name *</Label>
              <Input
                id="bankName"
                {...register('bankName')}
                placeholder="Enter bank name"
                className={errors.bankName ? 'border-destructive' : ''}
              />
              {errors.bankName && (
                <p className="text-xs text-destructive">{errors.bankName.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branchName">Branch Name *</Label>
              <Input
                id="branchName"
                {...register('branchName')}
                placeholder="Enter branch name"
                className={errors.branchName ? 'border-destructive' : ''}
              />
              {errors.branchName && (
                <p className="text-xs text-destructive">{errors.branchName.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="accountNumber">Account Number *</Label>
              <Input
                id="accountNumber"
                {...register('accountNumber')}
                placeholder="Enter account number"
                className={errors.accountNumber ? 'border-destructive' : ''}
              />
              {errors.accountNumber && (
                <p className="text-xs text-destructive">{errors.accountNumber.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmAccountNumber">Confirm Account Number *</Label>
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

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label>Account Type *</Label>
              <Controller
                name="accountType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current Account</SelectItem>
                      <SelectItem value="savings">Savings Account</SelectItem>
                      <SelectItem value="cash_credit">Cash Credit</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {accountType === 'others' && (
              <div className="grid gap-1.5">
                <Label htmlFor="accountTypeOther">Specify Account Type</Label>
                <Input
                  id="accountTypeOther"
                  {...register('accountTypeOther')}
                  placeholder="Enter account type"
                />
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="ifscCode">IFSC Code *</Label>
              <div className="flex gap-2">
                <Input
                  id="ifscCode"
                  {...register('ifscCode')}
                  placeholder="SBIN0001234"
                  className={`uppercase flex-1 ${errors.ifscCode ? 'border-destructive' : ''}`}
                  maxLength={11}
                />
                <VerifyButton
                  onClick={handleVerifyBank}
                  state={validationStates.bank}
                  disabled={!canVerify}
                />
              </div>
              {errors.ifscCode && (
                <p className="text-xs text-destructive">{errors.ifscCode.message}</p>
              )}
              <ValidationMessage state={validationStates.bank} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="micrCode">MICR Code (9 digits)</Label>
              <Input
                id="micrCode"
                {...register('micrCode')}
                placeholder="9-digit MICR code"
                maxLength={9}
              />
              <p className="text-xs text-muted-foreground">
                Complete postal code appearing next to cheque no.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="bankAddress">Bank Address</Label>
            <Input
              id="bankAddress"
              {...register('bankAddress')}
              placeholder="Full bank branch address"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">
          <CreditCard className="h-5 w-5 text-primary" />
          Supporting Documents
        </h3>

        <Alert className="mb-5 border-warning bg-warning/10">
          <AlertDescription className="text-warning-foreground">
            Cancelled cheque upload is mandatory. You cannot proceed without uploading this document.
          </AlertDescription>
        </Alert>

        <FileUpload
          label="Cancelled Cheque / Blank Cheque *"
          accept=".pdf,.jpg,.jpeg,.png"
          documentType="cancelled_cheque"
          onFileSelect={setCancelledChequeFile}
          currentFile={cancelledChequeFile}
          required
        />
        {!cancelledChequeFile && (
          <p className="text-xs text-destructive mt-2">This document is required to proceed</p>
        )}
      </div>
    </form>
  );
}
