import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Lock, XCircle } from 'lucide-react';
import { useState } from 'react';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';
import { lookupIfsc, isValidIfsc } from '@/lib/ifscLookup';
import { fuzzyNameMatch } from '@/lib/nameMatch';

interface BankKycTabProps {
  bankAccountNumber: string;
  ifscCode: string;
  onBankDetailsChange: (data: {
    bankAccountNumber: string;
    ifscCode: string;
    bankName?: string;
    branchName?: string;
    accountHolderName?: string;
  }) => void;
  legalName?: string;
  cancelledChequeFile: File | null;
  onCancelledChequeFileChange: (f: File | null) => void;
  onVerifiedDetails?: (data: Record<string, any>) => void;
  onStatusChange?: (status: 'idle' | 'validating' | 'passed' | 'failed') => void;
  vendorId?: string;
  /** Verified GST legal name — used to validate Bank account holder name. */
  gstLegalName?: string;
  /** Verified PAN holder name — used to validate Bank account holder name. */
  panHolderName?: string;
}

/**
 * Coerce values that might come back as a Surepass `{ value, confidence }`
 * object (when the admin's response_data_mapping forgets to drill into `.value`)
 * into a plain string. Belt-and-braces — the migration already maps `.value`
 * paths, but this avoids `[object Object]` if config drifts.
 */
function pickString(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && 'value' in v) return String((v as any).value ?? '');
  return '';
}

