import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import { OcrUploadAndVerify, ComparisonRow } from './OcrUploadAndVerify';
import { supabase } from '@/integrations/supabase/client';

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
  const handleVerify = async (extracted: Record<string, any>) => {
    const extractedPan = (extracted.pan_number || '').toUpperCase().trim();
    if (!extractedPan || extractedPan.length !== 10) {
      props.onStatusChange?.('failed');
      return { ok: false, message: 'Could not read a valid 10-character PAN from the document.' };
    }
    props.onPanChange(extractedPan);
    props.onStatusChange?.('validating');
    try {
      const { data, error } = await supabase.functions.invoke('verify-pan', {
        body: { id_number: extractedPan },
      });
      if (error) throw error;
      if (!data?.success) {
        props.onStatusChange?.('failed');
        return { ok: false, message: data?.message || 'PAN verification failed' };
      }
      const apiData = data.data || {};
      const apiName = (apiData.full_name || '').toString();
      if (props.legalName && apiName) {
        const a = props.legalName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const b = apiName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (!a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
          props.onStatusChange?.('failed');
          return {
            ok: false,
            message: `Name mismatch: PAN is registered to "${apiName}" but you entered "${props.legalName}".`,
            apiData,
          };
        }
      }
      props.onVerifiedDetails?.(apiData);
      props.onStatusChange?.('passed');
      return { ok: true, message: `PAN verified — ${apiName || extractedPan}`, apiData };
    } catch (e: any) {
      props.onStatusChange?.('failed');
      return { ok: false, message: e?.message || 'Verification service unavailable' };
    }
  };

  const buildRows = (extracted: Record<string, any>, apiData?: Record<string, any>): ComparisonRow[] => [
    { label: 'PAN Number', ocrValue: extracted.pan_number, apiValue: apiData?.pan_number },
    { label: 'Holder Name', ocrValue: extracted.holder_name, apiValue: apiData?.full_name },
    { label: 'Date of Birth', ocrValue: extracted.date_of_birth, apiValue: apiData?.date_of_birth },
  ];

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Upload your PAN card. We will read it via OCR and verify it against the official PAN database. Manual entry is disabled.
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
        onVerifyExtracted={handleVerify}
        buildComparisonRows={buildRows}
        onVerified={() => { /* state pushed via props */ }}
        vendorId={props.vendorId}
      />
    </div>
  );
}
