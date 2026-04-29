import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil, Upload } from 'lucide-react';
import { ManualEntryAndVerify } from './ManualEntryAndVerify';
import { OcrUploadAndVerify, ComparisonRow } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { useProviderVerify } from '@/hooks/useProviderVerify';

interface MsmeKycTabProps {
  isMsmeRegistered: boolean;
  onIsMsmeRegisteredChange: (v: boolean) => void;
  msmeNumber: string;
  onMsmeNumberChange: (v: string) => void;
  onMsmeCategoryChange?: (cat: 'micro' | 'small' | 'medium' | '') => void;
  legalName?: string;
  msmeCertificateFile: File | null;
  onMsmeCertificateFileChange: (f: File | null) => void;
  onVerifiedDetails?: (data: Record<string, any>) => void;
  onStatusChange?: (status: 'idle' | 'validating' | 'passed' | 'failed' | 'na') => void;
  vendorId?: string;
}

export function MsmeKycTab(props: MsmeKycTabProps) {
  const { callProvider } = useConfiguredKycApi();
  const { state, verify } = useProviderVerify();
  const [mode, setMode] = useState<'manual' | 'upload'>('manual');

  if (props.onStatusChange) {
    props.onStatusChange(props.isMsmeRegistered ? (state.status as any) : 'na');
  }

  const handleManualVerify = async () => {
    const r = await verify({
      providerName: 'MSME',
      input: { msme: props.msmeNumber, id_number: props.msmeNumber },
      validate: (data) => {
        const apiName = String(data.enterprise_name || data.legal_name || '').trim();
        if (props.legalName && apiName) {
          const a = props.legalName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
          const b = apiName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
          if (!a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
            return { ok: false, message: `Name mismatch: MSME is registered to "${apiName}" but you entered "${props.legalName}".`, data };
          }
        }
        const cat = String(data.enterprise_type || '').toLowerCase();
        if (cat === 'micro' || cat === 'small' || cat === 'medium') {
          props.onMsmeCategoryChange?.(cat as any);
        }
        return { ok: true, message: `MSME verified — ${apiName || props.msmeNumber}`, data };
      },
    });
    if (r.ok) props.onVerifiedDetails?.(r.data || {});
  };

  const runMsmeOcr = async (file: File) => {
    const r = await callProvider({ providerName: 'MSME_OCR', file });
    if (!r.found) return { success: false, error: r.message || 'MSME OCR provider not configured' };
    if (!r.ok || !r.data) return { success: false, error: r.message || 'MSME OCR failed' };
    return { success: true, extracted: r.data };
  };

  const handleOcrVerify = async (extracted: Record<string, any>) => {
    const extractedNum = String(extracted.udyam_number || '').toUpperCase().trim();
    if (!extractedNum) {
      return { ok: false, message: 'Could not read a valid Udyam number from the certificate.' };
    }
    props.onMsmeNumberChange(extractedNum);
    const apiName = String(extracted.enterprise_name || '').trim();
    if (props.legalName && apiName) {
      const a = props.legalName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const b = apiName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (!a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
        return {
          ok: false,
          message: `Name mismatch: MSME is registered to "${apiName}" but you entered "${props.legalName}".`,
          apiData: extracted,
        };
      }
    }
    const cat = String(extracted.enterprise_type || '').toLowerCase();
    if (cat === 'micro' || cat === 'small' || cat === 'medium') {
      props.onMsmeCategoryChange?.(cat as any);
    }
    props.onVerifiedDetails?.(extracted);
    return { ok: true, message: `MSME verified — ${apiName || extractedNum}`, apiData: extracted };
  };

  const buildRows = (extracted: Record<string, any>): ComparisonRow[] => [
    { label: 'Udyam Number', ocrValue: extracted.udyam_number },
    { label: 'Enterprise Name', ocrValue: extracted.enterprise_name },
    { label: 'Type', ocrValue: extracted.enterprise_type },
    { label: 'Major Activity', ocrValue: extracted.major_activity },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label>Are you MSME registered? *</Label>
        <RadioGroup
          value={props.isMsmeRegistered ? 'yes' : 'no'}
          onValueChange={(v) => props.onIsMsmeRegisteredChange(v === 'yes')}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id="msme-yes" />
            <Label htmlFor="msme-yes" className="font-normal cursor-pointer">Yes</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id="msme-no" />
            <Label htmlFor="msme-no" className="font-normal cursor-pointer">No</Label>
          </div>
        </RadioGroup>
      </div>

      {props.isMsmeRegistered && (
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'upload')} className="space-y-4">
          <TabsList className="grid grid-cols-2 max-w-sm">
            <TabsTrigger value="manual"><Pencil className="h-3.5 w-3.5 mr-2" />Enter manually</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-2" />Upload certificate</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3">
            <ManualEntryAndVerify
              id="msmeNumber"
              label="MSME / Udyam Number *"
              placeholder="UDYAM-XX-00-0000000"
              value={props.msmeNumber}
              onChange={props.onMsmeNumberChange}
              onVerify={handleManualVerify}
              state={state}
              canVerify={!!props.msmeNumber && props.msmeNumber.length >= 10}
              helperText="Enter your Udyam registration number and click Verify."
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <OcrUploadAndVerify
              documentType="msme"
              fileLabel="MSME / Udyam Certificate *"
              currentFile={props.msmeCertificateFile}
              onFileChange={props.onMsmeCertificateFileChange}
              runOcr={runMsmeOcr}
              skipVerifyPhase
              onVerifyExtracted={handleOcrVerify}
              buildComparisonRows={buildRows}
              onVerified={() => {}}
              vendorId={props.vendorId}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
