import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CheckCircle2, Pencil, Upload, XCircle } from 'lucide-react';
import { ManualEntryAndVerify } from './ManualEntryAndVerify';
import { OcrUploadAndVerify } from './OcrUploadAndVerify';
import { ApiResponseDetails } from './ApiResponseDetails';
import { useConfiguredKycApi, type KycApiResult } from '@/hooks/useConfiguredKycApi';
import { useProviderVerify } from '@/hooks/useProviderVerify';
import { mergeOcrExtracted } from '@/lib/kycExtract';
import { toastKycResult } from '@/lib/kycToast';
import { fuzzyNameMatch } from '@/lib/nameMatch';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  /** Verified PAN holder name from the PAN tab — used to validate enterprise name. */
  panHolderName?: string;
  /** Verified GST legal name from the GST tab — used to validate enterprise name. */
  gstLegalName?: string;
}

export function MsmeKycTab(props: MsmeKycTabProps) {
  const { callProvider } = useConfiguredKycApi();
  const { state, verify } = useProviderVerify();
  const [mode, setMode] = useState<'manual' | 'upload'>('manual');
  const [manualApiResult, setManualApiResult] = useState<KycApiResult | undefined>();
  const [enterpriseName, setEnterpriseName] = useState<string>('');
  const [enterpriseCheck, setEnterpriseCheck] =
    useState<'idle' | 'gst+pan' | 'gst' | 'pan' | 'failed'>('idle');
  const [mismatchOpen, setMismatchOpen] = useState(false);

  if (props.onStatusChange) {
    props.onStatusChange(props.isMsmeRegistered ? (state.status as any) : 'na');
  }

  // Coerce Surepass `{ value, confidence }` shape to a plain string.
  const pick = (v: any): string => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object' && 'value' in v) return String((v as any).value ?? '');
    return '';
  };

  // Cross-tab name check: enterprise name must match GST Legal Name OR PAN
  // Holder Name. Returns the resolved status + a user-facing message.
  const checkEnterpriseName = (apiName: string): {
    status: 'gst+pan' | 'gst' | 'pan' | 'failed' | 'skipped';
    message: string;
  } => {
    const gst = props.gstLegalName?.trim();
    const pan = props.panHolderName?.trim();
    if (!apiName || (!gst && !pan)) return { status: 'skipped', message: '' };
    const gstOk = gst ? fuzzyNameMatch(apiName, gst) : false;
    const panOk = pan ? fuzzyNameMatch(apiName, pan) : false;
    if (gstOk && panOk) {
      return {
        status: 'gst+pan',
        message: 'Enterprise Name verified with GST Legal Name and PAN Holder Name.',
      };
    }
    if (gstOk) return { status: 'gst', message: 'Enterprise Name matched with GST Legal Name.' };
    if (panOk) return { status: 'pan', message: 'Enterprise Name matched with PAN Holder Name.' };
    return {
      status: 'failed',
      message: 'Enterprise Name does not match with GST Legal Name and PAN Holder Name.',
    };
  };

  const handleManualVerify = async () => {
    setManualApiResult(undefined);
    setEnterpriseCheck('idle');
    setEnterpriseName('');
    const r = await verify({
      providerName: 'MSME',
      label: 'MSME',
      input: { msme: props.msmeNumber, id_number: props.msmeNumber },
      validate: (data) => {
        const apiName = pick(
          data.name_of_enterprise || data.enterprise_name || data.legal_name,
        ).trim();
        setEnterpriseName(apiName);
        const check = checkEnterpriseName(apiName);
        if (check.status === 'failed') {
          setEnterpriseCheck('failed');
          setMismatchOpen(true);
          return { ok: false, message: check.message, data };
        }
        if (check.status !== 'skipped') setEnterpriseCheck(check.status);
        const cat = pick(data.enterprise_type).toLowerCase();
        if (cat === 'micro' || cat === 'small' || cat === 'medium') {
          props.onMsmeCategoryChange?.(cat as any);
        }
        return {
          ok: true,
          message: check.message || `MSME verified — ${apiName || props.msmeNumber}`,
          data,
        };
      },
    });
    setManualApiResult((r as any).apiResult);
    if (r.ok) props.onVerifiedDetails?.(r.data || {});
  };

  const runMsmeOcr = async (file: File) => {
    const r = await callProvider({ providerName: 'MSME_OCR', file });
    toastKycResult('MSME OCR', r);
    if (!r.found && !r.message_code) {
      return { success: false, error: 'MSME OCR provider not configured. Add it in KYC & Validation API Settings.', apiResult: r };
    }
    if (!r.ok) {
      return { success: false, error: r.message || r.message_code || 'MSME OCR failed', apiResult: r };
    }
    return { success: true, extracted: mergeOcrExtracted(r.data, r.raw), apiResult: r };
  };

  const handleOcrVerify = async (extracted: Record<string, any>) => {
    const extractedNum = pick(extracted.udyam_number).toUpperCase().trim();
    if (extractedNum) props.onMsmeNumberChange(extractedNum);
    setEnterpriseCheck('idle');
    setEnterpriseName('');

    let merged: Record<string, any> = { ...extracted };
    if (extractedNum) {
      const verifyRes = await callProvider({
        providerName: 'MSME',
        input: { msme: extractedNum, id_number: extractedNum },
      });
      toastKycResult('MSME', verifyRes);
      if (verifyRes.found && verifyRes.ok && verifyRes.data) {
        merged = { ...merged, ...verifyRes.data };
      }
    }

    const apiName = pick(
      merged.name_of_enterprise || merged.enterprise_name || merged.legal_name,
    ).trim();
    setEnterpriseName(apiName);

    const check = checkEnterpriseName(apiName);
    if (check.status === 'failed') {
      setEnterpriseCheck('failed');
      setMismatchOpen(true);
      return { ok: false, message: check.message, apiData: merged };
    }
    if (check.status !== 'skipped') setEnterpriseCheck(check.status);

    const cat = pick(merged.enterprise_type).toLowerCase();
    if (cat === 'micro' || cat === 'small' || cat === 'medium') {
      props.onMsmeCategoryChange?.(cat as any);
    }
    props.onVerifiedDetails?.(merged);
    return {
      ok: true,
      message: check.message || `MSME verified — ${apiName || extractedNum || 'see API response below'}`,
      apiData: merged,
    };
  };

  const checkMessage = (() => {
    if (enterpriseCheck === 'gst+pan')
      return 'Enterprise Name verified with GST Legal Name and PAN Holder Name.';
    if (enterpriseCheck === 'gst') return 'Enterprise Name matched with GST Legal Name.';
    if (enterpriseCheck === 'pan') return 'Enterprise Name matched with PAN Holder Name.';
    if (enterpriseCheck === 'failed')
      return 'Enterprise Name does not match with GST Legal Name and PAN Holder Name.';
    return '';
  })();

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
            {manualApiResult && (
              <ApiResponseDetails result={manualApiResult} title="MSME verification response" />
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <OcrUploadAndVerify
              documentType="msme"
              fileLabel="MSME / Udyam Certificate *"
              currentFile={props.msmeCertificateFile}
              onFileChange={props.onMsmeCertificateFileChange}
              runOcr={runMsmeOcr}
              onVerifyExtracted={handleOcrVerify}
              apiLabel="MSME"
              onVerified={() => {}}
              vendorId={props.vendorId}
            />
          </TabsContent>
        </Tabs>
      )}

      {props.isMsmeRegistered && enterpriseCheck !== 'idle' && enterpriseName && (
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
            enterpriseCheck === 'failed'
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-success/30 bg-success/5'
          }`}
        >
          {enterpriseCheck === 'failed' ? (
            <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
          )}
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap gap-x-2 items-baseline">
              <span className="text-xs text-muted-foreground">Enterprise Name:</span>
              <span className="font-medium break-words">{enterpriseName}</span>
            </div>
            <div className={enterpriseCheck === 'failed' ? 'text-destructive' : 'text-success'}>
              {checkMessage}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={mismatchOpen} onOpenChange={setMismatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enterprise Name mismatch</AlertDialogTitle>
            <AlertDialogDescription>
              Enterprise Name does not match with GST Legal Name and PAN Holder Name.
              Please re-check your MSME / Udyam certificate and resolve the mismatch
              before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMismatchOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

