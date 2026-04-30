import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';
import { lookupIfsc, isValidIfsc } from '@/lib/ifscLookup';

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
    const apiName = pickString(apiData.name_at_bank).trim();

    if (props.legalName && apiName) {
      const a = props.legalName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const b = apiName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (!a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
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
    return { ok: true, message: `Bank account verified — ${apiName || account}`, apiData };
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
    </div>
  );
}
