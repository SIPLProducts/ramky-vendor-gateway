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
import { mergeOcrExtracted } from '@/lib/kycExtract';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { useProviderVerify } from '@/hooks/useProviderVerify';
import { toastKycResult } from '@/lib/kycToast';

import {
  evaluateCrossNameMatch,
  formatCrossMatchSuccess,
  formatCrossMatchFailure,
} from '@/lib/nameMatch';
import { CheckCircle2, XCircle } from 'lucide-react';

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
  /** Cross-tab refs for name policy (only used if any are already verified). */
  panHolderName?: string;
  msmeEnterpriseName?: string;
  bankAccountHolderName?: string;
}

export function GstKycTab(props: GstKycTabProps) {
  const { callProvider } = useConfiguredKycApi();
  const { state, verify, reset, setState } = useProviderVerify();
  const [mode, setMode] = useState<'manual' | 'upload'>('manual');
  const [legalNameCheck, setLegalNameCheck] =
    useState<'idle' | 'passed' | 'failed' | 'skipped'>('idle');
  const [legalNameCheckMessage, setLegalNameCheckMessage] = useState<string>('');
  const [verifiedLegalName, setVerifiedLegalName] = useState<string>('');

  if (props.onStatusChange) {
    const status = !props.isGstRegistered
      ? (props.gstSelfDeclarationFile ? 'passed' : 'na')
      : state.status;
    props.onStatusChange(status as any);
  }

  // Cross-field name policy: GST Legal Name vs PAN/MSME/Bank verified names.
  // If no other names are verified yet (typical first-tab case), we skip.
  const evalLegalName = (apiName: string) => {
    const r = evaluateCrossNameMatch(apiName, [
      { field: 'PAN Holder Name', value: props.panHolderName },
      { field: 'MSME Enterprise Name', value: props.msmeEnterpriseName },
      { field: 'Bank Account Holder Name', value: props.bankAccountHolderName },
    ]);
    if (r.skipped) return { status: 'skipped' as const, message: '' };
    if (r.passed)
      return { status: 'passed' as const, message: formatCrossMatchSuccess('GST Legal Name', r.matches) };
    return { status: 'failed' as const, message: formatCrossMatchFailure('GST Legal Name', r.best) };
  };

  const handleManualVerify = async () => {
    setLegalNameCheck('idle');
    setLegalNameCheckMessage('');
    setVerifiedLegalName('');
    const r = await verify({
      providerName: 'GST',
      label: 'GST',
      input: { gstin: props.gstin, id_number: props.gstin },
      validate: (data) => {
        const apiName = String(data.legal_name || data.business_name || '').trim();
        setVerifiedLegalName(apiName);
        const check = evalLegalName(apiName);
        setLegalNameCheck(check.status);
        setLegalNameCheckMessage(check.message);
        if (check.status === 'failed') {
          return { ok: false, message: check.message, data };
        }
        return {
          ok: true,
          message: check.message || `GSTIN is verified${apiName ? ` — ${apiName}` : ''}`,
          data,
        };
      },
    });
    if (r.ok) props.onVerifiedDetails?.(r.data || {});
  };

  // Run the admin-configured GST_OCR provider as the "OCR" step.
  // We surface the raw API result so the UI can render exactly what the
  // configured provider returned (no hardcoded field list).
  const runGstOcr = async (file: File) => {
    const r = await callProvider({ providerName: 'GST_OCR', file });
    toastKycResult('GST OCR', r);
    if (!r.found && !r.message_code) {
      return {
        success: false,
        error: 'GST OCR provider not configured. Add it in KYC & Validation API Settings.',
        apiResult: r,
      };
    }
    if (!r.ok) {
      return {
        success: false,
        error: r.message || r.message_code || 'GST OCR failed',
        apiResult: r,
      };
    }
    // Pass whatever the API returned, even if the mapping yielded only some fields.
    return { success: true, extracted: mergeOcrExtracted(r.data, r.raw), apiResult: r };
  };

  // After OCR completes, automatically chain to the GST verification API.
  // Compare the OCR-extracted GSTIN with the verified GSTIN and decide:
  //  - match    -> success "GSTIN is verified"
  //  - mismatch -> failure with both values shown
  //  - OCR blank, API ok -> success "GSTIN populated from registry"
  // Always merge API response over OCR so any fields OCR missed get filled.
  const handleOcrVerify = async (extracted: Record<string, any>) => {
    const ocrGstin = String(extracted.gstin || '').toUpperCase().trim();
    reset();

    // We need a GSTIN to verify against. If OCR didn't read one, we can't
    // chain — surface that clearly to the user.
    if (!ocrGstin || ocrGstin.length !== 15) {
      return {
        ok: false,
        message: 'Could not read a valid 15-character GSTIN from the certificate. Please upload a clearer scan.',
        apiData: extracted,
      };
    }

    // Tentatively reflect OCR value in the form so the user sees what was read.
    props.onGstinChange(ocrGstin);

    const verify = await callProvider({
      providerName: 'GST',
      input: { gstin: ocrGstin, id_number: ocrGstin },
    });
    toastKycResult('GST', verify);

    if (!verify.found) {
      return { ok: false, message: 'GST validation provider not configured. Add it in KYC & Validation API Settings.', apiResult: verify };
    }
    if (!verify.ok || !verify.data) {
      return { ok: false, message: verify.message || 'GST verification failed', apiData: verify.data, apiResult: verify };
    }

    const apiGstin = String(verify.data.gstin || '').toUpperCase().trim();
    const merged: Record<string, any> = { ...extracted, ...verify.data };

    // Mismatch between what OCR read and what the registry actually has.
    if (apiGstin && ocrGstin !== apiGstin) {
      return {
        ok: false,
        message: `GSTIN mismatch: OCR read "${ocrGstin}" but the registry shows "${apiGstin}". Please re-upload a clearer certificate.`,
        apiData: merged,
        apiResult: verify,
      };
    }

    // GST registry is the source of truth for the GSTIN. The Legal Name is
    // additionally cross-checked against any other already-verified names
    // (PAN / MSME / Bank). On a typical first-tab run there are no refs and
    // we simply skip the check.
    const apiName = String(merged.legal_name || merged.business_name || merged.trade_name || '').trim();
    setVerifiedLegalName(apiName);
    const check = evalLegalName(apiName);
    setLegalNameCheck(check.status);
    setLegalNameCheckMessage(check.message);

    if (apiGstin) props.onGstinChange(apiGstin);

    if (check.status === 'failed') {
      // Surface failure via setState so the OCR component renders the error.
      setState({ status: 'failed', message: check.message, data: merged });
      return { ok: false, message: check.message, apiData: merged, apiResult: verify };
    }

    props.onVerifiedDetails?.(merged);
    return {
      ok: true,
      message: check.message || `GSTIN is verified${apiName ? ` — ${apiName}` : ''}`,
      apiData: merged,
      apiResult: verify,
    };
  };

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
              runOcr={runGstOcr}
              skipVerifyPhase
              onVerifyExtracted={handleOcrVerify}
              apiLabel="GST OCR"
              onVerified={() => { /* state already updated via props */ }}
              vendorId={props.vendorId}
            />
          </TabsContent>
        </Tabs>
      ) : null}

      {props.isGstRegistered && legalNameCheck !== 'idle' && legalNameCheck !== 'skipped' && verifiedLegalName && (
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
            legalNameCheck === 'failed'
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-success/30 bg-success/5'
          }`}
        >
          {legalNameCheck === 'failed' ? (
            <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
          )}
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap gap-x-2 items-baseline">
              <span className="text-xs text-muted-foreground">GST Legal Name:</span>
              <span className="font-medium break-words">{verifiedLegalName}</span>
            </div>
            <div className={legalNameCheck === 'failed' ? 'text-destructive' : 'text-success'}>
              {legalNameCheckMessage}
            </div>
          </div>
        </div>
      )}

      {props.isGstRegistered ? null : (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Please download the GST Self-Declaration form, sign it, and upload the signed copy below.
            </AlertDescription>
          </Alert>

          <Button asChild type="button" variant="outline" size="sm">
            <a href="/templates/gst-self-declaration.docx" target="_blank" rel="noopener noreferrer" download>
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
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
