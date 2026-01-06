import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BankDetails } from '@/types/vendor';
import { ChevronLeft, ChevronRight, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/vendor/FileUpload';
import { useState } from 'react';

const schema = z.object({
  bankName: z.string().min(2, 'Bank name is required'),
  accountNumber: z.string().min(9, 'Account number must be at least 9 digits').max(18, 'Account number cannot exceed 18 digits'),
  confirmAccountNumber: z.string(),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
  branchName: z.string().min(2, 'Branch name is required'),
  accountType: z.enum(['current', 'savings']),
}).refine((data) => data.accountNumber === data.confirmAccountNumber, {
  message: "Account numbers don't match",
  path: ['confirmAccountNumber'],
});

interface BankStepProps {
  data: BankDetails;
  onNext: (data: BankDetails) => void;
  onBack: () => void;
}

export function BankStep({ data, onNext, onBack }: BankStepProps) {
  const [cancelledChequeFile, setCancelledChequeFile] = useState<File | null>(data.cancelledChequeFile);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Omit<BankDetails, 'cancelledChequeFile'>>({
    resolver: zodResolver(schema),
    defaultValues: {
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      confirmAccountNumber: data.confirmAccountNumber,
      ifscCode: data.ifscCode,
      branchName: data.branchName,
      accountType: data.accountType,
    },
  });

  const popularBanks = [
    'State Bank of India',
    'HDFC Bank',
    'ICICI Bank',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'Punjab National Bank',
    'Bank of Baroda',
    'Canara Bank',
    'Union Bank of India',
    'IndusInd Bank',
    'Yes Bank',
    'IDBI Bank',
    'Federal Bank',
    'Other',
  ];

  const handleFormSubmit = (formData: Omit<BankDetails, 'cancelledChequeFile'>) => {
    onNext({
      ...formData,
      cancelledChequeFile,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Bank account will be verified through ₹1 penny drop. Ensure the account is active and belongs to the vendor entity.
        </AlertDescription>
      </Alert>

      <div className="form-section">
        <h3 className="form-section-title">Bank Account Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bankName">Bank Name *</Label>
            <Controller
              name="bankName"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {popularBanks.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.bankName && (
              <p className="text-sm text-destructive">{errors.bankName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountType">Account Type *</Label>
            <Controller
              name="accountType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Account</SelectItem>
                    <SelectItem value="savings">Savings Account</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.accountType && (
              <p className="text-sm text-destructive">{errors.accountType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number *</Label>
            <Input
              id="accountNumber"
              type="password"
              {...register('accountNumber')}
              placeholder="Enter account number"
              maxLength={18}
            />
            {errors.accountNumber && (
              <p className="text-sm text-destructive">{errors.accountNumber.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmAccountNumber">Confirm Account Number *</Label>
            <Input
              id="confirmAccountNumber"
              {...register('confirmAccountNumber')}
              placeholder="Re-enter account number"
              maxLength={18}
            />
            {errors.confirmAccountNumber && (
              <p className="text-sm text-destructive">{errors.confirmAccountNumber.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ifscCode">IFSC Code *</Label>
            <Input
              id="ifscCode"
              {...register('ifscCode')}
              placeholder="e.g., HDFC0001234"
              className="uppercase"
              maxLength={11}
            />
            {errors.ifscCode && (
              <p className="text-sm text-destructive">{errors.ifscCode.message}</p>
            )}
            <p className="text-xs text-muted-foreground">11-character IFSC code</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branchName">Branch Name *</Label>
            <Input
              id="branchName"
              {...register('branchName')}
              placeholder="Enter branch name"
            />
            {errors.branchName && (
              <p className="text-sm text-destructive">{errors.branchName.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Cancelled Cheque</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a clear image of cancelled cheque for bank verification
        </p>
        
        <FileUpload
          label="Cancelled Cheque"
          accept=".pdf,.jpg,.jpeg,.png"
          documentType="cancelled_cheque"
          onFileSelect={setCancelledChequeFile}
          currentFile={cancelledChequeFile}
          required
        />
      </div>

      <Alert variant="destructive" className="bg-warning/10 border-warning text-warning-foreground">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-foreground">
          <strong>Important:</strong> The account holder name must match the vendor legal name for verification to pass.
        </AlertDescription>
      </Alert>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button type="submit" className="gap-2">
          Next Step
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
