import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import { OcrUploadAndVerify, ComparisonRow } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';

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

export function BankKycTab(props: BankKycTabProps) {
  const { callProvider } = useConfiguredKycApi();

  // OCR step: read cancelled cheque via configured BANK_OCR provider.
  const runBankOcr = async (file: File) => {
    const r = await callProvider({ providerName: 'BANK_OCR', file });
    toastKycResult('Bank OCR', r);
    if (!r.found) return { success: false, error: r.message || 'Bank OCR provider not configured' };
    if (!r.ok || !r.data) return { success: false, error: r.message || 'Could not read cheque' };
    return { success: true, extracted: r.data };
  };

  // Verify step: penny-drop via configured BANK validation provider.
  const handleVerify = async (extracted: Record<string, any>) => {
    const account = String(extracted.account_number || '').replace(/\s+/g, '');
    const ifsc = String(extracted.ifsc_code || '').toUpperCase().trim();
    if (!account || account.length < 8) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid account number from the cheque.' };
    }
    if (!ifsc || ifsc.length !== 11) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid 11-character IFSC code from the cheque.' };
    }

    props.onStatusChange?.('validating');
    props.onBankDetailsChange({
      bankAccountNumber: account,
      ifscCode: ifsc,
      bankName: extracted.bank_name,
      branchName: extracted.branch_name,
      accountHolderName: extracted.account_holder_name,
    });

    const r = await callProvider({
      providerName: 'BANK',
      input: { account, ifsc },
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
    const apiName = String(apiData.name_at_bank || apiData.accountHolder || '').trim();

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
      bankName: apiData.bank_name || apiData.bankName || extracted.bank_name,
      branchName: apiData.branch_name || apiData.branch || extracted.branch_name,
      accountHolderName: apiName || extracted.account_holder_name,
    });
    props.onVerifiedDetails?.(apiData);
    props.onStatusChange?.('passed');
    return { ok: true, message: `Bank account verified — ${apiName || account}`, apiData };
  };

  const buildRows = (extracted: Record<string, any>, apiData?: Record<string, any>): ComparisonRow[] => [
    { label: 'Account Number', ocrValue: extracted.account_number, apiValue: apiData?.account_number },
    { label: 'IFSC Code', ocrValue: extracted.ifsc_code, apiValue: apiData?.ifsc },
    { label: 'Bank Name', ocrValue: extracted.bank_name, apiValue: apiData?.bank_name || apiData?.bankName },
    { label: 'Branch', ocrValue: extracted.branch_name, apiValue: apiData?.branch_name || apiData?.branch },
    { label: 'Account Holder', ocrValue: extracted.account_holder_name, apiValue: apiData?.name_at_bank || apiData?.accountHolder },
  ];

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload a clear image of your cancelled cheque. We'll read the account number and IFSC, then verify them via penny-drop. Manual entry is disabled.
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
        buildComparisonRows={buildRows}
        onVerified={() => {}}
        vendorId={props.vendorId}
      />
    </div>
  );
}
