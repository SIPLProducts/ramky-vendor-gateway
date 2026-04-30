import { useState } from 'react';
import { FileUpload } from '@/components/vendor/FileUpload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, ScanLine, ShieldCheck, CheckCircle2, XCircle, RotateCw } from 'lucide-react';
import type { OcrDocumentType } from '@/hooks/useOcrExtraction';
import type { KycApiResult } from '@/hooks/useConfiguredKycApi';
import { ApiResponseDetails } from './ApiResponseDetails';

/** Kept for backwards compatibility — most callers no longer pass this. */
export interface ComparisonRow {
  label: string;
  ocrValue?: string;
  apiValue?: string;
}

interface OcrUploadAndVerifyProps {
  documentType: OcrDocumentType;
  fileLabel: string;
  acceptedFileTypes?: string;
  currentFile?: File | null;
  onFileChange: (file: File | null) => void;
  /**
   * Required: OCR runner backed by an admin-configured KYC provider.
   * Should also pass through the raw `KycApiResult` so the UI can render
   * exactly what the upstream API returned.
   */
  runOcr: (file: File) => Promise<{
    success: boolean;
    extracted?: Record<string, any>;
    error?: string;
    /** Raw KYC API result so we can show whatever fields the API returned. */
    apiResult?: KycApiResult;
  }>;
  /** Run validation API after OCR. Return { ok, message, apiData } */
  onVerifyExtracted: (extracted: Record<string, any>) => Promise<{
    ok: boolean;
    message: string;
    apiData?: Record<string, any>;
    /** Optional raw KYC API result from the verification step. */
    apiResult?: KycApiResult;
  }>;
  /** Called once verification passes — parent should commit verified values to its form */
  onVerified: (verified: { extracted: Record<string, any>; apiData?: Record<string, any> }) => void;
  vendorId?: string;
  /** When OCR result is the same as the validated record, skip the second "Verifying" phase. */
  skipVerifyPhase?: boolean;
  /** Friendly label shown above the API response card (e.g. "GST OCR"). */
  apiLabel?: string;
}

type Phase = 'idle' | 'ocr' | 'verifying' | 'passed' | 'failed';

export function OcrUploadAndVerify({
  documentType,
  fileLabel,
  acceptedFileTypes = '.pdf,.jpg,.jpeg,.png',
  currentFile,
  onFileChange,
  runOcr,
  onVerifyExtracted,
  onVerified,
  vendorId,
  skipVerifyPhase,
  apiLabel,
}: OcrUploadAndVerifyProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<KycApiResult | undefined>();
  const [verifyResult, setVerifyResult] = useState<KycApiResult | undefined>();
  const [showDetails, setShowDetails] = useState(true);

  const runPipeline = async (file: File) => {
    setOcrResult(undefined);
    setVerifyResult(undefined);
    setPhase('ocr');
    setMessage('Reading document via configured OCR provider…');

    if (!runOcr) {
      setPhase('failed');
      setMessage('OCR provider not configured. Add it in KYC & Validation API Settings.');
      return;
    }
    const ocr = await runOcr(file);
    setOcrResult(ocr.apiResult);

    if (!ocr.success || !ocr.extracted) {
      setPhase('failed');
      setMessage(ocr.error || 'Could not read the document. Please upload a clearer scan.');
      return;
    }

    if (!skipVerifyPhase) {
      setPhase('verifying');
      setMessage('Verifying extracted details with the validation API…');
    }
    const verify = await onVerifyExtracted(ocr.extracted);
    setVerifyResult(verify.apiResult);

    if (verify.ok) {
      setPhase('passed');
      setMessage(verify.message || 'Verified successfully.');
      onVerified({ extracted: ocr.extracted, apiData: verify.apiData });
    } else {
      setPhase('failed');
      setMessage(verify.message || 'Verification failed.');
    }
  };

  const handleFileSelect = async (file: File | null) => {
    onFileChange(file);
    if (file) await runPipeline(file);
  };

  const handleRetry = async () => {
    if (currentFile) await runPipeline(currentFile);
  };

  return (
    <div className="space-y-3">
      <FileUpload
        label={fileLabel}
        accept={acceptedFileTypes}
        documentType={documentType}
        onFileSelect={handleFileSelect}
        currentFile={currentFile}
        vendorId={vendorId}
      />

      {phase === 'ocr' && (
        <Alert className="border-primary/30 bg-primary/5">
          <ScanLine className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {message}
          </AlertDescription>
        </Alert>
      )}

      {phase === 'verifying' && (
        <Alert className="border-primary/30 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {message}
          </AlertDescription>
        </Alert>
      )}

      {phase === 'passed' && (
        <Alert className="border-success/30 bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="text-success font-medium flex items-center justify-between gap-2">
            <span>{message}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowDetails((s) => !s)}
            >
              {showDetails ? 'Hide details' : 'View details'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {phase === 'failed' && (
        <Alert className="border-destructive/30 bg-destructive/10">
          <XCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive flex items-center justify-between gap-2">
            <span>{message}</span>
            {currentFile && (
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={handleRetry}>
                <RotateCw className="h-3 w-3 mr-1" /> Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Show whatever the OCR / verify APIs actually returned — no hardcoded fields. */}
      {(phase === 'failed' || (phase === 'passed' && showDetails)) && ocrResult && (
        <ApiResponseDetails result={ocrResult} title={`${apiLabel || 'OCR'} response`} />
      )}
      {(phase === 'failed' || (phase === 'passed' && showDetails)) && verifyResult && (
        <ApiResponseDetails result={verifyResult} title={`${apiLabel || 'Validation'} verification response`} />
      )}
    </div>
  );
}