export function BankKycTab(props: BankKycTabProps) {
  const { callProvider } = useConfiguredKycApi();
  const [holderName, setHolderName] = useState<string>('');
  const [holderCheck, setHolderCheck] =
    useState<'idle' | 'gst+pan' | 'gst' | 'pan' | 'failed'>('idle');

  // OCR step: read cancelled cheque via configured BANK_OCR provider.
  const runBankOcr = async (file: File) => {
    const r = await callProvider({ providerName: 'BANK_OCR', file });
    toastKycResult('Bank OCR', r);
    if (!r.found && !r.message_code) {
      return { success: false, error: 'Bank OCR provider not configured. Add it in KYC & Validation API Settings.', apiResult: r };
    }
    if (!r.ok) {
      return { success: false, error: r.message || r.message_code || 'Could not read cheque', apiResult: r };
    }
    return { success: true, extracted: r.data || {}, apiResult: r };
  };

  // Verify step: penny-drop via configured BANK validation provider, then
  // enrich Bank Name / Branch from the public IFSC lookup since Surepass
  // cheque OCR doesn't return them.
  const handleVerify = async (extracted: Record<string, any>) => {
    const account = pickString(extracted.account_number).replace(/\s+/g, '');
    const ifsc = pickString(extracted.ifsc_code).toUpperCase().trim();
    setHolderCheck('idle');
    setHolderName('');
    if (!account || account.length < 8) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid account number from the cheque.' };
    }
    if (!isValidIfsc(ifsc)) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid 11-character IFSC code from the cheque.' };
    }

    props.onStatusChange?.('validating');

    // Enrich Bank Name + Branch from public IFSC directory (cheque OCR has neither).
    const ifscDetails = await lookupIfsc(ifsc);
    const enrichedBankName = ifscDetails?.bank;
    const enrichedBranch = ifscDetails?.branch;

    props.onBankDetailsChange({
      bankAccountNumber: account,
      ifscCode: ifsc,
      bankName: enrichedBankName,
      branchName: enrichedBranch,
      accountHolderName: undefined,
    });

    const r = await callProvider({
      providerName: 'BANK',
      input: { account, ifsc, id_number: account },
    });
    toastKycResult('Bank', r);
    if (!r.found) {
      props.onStatusChange?.('failed');
      return { ok: false, message: r.message || 'Bank validation provider not configured' };
    }
    if (!r.ok || !r.data) {
      props.onStatusChange?.('failed');
      return { ok: false, message: r.message || 'Bank verification failed', apiData: r.data };
    }
    const apiData = r.data;
    const apiName = (pickString(apiData.full_name) || pickString(apiData.name_at_bank)).trim();
    setHolderName(apiName);

    // Compare account holder name against verified GST + PAN names. Both
    // values come from official registries and are higher-trust than the
    // user's typed legalName.
    const gstOk = fuzzyNameMatch(apiName, props.gstLegalName);
    const panOk = fuzzyNameMatch(apiName, props.panHolderName);

    let nameMessage = '';
    if (apiName && (props.gstLegalName || props.panHolderName)) {
      if (gstOk && panOk) {
        setHolderCheck('gst+pan');
        nameMessage = 'Account Holder Name verified with GST Legal Name and PAN Holder Name.';
      } else if (gstOk) {
        setHolderCheck('gst');
        nameMessage = 'Account Holder Name matched with GST Legal Name.';
      } else if (panOk) {
        setHolderCheck('pan');
        nameMessage = 'Account Holder Name matched with PAN Holder Name.';
      } else {
        setHolderCheck('failed');
        props.onStatusChange?.('failed');
        return {
          ok: false,
          message: 'Account Holder Name does not match with GST Legal Name and PAN Holder Name.',
          apiData,
        };
      }
    } else if (props.legalName && apiName) {
      // Fallback to typed legal name if neither GST nor PAN names are present.
      const a = props.legalName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const b = apiName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (!a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
        setHolderCheck('failed');
        props.onStatusChange?.('failed');
        return {
          ok: false,
          message: `Name mismatch: Bank account is registered to "${apiName}" but you entered "${props.legalName}".`,
          apiData,
        };
      }
    }

    props.onBankDetailsChange({
      bankAccountNumber: account,
      ifscCode: ifsc,
      bankName: pickString(apiData.bank_name) || enrichedBankName,
      branchName: pickString(apiData.branch_name) || enrichedBranch,
      accountHolderName: apiName || undefined,
    });
    props.onVerifiedDetails?.({ ...apiData, bank_name_resolved: pickString(apiData.bank_name) || enrichedBankName, branch_name_resolved: pickString(apiData.branch_name) || enrichedBranch });
    props.onStatusChange?.('passed');
    return {
      ok: true,
      message: nameMessage || `Bank account verified — ${apiName || account}`,
      apiData,
    };
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload a clear image of your cancelled cheque. We'll read the account number and IFSC, derive Bank Name and Branch from the IFSC directory, then verify via penny-drop. Manual entry is disabled.
        </AlertDescription>
      </Alert>

      {props.bankAccountNumber && props.ifscCode && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-success/30 bg-success/5 text-sm">
            <Lock className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">Account:</span>
            <span className="font-mono font-medium">{props.bankAccountNumber}</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-md border border-success/30 bg-success/5 text-sm">
            <Lock className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">IFSC:</span>
            <span className="font-mono font-medium">{props.ifscCode}</span>
          </div>
        </div>
      )}

      <OcrUploadAndVerify
        documentType="cheque"
        fileLabel="Cancelled Cheque *"
        currentFile={props.cancelledChequeFile}
        onFileChange={props.onCancelledChequeFileChange}
        runOcr={runBankOcr}
        onVerifyExtracted={handleVerify}
        apiLabel="Bank"
        onVerified={() => {}}
        vendorId={props.vendorId}
      />

      {holderCheck !== 'idle' && holderName && (
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
            holderCheck === 'failed'
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-success/30 bg-success/5'
          }`}
        >
          {holderCheck === 'failed' ? (
            <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
          )}
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap gap-x-2 items-baseline">
              <span className="text-xs text-muted-foreground">Account Holder Name:</span>
              <span className="font-medium break-words">{holderName}</span>
            </div>
            <div className={holderCheck === 'failed' ? 'text-destructive' : 'text-success'}>
              {holderCheck === 'gst+pan' &&
                'Account Holder Name verified with GST Legal Name and PAN Holder Name.'}
              {holderCheck === 'gst' && 'Account Holder Name matched with GST Legal Name.'}
              {holderCheck === 'pan' && 'Account Holder Name matched with PAN Holder Name.'}
              {holderCheck === 'failed' &&
                'Account Holder Name does not match with GST and PAN details.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
