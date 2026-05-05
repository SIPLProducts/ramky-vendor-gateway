import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Lock, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';
import { fuzzyNameMatch, panMatch } from '@/lib/nameMatch';
import { mergeOcrExtracted } from '@/lib/kycExtract';
import { useEffect, useRef, useState } from 'react';

interface PanKycTabProps {
  pan: string;
  onPanChange: (v: string) => void;
  legalName?: string;
  panCardFile: File | null;
  onPanCardFileChange: (f: File | null) => void;
  onVerifiedDetails?: (data: Record<string, any>) => void;
  onStatusChange?: (status: 'idle' | 'validating' | 'passed' | 'failed') => void;
  vendorId?: string;
  /** Whether the vendor selected GST = "Yes" in the GST tab. */
  gstRegistered?: boolean;
  /** PAN number derived from the verified GSTIN (source of truth). */
  gstPanNumber?: string;
  /** Legal name from the verified GST registry record. */
  gstLegalName?: string;
  /** Whether GST verification has passed. */
  gstVerified: boolean;
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

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

  const gstRegistered = props.gstRegistered !== false; // default true to preserve old behavior

  // When GST is registered + verified, auto-populate PAN from GST registry data
  // and mark this tab as passed without requiring a PAN card upload.
  const autoNotifiedRef = useRef<string>('');
  const effectivePan = ((props.gstPanNumber || props.pan || '').toUpperCase().trim());
  useEffect(() => {
    if (!gstRegistered) return;
    if (!props.gstVerified) return;
    if (!effectivePan || effectivePan.length !== 10) return;

    const key = `${effectivePan}|${props.gstLegalName || ''}`;
    if (autoNotifiedRef.current === key) return;
    autoNotifiedRef.current = key;

    if (props.pan !== effectivePan) props.onPanChange(effectivePan);
    props.onVerifiedDetails?.({ pan_number: effectivePan, full_name: props.gstLegalName || '' });
    props.onStatusChange?.('passed');
  }, [gstRegistered, props.gstVerified, effectivePan, props.gstLegalName]);

  const runPanOcr = async (file: File) => {
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
    return { success: true, extracted: mergeOcrExtracted(r.data, r.raw), apiResult: r };
  };

  const handleVerify = async (extracted: Record<string, any>) => {
    const extractedPan = pickStr(extracted.pan_number).toUpperCase().trim();
    const extractedName = pickStr(extracted.full_name || extracted.holder_name || extracted.name).trim();

    setOcrPan(extractedPan);
    setOcrName(extractedName);
    if (extractedPan && extractedPan.length === 10) {
      props.onPanChange(extractedPan);
    }

    if (gstRegistered) {
      // GST cross-check path (vendor said Yes to GST)
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
    }

    // Non-GST path: validate PAN format + name match against the typed legal name.
    const panFormatOk = PAN_REGEX.test(extractedPan);
    const nameOk = props.legalName
      ? fuzzyNameMatch(extractedName, props.legalName)
      : !!extractedName;
    setPanCheck(panFormatOk ? 'passed' : 'failed');
    setNameCheck(nameOk ? 'passed' : 'failed');
    props.onVerifiedDetails?.(extracted);

    if (panFormatOk && nameOk) {
      props.onStatusChange?.('passed');
      return {
        ok: true,
        message: 'PAN verified successfully.',
        apiData: extracted,
      };
    }
    props.onStatusChange?.('failed');
    return {
      ok: false,
      message: !panFormatOk
        ? 'Invalid PAN number format extracted from card.'
        : `PAN holder name does not match the legal name${props.legalName ? ` ("${props.legalName}")` : ''}.`,
      apiData: extracted,
    };
  };

  const showFieldChecks = ocrPan || ocrName;

  // ---- GST = Yes branch ----
  if (gstRegistered) {
    if (!props.gstVerified) {
      return (
        <div className="space-y-4">
          <Alert className="border-warning/40 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning-foreground text-sm">
              Please complete <strong>GST verification</strong> first. PAN details will be auto-filled from the GST registry — no upload required.
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Alert className="border-success/40 bg-success/10">
          <ShieldCheck className="h-4 w-4 text-success" />
          <AlertDescription className="text-sm">
            PAN details have been auto-fetched from your verified GST record. No PAN card upload is required.
          </AlertDescription>
        </Alert>

        <div className="rounded-md border border-success/30 bg-success/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">PAN Number:</span>
            <span className="font-mono font-medium">{props.gstPanNumber || props.pan}</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">
              Auto-verified from GST
            </span>
          </div>
          {props.gstLegalName && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-muted-foreground">PAN Holder Name:</span>
              <span className="font-medium">{props.gstLegalName}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- GST = No branch (upload required) ----
  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Since you are not GST registered, please upload your PAN card. We'll read it via OCR and verify the PAN number and holder name.
        </AlertDescription>
      </Alert>

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
              passedMsg="PAN Number format is valid."
              failedMsg="Invalid PAN number format."
            />
          )}
          {ocrName && (
            <FieldCheckRow
              label="PAN Holder Name"
              value={ocrName}
              status={nameCheck}
              passedMsg="PAN Holder Name matches the legal name."
              failedMsg={`PAN Holder Name does not match the legal name${props.legalName ? ` ("${props.legalName}")` : ''}.`}
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
