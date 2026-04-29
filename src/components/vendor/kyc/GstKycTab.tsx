import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, FileText, Pencil, Upload } from 'lucide-react';
import { FileUpload } from '@/components/vendor/FileUpload';
import { ManualEntryAndVerify } from './ManualEntryAndVerify';
import { OcrUploadAndVerify, ComparisonRow } from './OcrUploadAndVerify';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { supabase } from '@/integrations/supabase/client';

interface GstKycTabProps {
  isGstRegistered: boolean;
  onIsGstRegisteredChange: (val: boolean) => void;
  gstin: string;
  onGstinChange: (v: string) => void;
  legalName?: string;
  gstCertificateFile: File | null;
  onGstCertificateFileChange: (f: File | null) => void;
  gstSelfDeclarationFile: File | null;
  onGstSelfDeclarationFileChange: (f: File | null) => void;
  gstDeclarationReason: string;
  onGstDeclarationReasonChange: (v: string) => void;
  onVerifiedDetails?: (data: Record<string, any>) => void;
  onStatusChange?: (status: 'idle' | 'validating' | 'passed' | 'failed' | 'na') => void;
  vendorId?: string;
}

export function GstKycTab(props: GstKycTabProps) {
  const { validationStates, validateGST, resetValidation } = useFieldValidation(props.vendorId);
  const [mode, setMode] = useState<'manual' | 'upload'>('manual');

  const state = validationStates.gst;

  // Bubble status to parent
  if (props.onStatusChange) {
    const status = !props.isGstRegistered
      ? (props.gstSelfDeclarationFile ? 'passed' : 'na')
      : state.status;
    props.onStatusChange(status as any);
  }

  const handleManualVerify = async () => {
    const ok = await validateGST(props.gstin, props.legalName);
    if (ok) props.onVerifiedDetails?.(state.data || {});
  };

  const handleOcrVerify = async (extracted: Record<string, any>) => {
    const extractedGstin = (extracted.gstin || '').toUpperCase().trim();
    if (!extractedGstin || extractedGstin.length !== 15) {
      return { ok: false, message: 'Could not read a valid 15-character GSTIN from the certificate.' };
    }
    props.onGstinChange(extractedGstin);
    resetValidation('gst');
    try {
      const { data, error } = await supabase.functions.invoke('validate-gst', {
        body: { id_number: extractedGstin },
      });
      if (error) throw error;
      if (!data?.success) {
        return { ok: false, message: data?.message || 'GSTIN verification failed' };
      }
      const apiData = data.data || {};
      // simple name check vs legalName
      const apiName = (apiData.legal_name || apiData.trade_name || '').toString();
      if (props.legalName && apiName) {
        const a = props.legalName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const b = apiName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (!a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
          return {
            ok: false,
            message: `Name mismatch: GSTIN is registered to "${apiName}" but you entered "${props.legalName}".`,
            apiData,
          };
        }
      }
      props.onVerifiedDetails?.(apiData);
      return { ok: true, message: `GSTIN verified — ${apiName || extractedGstin}`, apiData };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Verification service unavailable' };
    }
  };

  const buildRows = (extracted: Record<string, any>, apiData?: Record<string, any>): ComparisonRow[] => [
    { label: 'GSTIN', ocrValue: extracted.gstin, apiValue: apiData?.gstin },
    { label: 'Legal Name', ocrValue: extracted.legal_name, apiValue: apiData?.legal_name },
    { label: 'Trade Name', ocrValue: extracted.trade_name, apiValue: apiData?.trade_name },
    { label: 'Status', ocrValue: extracted.gst_status, apiValue: apiData?.status },
    { label: 'Address', ocrValue: extracted.principal_place_of_business, apiValue: apiData?.address },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label>Are you GST registered? *</Label>
        <RadioGroup
          value={props.isGstRegistered ? 'yes' : 'no'}
          onValueChange={(v) => props.onIsGstRegisteredChange(v === 'yes')}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id="gst-yes" />
            <Label htmlFor="gst-yes" className="font-normal cursor-pointer">Yes</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id="gst-no" />
            <Label htmlFor="gst-no" className="font-normal cursor-pointer">No</Label>
          </div>
        </RadioGroup>
      </div>

      {props.isGstRegistered ? (
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'upload')} className="space-y-4">
          <TabsList className="grid grid-cols-2 max-w-sm">
            <TabsTrigger value="manual"><Pencil className="h-3.5 w-3.5 mr-2" />Enter manually</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-2" />Upload certificate</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3">
            <ManualEntryAndVerify
              id="gstin"
              label="GSTIN *"
              placeholder="22AAAAA0000A1Z5"
              value={props.gstin}
              onChange={props.onGstinChange}
              onVerify={handleManualVerify}
              state={state}
              maxLength={15}
              canVerify={!!props.gstin && props.gstin.length === 15}
              helperText="Enter the 15-character GSTIN and click Verify."
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <OcrUploadAndVerify
              documentType="gst"
              fileLabel="GST Certificate *"
              currentFile={props.gstCertificateFile}
              onFileChange={props.onGstCertificateFileChange}
              onVerifyExtracted={handleOcrVerify}
              buildComparisonRows={buildRows}
              onVerified={() => { /* state already updated via props */ }}
              vendorId={props.vendorId}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Please download the GST Self-Declaration form, sign it, and upload the signed copy below.
            </AlertDescription>
          </Alert>

          <Button asChild type="button" variant="outline" size="sm">
            <a href="/templates/gst-self-declaration.html" target="_blank" rel="noopener noreferrer" download>
              <Download className="h-4 w-4 mr-2" />
              Download GST Self-Declaration Template
            </a>
          </Button>

          <div className="grid gap-1.5">
            <Label htmlFor="gstDeclarationReason">Reason for non-registration (optional)</Label>
            <Textarea
              id="gstDeclarationReason"
              value={props.gstDeclarationReason}
              onChange={(e) => props.onGstDeclarationReasonChange(e.target.value)}
              placeholder="e.g. Turnover below GST threshold limit"
              rows={2}
            />
          </div>

          <FileUpload
            label="Signed GST Self-Declaration *"
            accept=".pdf,.jpg,.jpeg,.png"
            documentType="gst_self_declaration"
            onFileSelect={props.onGstSelfDeclarationFileChange}
            currentFile={props.gstSelfDeclarationFile}
            vendorId={props.vendorId}
          />
        </div>
      )}
    </div>
  );
}
