import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Lock, Pencil, Upload, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VerifyButton } from '@/components/vendor/VerifyButton';
import { ValidationMessage } from '@/components/vendor/ValidationMessage';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { useProviderVerify } from '@/hooks/useProviderVerify';
import { toastKycResult } from '@/lib/kycToast';
import { lookupIfsc, isValidIfsc } from '@/lib/ifscLookup';
import { fuzzyNameMatch } from '@/lib/nameMatch';
import { mergeOcrExtracted } from '@/lib/kycExtract';
import { FileUpload } from '@/components/vendor/FileUpload';

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
  gstLegalName?: string;
  panHolderName?: string;
}

function pickString(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && 'value' in v) return String((v as any).value ?? '');
  return '';
}

export function BankKycTab(props: BankKycTabProps) {
  const { callProvider } = useConfiguredKycApi();
  const { state: manualState, verify: manualVerify } = useProviderVerify();
  const [mode, setMode] = useState<'manual' | 'upload'>('upload');
  const [manualAccount, setManualAccount] = useState('');
  const [manualIfsc, setManualIfsc] = useState('');
  const [holderName, setHolderName] = useState<string>('');
  const [holderCheck, setHolderCheck] =
    useState<'idle' | 'gst+pan' | 'gst' | 'pan' | 'failed'>('idle');

  // Shared post-verification logic: IFSC enrichment, name matching, and state updates.
  const finalizePennyDrop = async (
    account: string,
    ifsc: string,
    apiData: Record<string, any>,
  ): Promise<{ ok: boolean; message: string; apiData: Record<string, any> }> => {
    const ifscDetails = await lookupIfsc(ifsc);
    const enrichedBankName = ifscDetails?.bank;
    const enrichedBranch = ifscDetails?.branch;

    const apiName = (pickString(apiData.full_name) || pickString(apiData.name_at_bank)).trim();
    setHolderName(apiName);

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
    props.onVerifiedDetails?.({
      ...apiData,
      bank_name_resolved: pickString(apiData.bank_name) || enrichedBankName,
      branch_name_resolved: pickString(apiData.branch_name) || enrichedBranch,
    });
    props.onStatusChange?.('passed');
    return {
      ok: true,
      message: nameMessage || `Bank account verified — ${apiName || account}`,
      apiData,
    };
  };

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
    const extracted = mergeOcrExtracted(r.data, r.raw);
    return { success: true, extracted, apiResult: r };
  };

  // OCR-mode verify
  const handleOcrVerify = async (extracted: Record<string, any>) => {
    const account = pickString(extracted.account_number).replace(/\s+/g, '');
    const ifsc = pickString(extracted.ifsc_code).toUpperCase().trim();
    setHolderCheck('idle');
    setHolderName('');
    if (!account || account.length < 8) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid account number from the cheque. Switch to manual entry to continue.' };
    }
    if (!isValidIfsc(ifsc)) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid 11-character IFSC code from the cheque. Switch to manual entry to continue.' };
    }

    props.onStatusChange?.('validating');
    props.onBankDetailsChange({
      bankAccountNumber: account,
      ifscCode: ifsc,
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
    return finalizePennyDrop(account, ifsc, r.data);
  };

  // Manual-mode verify
  const handleManualVerify = async () => {
    const account = manualAccount.replace(/\s+/g, '');
    const ifsc = manualIfsc.toUpperCase().trim();
    setHolderCheck('idle');
    setHolderName('');
    await manualVerify({
      providerName: 'BANK',
      label: 'Bank',
      input: { account, ifsc, id_number: account },
      validate: (data) => {
        // synchronous validate runs before finalize; we update state via finalize below
        return { ok: true, message: '', data };
      },
    });
    // useProviderVerify already toasted. Now run shared finalize.
    if (manualState.status === 'failed') return;
    props.onStatusChange?.('validating');
    props.onBankDetailsChange({
      bankAccountNumber: account,
      ifscCode: ifsc,
      accountHolderName: undefined,
    });
    const r = await callProvider({
      providerName: 'BANK',
      input: { account, ifsc, id_number: account },
    });
    if (!r.ok || !r.data) {
      props.onStatusChange?.('failed');
      return;
    }
    await finalizePennyDrop(account, ifsc, r.data);
  };

  const canManualVerify =
    manualAccount.replace(/\s+/g, '').length >= 8 && isValidIfsc(manualIfsc);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload a cancelled cheque to auto-read the account number and IFSC, or switch to manual entry if OCR fails. Both flows verify the account via the configured Penny-Drop API.
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

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'upload')} className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-sm">
          <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-2" />Upload cheque</TabsTrigger>
          <TabsTrigger value="manual"><Pencil className="h-3.5 w-3.5 mr-2" />Enter manually</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-3">
          <OcrUploadAndVerify
            documentType="cheque"
            fileLabel="Cancelled Cheque *"
            currentFile={props.cancelledChequeFile}
            onFileChange={props.onCancelledChequeFileChange}
            runOcr={runBankOcr}
            onVerifyExtracted={handleOcrVerify}
            apiLabel="Bank"
            onVerified={() => {}}
            vendorId={props.vendorId}
          />
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="manualAccount">Account Number *</Label>
              <Input
                id="manualAccount"
                value={manualAccount}
                onChange={(e) => setManualAccount(e.target.value.replace(/\s+/g, ''))}
                placeholder="e.g. 50100123456789"
                className="font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="manualIfsc">IFSC Code *</Label>
              <Input
                id="manualIfsc"
                value={manualIfsc}
                onChange={(e) => setManualIfsc(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                maxLength={11}
                className="font-mono uppercase"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Verifies via the configured Penny-Drop API (KYC API Settings).
            </p>
            <VerifyButton
              onClick={handleManualVerify}
              state={manualState}
              disabled={!canManualVerify}
            />
          </div>
          <ValidationMessage state={manualState} />

          <FileUpload
            label="Cancelled Cheque / Bank Proof (optional)"
            accept=".pdf,.jpg,.jpeg,.png"
            documentType="cheque"
            onFileSelect={props.onCancelledChequeFileChange}
            currentFile={props.cancelledChequeFile}
            vendorId={props.vendorId}
          />
        </TabsContent>
      </Tabs>

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
                'Account Holder Name does not match with GST Legal Name and PAN Holder Name.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
