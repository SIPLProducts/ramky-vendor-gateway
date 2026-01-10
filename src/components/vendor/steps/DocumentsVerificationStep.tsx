import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatutoryDetails, BankDetails } from '@/types/vendor';
import { 
  FileText, 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/vendor/FileUpload';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

// Combined data type
export interface DocumentsVerificationData {
  statutory: StatutoryDetails;
  bank: BankDetails;
}

// Validation state
interface ValidationState {
  status: 'idle' | 'validating' | 'passed' | 'failed';
  message: string;
}

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const schema = z.object({
  gstin: z.string().regex(gstinRegex, 'Invalid GSTIN format'),
  pan: z.string().regex(panRegex, 'Invalid PAN format'),
  msmeNumber: z.string().optional(),
  msmeCategory: z.string().optional(),
  entityType: z.string().min(1, 'Entity type is required'),
  bankName: z.string().min(2, 'Bank name is required'),
  accountNumber: z.string().min(9, 'Account number must be at least 9 digits'),
  confirmAccountNumber: z.string(),
  ifscCode: z.string().regex(ifscRegex, 'Invalid IFSC format'),
  branchName: z.string().optional(),
  accountType: z.enum(['current', 'savings']),
}).refine((data) => data.accountNumber === data.confirmAccountNumber, {
  message: "Account numbers don't match",
  path: ['confirmAccountNumber'],
});

interface DocumentsVerificationStepProps {
  data: DocumentsVerificationData;
  onNext: (data: DocumentsVerificationData) => void;
  onBack: () => void;
  vendorId?: string;
  legalName?: string;
}

export function DocumentsVerificationStep({ 
  data, 
  onNext, 
  vendorId,
  legalName 
}: DocumentsVerificationStepProps) {
  const [gstValidation, setGstValidation] = useState<ValidationState>({ status: 'idle', message: '' });
  const [panValidation, setPanValidation] = useState<ValidationState>({ status: 'idle', message: '' });
  const [msmeValidation, setMsmeValidation] = useState<ValidationState>({ status: 'idle', message: '' });
  const [bankValidation, setBankValidation] = useState<ValidationState>({ status: 'idle', message: '' });
  const [nameMatchValidation, setNameMatchValidation] = useState<ValidationState>({ status: 'idle', message: '' });

  // File states
  const [gstCertificateFile, setGstCertificateFile] = useState<File | null>(data.statutory.gstCertificateFile);
  const [panCardFile, setPanCardFile] = useState<File | null>(data.statutory.panCardFile);
  const [msmeCertificateFile, setMsmeCertificateFile] = useState<File | null>(data.statutory.msmeCertificateFile);
  const [cancelledChequeFile, setCancelledChequeFile] = useState<File | null>(data.bank.cancelledChequeFile);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      gstin: data.statutory.gstin,
      pan: data.statutory.pan,
      msmeNumber: data.statutory.msmeNumber,
      msmeCategory: data.statutory.msmeCategory,
      entityType: data.statutory.entityType,
      bankName: data.bank.bankName,
      accountNumber: data.bank.accountNumber,
      confirmAccountNumber: data.bank.confirmAccountNumber,
      ifscCode: data.bank.ifscCode,
      branchName: data.bank.branchName,
      accountType: data.bank.accountType,
    },
  });

  const watchedGstin = watch('gstin');
  const watchedPan = watch('pan');
  const watchedMsme = watch('msmeNumber');
  const watchedAccountNumber = watch('accountNumber');
  const watchedIfsc = watch('ifscCode');

  const debouncedGstin = useDebounce(watchedGstin, 1000);
  const debouncedPan = useDebounce(watchedPan, 1000);
  const debouncedMsme = useDebounce(watchedMsme, 1000);
  const debouncedAccountNumber = useDebounce(watchedAccountNumber, 1000);
  const debouncedIfsc = useDebounce(watchedIfsc, 1000);

  // GST Validation
  const validateGst = useCallback(async (gstin: string) => {
    if (!gstin || !gstinRegex.test(gstin)) return;
    
    setGstValidation({ status: 'validating', message: 'Verifying GSTIN...' });
    
    try {
      const response = await supabase.functions.invoke('validate-gst', {
        body: { gstin, legalName },
      });
      
      if (response.data?.valid) {
        setGstValidation({ status: 'passed', message: response.data.message || 'GSTIN verified successfully' });
        // Also run name match
        if (response.data.tradeName && legalName) {
          validateNameMatch(legalName, response.data.tradeName);
        }
      } else {
        setGstValidation({ status: 'failed', message: response.data?.message || 'GSTIN verification failed' });
      }
    } catch {
      setGstValidation({ status: 'failed', message: 'Verification service unavailable' });
    }
  }, [legalName]);

  // PAN Validation
  const validatePan = useCallback(async (pan: string) => {
    if (!pan || !panRegex.test(pan)) return;
    
    setPanValidation({ status: 'validating', message: 'Verifying PAN...' });
    
    try {
      const response = await supabase.functions.invoke('validate-pan', {
        body: { pan, name: legalName },
      });
      
      if (response.data?.valid) {
        setPanValidation({ status: 'passed', message: response.data.message || 'PAN verified successfully' });
      } else {
        setPanValidation({ status: 'failed', message: response.data?.message || 'PAN verification failed' });
      }
    } catch {
      setPanValidation({ status: 'failed', message: 'Verification service unavailable' });
    }
  }, [legalName]);

  // MSME Validation
  const validateMsme = useCallback(async (msmeNumber: string) => {
    if (!msmeNumber) {
      setMsmeValidation({ status: 'idle', message: '' });
      return;
    }
    
    setMsmeValidation({ status: 'validating', message: 'Verifying MSME/Udyam...' });
    
    try {
      const response = await supabase.functions.invoke('validate-msme', {
        body: { msmeNumber },
      });
      
      if (response.data?.valid) {
        setMsmeValidation({ status: 'passed', message: response.data.message || 'MSME verified successfully' });
      } else {
        setMsmeValidation({ status: 'failed', message: response.data?.message || 'MSME verification failed' });
      }
    } catch {
      setMsmeValidation({ status: 'failed', message: 'Verification service unavailable' });
    }
  }, []);

  // Bank Validation
  const validateBank = useCallback(async (accountNumber: string, ifscCode: string) => {
    if (!accountNumber || accountNumber.length < 9 || !ifscCode || !ifscRegex.test(ifscCode)) return;
    
    setBankValidation({ status: 'validating', message: 'Verifying bank account (₹1 Penny Drop)...' });
    
    try {
      const response = await supabase.functions.invoke('validate-bank', {
        body: { 
          accountNumber, 
          ifscCode,
          accountHolderName: legalName,
        },
      });
      
      if (response.data?.valid) {
        setBankValidation({ status: 'passed', message: response.data.message || 'Bank account verified successfully' });
      } else {
        setBankValidation({ status: 'failed', message: response.data?.message || 'Bank verification failed' });
      }
    } catch {
      setBankValidation({ status: 'failed', message: 'Verification service unavailable' });
    }
  }, [legalName]);

  // Name Match Validation
  const validateNameMatch = useCallback(async (vendorName: string, gstLegalName: string) => {
    setNameMatchValidation({ status: 'validating', message: 'Matching names...' });
    
    try {
      const response = await supabase.functions.invoke('validate-name-match', {
        body: { vendorName, gstLegalName, threshold: 80 },
      });
      
      if (response.data?.valid) {
        setNameMatchValidation({ status: 'passed', message: `Names match (${response.data.score}% similarity)` });
      } else {
        setNameMatchValidation({ status: 'failed', message: response.data?.message || 'Name mismatch detected' });
      }
    } catch {
      setNameMatchValidation({ status: 'failed', message: 'Name matching failed' });
    }
  }, []);

  // Trigger validations on debounced value changes
  useEffect(() => {
    if (debouncedGstin && gstinRegex.test(debouncedGstin)) {
      validateGst(debouncedGstin);
    }
  }, [debouncedGstin, validateGst]);

  useEffect(() => {
    if (debouncedPan && panRegex.test(debouncedPan)) {
      validatePan(debouncedPan);
    }
  }, [debouncedPan, validatePan]);

  useEffect(() => {
    if (debouncedMsme) {
      validateMsme(debouncedMsme);
    }
  }, [debouncedMsme, validateMsme]);

  useEffect(() => {
    if (debouncedAccountNumber && debouncedIfsc && ifscRegex.test(debouncedIfsc)) {
      validateBank(debouncedAccountNumber, debouncedIfsc);
    }
  }, [debouncedAccountNumber, debouncedIfsc, validateBank]);

  const handleFormSubmit = (formData: z.infer<typeof schema>) => {
    const result: DocumentsVerificationData = {
      statutory: {
        gstin: formData.gstin,
        pan: formData.pan,
        msmeNumber: formData.msmeNumber || '',
        msmeCategory: (formData.msmeCategory as 'micro' | 'small' | 'medium' | '') || '',
        entityType: formData.entityType,
        gstCertificateFile,
        panCardFile,
        msmeCertificateFile,
      },
      bank: {
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        confirmAccountNumber: formData.confirmAccountNumber,
        ifscCode: formData.ifscCode,
        branchName: formData.branchName || '',
        accountType: formData.accountType,
        cancelledChequeFile,
      },
    };
    onNext(result);
  };

  const ValidationIndicator = ({ validation }: { validation: ValidationState }) => {
    if (validation.status === 'idle') return null;
    
    const config = {
      validating: { icon: Loader2, className: 'text-primary animate-spin', bg: 'bg-primary/10' },
      passed: { icon: CheckCircle2, className: 'text-success', bg: 'bg-success/10' },
      failed: { icon: XCircle, className: 'text-destructive', bg: 'bg-destructive/10' },
    };
    
    const { icon: Icon, className, bg } = config[validation.status as keyof typeof config] || config.validating;
    
    return (
      <div className={cn('flex items-center gap-2 mt-2 p-2 rounded-md text-sm', bg)}>
        <Icon className={cn('h-4 w-4', className)} />
        <span className={className}>{validation.message}</span>
      </div>
    );
  };

  const ValidationBadge = ({ validation }: { validation: ValidationState }) => {
    if (validation.status === 'idle') return null;
    
    const config = {
      validating: { label: 'Verifying...', className: 'bg-primary/10 text-primary border-primary/30' },
      passed: { label: 'Verified', className: 'bg-success/10 text-success border-success/30' },
      failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive border-destructive/30' },
    };
    
    const { label, className } = config[validation.status as keyof typeof config] || config.validating;
    
    return (
      <Badge variant="outline" className={cn('ml-2', className)}>
        {label}
      </Badge>
    );
  };

  // Summary of all validations
  const allValidations = [gstValidation, panValidation, bankValidation, nameMatchValidation];
  const passedCount = allValidations.filter(v => v.status === 'passed').length;
  const failedCount = allValidations.filter(v => v.status === 'failed').length;
  const pendingCount = allValidations.filter(v => v.status === 'validating').length;

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Validation Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div>
            <p className="text-xl font-bold text-success">{passedCount}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
          <XCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-xl font-bold text-destructive">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xl font-bold text-primary">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Verifying</p>
          </div>
        </div>
      </div>

      <Alert className="bg-info/5 border-info/20">
        <Info className="h-4 w-4 text-info" />
        <AlertDescription className="text-sm">
          Enter your details below. Validation happens automatically in real-time as you type.
        </AlertDescription>
      </Alert>

      {/* GST Section */}
      <div className="form-section">
        <h3 className="form-section-title">
          <FileText className="h-5 w-5 text-primary" />
          GST Details
          <ValidationBadge validation={gstValidation} />
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="gstin">GSTIN *</Label>
            <Input
              id="gstin"
              {...register('gstin')}
              placeholder="e.g., 27AABCU9603R1ZM"
              className={cn(
                'focus-enterprise uppercase',
                gstValidation.status === 'passed' && 'border-success',
                gstValidation.status === 'failed' && 'border-destructive'
              )}
              maxLength={15}
            />
            {errors.gstin && <p className="text-sm text-destructive">{errors.gstin.message}</p>}
            <ValidationIndicator validation={gstValidation} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entityType">Entity Type *</Label>
            <Controller
              name="entityType"
              control={control}
              render={({ field: { ref, ...fieldProps } }) => (
                <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                  <SelectTrigger className="focus-enterprise">
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Private Limited">Private Limited</SelectItem>
                    <SelectItem value="Public Limited">Public Limited</SelectItem>
                    <SelectItem value="Partnership">Partnership</SelectItem>
                    <SelectItem value="Proprietorship">Proprietorship</SelectItem>
                    <SelectItem value="LLP">LLP</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.entityType && <p className="text-sm text-destructive">{errors.entityType.message}</p>}
          </div>

          <div className="md:col-span-2">
            <FileUpload
              label="GST Certificate"
              accept=".pdf,.jpg,.jpeg,.png"
              maxSizeMB={5}
              vendorId={vendorId}
              documentType="gst_certificate"
              onFileSelect={setGstCertificateFile}
              currentFile={gstCertificateFile}
              required
            />
          </div>
        </div>

        {/* Name Match Validation */}
        {nameMatchValidation.status !== 'idle' && (
          <div className="mt-4">
            <ValidationIndicator validation={nameMatchValidation} />
          </div>
        )}
      </div>

      {/* PAN Section */}
      <div className="form-section">
        <h3 className="form-section-title">
          <CreditCard className="h-5 w-5 text-primary" />
          PAN Details
          <ValidationBadge validation={panValidation} />
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="pan">PAN Number *</Label>
            <Input
              id="pan"
              {...register('pan')}
              placeholder="e.g., ABCDE1234F"
              className={cn(
                'focus-enterprise uppercase',
                panValidation.status === 'passed' && 'border-success',
                panValidation.status === 'failed' && 'border-destructive'
              )}
              maxLength={10}
            />
            {errors.pan && <p className="text-sm text-destructive">{errors.pan.message}</p>}
            <ValidationIndicator validation={panValidation} />
          </div>

          <div className="space-y-2">
            <FileUpload
              label="PAN Card Copy"
              accept=".pdf,.jpg,.jpeg,.png"
              maxSizeMB={5}
              vendorId={vendorId}
              documentType="pan_card"
              onFileSelect={setPanCardFile}
              currentFile={panCardFile}
              required
            />
          </div>
        </div>
      </div>

      {/* MSME Section */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          MSME/Udyam Details (Optional)
          <ValidationBadge validation={msmeValidation} />
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="msmeNumber">Udyam Registration Number</Label>
            <Input
              id="msmeNumber"
              {...register('msmeNumber')}
              placeholder="e.g., UDYAM-XX-00-0000000"
              className={cn(
                'focus-enterprise uppercase',
                msmeValidation.status === 'passed' && 'border-success',
                msmeValidation.status === 'failed' && 'border-destructive'
              )}
            />
            <ValidationIndicator validation={msmeValidation} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="msmeCategory">MSME Category</Label>
            <Controller
              name="msmeCategory"
              control={control}
              render={({ field: { ref, ...fieldProps } }) => (
                <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                  <SelectTrigger className="focus-enterprise">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="micro">Micro Enterprise</SelectItem>
                    <SelectItem value="small">Small Enterprise</SelectItem>
                    <SelectItem value="medium">Medium Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="md:col-span-2">
            <FileUpload
              label="MSME/Udyam Certificate"
              accept=".pdf,.jpg,.jpeg,.png"
              maxSizeMB={5}
              vendorId={vendorId}
              documentType="msme_certificate"
              onFileSelect={setMsmeCertificateFile}
              currentFile={msmeCertificateFile}
            />
          </div>
        </div>
      </div>

      {/* Bank Details Section */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          Bank Account Details
          <ValidationBadge validation={bankValidation} />
        </h3>

        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Bank account verification uses ₹1 Penny Drop. The account holder name must match the vendor legal name.
          </AlertDescription>
        </Alert>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="bankName">Bank Name *</Label>
            <Input
              id="bankName"
              {...register('bankName')}
              placeholder="e.g., State Bank of India"
              className="focus-enterprise"
            />
            {errors.bankName && <p className="text-sm text-destructive">{errors.bankName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ifscCode">IFSC Code *</Label>
            <Input
              id="ifscCode"
              {...register('ifscCode')}
              placeholder="e.g., SBIN0001234"
              className={cn(
                'focus-enterprise uppercase',
                bankValidation.status === 'passed' && 'border-success',
                bankValidation.status === 'failed' && 'border-destructive'
              )}
              maxLength={11}
            />
            {errors.ifscCode && <p className="text-sm text-destructive">{errors.ifscCode.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number *</Label>
            <Input
              id="accountNumber"
              {...register('accountNumber')}
              placeholder="Enter account number"
              className="focus-enterprise"
            />
            {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmAccountNumber">Confirm Account Number *</Label>
            <Input
              id="confirmAccountNumber"
              {...register('confirmAccountNumber')}
              placeholder="Re-enter account number"
              className="focus-enterprise"
            />
            {errors.confirmAccountNumber && <p className="text-sm text-destructive">{errors.confirmAccountNumber.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="branchName">Branch Name</Label>
            <Input
              id="branchName"
              {...register('branchName')}
              placeholder="Enter branch name"
              className="focus-enterprise"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountType">Account Type *</Label>
            <Controller
              name="accountType"
              control={control}
              render={({ field: { ref, ...fieldProps } }) => (
                <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                  <SelectTrigger className="focus-enterprise">
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Account</SelectItem>
                    <SelectItem value="savings">Savings Account</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.accountType && <p className="text-sm text-destructive">{errors.accountType.message}</p>}
          </div>

          <div className="md:col-span-2">
            <ValidationIndicator validation={bankValidation} />
          </div>

          <div className="md:col-span-2">
            <FileUpload
              label="Cancelled Cheque / Bank Statement"
              accept=".pdf,.jpg,.jpeg,.png"
              maxSizeMB={5}
              vendorId={vendorId}
              documentType="cancelled_cheque"
              onFileSelect={setCancelledChequeFile}
              currentFile={cancelledChequeFile}
              required
            />
          </div>
        </div>
      </div>
    </form>
  );
}
