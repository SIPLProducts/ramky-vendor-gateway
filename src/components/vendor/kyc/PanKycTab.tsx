import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Lock, XCircle, AlertTriangle } from 'lucide-react';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';
import {
  panMatch,
  evaluateCrossNameMatch,
  formatCrossMatchSuccess,
  formatCrossMatchFailure,
  type CrossNameMatchResult,
} from '@/lib/nameMatch';
import { mergeOcrExtracted } from '@/lib/kycExtract';
import { formatPanStatus, formatAadhaarLinked } from '@/lib/panComprehensive';
import { useState } from 'react';

export type PanCheckStatus = 'idle' | 'passed' | 'failed';
export interface PanTabResult {
  ocrPan: string;
  ocrName: string;
  panCheck: PanCheckStatus;
  nameCheck: PanCheckStatus;
  nameCheckMessage?: string;
  nameMatchResult?: CrossNameMatchResult;
  /** Raw `status` value from PAN Comprehensive API (e.g. "valid"). */
  panStatus?: string | null;
  /** Raw `aadhaar_linked` boolean from PAN Comprehensive API. */
  aadhaarLinked?: boolean | null;
}

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
  /** Trade name from the verified GST registry record (cross-check). */
  gstTradeName?: string;
  /** Enterprise name from the verified MSME record (cross-check). */
  msmeEnterpriseName?: string;
  /** Account holder name from the verified Bank record (cross-check). */
  bankAccountHolderName?: string;
  /** Whether GST verification has passed. PAN cannot be validated otherwise. */
  gstVerified: boolean;
  /** Persisted OCR result (lifted to parent so it survives tab switches). */
  ocrResult?: PanTabResult;
  onOcrResultChange?: (r: PanTabResult) => void;
  /** Fires when PAN Comprehensive API returns status/aadhaar_linked. */
  onComprehensiveResult?: (v: { status?: string | null; aadhaarLinked?: boolean | null }) => void;
}

function pickStr(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && 'value' in v) return String((v as any).value ?? '');
  return '';
}

const EMPTY_RESULT: PanTabResult = { ocrPan: '', ocrName: '', panCheck: 'idle', nameCheck: 'idle' };

export function PanKycTab(props: PanKycTabProps) {
  const { callProvider } = useConfiguredKycApi();
  const [localResult, setLocalResult] = useState<PanTabResult>(EMPTY_RESULT);
  const result = props.ocrResult ?? localResult;
  const { ocrPan, ocrName, panCheck, nameCheck, nameCheckMessage, nameMatchResult, panStatus, aadhaarLinked } = result;
  const updateResult = (next: Partial<PanTabResult>) => {
    const merged = { ...result, ...next };
    if (props.onOcrResultChange) props.onOcrResultChange(merged);
    else setLocalResult(merged);
  };


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
    return { success: true, extracted: mergeOcrExtracted(r.data, r.raw), apiResult: r };
  };

  // OCR is the only API call. PAN number is matched strictly against the GST
  // registry. Holder name is evaluated against ALL other available verified
  // names (GST / MSME / Bank) using the cross-field policy: any match >= 20%.
  const handleVerify = async (extracted: Record<string, any>) => {
    const extractedPan = pickStr(extracted.pan_number).toUpperCase().trim();
    const extractedName = pickStr(extracted.full_name || extracted.holder_name || extracted.name).trim();

    if (extractedPan && extractedPan.length === 10) {
      props.onPanChange(extractedPan);
    }

    const panOk = panMatch(extractedPan, props.gstPanNumber);

    const nameEval = evaluateCrossNameMatch(extractedName, [
      { field: 'GST Legal Name', value: props.gstLegalName },
      { field: 'GST Trade Name', value: props.gstTradeName },
      { field: 'MSME Enterprise Name', value: props.msmeEnterpriseName },
      { field: 'Bank Account Holder Name', value: props.bankAccountHolderName },
    ]);

    // If no other names available yet, skip cross-check (treat as pass).
    const nameOk = nameEval.skipped ? true : nameEval.passed;
    const nameMessage = nameEval.skipped
      ? 'PAN Holder Name captured (no other verified names yet to cross-check).'
      : nameEval.passed
        ? formatCrossMatchSuccess('PAN Holder Name', nameEval.matches)
        : formatCrossMatchFailure('PAN Holder Name', nameEval.best);

    updateResult({
      ocrPan: extractedPan,
      ocrName: extractedName,
      panCheck: panOk ? 'passed' : 'failed',
      nameCheck: nameOk ? 'passed' : 'failed',
      nameCheckMessage: nameMessage,
      nameMatchResult: nameEval,
    });

    props.onVerifiedDetails?.(extracted);

    if (panOk && nameOk) {
      props.onStatusChange?.('passed');
      // Fire-and-forget PAN Comprehensive call to fetch `status` + `aadhaar_linked`.
      // Optional: if the provider isn't configured or the call fails, we silently
      // skip — this must not block PAN verification.
      (async () => {
        try {
          const cr = await callProvider({
            providerName: 'PAN',
            input: { id_number: extractedPan, pan: extractedPan },
          });
          if (cr?.ok && cr.data) {
            const rawStatus = pickStr((cr.data as any).status) || null;
            const rawLinked = (cr.data as any).aadhaar_linked;
            const aadhaarLinked =
              rawLinked === true || String(rawLinked).toLowerCase() === 'true'
                ? true
                : rawLinked === false || String(rawLinked).toLowerCase() === 'false'
                  ? false
                  : null;
            updateResult({ panStatus: rawStatus, aadhaarLinked });
            props.onComprehensiveResult?.({ status: rawStatus, aadhaarLinked });
          }
        } catch {
          /* silent — comprehensive call is best-effort */
        }
      })();
      return {
        ok: true,
        message: `PAN Number verified with GST PAN Number. ${nameMessage}`,
        apiData: extracted,
      };
    }
    props.onStatusChange?.('failed');
    return {
      ok: false,
      message: panOk ? nameMessage : 'PAN Number does not match the verified GST PAN Number.',
      apiData: extracted,
    };
  };

  const showFieldChecks = ocrPan || ocrName;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload your PAN card. We'll read it via OCR, verify the PAN number against your GST record, and cross-check the holder name with all other verified names (GST / MSME / Bank).
        </AlertDescription>
      </Alert>

      {!props.gstVerified && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning-foreground text-sm">
            Please complete <strong>GST verification</strong> first. PAN is validated against the PAN number returned by the GST registry.
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
              failedMsg={`PAN Number does not match GST data${props.gstPanNumber ? ` (GST PAN: ${props.gstPanNumber})` : ''}.`}
            />
          )}
          {ocrName && (
            <FieldCheckRow
              label="PAN Holder Name"
              value={ocrName}
              status={nameCheck}
              passedMsg={nameCheckMessage || 'PAN Holder Name verified.'}
              failedMsg={nameCheckMessage || 'PAN Holder Name does not match any verified name.'}
            />
          )}
          {(panStatus != null || aadhaarLinked != null) && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm space-y-1.5">
              <div className="flex flex-wrap gap-x-2">
                <span className="text-xs text-muted-foreground">PAN Status:</span>
                <span className="font-medium">{formatPanStatus(panStatus)}</span>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <span className="text-xs text-muted-foreground">Is Aadhaar Linked:</span>
                <span className="font-medium">{formatAadhaarLinked(aadhaarLinked)}</span>
              </div>
            </div>
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
