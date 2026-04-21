import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Upload, CheckCircle2, Loader2, AlertCircle, FileText, RotateCcw, ShieldCheck, Download, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOcrExtraction, OcrDocumentType } from "@/hooks/useOcrExtraction";
import { OcrComparisonCard } from "@/components/vendor/OcrComparisonCard";

export interface VerifiedDocumentData {
  // Stage 1 — GST gate
  isGstRegistered?: boolean;
  gstDeclarationReason?: string;
  // Yes path
  gst?: {
    gstin: string;
    legalName: string;
    tradeName?: string;
    constitutionOfBusiness?: string;
    principalPlaceOfBusiness?: string;
    address?: string;
    apiName?: string;
    nameMatchScore?: number;
  };
  // No path
  manualLegalName?: string;
  manualAddress?: {
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  gstSelfDeclarationFile?: File | null;

  // Stage 2 — PAN
  pan?: { number: string; holderName: string; apiName?: string; nameMatchScore?: number };

  // Stage 3 — MSME gate
  isMsmeRegistered?: boolean;
  msme?: { udyamNumber: string; enterpriseName: string; enterpriseType?: string; apiName?: string; nameMatchScore?: number };

  // Stage 4 — Bank
  bank?: { accountNumber: string; ifsc: string; bankName: string; branchName?: string; accountHolderName?: string; apiName?: string };
}

interface DocumentVerificationStepProps {
  vendorId?: string;
  initialData?: VerifiedDocumentData;
  onComplete: (data: VerifiedDocumentData) => void;
}

type DocStatus = "idle" | "uploading" | "ocr" | "verifying" | "verified" | "failed";

interface DocState {
  status: DocStatus;
  fileName?: string;
  ocrData?: Record<string, any>;
  apiData?: Record<string, any>;
  nameMatchScore?: number;
  errorMessage?: string;
}

const idleDoc: DocState = { status: "idle" };

function normName(s?: string) {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
}
function nameMatchScore(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined;
  const A = new Set(normName(a));
  const B = new Set(normName(b));
  if (A.size === 0 || B.size === 0) return 0;
  let common = 0;
  A.forEach((t) => { if (B.has(t)) common += 1; });
  return Math.round((common / Math.max(A.size, B.size)) * 100);
}

export function DocumentVerificationStep({
  vendorId,
  initialData,
  onComplete,
}: DocumentVerificationStepProps) {
  const { extractFromFile } = useOcrExtraction();

  // Stage 1: GST
  const [isGstRegistered, setIsGstRegistered] = useState<boolean | null>(
    initialData?.isGstRegistered ?? (initialData?.gst ? true : null),
  );
  const [gstDoc, setGstDoc] = useState<DocState>(
    initialData?.gst
      ? {
          status: "verified",
          ocrData: {
            gstin: initialData.gst.gstin,
            legal_name: initialData.gst.legalName,
            trade_name: initialData.gst.tradeName,
            constitution_of_business: initialData.gst.constitutionOfBusiness,
            principal_place_of_business: initialData.gst.principalPlaceOfBusiness,
            address: initialData.gst.address,
          },
          apiData: { legalName: initialData.gst.apiName },
          nameMatchScore: initialData.gst.nameMatchScore,
        }
      : idleDoc,
  );
  const [editablePrincipalPlace, setEditablePrincipalPlace] = useState<string>(
    initialData?.gst?.principalPlaceOfBusiness || initialData?.gst?.address || "",
  );

  // No-GST path
  const [gstDeclarationFile, setGstDeclarationFile] = useState<File | null>(
    initialData?.gstSelfDeclarationFile ?? null,
  );
  const [gstDeclarationReason, setGstDeclarationReason] = useState<string>(
    initialData?.gstDeclarationReason ?? "",
  );
  const [manualLegalName, setManualLegalName] = useState<string>(initialData?.manualLegalName ?? "");
  const [manualAddress, setManualAddress] = useState({
    address: initialData?.manualAddress?.address ?? "",
    city: initialData?.manualAddress?.city ?? "",
    state: initialData?.manualAddress?.state ?? "",
    pincode: initialData?.manualAddress?.pincode ?? "",
  });

  // Stage 2: PAN
  const [panDoc, setPanDoc] = useState<DocState>(
    initialData?.pan
      ? {
          status: "verified",
          ocrData: { pan_number: initialData.pan.number, holder_name: initialData.pan.holderName },
          apiData: { name: initialData.pan.apiName },
          nameMatchScore: initialData.pan.nameMatchScore,
        }
      : idleDoc,
  );
  const [panCrossCheckError, setPanCrossCheckError] = useState<string | null>(null);

  // Stage 3: MSME
  const [isMsmeRegistered, setIsMsmeRegistered] = useState<boolean | null>(
    initialData?.isMsmeRegistered ?? (initialData?.msme ? true : null),
  );
  const [msmeDoc, setMsmeDoc] = useState<DocState>(
    initialData?.msme
      ? {
          status: "verified",
          ocrData: {
            udyam_number: initialData.msme.udyamNumber,
            enterprise_name: initialData.msme.enterpriseName,
            enterprise_type: initialData.msme.enterpriseType,
          },
          apiData: { name: initialData.msme.apiName },
          nameMatchScore: initialData.msme.nameMatchScore,
        }
      : idleDoc,
  );

  // Stage 4: Bank
  const [bankDoc, setBankDoc] = useState<DocState>(
    initialData?.bank
      ? {
          status: "verified",
          ocrData: {
            account_number: initialData.bank.accountNumber,
            ifsc_code: initialData.bank.ifsc,
            bank_name: initialData.bank.bankName,
            branch_name: initialData.bank.branchName,
            account_holder_name: initialData.bank.accountHolderName,
          },
          apiData: { name: initialData.bank.apiName },
        }
      : idleDoc,
  );

  // ---------- Verification helpers ----------
  const verifyApi = async (kind: OcrDocumentType, ocr: Record<string, any>) => {
    try {
      if (kind === "gst") {
        const { data, error } = await supabase.functions.invoke("validate-gst", {
          body: { gstin: ocr.gstin, name: ocr.legal_name, simulationMode: true },
        });
        if (error || !data?.valid) throw new Error(data?.message || error?.message || "GST verification failed");
        return { ok: true, apiData: data.data, registeredName: data.data?.legalName || data.data?.name };
      }
      if (kind === "pan") {
        const { data, error } = await supabase.functions.invoke("validate-pan", {
          body: { pan: ocr.pan_number, name: ocr.holder_name, simulationMode: true },
        });
        if (error || !data?.valid) throw new Error(data?.message || error?.message || "PAN verification failed");
        return { ok: true, apiData: data.data, registeredName: data.data?.name };
      }
      if (kind === "msme") {
        const { data, error } = await supabase.functions.invoke("validate-msme", {
          body: { msmeNumber: ocr.udyam_number, name: ocr.enterprise_name, simulationMode: true },
        });
        if (error || !data?.valid) throw new Error(data?.message || error?.message || "MSME verification failed");
        return { ok: true, apiData: data.data, registeredName: data.data?.name || data.data?.enterpriseName };
      }
      // cheque -> penny drop
      const { data, error } = await supabase.functions.invoke("validate-penny-drop", {
        body: {
          accountNumber: ocr.account_number,
          ifscCode: ocr.ifsc_code,
          name: ocr.account_holder_name,
          simulationMode: true,
        },
      });
      if (error || !data?.valid) throw new Error(data?.message || error?.message || "Bank verification failed");
      return { ok: true, apiData: data.data, registeredName: data.data?.accountHolderName || data.data?.name };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Verification failed" } as const;
    }
  };

  const runDocFlow = async (
    kind: OcrDocumentType,
    file: File,
    setDoc: (d: DocState) => void,
    afterVerifiedOcrName: () => string | undefined,
    extraValidation?: (ocr: Record<string, any>, apiData: any) => string | null,
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      setDoc({ status: "failed", fileName: file.name, errorMessage: "File must be under 5 MB" });
      return;
    }
    setDoc({ status: "uploading", fileName: file.name });
    setDoc({ status: "ocr", fileName: file.name });
    const ocrRes = await extractFromFile(file, kind, vendorId);
    if (!ocrRes.success || !ocrRes.extracted) {
      setDoc({ status: "failed", fileName: file.name, errorMessage: ocrRes.error || "Could not read document" });
      return;
    }
    const conf = ocrRes.confidence ?? 0;
    if (conf < 0.5) {
      setDoc({ status: "failed", fileName: file.name, ocrData: ocrRes.extracted, errorMessage: "Couldn't read clearly — please upload a sharper scan." });
      return;
    }
    setDoc({ status: "verifying", fileName: file.name, ocrData: ocrRes.extracted });
    const v = await verifyApi(kind, ocrRes.extracted);
    if (!v.ok) {
      setDoc({ status: "failed", fileName: file.name, ocrData: ocrRes.extracted, errorMessage: v.error });
      return;
    }
    const extraErr = extraValidation?.(ocrRes.extracted, v.apiData) ?? null;
    if (extraErr) {
      setDoc({ status: "failed", fileName: file.name, ocrData: ocrRes.extracted, apiData: v.apiData, errorMessage: extraErr });
      return;
    }
    const score = nameMatchScore(afterVerifiedOcrName(), v.registeredName);
    setDoc({
      status: "verified",
      fileName: file.name,
      ocrData: ocrRes.extracted,
      apiData: v.apiData,
      nameMatchScore: score,
    });
  };

