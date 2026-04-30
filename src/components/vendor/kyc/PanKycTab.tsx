import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import { OcrUploadAndVerify, ComparisonRow } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';

interface PanKycTabProps {
  pan: string;
  onPanChange: (v: string) => void;
  legalName?: string;
  panCardFile: File | null;
  onPanCardFileChange: (f: File | null) => void;
  onVerifiedDetails?: (data: Record<string, any>) => void;
  onStatusChange?: (status: 'idle' | 'validating' | 'passed' | 'failed') => void;
  vendorId?: string;
}

export function PanKycTab(props: PanKycTabProps) {
  const { callProvider } = useConfiguredKycApi();

  const runPanOcr = async (file: File) => {
    props.onStatusChange?.('validating');
    const r = await callProvider({ providerName: 'PAN_OCR', file });
    toastKycResult('PAN OCR', r);
    if (!r.found && !r.message_code) {
      props.onStatusChange?.('failed');
      return { success: false, error: 'PAN OCR provider not configured. Add it in KYC & Validation API Settings.' };
    }
    if (!r.ok || !r.data || Object.keys(r.data).length === 0) {
      props.onStatusChange?.('failed');
      return { success: false, error: r.message || 'PAN OCR failed' };
    }
    return { success: true, extracted: r.data };
  };

  const handleVerify = async (extracted: Record<string, any>) => {
    const extractedPan = String(extracted.pan_number || '').toUpperCase().trim();
    if (!extractedPan || extractedPan.length !== 10) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid 10-character PAN from the document.' };
    }
    props.onPanChange(extractedPan);

    const apiName = String(extracted.full_name || '').trim();
    if (props.legalName && apiName) {
      const a = props.legalName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const b = apiName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (!a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
        props.onStatusChange?.('failed');
        return {
          ok: false,
          message: `Name mismatch: PAN is registered to "${apiName}" but you entered "${props.legalName}".`,
          apiData: extracted,
        };
      }
    }
    props.onVerifiedDetails?.(extracted);
    props.onStatusChange?.('passed');
    return { ok: true, message: `PAN verified — ${apiName || extractedPan}`, apiData: extracted };
  };

  const buildRows = (extracted: Record<string, any>): ComparisonRow[] => [
    { label: 'PAN Number', ocrValue: extracted.pan_number },
    { label: 'Full Name', ocrValue: extracted.full_name },
    { label: 'Father Name', ocrValue: extracted.father_name },
    { label: 'Date of Birth', ocrValue: extracted.dob },
  ];

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload your PAN card. We'll read it via the configured OCR API and verify the details automatically.
        </AlertDescription>
      </Alert>

      {props.pan && (
        <div className="flex items-center gap-2 p-3 rounded-md border border-success/30 bg-success/5 text-sm">
          <Lock className="h-4 w-4 text-success" />
          <span className="text-muted-foreground">Verified PAN:</span>
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
        buildComparisonRows={buildRows}
        onVerified={() => { /* state pushed via props */ }}
        vendorId={props.vendorId}
      />
    </div>
  );
}
