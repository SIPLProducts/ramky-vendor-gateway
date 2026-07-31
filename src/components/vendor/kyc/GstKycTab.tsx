import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, FileText, Pencil, Upload, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/vendor/FileUpload';
import { ManualEntryAndVerify } from './ManualEntryAndVerify';
import { mergeOcrExtracted } from '@/lib/kycExtract';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { useProviderVerify } from '@/hooks/useProviderVerify';
import { toastKycResult } from '@/lib/kycToast';
import { GstFilingStatusTable, normalizeFilingStatus, evaluateGstr1Compliance } from './GstFilingStatusTable';
import { GstDeclarationDialog } from './GstDeclarationDialog';
import { ManualEntryFallbackDialog } from './ManualEntryFallbackDialog';
import { supabase } from '@/integrations/supabase/client';


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
  const [filingStatusRows, setFilingStatusRows] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<{ previousMonthFiled: boolean; declarationRequired: boolean; checkedPeriod: string } | null>(null);
  const [declarationDialogOpen, setDeclarationDialogOpen] = useState(false);
  const [pendingVerifiedData, setPendingVerifiedData] = useState<Record<string, any> | null>(null);
  const [verifiedGstData, setVerifiedGstData] = useState<Record<string, any> | null>(null);
  const [filingChecking, setFilingChecking] = useState(false);
  const [filingChecked, setFilingChecked] = useState(false);
  const [manualFallbackOpen, setManualFallbackOpen] = useState(false);


  const persistGstValidation = async (data: Record<string, any>, message: string) => {
    if (!props.vendorId) return;
    try {
      await supabase
        .from('vendor_validations')
        .delete()
        .eq('vendor_id', props.vendorId)
        .eq('validation_type', 'gst');
      await supabase.from('vendor_validations').insert({
        vendor_id: props.vendorId,
        validation_type: 'gst',
        status: 'passed',
        message,
        details: data,
      });
    } catch (e) {
      console.warn('[GstKycTab] Failed to persist GST validation', e);
    }
  };

  /**
   * Calls the dedicated GST_FILING provider and evaluates compliance.
   * - All last-3-months filed  -> auto-advance to next tab (PAN).
   * - Any missing/not filed    -> open self-declaration dialog; advance only after upload.
   */
  const runFilingStatusCheck = async (baseGstData: Record<string, any>) => {
    const gstin = String(baseGstData?.gstin || props.gstin || '').toUpperCase().trim();
    if (!gstin) return;
    setFilingChecking(true);
    try {
      const r = await callProvider({
        providerName: 'GST_FILING',
        input: { gstin, id_number: gstin },
      });
      // If the dedicated provider isn't configured, fall back to the filing_status
      // that the GST Validation call already returned.
      const filingSrc = r.found && r.ok && r.data
        ? (r.data.filing_status ?? baseGstData.filing_status)
        : baseGstData.filing_status;
      const rows = normalizeFilingStatus(filingSrc);
      setFilingStatusRows(rows);
      setFilingChecked(true);
      const evalRes = evaluateGstr1Compliance(rows);
      setCompliance(evalRes);
      const merged = { ...baseGstData, filing_status: filingSrc };
      if (!evalRes.declarationRequired) {
        props.onVerifiedDetails?.(merged);
        const note = evalRes.previousMonthFiled
          ? `GST verified — GSTR1 filed for ${evalRes.checkedPeriod}`
          : `GST verified — GSTR1 for ${evalRes.checkedPeriod} not yet filed (within grace period, due 11th)`;
        void persistGstValidation(merged, note);
      } else {
        setPendingVerifiedData(merged);
        setDeclarationDialogOpen(true);
      }
    } finally {
      setFilingChecking(false);
    }
  };

  const confirmDeclarationUpload = () => {
    setDeclarationDialogOpen(false);
    if (pendingVerifiedData) {
      props.onVerifiedDetails?.(pendingVerifiedData);
      void persistGstValidation(pendingVerifiedData, 'GST verified (filing declaration uploaded)');
      setPendingVerifiedData(null);
    }
  };

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
    if (r.ok) {
      const data = r.data || {};
      setVerifiedGstData(data);
      void runFilingStatusCheck(data);
    }
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
    let ocrGstin = String(extracted.gstin || '').toUpperCase().trim();
    reset();

    // If OCR couldn't read a 15-char GSTIN from the PDF (common on self-hosted
    // servers where pdf-to-image conversion is flaky), fall back to whatever
    // GSTIN the user has already typed in the manual field. This keeps the
    // verification flow working instead of dead-ending with "upload clearer scan".
    if (!ocrGstin || ocrGstin.length !== 15) {
      const manual = String(props.gstin || '').toUpperCase().trim();
      if (manual.length === 15) {
        ocrGstin = manual;
      } else {
        return {
          ok: false,
          message: 'Could not read GSTIN from the certificate. Please type the 15-character GSTIN in the field above and re-upload, or click Verify after typing.',
          apiData: extracted,
        };
      }
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

    setVerifiedGstData(merged);
    void runFilingStatusCheck(merged);
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
              onOcrFailed={() => setManualFallbackOpen(true)}
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

      {props.isGstRegistered && verifiedGstData && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">GST Filing Status Check</h4>
            </div>
            <div className="flex items-center gap-2">
              {filingChecked && compliance?.previousMonthFiled && (
                <Badge className="bg-success text-success-foreground hover:bg-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  GSTR1 Filed for {compliance.checkedPeriod}
                </Badge>
              )}
              {filingChecked && compliance && !compliance.previousMonthFiled && !compliance.declarationRequired && (
                <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground bg-muted/40">
                  GSTR1 for {compliance.checkedPeriod} not yet filed — within grace period (due 11th)
                </Badge>
              )}
              {filingChecked && compliance?.declarationRequired && (
                <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  GSTR1 for {compliance.checkedPeriod} not filed — declaration required
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => runFilingStatusCheck(verifiedGstData)}
                disabled={filingChecking}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-2 ${filingChecking ? 'animate-spin' : ''}`} />
                {filingChecked ? 'Refresh Filing Status' : 'Check GST Filing Status'}
              </Button>
            </div>
          </div>

          {filingStatusRows.length > 0 ? (
            <GstFilingStatusTable rows={filingStatusRows} limit={3} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {filingChecking
                ? 'Fetching latest filing status from GSTN…'
                : 'Click "Check GST Filing Status" to fetch the last 3 months of returns.'}
            </p>
          )}
        </div>
      )}

      <GstDeclarationDialog
        open={declarationDialogOpen}
        onOpenChange={setDeclarationDialogOpen}
        currentFile={props.gstSelfDeclarationFile}
        onFileChange={props.onGstSelfDeclarationFileChange}
        onConfirm={confirmDeclarationUpload}
        vendorId={props.vendorId}
      />

      <ManualEntryFallbackDialog
        open={manualFallbackOpen}
        onOpenChange={setManualFallbackOpen}
        title="Enter GSTIN manually"
        description="We couldn't read the GST certificate. Type the 15-character GSTIN and we'll validate it against the GST registry."
        label="GSTIN *"
        placeholder="22AAAAA0000A1Z5"
        maxLength={15}
        pattern={/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/}
        initialValue={props.gstin}
        onVerify={async (gstin) => {
          props.onGstinChange(gstin);
          reset();
          const r = await callProvider({ providerName: 'GST', input: { gstin, id_number: gstin } });
          toastKycResult('GST', r);
          if (!r.found) return { ok: false, message: 'GST validation provider not configured.' };
          if (!r.ok || !r.data) return { ok: false, message: r.message || r.message_code || 'GST verification failed' };
          const data = r.data;
          const apiName = String(data.legal_name || data.business_name || data.trade_name || '').trim();
          setVerifiedLegalName(apiName);
          const check = evalLegalName(apiName);
          setLegalNameCheck(check.status);
          setLegalNameCheckMessage(check.message);
          if (check.status === 'failed') {
            setState({ status: 'failed', message: check.message, data });
            return { ok: false, message: check.message };
          }
          const okMsg = check.message || `GSTIN is verified${apiName ? ` — ${apiName}` : ''}`;
          setState({ status: 'passed', message: okMsg, data });
          setVerifiedGstData(data);
          void runFilingStatusCheck(data);
          return { ok: true };
        }}
      />




      {props.isGstRegistered ? null : (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Please download the Non-GST Self-Declaration form, sign it, and upload the signed copy below.
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate('/templates/non-gst-declaration.docx')}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Non-GST Self-Declaration Template
          </Button>


          <FileUpload
            label="Signed Non-GST Self-Declaration *"
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