  // Effective legal name (used as the cross-check anchor for PAN/MSME/Bank holder)
  const effectiveLegalName = useMemo(() => {
    if (isGstRegistered === true) return gstDoc.ocrData?.legal_name || gstDoc.apiData?.legalName;
    if (isGstRegistered === false) return manualLegalName;
    return undefined;
  }, [isGstRegistered, gstDoc, manualLegalName]);

  // ---------- Stage handlers ----------
  const handleGstUpload = (file: File) =>
    runDocFlow("gst", file, setGstDoc, () => gstDoc.ocrData?.legal_name).then(() => {
      // Pre-fill the editable principal place from latest OCR
      setGstDoc((prev) => {
        const principal = prev.ocrData?.principal_place_of_business || prev.ocrData?.address;
        if (principal && !editablePrincipalPlace) setEditablePrincipalPlace(principal);
        return prev;
      });
    });

  const handlePanUpload = (file: File) =>
    runDocFlow(
      "pan",
      file,
      setPanDoc,
      () => effectiveLegalName,
      (ocr) => {
        // PAN-from-GST cross-check (only when GST path)
        if (isGstRegistered === true && gstDoc.ocrData?.gstin) {
          const panFromGst = String(gstDoc.ocrData.gstin).slice(2, 12).toUpperCase();
          const panOcr = String(ocr.pan_number || "").toUpperCase();
          if (panFromGst.length === 10 && panOcr && panFromGst !== panOcr) {
            setPanCrossCheckError(`PAN on card (${panOcr}) does not match PAN derived from GSTIN (${panFromGst}).`);
            return `PAN on card (${panOcr}) does not match PAN derived from GSTIN (${panFromGst}).`;
          }
        }
        setPanCrossCheckError(null);
        return null;
      },
    );

