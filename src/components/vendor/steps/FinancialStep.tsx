import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TrendingUp, Users, Building } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/vendor/FileUpload';
import { FinancialDetails } from '@/types/vendor';
import { getLastThreeCompletedIndianFyStartYears, formatIndianFy } from '@/lib/indianFy';

const [fy1Start, fy2Start, fy3Start] = getLastThreeCompletedIndianFyStartYears();

const NEGATIVE_MSG = 'Please enter a valid amount. You can enter the amount either in Lakhs (e.g., 0.9) or in Rupees (e.g., 90000). Negative values are not allowed.';
const CREDIT_PERIOD_NEGATIVE_MSG = 'Negative values are not allowed.';

const nonNegNumericString = z
  .string()
  .optional()
  .refine((v) => !v || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= 0), { message: NEGATIVE_MSG });

const nonNegCreditPeriodString = z
  .string()
  .optional()
  .refine((v) => !v || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= 0), { message: CREDIT_PERIOD_NEGATIVE_MSG });


const schema = z.object({
  turnoverYear1: nonNegNumericString,
  turnoverYear2: nonNegNumericString,
  turnoverYear3: nonNegNumericString,
  creditPeriodExpected: nonNegCreditPeriodString,
  majorCustomer1: z.string().optional(),
  majorCustomer2: z.string().optional(),
  majorCustomer3: z.string().optional(),
  authorizedDistributorName: z.string().optional(),
  authorizedDistributorAddress: z.string().optional(),
});

interface FinancialStepProps {
  data: FinancialDetails;
  onNext: (data: FinancialDetails) => void;
  onBack: () => void;
}

export function FinancialStep({ data, onNext }: FinancialStepProps) {
  const [dealershipCertificateFile, setDealershipCertificateFile] = useState<File | null>(data.dealershipCertificateFile);
  const [financialDocsFile, setFinancialDocsFile] = useState<File | null>(data.financialDocsFile);
  const [amountErrors, setAmountErrors] = useState<Record<string, string | undefined>>({});
  const { register, handleSubmit, setValue, watch } = useForm<FinancialDetails>({ resolver: zodResolver(schema), defaultValues: data });

  const handleFormSubmit = (formData: FinancialDetails) => {
    onNext({ ...formData, dealershipCertificateFile, financialDocsFile });
  };

  const blockInvalidNumericKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const isNegativeAmount = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    return trimmed.startsWith('-') || Number(trimmed) < 0;
  };

  const sanitizeNonNegNumeric = (raw: string) => {
    if (isNegativeAmount(raw)) return '';

    // Strip anything that isn't a digit or dot and keep only the first dot.
    const cleaned = raw.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length <= 1 ? cleaned : parts[0] + '.' + parts.slice(1).join('');
    if (!normalized) return '';
    const n = Number(normalized);
    if (!isFinite(n) || n < 0) return '';
    return normalized;
  };

  const getNegativeMessage = (name: 'turnoverYear1' | 'turnoverYear2' | 'turnoverYear3' | 'creditPeriodExpected') =>
    name === 'creditPeriodExpected' ? CREDIT_PERIOD_NEGATIVE_MSG : NEGATIVE_MSG;

  const numericFieldProps = (name: 'turnoverYear1' | 'turnoverYear2' | 'turnoverYear3' | 'creditPeriodExpected') => ({
    type: 'text' as const,
    min: 0,
    inputMode: 'decimal' as const,
    pattern: '[0-9]*[.]?[0-9]*',
    onKeyDown: blockInvalidNumericKeys,
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      if (text && isNegativeAmount(text)) {
        e.preventDefault();
        setAmountErrors((p) => ({ ...p, [name]: getNegativeMessage(name) }));
        setValue(name, '', { shouldValidate: false, shouldDirty: true });
      }
    },
    value: (watch(name) as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const isNegative = isNegativeAmount(raw);
      setAmountErrors((p) => ({ ...p, [name]: isNegative ? getNegativeMessage(name) : undefined }));
      setValue(name, isNegative ? '' : sanitizeNonNegNumeric(raw), { shouldValidate: false, shouldDirty: true });
    },
  });

  const toLakhsPreview = (v?: string) => {
    const n = Number(v);
    if (!v || !isFinite(n) || n <= 0) return '';
    return `≈ ₹${(n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Lakhs`;
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title"><TrendingUp className="h-5 w-5 text-primary" />Audited Turnover (Last 3 Years)</h3>
        <Alert className="mb-5"><AlertDescription>Please provide CA certified copies of audited financial statements</AlertDescription></Alert>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-3 gap-5">
            {([['turnoverYear1', fy1Start], ['turnoverYear2', fy2Start], ['turnoverYear3', fy3Start]] as const).map(([name, fy]) => (
              <div key={name} className="grid gap-1.5">
                <Label htmlFor={name}>Turnover {formatIndianFy(fy)} (₹)</Label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span><Input id={name} {...numericFieldProps(name)} placeholder="Enter Amount in Rupees" className="pl-8" /></div>
                {amountErrors[name] ? (
                  <p className="text-xs text-destructive">{amountErrors[name]}</p>
                ) : toLakhsPreview(watch(name)) ? (
                  <p className="text-xs text-muted-foreground">{toLakhsPreview(watch(name))}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="creditPeriodExpected">Expected Credit Period (Days)</Label>
            <Input id="creditPeriodExpected" {...numericFieldProps('creditPeriodExpected')} placeholder="e.g., 30, 45, 60" />
            {amountErrors.creditPeriodExpected && (<p className="text-xs text-destructive">{CREDIT_PERIOD_NEGATIVE_MSG}</p>)}

          </div>
          <FileUpload label="Upload Audited Financial Statements (CA Certified)" accept=".pdf" documentType="financial_docs" onFileSelect={setFinancialDocsFile} currentFile={financialDocsFile} />
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><Users className="h-5 w-5 text-primary" />Existing Major Customers</h3>
        <div className="grid gap-5">
          <div className="grid gap-1.5"><Label htmlFor="majorCustomer1">Customer 1</Label><Input id="majorCustomer1" {...register('majorCustomer1')} placeholder="Company name" /></div>
          <div className="grid gap-1.5"><Label htmlFor="majorCustomer2">Customer 2</Label><Input id="majorCustomer2" {...register('majorCustomer2')} placeholder="Company name" /></div>
          <div className="grid gap-1.5"><Label htmlFor="majorCustomer3">Customer 3</Label><Input id="majorCustomer3" {...register('majorCustomer3')} placeholder="Company name" /></div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><Building className="h-5 w-5 text-primary" />Authorized Distributor Details</h3>
        <p className="text-sm text-muted-foreground mb-4">For Trader/Dealer/Authorized Distributor: Please attach relevant valid dealership certificates</p>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5"><Label htmlFor="authorizedDistributorName">Name</Label><Input id="authorizedDistributorName" {...register('authorizedDistributorName')} placeholder="Distributor/Dealer name" /></div>
            <div className="grid gap-1.5"><Label htmlFor="authorizedDistributorAddress">Address</Label><Input id="authorizedDistributorAddress" {...register('authorizedDistributorAddress')} placeholder="Distributor address" /></div>
          </div>
          <FileUpload label="Upload Dealership Certificate" accept=".pdf,.jpg,.jpeg,.png" documentType="dealership_certificate" onFileSelect={setDealershipCertificateFile} currentFile={dealershipCertificateFile} />
        </div>
      </div>
    </form>
  );
}
