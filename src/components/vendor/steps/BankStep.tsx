import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark, CreditCard } from 'lucide-react';
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
  confirmAccountNumber: z.string().min(8, 'Confirm account number'),
  accountType: z.enum(['current', 'savings', 'cash_credit', 'others']),
  accountTypeOther: z.string().optional(),
  ifscCode: z.string().min(11, 'IFSC code is required'),
  micrCode: z.string().optional(),
  bankAddress: z.string().optional(),
}).refine((data) => data.accountNumber === data.confirmAccountNumber, {
  message: "Account numbers don't match",
  path: ['confirmAccountNumber'],
});

interface BankStepProps {
  data: BankDetails;
  legalName?: string;
  onNext: (data: BankDetails) => void;
  onBack: () => void;
  onValidationStateChange?: (isValid: boolean) => void;
}

export function BankStep({ data, legalName, onNext, onValidationStateChange }: BankStepProps) {
  const [cancelledChequeFile, setCancelledChequeFile] = useState<File | null>(data.cancelledChequeFile);
  
  const { 
    validationStates, 
    validateBank,
    resetValidation 
  } = useFieldValidation();

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<BankDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });
  
  const accountType = watch('accountType');
  const accountNumber = watch('accountNumber');
  const ifscCode = watch('ifscCode');

  // Reset validation state when field values change
  useEffect(() => {
    if (validationStates.bank.status !== 'idle') {
      resetValidation('bank');
    }
  }, [accountNumber, ifscCode]);

  // Notify parent of validation state
  useEffect(() => {
    const bankValid = validationStates.bank.status === 'passed';
    onValidationStateChange?.(bankValid);
  }, [validationStates.bank.status, onValidationStateChange]);

  const handleVerifyBank = async () => {
    await validateBank(accountNumber || '', ifscCode || '', legalName);
  };

  const handleFormSubmit = (formData: BankDetails) => {
    // Check if bank validation passed
    if (validationStates.bank.status !== 'passed') {
      return; // Don't submit, validation required
    }

    onNext({ ...formData, cancelledChequeFile });
  };

  const canProceed = validationStates.bank.status === 'passed';
  const canVerify = accountNumber && accountNumber.length >= 8 && ifscCode && ifscCode.length === 11;

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Validation Notice */}
      {!canProceed && (
        <Alert className="border-warning bg-warning/10">
          <AlertDescription className="text-warning-foreground">
            Bank account verification via penny drop is mandatory. Please verify your bank details before proceeding.
          </AlertDescription>
        </Alert>
      )}

      <div className="form-section">
        <h3 className="form-section-title"><Landmark className="h-5 w-5 text-primary" />Bank Account Details</h3>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="bankName">Bank Name *</Label>
              <Input id="bankName" {...register('bankName')} placeholder="e.g., State Bank of India" className={errors.bankName ? 'border-destructive' : ''} />
              {errors.bankName && <p className="text-xs text-destructive">{errors.bankName.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branchName">Branch Name *</Label>
              <Input id="branchName" {...register('branchName')} placeholder="Enter branch name" className={errors.branchName ? 'border-destructive' : ''} />
              {errors.branchName && <p className="text-xs text-destructive">{errors.branchName.message}</p>}
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="accountNumber">Account Number *</Label>
              <Input id="accountNumber" {...register('accountNumber')} placeholder="Enter account number" className={errors.accountNumber ? 'border-destructive' : ''} />
              {errors.accountNumber && <p className="text-xs text-destructive">{errors.accountNumber.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmAccountNumber">Confirm Account Number *</Label>
              <Input id="confirmAccountNumber" {...register('confirmAccountNumber')} placeholder="Re-enter account number" className={errors.confirmAccountNumber ? 'border-destructive' : ''} />
              {errors.confirmAccountNumber && <p className="text-xs text-destructive">{errors.confirmAccountNumber.message}</p>}
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label>Account Type *</Label>
              <Controller name="accountType" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select account type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Account</SelectItem>
                    <SelectItem value="savings">Savings Account</SelectItem>
                    <SelectItem value="cash_credit">Cash Credit</SelectItem>
                    <SelectItem value="others">Others (Specify)</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
            {accountType === 'others' && (
              <div className="grid gap-1.5">
                <Label htmlFor="accountTypeOther">Specify Account Type</Label>
                <Input id="accountTypeOther" {...register('accountTypeOther')} placeholder="Specify account type" />
              </div>
            )}
          </div>
          
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="ifscCode">IFSC Code *</Label>
              <Input id="ifscCode" {...register('ifscCode')} placeholder="e.g., SBIN0001234" className={`uppercase ${errors.ifscCode ? 'border-destructive' : ''}`} maxLength={11} />
              {errors.ifscCode && <p className="text-xs text-destructive">{errors.ifscCode.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="micrCode">MICR Code (9 digits)</Label>
              <Input id="micrCode" {...register('micrCode')} placeholder="9-digit MICR code" maxLength={9} />
            </div>
          </div>
          
          <div className="grid gap-1.5">
            <Label htmlFor="bankAddress">Bank Address</Label>
            <Input id="bankAddress" {...register('bankAddress')} placeholder="Branch address" />
          </div>

          {/* Bank Verification Button */}
          <div className="p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-sm">Bank Account Verification</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Verify your bank account via ₹1 Penny Drop verification
                </p>
              </div>
              <VerifyButton
                onClick={handleVerifyBank}
                state={validationStates.bank}
                disabled={!canVerify}
              />
            </div>
            <ValidationMessage state={validationStates.bank} />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><CreditCard className="h-5 w-5 text-primary" />Cancelled Cheque</h3>
        <Alert className="mb-5"><AlertDescription>Please attach a copy of cancelled or blank cheque for bank verification</AlertDescription></Alert>
        <FileUpload label="Upload Cancelled Cheque" accept=".pdf,.jpg,.jpeg,.png" documentType="cancelled_cheque" onFileSelect={setCancelledChequeFile} currentFile={cancelledChequeFile} required />
      </div>
    </form>
  );
}