  const handleMsmeUpload = (file: File) =>
    runDocFlow("msme", file, setMsmeDoc, () => effectiveLegalName);

  const handleBankUpload = (file: File) =>
    runDocFlow("cheque", file, setBankDoc, () => effectiveLegalName);

  // ---------- Stage gating ----------
  const stage1Done =
    isGstRegistered === true
      ? gstDoc.status === "verified"
      : isGstRegistered === false
        ? !!gstDeclarationFile &&
          manualLegalName.trim().length > 1 &&
          manualAddress.address.trim().length > 1 &&
          manualAddress.city.trim().length > 1 &&
          manualAddress.state.trim().length > 1 &&
          manualAddress.pincode.trim().length >= 5
        : false;
  const stage2Done = panDoc.status === "verified" && !panCrossCheckError;
  const stage3Done = isMsmeRegistered === false || (isMsmeRegistered === true && msmeDoc.status === "verified");
  const stage4Done = bankDoc.status === "verified";

  const allDone = stage1Done && stage2Done && stage3Done && stage4Done;
  const completedCount = [stage1Done, stage2Done, stage3Done, stage4Done].filter(Boolean).length;

  const handleContinue = () => {
    const out: VerifiedDocumentData = {
      isGstRegistered: isGstRegistered ?? undefined,
    };

    if (isGstRegistered === true && gstDoc.status === "verified" && gstDoc.ocrData) {
      out.gst = {
        gstin: gstDoc.ocrData.gstin,
        legalName: gstDoc.ocrData.legal_name,
        tradeName: gstDoc.ocrData.trade_name,
        constitutionOfBusiness: gstDoc.ocrData.constitution_of_business,
        principalPlaceOfBusiness: editablePrincipalPlace || gstDoc.ocrData.principal_place_of_business || gstDoc.ocrData.address,
        address: editablePrincipalPlace || gstDoc.ocrData.address || gstDoc.ocrData.principal_place_of_business,
        apiName: gstDoc.apiData?.legalName || gstDoc.apiData?.name,
        nameMatchScore: gstDoc.nameMatchScore,
      };
    } else if (isGstRegistered === false) {
      out.gstDeclarationReason = gstDeclarationReason;
      out.gstSelfDeclarationFile = gstDeclarationFile;
      out.manualLegalName = manualLegalName;
      out.manualAddress = manualAddress;
    }

    if (panDoc.status === "verified" && panDoc.ocrData) {
      out.pan = {
        number: panDoc.ocrData.pan_number,
        holderName: panDoc.ocrData.holder_name,
        apiName: panDoc.apiData?.name,
        nameMatchScore: panDoc.nameMatchScore,
      };
    }

    out.isMsmeRegistered = isMsmeRegistered ?? false;
    if (isMsmeRegistered && msmeDoc.status === "verified" && msmeDoc.ocrData) {
      out.msme = {
        udyamNumber: msmeDoc.ocrData.udyam_number,
        enterpriseName: msmeDoc.ocrData.enterprise_name,
        enterpriseType: msmeDoc.ocrData.enterprise_type,
        apiName: msmeDoc.apiData?.name || msmeDoc.apiData?.enterpriseName,
        nameMatchScore: msmeDoc.nameMatchScore,
      };
    }

    if (bankDoc.status === "verified" && bankDoc.ocrData) {
      out.bank = {
        accountNumber: bankDoc.ocrData.account_number,
        ifsc: bankDoc.ocrData.ifsc_code,
        bankName: bankDoc.ocrData.bank_name,
        branchName: bankDoc.ocrData.branch_name,
        accountHolderName: bankDoc.ocrData.account_holder_name,
        apiName: bankDoc.apiData?.accountHolderName || bankDoc.apiData?.name,
      };
    }

    onComplete(out);
  };

