import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, Lock, XCircle } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';
import { lookupIfsc, isValidIfsc } from '@/lib/ifscLookup';
import { nameMatchPercentage } from '@/lib/nameMatch';

const NAME_MATCH_THRESHOLD = 40;
import { mergeOcrExtracted } from '@/lib/kycExtract';

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
  const [holderName, setHolderName] = useState<string>('');
  const [holderCheck, setHolderCheck] =
    useState<'idle' | 'gst+pan' | 'gst' | 'pan' | 'failed'>('idle');

  // Manual fallback popup
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupReason, setPopupReason] = useState<string>('');
  const [popupAccount, setPopupAccount] = useState('');
  const [popupIfsc, setPopupIfsc] = useState('');
  const [popupSubmitting, setPopupSubmitting] = useState(false);
  const [popupError, setPopupError] = useState<string>('');

  const openManualPopup = (reason: string, prefillAccount = '', prefillIfsc = '') => {
    setPopupReason(reason);
    setPopupAccount(prefillAccount);
    setPopupIfsc(prefillIfsc);
    setPopupError('');
    setPopupOpen(true);
  };

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

    const panScore = nameMatchPercentage(apiName, props.panHolderName);
    const gstScore = nameMatchPercentage(apiName, props.gstLegalName);
    const panOk = panScore >= NAME_MATCH_THRESHOLD;
    const gstOk = gstScore >= NAME_MATCH_THRESHOLD;

    const refsLabel = props.panHolderName && props.gstLegalName
      ? 'PAN Holder Name and GST Legal Name'
      : props.panHolderName
        ? 'PAN Holder Name'
        : props.gstLegalName
          ? 'GST Legal Name'
          : '';

    let nameMessage = '';
    if (apiName && (props.gstLegalName || props.panHolderName)) {
      if (panOk && gstOk) {
        setHolderCheck('gst+pan');
        nameMessage = `Account Holder Name verified with PAN Holder Name (${panScore}% match) and GST Legal Name (${gstScore}% match).`;
      } else if (panOk) {
        setHolderCheck('pan');
        nameMessage = `Account Holder Name verified with PAN Holder Name (${panScore}% match).`;
      } else if (gstOk) {
        setHolderCheck('gst');
        nameMessage = `Account Holder Name verified with GST Legal Name (${gstScore}% match).`;
      } else {
        setHolderCheck('failed');
        props.onStatusChange?.('failed');
        return {
          ok: false,
          message: `Account Holder Name does not match with the provided ${refsLabel || 'PAN'} (best match ${Math.max(panScore, gstScore)}%, need ≥ ${NAME_MATCH_THRESHOLD}%).`,
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
      openManualPopup('Bank OCR provider not configured. Please enter your bank details manually.');
      return { success: false, error: 'Bank OCR provider not configured. Add it in KYC & Validation API Settings.', apiResult: r };
    }
    if (!r.ok) {
      openManualPopup(r.message || 'We could not read your cheque. Please enter your bank details manually.');
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

    if (!account || account.length < 8 || !isValidIfsc(ifsc)) {
      props.onStatusChange?.('failed');
      openManualPopup(
        'We could not read a valid Account Number / IFSC from your cheque. Please enter the details manually.',
        account,
        ifsc,
      );
      return { ok: false, message: 'Could not read account / IFSC from cheque — please enter manually.' };
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
      openManualPopup(r.message || 'Bank verification provider not configured. Please enter manually.', account, ifsc);
      return { ok: false, message: r.message || 'Bank validation provider not configured' };
    }
    if (!r.ok || !r.data) {
      props.onStatusChange?.('failed');
      openManualPopup(r.message || 'Bank verification failed. Please enter your details manually.', account, ifsc);
      return { ok: false, message: r.message || 'Bank verification failed', apiData: r.data };
    }
    return finalizePennyDrop(account, ifsc, r.data);
  };

  // Popup submit
  const handlePopupSubmit = async () => {
    const account = popupAccount.replace(/\s+/g, '');
    const ifsc = popupIfsc.toUpperCase().trim();
    setPopupError('');
    if (account.length < 8) {
      setPopupError('Enter a valid account number (min 8 digits).');
      return;
    }
    if (!isValidIfsc(ifsc)) {
      setPopupError('Enter a valid 11-character IFSC code.');
      return;
    }
    setPopupSubmitting(true);
    setHolderCheck('idle');
    setHolderName('');
    props.onStatusChange?.('validating');
    props.onBankDetailsChange({
      bankAccountNumber: account,
      ifscCode: ifsc,
      accountHolderName: undefined,
    });
    try {
      const r = await callProvider({
        providerName: 'BANK',
        input: { account, ifsc, id_number: account },
      });
      toastKycResult('Bank', r);
      if (!r.found || !r.ok || !r.data) {
        props.onStatusChange?.('failed');
        setPopupError(r.message || 'Bank verification failed. Please re-check the details and try again.');
        return;
      }
      const result = await finalizePennyDrop(account, ifsc, r.data);
      if (!result.ok) {
        setPopupError(result.message);
        return;
      }
      setPopupOpen(false);
    } finally {
      setPopupSubmitting(false);
    }
  };

  const canSubmitPopup =
    popupAccount.replace(/\s+/g, '').length >= 8 && isValidIfsc(popupIfsc);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload your cancelled cheque to auto-read account number and IFSC. If we can't read it, you'll be prompted to enter the details manually.
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
        onVerifyExtracted={handleOcrVerify}
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
                'Account Holder Name verified with PAN Holder Name and GST Legal Name.'}
              {holderCheck === 'gst' && 'Account Holder Name verified with GST Legal Name.'}
              {holderCheck === 'pan' && 'Account Holder Name verified with PAN Holder Name.'}
              {holderCheck === 'failed' &&
                'Account Holder Name does not match with the provided PAN/MSME details.'}
            </div>
          </div>
        </div>
      )}

      <Dialog open={popupOpen} onOpenChange={(o) => !popupSubmitting && setPopupOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank verification — enter details manually</DialogTitle>
            <DialogDescription>
              {popupReason || 'Please enter your bank account details to verify via Penny-Drop.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="popupAccount">Account Number *</Label>
              <Input
                id="popupAccount"
                value={popupAccount}
                onChange={(e) => setPopupAccount(e.target.value.replace(/\s+/g, ''))}
                placeholder="e.g. 50100123456789"
                className="font-mono"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="popupIfsc">IFSC Code *</Label>
              <Input
                id="popupIfsc"
                value={popupIfsc}
                onChange={(e) => setPopupIfsc(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                maxLength={11}
                className="font-mono uppercase"
              />
            </div>
            {popupError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="break-words">{popupError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPopupOpen(false)}
              disabled={popupSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePopupSubmit}
              disabled={!canSubmitPopup || popupSubmitting}
            >
              {popupSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
