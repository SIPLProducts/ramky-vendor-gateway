import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil, Upload } from 'lucide-react';
import { ManualEntryAndVerify } from './ManualEntryAndVerify';
import { OcrUploadAndVerify, ComparisonRow } from './OcrUploadAndVerify';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { supabase } from '@/integrations/supabase/client';

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
  const { validationStates, validateMSME } = useFieldValidation(props.vendorId);
  const [mode, setMode] = useState<'manual' | 'upload'>('manual');
  const state = validationStates.msme;

  if (props.onStatusChange) {
    props.onStatusChange(props.isMsmeRegistered ? (state.status as any) : 'na');
  }

  const handleManualVerify = async () => {
    const ok = await validateMSME(props.msmeNumber, props.legalName);
    if (ok) props.onVerifiedDetails?.(state.data || {});
  };

  const handleOcrVerify = async (extracted: Record<string, any>) => {
    const extractedNum = (extracted.udyam_number || '').toUpperCase().trim();
    if (!extractedNum) {
      return { ok: false, message: 'Could not read a valid Udyam number from the certificate.' };
    }
    props.onMsmeNumberChange(extractedNum);
    try {
      const { data, error } = await supabase.functions.invoke('validate-msme', {
        body: { id_number: extractedNum },
      });
      if (error) throw error;
      if (!data?.success) return { ok: false, message: data?.message || 'MSME verification failed' };
      const apiData = data.data || {};
      const apiName = (apiData.enterprise_name || '').toString();
      if (props.legalName && apiName) {
        const a = props.legalName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const b = apiName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (!a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
          return {
            ok: false,
            message: `Name mismatch: MSME is registered to "${apiName}" but you entered "${props.legalName}".`,
            apiData,
          };
        }
      }
      const cat = (apiData.enterprise_type || '').toString().toLowerCase();
      if (cat === 'micro' || cat === 'small' || cat === 'medium') {
        props.onMsmeCategoryChange?.(cat as any);
      }
      props.onVerifiedDetails?.(apiData);
      return { ok: true, message: `MSME verified — ${apiName || extractedNum}`, apiData };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Verification service unavailable' };
    }
  };

  const buildRows = (extracted: Record<string, any>, apiData?: Record<string, any>): ComparisonRow[] => [
    { label: 'Udyam Number', ocrValue: extracted.udyam_number, apiValue: apiData?.udyam_number },
    { label: 'Enterprise Name', ocrValue: extracted.enterprise_name, apiValue: apiData?.enterprise_name },
    { label: 'Type', ocrValue: extracted.enterprise_type, apiValue: apiData?.enterprise_type },
    { label: 'Major Activity', ocrValue: extracted.major_activity, apiValue: apiData?.major_activity },
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