  return (
    <form
      id="step-form"
      onSubmit={(e) => { e.preventDefault(); if (allDone) handleContinue(); }}
      className="space-y-6"
    >
      {/* Banner */}
      <Alert className={cn("border", allDone ? "border-success bg-success/10" : "border-warning bg-warning/10")}>
        <ShieldCheck className={cn("h-4 w-4", allDone ? "text-success" : "text-warning")} />
        <AlertDescription className="font-medium">
          {allDone
            ? "All required checks passed. You can continue to the next step."
            : `${completedCount} of 4 stages complete. Finish each stage in order to continue.`}
        </AlertDescription>
      </Alert>

      {/* STAGE 1 — GST */}
      <StageCard
        index={1}
        title="GST Registration"
        subtitle="Tell us about your GST status"
        done={stage1Done}
        unlocked
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Are you GST registered?</Label>
            <RadioGroup
              value={isGstRegistered === null ? "" : isGstRegistered ? "yes" : "no"}
              onValueChange={(v) => setIsGstRegistered(v === "yes")}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="gst-yes" />
                <Label htmlFor="gst-yes" className="cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="gst-no" />
                <Label htmlFor="gst-no" className="cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>

          {isGstRegistered === true && (
            <UploadBox
              label="GST Certificate"
              accept=".pdf,.jpg,.jpeg,.png"
              state={gstDoc}
              onUpload={handleGstUpload}
              onReset={() => setGstDoc(idleDoc)}
              statusText={{ uploading: "Uploading…", ocr: "Reading GST certificate…", verifying: "Verifying with GST API…" }}
              successContent={
                <div className="space-y-3">
                  <OcrComparisonCard
                    rows={[
                      { label: "GSTIN", ocrValue: gstDoc.ocrData?.gstin, apiValue: gstDoc.apiData?.gstin ?? gstDoc.ocrData?.gstin },
                      { label: "Legal Name", ocrValue: gstDoc.ocrData?.legal_name, apiValue: gstDoc.apiData?.legalName ?? gstDoc.apiData?.name },
                      { label: "Trade Name", ocrValue: gstDoc.ocrData?.trade_name, apiValue: gstDoc.apiData?.tradeName },
                      { label: "Constitution", ocrValue: gstDoc.ocrData?.constitution_of_business, apiValue: gstDoc.apiData?.constitutionOfBusiness },
                    ]}
                    nameMatchScore={gstDoc.nameMatchScore}
                  />
                  <div>
                    <Label htmlFor="principal-place" className="text-xs font-medium">
                      Principal Place of Business <span className="text-muted-foreground">(editable)</span>
                    </Label>
                    <Input
                      id="principal-place"
                      value={editablePrincipalPlace}
                      onChange={(e) => setEditablePrincipalPlace(e.target.value)}
                      placeholder="As per GST certificate"
                      className="mt-1"
                    />
                  </div>
                </div>
              }
            />
          )}

          {isGstRegistered === false && (
            <div className="space-y-3 rounded-md border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">GST Self-Declaration</p>
                  <p className="text-xs text-muted-foreground">Download the template, sign it, and upload the signed copy.</p>
                </div>
                <a
                  href="/templates/gst-self-declaration.html"
                  download
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>

              <div>
                <Label className="text-xs font-medium">Reason for non-registration</Label>
                <Input
                  value={gstDeclarationReason}
                  onChange={(e) => setGstDeclarationReason(e.target.value)}
                  placeholder="e.g. Turnover below threshold"
                  className="mt-1"
                />
              </div>

              <FilePicker
                label="Signed declaration"
                file={gstDeclarationFile}
                onPick={setGstDeclarationFile}
                accept=".pdf,.jpg,.jpeg,.png"
              />

              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <Field label="Legal Name *" value={manualLegalName} onChange={setManualLegalName} placeholder="Registered name of the entity" />
                <Field label="Address *" value={manualAddress.address} onChange={(v) => setManualAddress((p) => ({ ...p, address: v }))} placeholder="Street, area" />
                <Field label="City *" value={manualAddress.city} onChange={(v) => setManualAddress((p) => ({ ...p, city: v }))} />
                <Field label="State *" value={manualAddress.state} onChange={(v) => setManualAddress((p) => ({ ...p, state: v }))} />
                <Field label="Pincode *" value={manualAddress.pincode} onChange={(v) => setManualAddress((p) => ({ ...p, pincode: v }))} />
              </div>
            </div>
          )}
        </div>
      </StageCard>

      {/* STAGE 2 — PAN */}
      <StageCard
        index={2}
        title="PAN Verification"
        subtitle="Upload PAN card for the entity"
        done={stage2Done}
        unlocked={stage1Done}
      >
        {stage1Done ? (
          <UploadBox
            label="PAN Card"
            accept=".pdf,.jpg,.jpeg,.png"
            state={panDoc}
            onUpload={handlePanUpload}
            onReset={() => { setPanDoc(idleDoc); setPanCrossCheckError(null); }}
            statusText={{ uploading: "Uploading…", ocr: "Reading PAN card…", verifying: "Verifying with PAN API…" }}
            extraError={panCrossCheckError}
            successContent={
              <OcrComparisonCard
                rows={[
                  { label: "PAN Number", ocrValue: panDoc.ocrData?.pan_number, apiValue: panDoc.apiData?.pan ?? panDoc.ocrData?.pan_number },
                  { label: "Holder Name", ocrValue: panDoc.ocrData?.holder_name, apiValue: panDoc.apiData?.name },
                  ...(effectiveLegalName ? [{ label: "Cross-check vs Legal Name", ocrValue: panDoc.ocrData?.holder_name, apiValue: effectiveLegalName }] : []),
                ]}
                nameMatchScore={panDoc.nameMatchScore}
              />
            }
          />
        ) : (
          <LockedHint>Complete Stage 1 to unlock PAN upload.</LockedHint>
        )}
      </StageCard>

      {/* STAGE 3 — MSME */}
      <StageCard
        index={3}
        title="MSME / Udyam Registration"
        subtitle="Optional — only if you are MSME registered"
        done={stage3Done}
        unlocked={stage2Done}
      >
        {stage2Done ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Are you MSME / Udyam registered?</Label>
              <RadioGroup
                value={isMsmeRegistered === null ? "" : isMsmeRegistered ? "yes" : "no"}
                onValueChange={(v) => setIsMsmeRegistered(v === "yes")}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="msme-yes" />
                  <Label htmlFor="msme-yes" className="cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="msme-no" />
                  <Label htmlFor="msme-no" className="cursor-pointer">No, skip</Label>
                </div>
              </RadioGroup>
            </div>

            {isMsmeRegistered === true && (
              <UploadBox
                label="Udyam Certificate"
                accept=".pdf,.jpg,.jpeg,.png"
                state={msmeDoc}
                onUpload={handleMsmeUpload}
                onReset={() => setMsmeDoc(idleDoc)}
                statusText={{ uploading: "Uploading…", ocr: "Reading Udyam certificate…", verifying: "Verifying with MSME API…" }}
                successContent={
                  <OcrComparisonCard
                    rows={[
                      { label: "Udyam No.", ocrValue: msmeDoc.ocrData?.udyam_number, apiValue: msmeDoc.apiData?.udyamNumber ?? msmeDoc.ocrData?.udyam_number },
                      { label: "Enterprise", ocrValue: msmeDoc.ocrData?.enterprise_name, apiValue: msmeDoc.apiData?.enterpriseName ?? msmeDoc.apiData?.name },
                      { label: "Type", ocrValue: msmeDoc.ocrData?.enterprise_type, apiValue: msmeDoc.apiData?.enterpriseType },
                    ]}
                    nameMatchScore={msmeDoc.nameMatchScore}
                  />
                }
              />
            )}
          </div>
        ) : (
          <LockedHint>Complete Stage 2 to unlock MSME stage.</LockedHint>
        )}
      </StageCard>

