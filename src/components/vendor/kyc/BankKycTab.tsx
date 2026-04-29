import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import { OcrUploadAndVerify, ComparisonRow } from './OcrUploadAndVerify';
import { supabase } from '@/integrations/supabase/client';

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
  const handleVerify = async (extracted: Record<string, any>) => {
    const account = (extracted.account_number || '').toString().replace(/\s+/g, '');
    const ifsc = (extracted.ifsc_code || '').toString().toUpperCase().trim();
    if (!account || account.length < 8) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid account number from the cheque.' };
    }
    if (!ifsc || ifsc.length !== 11) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid 11-character IFSC code from the cheque.' };
    }

    props.onBankDetailsChange({
      bankAccountNumber: account,
      ifscCode: ifsc,
      bankName: extracted.bank_name,
      branchName: extracted.branch_name,
      accountHolderName: extracted.account_holder_name,
    });
    props.onStatusChange?.('validating');

    try {
      const { data, error } = await supabase.functions.invoke('validate-bank', {
        body: { id_number: account, ifsc },
      });
      if (error) throw error;
      if (!data?.success) {
        props.onStatusChange?.('failed');
        return { ok: false, message: data?.message || 'Bank verification failed' };
      }
      const apiData = data.data || {};
      const apiName = (apiData.name_at_bank || '').toString();
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
        bankName: apiData.bank_name || extracted.bank_name,
        branchName: apiData.branch_name || extracted.branch_name,
        accountHolderName: apiName || extracted.account_holder_name,
      });
      props.onVerifiedDetails?.(apiData);
      props.onStatusChange?.('passed');
      return { ok: true, message: `Bank account verified — ${apiName || account}`, apiData };
    } catch (e: any) {
      props.onStatusChange?.('failed');
      return { ok: false, message: e?.message || 'Verification service unavailable' };
    }
  };

  const buildRows = (extracted: Record<string, any>, apiData?: Record<string, any>): ComparisonRow[] => [
    { label: 'Account Number', ocrValue: extracted.account_number, apiValue: apiData?.account_number },
    { label: 'IFSC Code', ocrValue: extracted.ifsc_code, apiValue: apiData?.ifsc_code },
    { label: 'Bank Name', ocrValue: extracted.bank_name, apiValue: apiData?.bank_name },
    { label: 'Branch', ocrValue: extracted.branch_name, apiValue: apiData?.branch_name },
    { label: 'Account Holder', ocrValue: extracted.account_holder_name, apiValue: apiData?.name_at_bank },
  ];

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload a clear image of your cancelled cheque. We will extract the account number and IFSC, then verify them with your bank. Manual entry is disabled.
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
        onVerifyExtracted={handleVerify}
        buildComparisonRows={buildRows}
        onVerified={() => {}}
        vendorId={props.vendorId}
      />
    </div>
  );
}
