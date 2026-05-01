import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Lock, XCircle, AlertTriangle } from 'lucide-react';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';
import { fuzzyNameMatch, panMatch } from '@/lib/nameMatch';
import { useState } from 'react';

interface PanKycTabProps {
  pan: string;
  onPanChange: (v: string) => void;
  legalName?: string;
  panCardFile: File | null;
  onPanCardFileChange: (f: File | null) => void;
  onVerifiedDetails?: (data: Record<string, any>) => void;
  onStatusChange?: (status: 'idle' | 'validating' | 'passed' | 'failed') => void;
  vendorId?: string;
  /** PAN number derived from the verified GSTIN (source of truth). */
  gstPanNumber?: string;
  /** Legal name from the verified GST registry record. */
  gstLegalName?: string;
  /** Whether GST verification has passed. PAN cannot be validated otherwise. */
  gstVerified: boolean;
}

function pickStr(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && 'value' in v) return String((v as any).value ?? '');
  return '';
}

export function PanKycTab(props: PanKycTabProps) {
  const { callProvider } = useConfiguredKycApi();
  const [ocrPan, setOcrPan] = useState<string>('');
  const [ocrName, setOcrName] = useState<string>('');
  const [panCheck, setPanCheck] = useState<'idle' | 'passed' | 'failed'>('idle');
  const [nameCheck, setNameCheck] = useState<'idle' | 'passed' | 'failed'>('idle');

  const runPanOcr = async (file: File) => {
    if (!props.gstVerified) {
      return {
        success: false,
        error: 'Please verify GST first — PAN is validated against GST records.',
      };
    }
    props.onStatusChange?.('validating');
    const r = await callProvider({ providerName: 'PAN_OCR', file });
    toastKycResult('PAN OCR', r);
    if (!r.found && !r.message_code) {
      props.onStatusChange?.('failed');
      return {
        success: false,
        error: 'PAN OCR provider not configured. Add it in KYC & Validation API Settings.',
        apiResult: r,
      };
    }
    if (!r.ok) {
      props.onStatusChange?.('failed');
      return { success: false, error: r.message || r.message_code || 'PAN OCR failed', apiResult: r };
    }
    return { success: true, extracted: r.data || {}, apiResult: r };
  };

  // OCR is the only API call. Validation is done by comparing the extracted
  // PAN number + holder name against the GST tab's verified registry data.
  const handleVerify = async (extracted: Record<string, any>) => {
    const extractedPan = pickStr(extracted.pan_number).toUpperCase().trim();
    const extractedName = pickStr(extracted.full_name || extracted.holder_name || extracted.name).trim();

    setOcrPan(extractedPan);
    setOcrName(extractedName);
    if (extractedPan && extractedPan.length === 10) {
      props.onPanChange(extractedPan);
    }

    const panOk = panMatch(extractedPan, props.gstPanNumber);
    const nameOk = fuzzyNameMatch(extractedName, props.gstLegalName);
    setPanCheck(panOk ? 'passed' : 'failed');
    setNameCheck(nameOk ? 'passed' : 'failed');

    props.onVerifiedDetails?.(extracted);

    if (panOk && nameOk) {
      props.onStatusChange?.('passed');
      return {
        ok: true,
        message: 'PAN Number verified with GST PAN Number. PAN Holder Name verified with GST Legal Name.',
        apiData: extracted,
      };
    }
    props.onStatusChange?.('failed');
    return {
      ok: false,
      message: 'PAN details do not match with GST data.',
      apiData: extracted,
    };
  };

  const showFieldChecks = ocrPan || ocrName;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload your PAN card. We'll read it via OCR and verify the PAN number and holder name against your verified GST record.
        </AlertDescription>
      </Alert>

      {!props.gstVerified && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning-foreground text-sm">
            Please complete <strong>GST verification</strong> first. PAN is validated against the PAN number and legal name returned by the GST registry.
          </AlertDescription>
        </Alert>
      )}

      {props.pan && (
        <div className="flex items-center gap-2 p-3 rounded-md border border-success/30 bg-success/5 text-sm">
          <Lock className="h-4 w-4 text-success" />
          <span className="text-muted-foreground">PAN:</span>
          <span className="font-mono font-medium">{props.pan}</span>
        </div>
      )}

      <OcrUploadAndVerify
        documentType="pan"
        fileLabel="PAN Card *"
        currentFile={props.panCardFile}
        onFileChange={props.onPanCardFileChange}
        runOcr={runPanOcr}
        skipVerifyPhase
        onVerifyExtracted={handleVerify}
        apiLabel="PAN OCR"
        onVerified={() => { /* state pushed via props */ }}
        vendorId={props.vendorId}
      />

      {showFieldChecks && (
        <div className="space-y-2">
          {ocrPan && (
            <FieldCheckRow
              label="PAN Number"
              value={ocrPan}
              status={panCheck}
              passedMsg="PAN Number verified with GST PAN Number."
              failedMsg={`PAN details do not match with GST data${props.gstPanNumber ? ` (GST PAN: ${props.gstPanNumber})` : ''}.`}
            />
          )}
          {ocrName && (
            <FieldCheckRow
              label="PAN Holder Name"
              value={ocrName}
              status={nameCheck}
              passedMsg="PAN Holder Name verified with GST Legal Name."
              failedMsg={`PAN Holder Name does not match GST Legal Name${props.gstLegalName ? ` ("${props.gstLegalName}")` : ''}.`}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FieldCheckRow({
  label, value, status, passedMsg, failedMsg,
}: {
  label: string;
  value: string;
  status: 'idle' | 'passed' | 'failed';
  passedMsg: string;
  failedMsg: string;
}) {
  if (status === 'idle') return null;
  const passed = status === 'passed';
  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
        passed ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
      }`}
    >
      {passed ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
      ) : (
        <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
      )}
      <div className="space-y-0.5 min-w-0">
        <div className="flex flex-wrap gap-x-2 items-baseline">
          <span className="text-xs text-muted-foreground">{label}:</span>
          <span className="font-medium font-mono break-all">{value}</span>
        </div>
        <div className={passed ? 'text-success' : 'text-destructive'}>
          {passed ? passedMsg : failedMsg}
        </div>
      </div>
    </div>
  );
}