      {/* STAGE 4 — Bank */}
      <StageCard
        index={4}
        title="Bank Verification"
        subtitle="Cancelled cheque + penny-drop validation"
        done={stage4Done}
        unlocked={stage3Done}
      >
        {stage3Done ? (
          <UploadBox
            label="Cancelled Cheque"
            accept=".pdf,.jpg,.jpeg,.png"
            state={bankDoc}
            onUpload={handleBankUpload}
            onReset={() => setBankDoc(idleDoc)}
            statusText={{ uploading: "Uploading…", ocr: "Reading cheque…", verifying: "Running penny-drop verification…" }}
            successContent={
              <OcrComparisonCard
                rows={[
                  { label: "Account No.", ocrValue: bankDoc.ocrData?.account_number, apiValue: bankDoc.apiData?.accountNumber ?? bankDoc.ocrData?.account_number },
                  { label: "IFSC", ocrValue: bankDoc.ocrData?.ifsc_code, apiValue: bankDoc.apiData?.ifsc ?? bankDoc.apiData?.ifscCode ?? bankDoc.ocrData?.ifsc_code },
                  { label: "Bank", ocrValue: bankDoc.ocrData?.bank_name, apiValue: bankDoc.apiData?.bankName ?? bankDoc.ocrData?.bank_name },
                  { label: "Holder", ocrValue: bankDoc.ocrData?.account_holder_name, apiValue: bankDoc.apiData?.accountHolderName ?? bankDoc.apiData?.name },
                  ...(effectiveLegalName ? [{ label: "Cross-check vs Legal Name", ocrValue: bankDoc.ocrData?.account_holder_name, apiValue: effectiveLegalName }] : []),
                ]}
              />
            }
          />
        ) : (
          <LockedHint>Complete Stage 3 to unlock Bank verification.</LockedHint>
        )}
      </StageCard>
    </form>
  );
}

// ---------- Sub-components ----------

interface StageCardProps {
  index: number;
  title: string;
  subtitle: string;
  done: boolean;
  unlocked: boolean;
  children: React.ReactNode;
}
function StageCard({ index, title, subtitle, done, unlocked, children }: StageCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-colors",
        done && "border-success",
        !unlocked && "opacity-70",
      )}
    >
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2 bg-muted/20">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold",
              done ? "bg-success text-success-foreground" : unlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {done ? <CheckCircle2 className="h-4 w-4" /> : index}
          </div>
          <div>
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {!unlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function LockedHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
      <Lock className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

interface UploadBoxProps {
  label: string;
  accept: string;
  state: DocState;
  onUpload: (f: File) => void;
  onReset: () => void;
  statusText: Record<"uploading" | "ocr" | "verifying", string>;
  successContent: React.ReactNode;
  extraError?: string | null;
}
function UploadBox({ label, accept, state, onUpload, onReset, statusText, successContent, extraError }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = state.status === "uploading" || state.status === "ocr" || state.status === "verifying";
  const isVerified = state.status === "verified";
  const isFailed = state.status === "failed";

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onUpload(f);
  }, [onUpload]);

  return (
    <div className="space-y-3">
      {state.status === "idle" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="w-full border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30 rounded-md p-6 flex flex-col items-center justify-center gap-2 transition-colors"
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Drop {label.toLowerCase()} or click to browse</span>
          <span className="text-xs text-muted-foreground">PDF, JPG, PNG up to 5 MB</span>
        </button>
      )}

      {isBusy && (
        <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-md">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {state.status === "uploading" && statusText.uploading}
              {state.status === "ocr" && statusText.ocr}
              {state.status === "verifying" && statusText.verifying}
            </p>
            {state.fileName && <p className="text-xs text-muted-foreground truncate">{state.fileName}</p>}
          </div>
        </div>
      )}

      {isFailed && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{state.errorMessage}</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onReset}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Re-upload
          </Button>
        </div>
      )}

      {isVerified && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 p-2 bg-success/10 border border-success/30 rounded-md text-success text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Verified</span>
              {state.fileName && <span className="text-xs text-muted-foreground truncate">· {state.fileName}</span>}
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={onReset} className="h-7 px-2 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              Re-upload
            </Button>
          </div>
          {extraError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{extraError}</span>
            </div>
          )}
          {successContent}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}

function FilePicker({ label, file, onPick, accept }: { label: string; file: File | null; onPick: (f: File | null) => void; accept: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Label className="text-xs font-medium">{label} *</Label>
      <div className="mt-1 flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          {file ? "Replace file" : "Choose file"}
        </Button>
        {file && (
          <span className="text-xs text-muted-foreground truncate flex-1">{file.name}</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onPick(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs font-medium">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
    </div>
  );
}
