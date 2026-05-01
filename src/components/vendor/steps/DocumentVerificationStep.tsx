import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Upload, CheckCircle2, Loader2, AlertCircle, AlertTriangle, FileText, RotateCcw, ShieldCheck, Download, Lock, Clock, Landmark, BadgeCheck, Building2, CreditCard, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { OcrDocumentType } from "@/hooks/useOcrExtraction";
import { useConfiguredKycApi } from "@/hooks/useConfiguredKycApi";
import { toastKycResult } from "@/lib/kycToast";
import { lookupIfsc, isValidIfsc } from "@/lib/ifscLookup";
import { fuzzyNameMatch } from "@/lib/nameMatch";

/**
 * Maps the registration step's document type → the provider_name configured
 * in KYC & Validation API Settings. Keep these in sync with the templates
 * defined in src/pages/KycApiSettings.tsx.
 */
const OCR_PROVIDER_BY_KIND: Record<OcrDocumentType, { provider: string; label: string }> = {
  gst: { provider: "GST_OCR", label: "GST OCR" },
  pan: { provider: "PAN_OCR", label: "PAN OCR" },
  msme: { provider: "MSME_OCR", label: "MSME OCR" },
  cheque: { provider: "BANK_OCR", label: "Bank OCR" },
};

export interface VerifiedDocumentData {
  isGstRegistered?: boolean;
  gstDeclarationReason?: string;
  gst?: {
    gstin: string;
    legalName: string;
    tradeName?: string;
    constitutionOfBusiness?: string;
    principalPlaceOfBusiness?: string;
    address?: string;
    apiName?: string;
    nameMatchScore?: number;
    status?: string;
    registrationDate?: string;
    taxpayerType?: string;
    businessNature?: string[];
    additionalPlaces?: string[];
    jurisdictionCentre?: string;
    jurisdictionState?: string;
  };
  manualLegalName?: string;
  manualAddress?: { address: string; city: string; state: string; pincode: string };
  gstSelfDeclarationFile?: File | null;
  pan?: { number: string; holderName: string; apiName?: string; nameMatchScore?: number };
  isMsmeRegistered?: boolean;
  msme?: { udyamNumber: string; enterpriseName: string; enterpriseType?: string; majorActivity?: string; apiName?: string; nameMatchScore?: number };
  bank?: { accountNumber: string; ifsc: string; bankName: string; branchName?: string; accountHolderName?: string; apiName?: string; accountType?: string; bankAddress?: string };
  // Step-1 uploaded files — lifted so parent draft saves include them
  gstCertificateFile?: File | null;
  panCardFile?: File | null;
  msmeCertificateFile?: File | null;
  cancelledChequeFile?: File | null;
  // Authoritative completion status from the child
  step1Status?: {
    stage1Done: boolean;
    stage2Done: boolean;
    stage3Done: boolean;
    stage4Done: boolean;
    allDone: boolean;
  };
}

interface DocumentVerificationStepProps {
  vendorId?: string;
  initialData?: VerifiedDocumentData;
  onComplete: (data: VerifiedDocumentData) => void;
  onStageChange?: (data: VerifiedDocumentData) => void;
}

type DocStatus = "idle" | "uploading" | "ocr" | "verifying" | "verified" | "failed";
type StageStatus = "pending" | "in-progress" | "verified" | "failed";

interface DocState {
  status: DocStatus;
  fileName?: string;
  fileSize?: number;
  /** The actual uploaded File — lifted to parent so draft save includes it */
  file?: File;
  ocrData?: Record<string, any>;
  /** Original OCR snapshot — used to power the "Edited" badge and "Reset to OCR" link */
  originalOcrData?: Record<string, any>;
  apiData?: Record<string, any>;
  nameMatchScore?: number;
  errorMessage?: string;
  verifiedAt?: number;
  ocrModel?: string;
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

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function timeAgo(ts?: number) {
  if (!ts) return "";
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function friendlyModelName(model?: string): string | undefined {
  if (!model) return undefined;
  const map: Record<string, string> = {
    "google/gemini-2.5-pro": "Gemini 2.5 Pro",
    "google/gemini-2.5-flash": "Gemini 2.5 Flash",
    "google/gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
    "google/gemini-3-flash-preview": "Gemini 3 Flash",
    "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro",
    "openai/gpt-5": "GPT-5",
    "openai/gpt-5-mini": "GPT-5 Mini",
    "openai/gpt-5-nano": "GPT-5 Nano",
  };
  if (map[model]) return map[model];
  // Fallback: take part after "/" and prettify
  const tail = model.includes("/") ? model.split("/")[1] : model;
  return tail
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DocumentVerificationStep({
  vendorId,
  initialData,
  onComplete,
  onStageChange,
}: DocumentVerificationStepProps) {
  // OCR is now exclusively driven by the admin-configured providers in
  // "KYC & Validation API Settings" (see kyc-api-execute edge function).
  // The Gemini-based useOcrExtraction hook has been removed from this flow.
  const { callProvider } = useConfiguredKycApi();

  const extractFromFile = useCallback(
    async (file: File, documentType: OcrDocumentType, _vendorId?: string) => {
      const cfg = OCR_PROVIDER_BY_KIND[documentType];
      const r = await callProvider({ providerName: cfg.provider, file });
      // Surface upstream provider identity + message_code/status_code so it's
      // obvious the call hit the configured provider (not Gemini).
      toastKycResult(cfg.label, r);
      if (!r.found && !r.message_code) {
        return {
          success: false as const,
          error: `${cfg.label} provider not configured. Add it in KYC & Validation API Settings.`,
        };
      }
      if (!r.ok || !r.data || Object.keys(r.data).length === 0) {
        return {
          success: false as const,
          error: r.message || `${cfg.label} failed`,
          extracted: r.data,
        };
      }
      // Normalize PAN OCR shape: Surepass returns full_name, the rest of this
      // component expects holder_name. Alias without losing the original key.
      const extracted: Record<string, any> = { ...r.data };
      if (documentType === "pan") {
        if (extracted.full_name && !extracted.holder_name) extracted.holder_name = extracted.full_name;
      }
      return {
        success: true as const,
        extracted,
        confidence: 1,
        model: r.provider_name || cfg.provider,
      };
    },
    [callProvider],
  );

  // Stage 1: GST
  const [isGstRegistered, setIsGstRegistered] = useState<boolean | null>(
    initialData?.isGstRegistered ?? (initialData?.gst ? true : null),
  );
  const [gstDoc, setGstDoc] = useState<DocState>(() => {
    if (!initialData?.gst) return idleDoc;
    const data = {
      gstin: initialData.gst.gstin,
      legal_name: initialData.gst.legalName,
      trade_name: initialData.gst.tradeName,
      constitution_of_business: initialData.gst.constitutionOfBusiness,
      principal_place_of_business: initialData.gst.principalPlaceOfBusiness,
      address: initialData.gst.address,
      gst_status: initialData.gst.status,
      registration_date: initialData.gst.registrationDate,
      taxpayer_type: initialData.gst.taxpayerType,
      business_nature: initialData.gst.businessNature,
      additional_places: initialData.gst.additionalPlaces,
      jurisdiction_centre: initialData.gst.jurisdictionCentre,
      jurisdiction_state: initialData.gst.jurisdictionState,
    };
    return {
      status: "verified",
      ocrData: data,
      originalOcrData: data,
      apiData: { legalName: initialData.gst.apiName },
      nameMatchScore: initialData.gst.nameMatchScore,
    };
  });
  const [editablePrincipalPlace, setEditablePrincipalPlace] = useState<string>(
    initialData?.gst?.principalPlaceOfBusiness || initialData?.gst?.address || "",
  );

  const [gstDeclarationFile, setGstDeclarationFile] = useState<File | null>(initialData?.gstSelfDeclarationFile ?? null);
  const [gstDeclarationReason, setGstDeclarationReason] = useState<string>(initialData?.gstDeclarationReason ?? "");
  const [manualLegalName, setManualLegalName] = useState<string>(initialData?.manualLegalName ?? "");
  const [manualAddress, setManualAddress] = useState({
    address: initialData?.manualAddress?.address ?? "",
    city: initialData?.manualAddress?.city ?? "",
    state: initialData?.manualAddress?.state ?? "",
    pincode: initialData?.manualAddress?.pincode ?? "",
  });

  // Stage 2: PAN
  const [panDoc, setPanDoc] = useState<DocState>(() => {
    if (!initialData?.pan) return idleDoc;
    const data = { pan_number: initialData.pan.number, holder_name: initialData.pan.holderName };
    return {
      status: "verified",
      ocrData: data,
      originalOcrData: data,
      apiData: { name: initialData.pan.apiName },
      nameMatchScore: initialData.pan.nameMatchScore,
    };
  });
  const [panCrossCheckError, setPanCrossCheckError] = useState<string | null>(null);

  // Stage 3: MSME
  const [isMsmeRegistered, setIsMsmeRegistered] = useState<boolean | null>(
    initialData?.isMsmeRegistered ?? (initialData?.msme ? true : null),
  );
  const [msmeDoc, setMsmeDoc] = useState<DocState>(() => {
    if (!initialData?.msme) return idleDoc;
    const data = {
      udyam_number: initialData.msme.udyamNumber,
      enterprise_name: initialData.msme.enterpriseName,
      enterprise_type: initialData.msme.enterpriseType,
      major_activity: initialData.msme.majorActivity,
    };
    return {
      status: "verified",
      ocrData: data,
      originalOcrData: data,
      apiData: { name: initialData.msme.apiName },
      nameMatchScore: initialData.msme.nameMatchScore,
    };
  });

  // Stage 4: Bank
  const [bankDoc, setBankDoc] = useState<DocState>(() => {
    if (!initialData?.bank) return idleDoc;
    const data = {
      account_number: initialData.bank.accountNumber,
      ifsc_code: initialData.bank.ifsc,
      bank_name: initialData.bank.bankName,
      branch_name: initialData.bank.branchName,
      account_holder_name: initialData.bank.accountHolderName,
    };
    return {
      status: "verified",
      ocrData: data,
      originalOcrData: data,
      apiData: { name: initialData.bank.apiName },
    };
  });
  // Account Type + Bank Address — captured here (not on a cheque) so vendor
  // sets them once, in context, alongside the OCR'd bank values.
  const [bankAccountType, setBankAccountType] = useState<string>(
    initialData?.bank?.accountType || "current",
  );
  const [bankBranchAddress, setBankBranchAddress] = useState<string>(
    initialData?.bank?.bankAddress || "",
  );
  const [bankBranchAutoFilled, setBankBranchAutoFilled] = useState(false);
  const bankAddressTouchedRef = useRef(!!initialData?.bank?.bankAddress);

  // Cross-tab name-mismatch popup. Used for MSME (Enterprise Name vs
  // GST/PAN) and Bank (Account Holder Name vs GST/PAN). The dialog also
  // forces the user back onto the offending tab so they cannot proceed.
  const [mismatchDialog, setMismatchDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  });

  // ---------- Verification ----------
  // For GST, hit the configured `GST` provider (Surepass GSTIN validation).
  // Other kinds still use a lightweight simulation pending real provider wiring.
  const verifyApi = async (kind: OcrDocumentType, ocr: Record<string, any>) => {
    if (kind === "gst") {
      const ocrGstin = String(ocr.gstin || "").toUpperCase().trim();
      if (!ocrGstin || ocrGstin.length !== 15) {
        return {
          ok: false as const,
          message: "Could not read a valid 15-character GSTIN from the certificate. Please upload a clearer scan.",
        };
      }
      const r = await callProvider({
        providerName: "GST",
        input: { id_number: ocrGstin, gstin: ocrGstin },
      });
      toastKycResult("GST", r);
      if (!r.found) {
        return { ok: false as const, message: "GST validation provider is not configured. Add it in KYC & Validation API Settings." };
      }
      if (!r.ok || !r.data) {
        return { ok: false as const, message: r.message || "GST verification failed" };
      }
      const apiGstin = String(r.data.gstin || "").toUpperCase().trim();
      if (apiGstin && apiGstin !== ocrGstin) {
        return {
          ok: false as const,
          message: `GSTIN mismatch: OCR read "${ocrGstin}" but the registry shows "${apiGstin}". Please re-upload a clearer certificate.`,
        };
      }
      const d = r.data as Record<string, any>;
      // Normalize API field names to the keys the UI reads from `ocrData`.
      const normalized: Record<string, any> = {
        gstin: apiGstin || ocrGstin,
        legal_name: d.legal_name,
        trade_name: d.trade_name || d.business_name,
        constitution_of_business: d.constitution_of_business,
        principal_place_of_business: d.address,
        address: d.address,
        gst_status: d.gstin_status || d.gst_status,
        registration_date: d.date_of_registration || d.registration_date,
        taxpayer_type: d.taxpayer_type,
        business_nature: Array.isArray(d.nature_bus_activities)
          ? d.nature_bus_activities
          : (d.nature_of_core_business_activity_description ? [d.nature_of_core_business_activity_description] : undefined),
        jurisdiction_centre: d.center_jurisdiction || d.jurisdiction_centre,
        jurisdiction_state: d.state_jurisdiction || d.jurisdiction_state,
        pan_number: d.pan_number,
      };
      return {
        ok: true as const,
        apiData: {
          legalName: d.legal_name,
          tradeName: d.trade_name || d.business_name,
          gstin: apiGstin || ocrGstin,
          status: d.gstin_status,
          panNumber: d.pan_number,
        },
        normalized,
        registeredName: d.legal_name,
      };
    }
    if (kind === "pan") {
      // PAN is NOT validated against its own registry. We compare the OCR'd
      // PAN number + holder name against the values returned by the GST
      // registry (verified in the previous stage). GST is the source of truth.
      const ocrPan = String(ocr.pan_number || "").toUpperCase().trim();
      const ocrName = String(ocr.full_name || ocr.holder_name || ocr.name || "").trim();
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(ocrPan)) {
        return { ok: false as const, message: "Could not read a valid 10-character PAN. Please upload a clearer scan." };
      }
      const gstPan = String(gstDoc.ocrData?.pan_number || "").toUpperCase().trim();
      const gstLegalName = String(gstDoc.ocrData?.legal_name || "").trim();
      if (!gstPan || !gstLegalName) {
        return {
          ok: false as const,
          message: "Please verify GST first — PAN is validated against the PAN number and legal name returned by the GST registry.",
        };
      }
      const panOk = ocrPan === gstPan;
      const nameOk = fuzzyNameMatch(ocrName, gstLegalName);
      if (!panOk || !nameOk) {
        return { ok: false as const, message: "PAN details do not match with GST data." };
      }
      const normalized: Record<string, any> = {
        pan_number: ocrPan,
        holder_name: ocrName || gstLegalName,
        full_name: ocrName || gstLegalName,
      };
      return {
        ok: true as const,
        apiData: {
          name: gstLegalName,
          pan: gstPan,
          source: "GST registry",
          panMatchMessage: "PAN Number verified with GST PAN Number.",
          nameMatchMessage: "PAN Holder Name verified with GST Legal Name.",
        },
        normalized,
        registeredName: gstLegalName,
      };
    }
    if (kind === "msme") {
      const ocrUdyam = String(ocr.udyam_number || "").toUpperCase().trim();
      // Try to call the configured MSME registry — if not configured or it
      // fails, fall back to the OCR data so the existing flow still works.
      let registry: Record<string, any> = {};
      if (ocrUdyam) {
        const r = await callProvider({
          providerName: "MSME",
          input: { id_number: ocrUdyam, msme: ocrUdyam },
        });
        toastKycResult("MSME", r);
        if (r.found && r.ok && r.data) {
          registry = r.data as Record<string, any>;
        }
      }
      const pickStr = (v: any): string => {
        if (v == null) return "";
        if (typeof v === "string" || typeof v === "number") return String(v);
        if (typeof v === "object" && "value" in v) return String((v as any).value ?? "");
        return "";
      };
      const normalized: Record<string, any> = {
        udyam_number: pickStr(registry.udyam_number) || ocrUdyam || ocr.udyam_number,
        enterprise_name: pickStr(registry.enterprise_name) || ocr.enterprise_name,
        enterprise_type: pickStr(registry.enterprise_type) || ocr.enterprise_type,
        major_activity: pickStr(registry.major_activity) || ocr.major_activity,
        organization_type: pickStr(registry.organization_type) || ocr.organization_type,
        registration_date: pickStr(registry.registration_date) || ocr.registration_date,
        social_category: pickStr(registry.social_category) || ocr.social_category,
        state: pickStr(registry.state) || ocr.state,
        district: pickStr(registry.district) || ocr.district,
        city: pickStr(registry.city) || ocr.city,
        pin_code: pickStr(registry.pin_code) || ocr.pin_code,
        mobile: pickStr(registry.mobile) || ocr.mobile,
        email: pickStr(registry.email) || ocr.email,
      };
      // Cross-check: Enterprise Name MUST match GST Legal Name OR PAN Holder Name.
      // If neither matches (and at least one reference is present), block the
      // step. The exact message is rendered both in the inline error banner
      // and via the modal popup raised in `runDocFlow`.
      const msmeName = String(normalized.enterprise_name || "").trim();
      const gstLegalName = String(gstDoc.ocrData?.legal_name || "").trim();
      const panHolderName = String(
        panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name || "",
      ).trim();
      if (msmeName && (gstLegalName || panHolderName)) {
        const gstOk = gstLegalName ? fuzzyNameMatch(msmeName, gstLegalName) : false;
        const panOk = panHolderName ? fuzzyNameMatch(msmeName, panHolderName) : false;
        if (!gstOk && !panOk) {
          return {
            ok: false as const,
            message:
              "Enterprise Name does not match with GST Legal Name and PAN Holder Name.",
            isNameMismatch: true,
          } as any;
        }
      }
      return {
        ok: true as const,
        apiData: { name: normalized.enterprise_name, enterpriseName: normalized.enterprise_name, udyamNumber: normalized.udyam_number },
        normalized,
        registeredName: normalized.enterprise_name,
      };
    }
    // Bank (cheque) → call configured BANK provider (Surepass penny-drop)
    const ocrAccountRaw = String(ocr.account_number || "").replace(/\s+/g, "");
    const ocrIfscRaw = String(ocr.ifsc_code || "").toUpperCase().trim();
    if (!/^\d{8,18}$/.test(ocrAccountRaw)) {
      return { ok: false as const, message: "Could not read a valid account number from the cheque. Please upload a clearer scan." };
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ocrIfscRaw)) {
      return { ok: false as const, message: "Could not read a valid 11-character IFSC from the cheque. Please upload a clearer scan." };
    }
    const r = await callProvider({
      providerName: "BANK",
      input: { account: ocrAccountRaw, ifsc: ocrIfscRaw, id_number: ocrAccountRaw },
    });
    toastKycResult("Bank", r);
    if (!r.found) {
      return { ok: false as const, message: "Bank validation provider is not configured. Add it in KYC & Validation API Settings." };
    }
    if (!r.ok || !r.data) {
      return { ok: false as const, message: r.message || "Bank verification failed. Please check the details or try again." };
    }
    const d = r.data as Record<string, any>;
    if (d.account_exists === false) {
      return { ok: false as const, message: "Bank account not found at the bank. Please check the cheque details." };
    }
    const apiAccount = String(d.account_number || "").replace(/\s+/g, "");
    const apiIfsc = String(d.ifsc || "").toUpperCase().trim();
    if (apiAccount && apiAccount !== ocrAccountRaw) {
      return { ok: false as const, message: `Bank details mismatch: cheque shows account ending "${ocrAccountRaw.slice(-4)}" but registry returned "${apiAccount.slice(-4)}".` };
    }
    if (apiIfsc && apiIfsc !== ocrIfscRaw) {
      return { ok: false as const, message: `IFSC mismatch: cheque shows "${ocrIfscRaw}" but registry returned "${apiIfsc}".` };
    }
    // Account holder name comes back as either `full_name` or `name_at_bank`
    // depending on the upstream provider. Accept both.
    const nameAtBank = String(d.full_name || d.name_at_bank || "").trim();

    // Compare account holder name against verified GST Legal Name + PAN Holder
    // Name (both higher-trust than the user's typed legalName).
    const gstLegalName = String(gstDoc.ocrData?.legal_name || "").trim();
    const panHolderName = String(
      panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name || "",
    ).trim();
    let holderNameStatus: "gst+pan" | "gst" | "pan" | "none" | "skipped" = "skipped";
    let holderNameMessage = "";
    if (nameAtBank && (gstLegalName || panHolderName)) {
      const gstOk = gstLegalName ? fuzzyNameMatch(nameAtBank, gstLegalName) : false;
      const panOk = panHolderName ? fuzzyNameMatch(nameAtBank, panHolderName) : false;
      if (gstOk && panOk) {
        holderNameStatus = "gst+pan";
        holderNameMessage = "Account Holder Name verified with GST Legal Name and PAN Holder Name.";
      } else if (gstOk) {
        holderNameStatus = "gst";
        holderNameMessage = "Account Holder Name matched with GST Legal Name.";
      } else if (panOk) {
        holderNameStatus = "pan";
        holderNameMessage = "Account Holder Name matched with PAN Holder Name.";
      } else {
        holderNameStatus = "none";
        return {
          ok: false as const,
          message:
            "Account Holder Name does not match with GST Legal Name and PAN Holder Name.",
        };
      }
    }

    const normalized: Record<string, any> = {
      account_number: apiAccount || ocrAccountRaw,
      ifsc_code: apiIfsc || ocrIfscRaw,
      bank_name: d.bank_name,
      branch_name: d.branch_name,
      account_holder_name: nameAtBank || ocr.account_holder_name,
      branch_address: d.branch_address,
      branch_city: d.branch_city,
      branch_state: d.branch_state,
      micr: d.micr,
    };
    return {
      ok: true as const,
      apiData: {
        accountHolderName: nameAtBank,
        bankName: d.bank_name,
        branchName: d.branch_name,
        ifsc: apiIfsc || ocrIfscRaw,
        accountNumber: apiAccount || ocrAccountRaw,
        bankAddress: d.branch_address,
        accountExists: d.account_exists,
        impsRefNo: d.imps_ref_no,
        holderNameStatus,
        holderNameMessage,
      },
      normalized,
      registeredName: nameAtBank || ocr.account_holder_name,
    };
  };

  const runDocFlow = async (
    kind: OcrDocumentType,
    file: File,
    setDoc: (d: DocState) => void,
    afterVerifiedOcrName: () => string | undefined,
    extraValidation?: (ocr: Record<string, any>, apiData: any) => string | null,
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, errorMessage: "File must be under 5 MB" });
      return;
    }
    setDoc({ status: "uploading", fileName: file.name, fileSize: file.size });
    setDoc({ status: "ocr", fileName: file.name, fileSize: file.size });
    const ocrRes = await extractFromFile(file, kind, vendorId);
    if (!ocrRes.success || !ocrRes.extracted) {
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, errorMessage: ocrRes.error || "Could not read document" });
      return;
    }
    const conf = ocrRes.confidence ?? 0;
    if (conf < 0.5) {
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, ocrData: ocrRes.extracted, errorMessage: "Couldn't read clearly — please upload a sharper scan." });
      return;
    }
    setDoc({ status: "verifying", fileName: file.name, fileSize: file.size, ocrData: ocrRes.extracted, ocrModel: ocrRes.model });
    const v = await verifyApi(kind, ocrRes.extracted);
    if (!v.ok) {
      const msg = (v as any).message || "Verification failed";
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, ocrData: ocrRes.extracted, ocrModel: ocrRes.model, errorMessage: msg });
      // Surface a hard popup for cross-tab name mismatches and force the
      // user back onto the offending tab so they cannot navigate forward.
      if (kind === "msme" && (v as any).isNameMismatch) {
        setMismatchDialog({ open: true, title: "Enterprise Name mismatch", message: msg });
        setActiveTab("msme");
      } else if (kind === "cheque" && /Account Holder Name does not match/i.test(msg)) {
        setMismatchDialog({ open: true, title: "Account Holder Name mismatch", message: msg });
        setActiveTab("bank");
      }
      return;
    }
    const extraErr = extraValidation?.(ocrRes.extracted, v.apiData) ?? null;
    if (extraErr) {
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, ocrData: ocrRes.extracted, apiData: v.apiData, ocrModel: ocrRes.model, errorMessage: extraErr });
      return;
    }
    // Merge normalized API fields over OCR so missing/incorrect OCR values are
    // auto-filled from the registry response (GST flow). For other kinds,
    // `normalized` is undefined and we keep the OCR data as-is.
    const merged = (v as any).normalized
      ? { ...ocrRes.extracted, ...(v as any).normalized }
      : ocrRes.extracted;
    const score = nameMatchScore(afterVerifiedOcrName(), v.registeredName);
    setDoc({
      status: "verified",
      fileName: file.name,
      fileSize: file.size,
      file,
      ocrData: merged,
      originalOcrData: ocrRes.extracted,
      // Attach the normalized snake_case registry payload so verified panels
      // can compare each field against what the validation API returned.
      apiData: { ...(v.apiData || {}), normalized: (v as any).normalized },
      nameMatchScore: score,
      verifiedAt: Date.now(),
      ocrModel: ocrRes.model,
    });
  };

  // Mutate a single OCR field on a verified doc — used by EditableOcrField for manual corrections.
  const setOcrField = useCallback(
    (setDoc: React.Dispatch<React.SetStateAction<DocState>>, key: string, value: any) => {
      setDoc((prev) => ({
        ...prev,
        ocrData: { ...(prev.ocrData || {}), [key]: value },
      }));
    },
    [],
  );

  const effectiveLegalName = useMemo(() => {
    if (isGstRegistered === true) return gstDoc.ocrData?.legal_name || gstDoc.apiData?.legalName;
    if (isGstRegistered === false) return manualLegalName;
    return undefined;
  }, [isGstRegistered, gstDoc, manualLegalName]);

  const handleGstUpload = (file: File) =>
    runDocFlow("gst", file, setGstDoc, () => gstDoc.ocrData?.legal_name).then(() => {
      setGstDoc((prev) => {
        const principal = prev.ocrData?.principal_place_of_business || prev.ocrData?.address;
        if (principal && !editablePrincipalPlace) setEditablePrincipalPlace(principal);
        return prev;
      });
    });

  const handlePanUpload = (file: File) =>
    runDocFlow("pan", file, setPanDoc, () => effectiveLegalName, (ocr) => {
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
    });

  const handleMsmeUpload = (file: File) => runDocFlow("msme", file, setMsmeDoc, () => effectiveLegalName);

  // ----- MSME Manual Entry (Udyam Number → MSME validation API) -----
  const [msmeMode, setMsmeMode] = useState<"manual" | "upload">("manual");
  const [msmeManualNumber, setMsmeManualNumber] = useState<string>("");
  const [msmeManualBusy, setMsmeManualBusy] = useState(false);
  const [msmeManualError, setMsmeManualError] = useState<string | null>(null);

  const pickValue = (v: any): string => {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (typeof v === "object" && "value" in v) return String((v as any).value ?? "");
    return "";
  };

  const handleMsmeManualValidate = async () => {
    const num = msmeManualNumber.trim().toUpperCase();
    if (!num) {
      setMsmeManualError("Please enter your Udyam number.");
      return;
    }
    setMsmeManualError(null);
    setMsmeManualBusy(true);
    setMsmeDoc({ status: "verifying", fileName: undefined, fileSize: undefined });
    try {
      const r = await callProvider({
        providerName: "MSME",
        input: { id_number: num, msme: num },
      });
      toastKycResult("MSME", r);
      if (!r.found) {
        const msg = "MSME validation provider is not configured. Add it in KYC & Validation API Settings.";
        setMsmeManualError(msg);
        setMsmeDoc({ status: "failed", errorMessage: msg });
        return;
      }
      if (!r.ok || !r.data) {
        const msg = r.message || "Udyam validation failed. Please check the number and try again.";
        setMsmeManualError(msg);
        setMsmeDoc({ status: "failed", errorMessage: msg });
        return;
      }
      const d = r.data as Record<string, any>;
      const ocrShape = {
        udyam_number: pickValue(d.udyam_number) || num,
        enterprise_name: pickValue(d.enterprise_name || d.legal_name),
        enterprise_type: pickValue(d.enterprise_type),
        major_activity: pickValue(d.major_activity),
        organization_type: pickValue(d.organization_type),
        registration_date: pickValue(d.registration_date),
        social_category: pickValue(d.social_category),
        state: pickValue(d.state),
        district: pickValue(d.district),
        city: pickValue(d.city),
        pin_code: pickValue(d.pin_code),
        mobile: pickValue(d.mobile),
        email: pickValue(d.email),
        nic_code: pickValue(d.nic_5_digit) || pickValue(d.nic_4_digit) || pickValue(d.nic_2_digit),
      };
      const apiName = ocrShape.enterprise_name;
      // Cross-tab gate: enterprise name must match GST Legal Name OR PAN Holder Name.
      const gstLegalName = String(gstDoc.ocrData?.legal_name || "").trim();
      const panHolderName = String(
        panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name || "",
      ).trim();
      if (apiName && (gstLegalName || panHolderName)) {
        const gstOk = gstLegalName ? fuzzyNameMatch(apiName, gstLegalName) : false;
        const panOk = panHolderName ? fuzzyNameMatch(apiName, panHolderName) : false;
        if (!gstOk && !panOk) {
          const msg = "Enterprise Name does not match with GST Legal Name and PAN Holder Name.";
          setMsmeManualError(msg);
          setMsmeDoc({ status: "failed", errorMessage: msg, ocrData: ocrShape });
          setMismatchDialog({ open: true, title: "Enterprise Name mismatch", message: msg });
          setActiveTab("msme");
          return;
        }
      }
      const score = nameMatchScore(effectiveLegalName, apiName);
      setMsmeDoc({
        status: "verified",
        fileName: `Udyam ${ocrShape.udyam_number}`,
        ocrData: ocrShape,
        originalOcrData: ocrShape,
        apiData: { name: apiName, enterpriseName: apiName, udyamNumber: ocrShape.udyam_number, normalized: { ...ocrShape } },
        nameMatchScore: score,
        verifiedAt: Date.now(),
      });
    } catch (e: any) {
      const msg = e?.message || "Udyam validation failed unexpectedly.";
      setMsmeManualError(msg);
      setMsmeDoc({ status: "failed", errorMessage: msg });
    } finally {
      setMsmeManualBusy(false);
    }
  };

  const handleBankUpload = (file: File) =>
    runDocFlow("cheque", file, setBankDoc, () => effectiveLegalName).then(async () => {
      // After cheque OCR, fill Branch (and Bank Name / Address) from IFSC if missing.
      setBankDoc((prev) => {
        const ifsc = prev.ocrData?.ifsc_code;
        const hasBranch = !!(prev.ocrData?.branch_name && String(prev.ocrData.branch_name).trim());
        if (!isValidIfsc(ifsc) || hasBranch) return prev;
        // Fire & forget the lookup, then patch.
        lookupIfsc(ifsc).then((info) => {
          if (!info) return;
          setBankDoc((curr) => {
            const next = { ...(curr.ocrData || {}) };
            let touched = false;
            if (info.branch && !next.branch_name) { next.branch_name = info.branch; touched = true; }
            if (info.bank && !next.bank_name) { next.bank_name = info.bank; }
            if (touched) setBankBranchAutoFilled(true);
            return { ...curr, ocrData: next };
          });
          if (info.address && !bankAddressTouchedRef.current) {
            setBankBranchAddress(info.address);
          }
        });
        return prev;
      });
    });

  // When the user manually edits the IFSC code (and Branch is blank), look it up.
  useEffect(() => {
    const ifsc = bankDoc.ocrData?.ifsc_code;
    const hasBranch = !!(bankDoc.ocrData?.branch_name && String(bankDoc.ocrData.branch_name).trim());
    if (!isValidIfsc(ifsc) || hasBranch) return;
    const t = setTimeout(async () => {
      const info = await lookupIfsc(ifsc!);
      if (!info) return;
      setBankDoc((curr) => {
        const next = { ...(curr.ocrData || {}) };
        let touched = false;
        if (info.branch && !next.branch_name) { next.branch_name = info.branch; touched = true; }
        if (info.bank && !next.bank_name) { next.bank_name = info.bank; }
        if (touched) setBankBranchAutoFilled(true);
        return { ...curr, ocrData: next };
      });
      if (info.address && !bankAddressTouchedRef.current) {
        setBankBranchAddress(info.address);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [bankDoc.ocrData?.ifsc_code, bankDoc.ocrData?.branch_name]);

  // Re-run PAN ↔ GSTIN cross-check live whenever the user corrects either OCR field.
  useEffect(() => {
    if (panDoc.status !== "verified" || isGstRegistered !== true) {
      setPanCrossCheckError(null);
      return;
    }
    const gstin = gstDoc.ocrData?.gstin;
    const panOcr = String(panDoc.ocrData?.pan_number || "").toUpperCase();
    if (!gstin || !panOcr) {
      setPanCrossCheckError(null);
      return;
    }
    const panFromGst = String(gstin).slice(2, 12).toUpperCase();
    if (panFromGst.length === 10 && panFromGst !== panOcr) {
      setPanCrossCheckError(`PAN on card (${panOcr}) does not match PAN derived from GSTIN (${panFromGst}).`);
    } else {
      setPanCrossCheckError(null);
    }
  }, [panDoc.status, panDoc.ocrData?.pan_number, gstDoc.ocrData?.gstin, isGstRegistered]);

  // Re-compute name-match scores live as user corrects names.
  useEffect(() => {
    if (panDoc.status !== "verified") return;
    const score = nameMatchScore(effectiveLegalName, panDoc.ocrData?.holder_name);
    setPanDoc((p) => (p.nameMatchScore === score ? p : { ...p, nameMatchScore: score }));
  }, [panDoc.status, panDoc.ocrData?.holder_name, effectiveLegalName]);

  useEffect(() => {
    if (msmeDoc.status !== "verified") return;
    const score = nameMatchScore(effectiveLegalName, msmeDoc.ocrData?.enterprise_name);
    setMsmeDoc((p) => (p.nameMatchScore === score ? p : { ...p, nameMatchScore: score }));
  }, [msmeDoc.status, msmeDoc.ocrData?.enterprise_name, effectiveLegalName]);

  // Silent backfill: older drafts may have MSME OCR data without `major_activity`
  // (the field was added later). If the original certificate file is still in
  // memory, re-run OCR in the background and merge the missing field.
  const msmeBackfillTriedRef = useRef(false);
  useEffect(() => {
    if (msmeBackfillTriedRef.current) return;
    if (msmeDoc.status !== "verified") return;
    if (!msmeDoc.file) return;
    if (msmeDoc.ocrData?.major_activity) return;
    msmeBackfillTriedRef.current = true;
    (async () => {
      try {
        const res = await extractFromFile(msmeDoc.file as File, "msme", vendorId);
        const ma = res?.extracted?.major_activity;
        if (!ma) return;
        setMsmeDoc((p) => ({
          ...p,
          ocrData: { ...(p.ocrData || {}), major_activity: ma },
          originalOcrData: { ...(p.originalOcrData || {}), major_activity: ma },
        }));
      } catch {
        // silent — user can still type it manually
      }
    })();
  }, [msmeDoc.status, msmeDoc.file, msmeDoc.ocrData?.major_activity, extractFromFile, vendorId]);

  useEffect(() => {
    if (gstDoc.status !== "verified") return;
    const score = nameMatchScore(gstDoc.ocrData?.legal_name, gstDoc.apiData?.legalName);
    setGstDoc((p) => (p.nameMatchScore === score ? p : { ...p, nameMatchScore: score }));
  }, [gstDoc.status, gstDoc.ocrData?.legal_name, gstDoc.apiData?.legalName]);

  // ---------- Gating ----------
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

  const buildOutput = useCallback((): VerifiedDocumentData => {
    const out: VerifiedDocumentData = { isGstRegistered: isGstRegistered ?? undefined };
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
        status: gstDoc.ocrData.gst_status,
        registrationDate: gstDoc.ocrData.registration_date,
        taxpayerType: gstDoc.ocrData.taxpayer_type,
        businessNature: Array.isArray(gstDoc.ocrData.business_nature) ? gstDoc.ocrData.business_nature : undefined,
        additionalPlaces: Array.isArray(gstDoc.ocrData.additional_places) ? gstDoc.ocrData.additional_places : undefined,
        jurisdictionCentre: gstDoc.ocrData.jurisdiction_centre,
        jurisdictionState: gstDoc.ocrData.jurisdiction_state,
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
        majorActivity: msmeDoc.ocrData.major_activity,
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
        accountType: bankAccountType,
        bankAddress: bankBranchAddress,
      };
    }
    // Lift uploaded files so the parent can persist them in the draft
    out.gstCertificateFile = gstDoc.file ?? null;
    out.panCardFile = panDoc.file ?? null;
    out.msmeCertificateFile = msmeDoc.file ?? null;
    out.cancelledChequeFile = bankDoc.file ?? null;
    // Authoritative completion status (mirrors what the UI shows green)
    out.step1Status = { stage1Done, stage2Done, stage3Done, stage4Done, allDone };
    return out;
  }, [isGstRegistered, gstDoc, editablePrincipalPlace, gstDeclarationReason, gstDeclarationFile, manualLegalName, manualAddress, panDoc, isMsmeRegistered, msmeDoc, bankDoc, bankAccountType, bankBranchAddress, stage1Done, stage2Done, stage3Done, stage4Done, allDone]);

  // Lift state to parent in real time so outer Continue + Save Draft work.
  // Use a ref for the callback so an unstable parent handler doesn't cause an infinite render loop.
  const onStageChangeRef = useRef(onStageChange);
  useEffect(() => { onStageChangeRef.current = onStageChange; }, [onStageChange]);
  useEffect(() => {
    onStageChangeRef.current?.(buildOutput());
  }, [buildOutput]);

  const handleContinue = () => {
    onComplete(buildOutput());
  };

  // ---------- Tabs ----------
  type TabKey = "gst" | "pan" | "msme" | "bank";
  const [activeTab, setActiveTab] = useState<TabKey>("gst");

  const prevDoneRef = useRef({ s1: false, s2: false, s3: false });
  useEffect(() => {
    const prev = prevDoneRef.current;
    if (stage1Done && !prev.s1 && activeTab === "gst") setActiveTab("pan");
    else if (stage2Done && !prev.s2 && activeTab === "pan") setActiveTab("msme");
    else if (stage3Done && !prev.s3 && activeTab === "msme") setActiveTab("bank");
    prevDoneRef.current = { s1: stage1Done, s2: stage2Done, s3: stage3Done };
  }, [stage1Done, stage2Done, stage3Done, activeTab]);

  const tabUnlock: Record<TabKey, boolean> = {
    gst: true,
    pan: stage1Done,
    msme: stage2Done,
    bank: stage3Done,
  };
  const tabStatus: Record<TabKey, StageStatus> = {
    gst: gstDoc.status === "failed" ? "failed" : stage1Done ? "verified" : isGstRegistered !== null ? "in-progress" : "pending",
    pan: panDoc.status === "failed" || !!panCrossCheckError ? "failed" : stage2Done ? "verified" : panDoc.status !== "idle" ? "in-progress" : "pending",
    msme: msmeDoc.status === "failed" ? "failed" : stage3Done ? "verified" : isMsmeRegistered !== null ? "in-progress" : "pending",
    bank: bankDoc.status === "failed" ? "failed" : stage4Done ? "verified" : bankDoc.status !== "idle" ? "in-progress" : "pending",
  };

  return (
    <form
      id="step-form"
      onSubmit={(e) => { e.preventDefault(); if (allDone) handleContinue(); }}
      className="space-y-5"
    >
      {/* Summary banner */}
      <div className="rounded-lg border border-border/60 bg-card shadow-enterprise-sm px-4 py-3 flex items-center gap-3">
        <ShieldCheck className={cn("h-5 w-5", allDone ? "text-success" : "text-primary")} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {allDone ? "All required checks passed" : "Document verification"}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden max-w-[260px]">
              <div
                className={cn("h-full transition-all", allDone ? "bg-success" : "bg-primary")}
                style={{ width: `${(completedCount / 4) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {completedCount} of 4 stages verified
            </span>
          </div>
        </div>
      </div>

      <TooltipProvider delayDuration={150}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-auto p-1 bg-muted/60">
            {([
              { key: "gst", label: "GST", num: 1 },
              { key: "pan", label: "PAN", num: 2 },
              { key: "msme", label: "MSME", num: 3 },
              { key: "bank", label: "Bank", num: 4 },
            ] as { key: TabKey; label: string; num: number }[]).map((t) => {
              const unlocked = tabUnlock[t.key];
              const status = tabStatus[t.key];
              const trigger = (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  disabled={!unlocked}
                  className="flex items-center justify-center gap-2 py-2.5 min-w-0 data-[state=active]:bg-background data-[state=active]:shadow-enterprise-sm"
                >
                  <span className="text-xs sm:text-sm font-medium">
                    {t.num}. {t.label}
                  </span>
                  <StatusChip status={status} locked={!unlocked} />
                </TabsTrigger>
              );
              return unlocked ? trigger : (
                <Tooltip key={t.key}>
                  <TooltipTrigger asChild>
                    <span className="contents">{trigger}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Complete the previous step first</TooltipContent>
                </Tooltip>
              );
            })}
          </TabsList>

          {/* ============================== GST ============================== */}
          <TabsContent value="gst" className="mt-4">
            <StageShell
              icon={<Building2 className="h-4 w-4" />}
              title="GST Verification"
              subtitle="Upload your GST certificate or declare non-registration"
              status={tabStatus.gst}
              verifiedAt={gstDoc.verifiedAt}
            >
              <div className="space-y-5">
                {/* Gate row */}
                <GateRow
                  label="Are you GST registered?"
                  value={isGstRegistered}
                  onChange={setIsGstRegistered}
                  yesLabel="Yes"
                  noLabel="No"
                />

                {/* YES path */}
                {isGstRegistered === true && (
                  <>
                    <DocSplitRow
                      uploadLabel="GST Certificate"
                      accept=".pdf,.jpg,.jpeg,.png"
                      doc={gstDoc}
                      onUpload={handleGstUpload}
                      onReset={() => setGstDoc(idleDoc)}
                      busyLabel={
                        gstDoc.status === "uploading" ? "Uploading…" :
                        gstDoc.status === "ocr" ? "Reading certificate…" :
                        gstDoc.status === "verifying" ? "Verifying…" : ""
                      }
                      verifiedFields={
                        <GstVerifiedDetails
                          ocr={gstDoc.ocrData}
                          original={gstDoc.originalOcrData}
                          verifiedApi={gstDoc.apiData?.normalized}
                          onChangeField={(k, v) => setOcrField(setGstDoc, k, v)}
                          editablePrincipalPlace={editablePrincipalPlace}
                          onChangePrincipalPlace={setEditablePrincipalPlace}
                        />
                      }
                    />
                    {gstDoc.status === "verified" && typeof gstDoc.nameMatchScore === "number" && (
                      <CrossCheckStrip
                        ok={gstDoc.nameMatchScore >= 80}
                        text={`Name match score: ${gstDoc.nameMatchScore}%`}
                      />
                    )}
                  </>
                )}

                {/* NO path */}
                {isGstRegistered === false && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">GST Self-Declaration</p>
                        <p className="text-xs text-muted-foreground">Download, sign, then upload</p>
                      </div>
                      <a
                        href="/templates/gst-self-declaration.html"
                        download
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Template
                      </a>
                      <InlineFilePicker
                        file={gstDeclarationFile}
                        onPick={setGstDeclarationFile}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <FormField
                        label="Reason for non-registration"
                        value={gstDeclarationReason}
                        onChange={setGstDeclarationReason}
                        placeholder="e.g. Turnover below threshold"
                      />
                      <FormField
                        label="Legal Name *"
                        value={manualLegalName}
                        onChange={setManualLegalName}
                        placeholder="Registered name of the entity"
                      />
                      <FormField
                        label="Address *"
                        value={manualAddress.address}
                        onChange={(v) => setManualAddress((p) => ({ ...p, address: v }))}
                        placeholder="Street, area"
                      />
                      <FormField
                        label="City *"
                        value={manualAddress.city}
                        onChange={(v) => setManualAddress((p) => ({ ...p, city: v }))}
                      />
                      <FormField
                        label="State *"
                        value={manualAddress.state}
                        onChange={(v) => setManualAddress((p) => ({ ...p, state: v }))}
                      />
                      <FormField
                        label="Pincode *"
                        value={manualAddress.pincode}
                        onChange={(v) => setManualAddress((p) => ({ ...p, pincode: v }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </StageShell>
          </TabsContent>

          {/* ============================== PAN ============================== */}
          <TabsContent value="pan" className="mt-4">
            <StageShell
              icon={<BadgeCheck className="h-4 w-4" />}
              title="PAN Verification"
              subtitle="Upload PAN card to extract and verify holder details"
              status={tabStatus.pan}
              verifiedAt={panDoc.verifiedAt}
            >
              <DocSplitRow
                uploadLabel="PAN Card"
                accept=".pdf,.jpg,.jpeg,.png"
                doc={panDoc}
                onUpload={handlePanUpload}
                onReset={() => { setPanDoc(idleDoc); setPanCrossCheckError(null); }}
                busyLabel={
                  panDoc.status === "uploading" ? "Uploading…" :
                  panDoc.status === "ocr" ? "Reading PAN…" :
                  panDoc.status === "verifying" ? "Verifying…" : ""
                }
                verifiedFields={
                  (() => {
                    const panApi = panDoc.apiData?.normalized || {};
                    return (
                      <div className="space-y-3">
                        <ReviewBanner />
                        <div className="grid md:grid-cols-2 gap-3">
                          <EditableOcrField
                            label="PAN Number"
                            value={panDoc.ocrData?.pan_number}
                            originalValue={panDoc.originalOcrData?.pan_number}
                            onChange={(v) => setOcrField(setPanDoc, "pan_number", v.toUpperCase())}
                            mono
                            verifiedValue={panApi.pan_number}
                            verifiedLabel="PAN is verified"
                          />
                          <EditableOcrField
                            label="Holder Name"
                            value={panDoc.ocrData?.holder_name}
                            originalValue={panDoc.originalOcrData?.holder_name}
                            onChange={(v) => setOcrField(setPanDoc, "holder_name", v)}
                            verifiedValue={panApi.holder_name || panApi.full_name}
                            verifiedLabel="Name matches PAN registry"
                          />
                          {panApi.dob && (
                            <EditableOcrField
                              label="Date of Birth"
                              value={panDoc.ocrData?.dob || panApi.dob}
                              originalValue={panApi.dob}
                              onChange={(v) => setOcrField(setPanDoc, "dob", v)}
                              verifiedValue={panApi.dob}
                              verifiedLabel="DOB verified from registry"
                            />
                          )}
                          {panApi.category && (
                            <EditableOcrField
                              label="Category"
                              value={panDoc.ocrData?.category || panApi.category}
                              originalValue={panApi.category}
                              onChange={(v) => setOcrField(setPanDoc, "category", v)}
                              verifiedValue={panApi.category}
                              verifiedLabel="Verified from registry"
                            />
                          )}
                          {panApi.status && (
                            <EditableOcrField
                              label="PAN Status"
                              value={panDoc.ocrData?.status || panApi.status}
                              originalValue={panApi.status}
                              onChange={(v) => setOcrField(setPanDoc, "status", v)}
                              verifiedValue={panApi.status}
                              verifiedLabel="Active per registry"
                            />
                          )}
                          {panApi.aadhaar_linked != null && (
                            <EditableOcrField
                              label="Aadhaar Linked"
                              value={panDoc.ocrData?.aadhaar_linked != null ? String(panDoc.ocrData.aadhaar_linked) : String(panApi.aadhaar_linked)}
                              originalValue={String(panApi.aadhaar_linked)}
                              onChange={(v) => setOcrField(setPanDoc, "aadhaar_linked", v)}
                              verifiedValue={String(panApi.aadhaar_linked)}
                              verifiedLabel="Verified from registry"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()
                }
              />
              {panCrossCheckError && (
                <CrossCheckStrip ok={false} text={panCrossCheckError} className="mt-3" />
              )}
              {panDoc.status === "verified" && !panCrossCheckError && isGstRegistered === true && (
                <CrossCheckStrip ok={true} text="PAN matches PAN derived from GSTIN" className="mt-3" />
              )}
              {panDoc.status === "verified" && typeof panDoc.nameMatchScore === "number" && (
                <CrossCheckStrip
                  ok={panDoc.nameMatchScore >= 80}
                  text={`Name match vs Legal Name: ${panDoc.nameMatchScore}%`}
                  className="mt-2"
                />
              )}
            </StageShell>
          </TabsContent>

          {/* ============================== MSME ============================== */}
          <TabsContent value="msme" className="mt-4">
            <StageShell
              icon={<ShieldCheck className="h-4 w-4" />}
              title="MSME / Udyam"
              subtitle="Optional — upload Udyam certificate or skip"
              status={tabStatus.msme}
              verifiedAt={msmeDoc.verifiedAt}
            >
              <div className="space-y-5">
                <GateRow
                  label="Are you MSME / Udyam registered?"
                  value={isMsmeRegistered}
                  onChange={setIsMsmeRegistered}
                  yesLabel="Yes"
                  noLabel="No, skip"
                />

                {isMsmeRegistered === false && (
                  <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Skipped — not MSME registered
                  </div>
                )}

                {isMsmeRegistered === true && (
                  <Tabs value={msmeMode} onValueChange={(v) => setMsmeMode(v as "manual" | "upload")} className="space-y-4">
                    <TabsList className="grid grid-cols-2 max-w-sm">
                      <TabsTrigger value="manual">
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Manual Entry
                      </TabsTrigger>
                      <TabsTrigger value="upload">
                        <Upload className="h-3.5 w-3.5 mr-2" />
                        Upload
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Udyam Number *
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={msmeManualNumber}
                            onChange={(e) => setMsmeManualNumber(e.target.value.toUpperCase())}
                            placeholder="UDYAM-XX-00-0000000"
                            disabled={msmeManualBusy || msmeDoc.status === "verified"}
                            className="font-mono uppercase"
                          />
                          <Button
                            type="button"
                            onClick={handleMsmeManualValidate}
                            disabled={
                              msmeManualBusy ||
                              msmeDoc.status === "verified" ||
                              msmeManualNumber.trim().length < 10
                            }
                          >
                            {msmeManualBusy ? (
                              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Validating…</>
                            ) : (
                              "Validate"
                            )}
                          </Button>
                        </div>
                        {msmeManualError && (
                          <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-xs">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{msmeManualError}</span>
                          </div>
                        )}
                        {msmeDoc.status === "verified" && (
                          <div className="space-y-3 pt-2">
                            <ReviewBanner />
                            <div className="grid md:grid-cols-2 gap-3">
                              {(() => { const m = msmeDoc.apiData?.normalized || {}; return (<>
                              <EditableOcrField
                                label="Udyam Number"
                                value={msmeDoc.ocrData?.udyam_number}
                                originalValue={msmeDoc.originalOcrData?.udyam_number}
                                onChange={(v) => setOcrField(setMsmeDoc, "udyam_number", v.toUpperCase())}
                                mono
                                verifiedValue={m.udyam_number}
                                verifiedLabel="Udyam Number is verified"
                              />
                              <EditableOcrField
                                label="Enterprise Name"
                                value={msmeDoc.ocrData?.enterprise_name}
                                originalValue={msmeDoc.originalOcrData?.enterprise_name}
                                onChange={(v) => setOcrField(setMsmeDoc, "enterprise_name", v)}
                                verifiedValue={m.enterprise_name}
                                verifiedLabel="Enterprise Name matches registry"
                              />
                              <EditableOcrField
                                label="Enterprise Type"
                                value={msmeDoc.ocrData?.enterprise_type}
                                originalValue={msmeDoc.originalOcrData?.enterprise_type}
                                onChange={(v) => setOcrField(setMsmeDoc, "enterprise_type", v)}
                                placeholder="Micro / Small / Medium"
                                verifiedValue={m.enterprise_type}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="Major Activity"
                                value={msmeDoc.ocrData?.major_activity}
                                originalValue={msmeDoc.originalOcrData?.major_activity}
                                onChange={(v) => setOcrField(setMsmeDoc, "major_activity", v)}
                                placeholder="e.g. Manufacturing, Services, Trading"
                                verifiedValue={m.major_activity}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="Organization Type"
                                value={msmeDoc.ocrData?.organization_type}
                                originalValue={msmeDoc.originalOcrData?.organization_type}
                                onChange={(v) => setOcrField(setMsmeDoc, "organization_type", v)}
                                verifiedValue={m.organization_type}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="Registration Date"
                                value={msmeDoc.ocrData?.registration_date}
                                originalValue={msmeDoc.originalOcrData?.registration_date}
                                onChange={(v) => setOcrField(setMsmeDoc, "registration_date", v)}
                                verifiedValue={m.registration_date}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="State"
                                value={msmeDoc.ocrData?.state}
                                originalValue={msmeDoc.originalOcrData?.state}
                                onChange={(v) => setOcrField(setMsmeDoc, "state", v)}
                                verifiedValue={m.state}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="District"
                                value={msmeDoc.ocrData?.district}
                                originalValue={msmeDoc.originalOcrData?.district}
                                onChange={(v) => setOcrField(setMsmeDoc, "district", v)}
                                verifiedValue={m.district}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="City"
                                value={msmeDoc.ocrData?.city}
                                originalValue={msmeDoc.originalOcrData?.city}
                                onChange={(v) => setOcrField(setMsmeDoc, "city", v)}
                                verifiedValue={m.city}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="PIN Code"
                                value={msmeDoc.ocrData?.pin_code}
                                originalValue={msmeDoc.originalOcrData?.pin_code}
                                onChange={(v) => setOcrField(setMsmeDoc, "pin_code", v)}
                                verifiedValue={m.pin_code}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="Mobile"
                                value={msmeDoc.ocrData?.mobile}
                                originalValue={msmeDoc.originalOcrData?.mobile}
                                onChange={(v) => setOcrField(setMsmeDoc, "mobile", v)}
                                verifiedValue={m.mobile}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="Email"
                                value={msmeDoc.ocrData?.email}
                                originalValue={msmeDoc.originalOcrData?.email}
                                onChange={(v) => setOcrField(setMsmeDoc, "email", v)}
                                verifiedValue={m.email}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="Social Category"
                                value={msmeDoc.ocrData?.social_category}
                                originalValue={msmeDoc.originalOcrData?.social_category}
                                onChange={(v) => setOcrField(setMsmeDoc, "social_category", v)}
                                verifiedValue={m.social_category}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="NIC Code"
                                value={msmeDoc.ocrData?.nic_code}
                                originalValue={msmeDoc.originalOcrData?.nic_code}
                                onChange={(v) => setOcrField(setMsmeDoc, "nic_code", v)}
                              />
                              </>); })()}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => { setMsmeDoc(idleDoc); setMsmeManualNumber(""); setMsmeManualError(null); }}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Re-validate
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="upload" className="space-y-3">
                      <DocSplitRow
                        uploadLabel="Udyam Certificate"
                        accept=".pdf,.jpg,.jpeg,.png"
                        doc={msmeDoc}
                        onUpload={handleMsmeUpload}
                        onReset={() => setMsmeDoc(idleDoc)}
                        busyLabel={
                          msmeDoc.status === "uploading" ? "Uploading…" :
                          msmeDoc.status === "ocr" ? "Reading Udyam…" :
                          msmeDoc.status === "verifying" ? "Verifying…" : ""
                        }
                        verifiedFields={
                          (() => { const m = msmeDoc.apiData?.normalized || {}; return (
                          <div className="space-y-3">
                            <ReviewBanner />
                            <div className="grid md:grid-cols-2 gap-3">
                              <EditableOcrField
                                label="Udyam Number"
                                value={msmeDoc.ocrData?.udyam_number}
                                originalValue={msmeDoc.originalOcrData?.udyam_number}
                                onChange={(v) => setOcrField(setMsmeDoc, "udyam_number", v.toUpperCase())}
                                mono
                                verifiedValue={m.udyam_number}
                                verifiedLabel="Udyam Number is verified"
                              />
                              <EditableOcrField
                                label="Enterprise Name"
                                value={msmeDoc.ocrData?.enterprise_name}
                                originalValue={msmeDoc.originalOcrData?.enterprise_name}
                                onChange={(v) => setOcrField(setMsmeDoc, "enterprise_name", v)}
                                verifiedValue={m.enterprise_name}
                                verifiedLabel="Enterprise Name matches registry"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <EditableOcrField
                                label="Enterprise Type"
                                value={msmeDoc.ocrData?.enterprise_type}
                                originalValue={msmeDoc.originalOcrData?.enterprise_type}
                                onChange={(v) => setOcrField(setMsmeDoc, "enterprise_type", v)}
                                placeholder="Micro / Small / Medium"
                                verifiedValue={m.enterprise_type}
                                verifiedLabel="Verified from registry"
                              />
                              <EditableOcrField
                                label="Major Activity"
                                value={msmeDoc.ocrData?.major_activity}
                                originalValue={msmeDoc.originalOcrData?.major_activity}
                                onChange={(v) => setOcrField(setMsmeDoc, "major_activity", v)}
                                placeholder="e.g. Manufacturing, Services, Trading"
                                verifiedValue={m.major_activity}
                                verifiedLabel="Verified from registry"
                              />
                            </div>
                            {!msmeDoc.ocrData?.major_activity && (
                              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                {msmeDoc.file ? (
                                  <>
                                    <Sparkles className="h-3 w-3 text-primary" />
                                    Reading Major Activity from certificate…
                                  </>
                                ) : (
                                  <>Couldn't read Major Activity from the certificate — please enter manually.</>
                                )}
                              </p>
                            )}
                          </div>
                          ); })()
                        }
                      />
                    </TabsContent>
                  </Tabs>
                )}


                {isMsmeRegistered === true && msmeDoc.status === "verified" && typeof msmeDoc.nameMatchScore === "number" && (
                  <CrossCheckStrip
                    ok={msmeDoc.nameMatchScore >= 80}
                    text={`Name match vs Legal Name: ${msmeDoc.nameMatchScore}%`}
                  />
                )}
              </div>
            </StageShell>
          </TabsContent>

          {/* ============================== BANK ============================== */}
          <TabsContent value="bank" className="mt-4">
            <StageShell
              icon={<Landmark className="h-4 w-4" />}
              title="Bank Account"
              subtitle="Upload cancelled cheque — penny-drop verifies the account"
              status={tabStatus.bank}
              verifiedAt={bankDoc.verifiedAt}
            >
              <DocSplitRow
                uploadLabel="Cancelled Cheque"
                accept=".pdf,.jpg,.jpeg,.png"
                doc={bankDoc}
                onUpload={handleBankUpload}
                onReset={() => setBankDoc(idleDoc)}
                busyLabel={
                  bankDoc.status === "uploading" ? "Uploading…" :
                  bankDoc.status === "ocr" ? "Reading cheque…" :
                  bankDoc.status === "verifying" ? "Penny-drop verification…" : ""
                }
                verifiedFields={
                  <div className="space-y-3">
                    <ReviewBanner />
                    <div className="grid md:grid-cols-2 gap-3">
                      <EditableOcrField
                        label="Account Number"
                        value={bankDoc.ocrData?.account_number}
                        originalValue={bankDoc.originalOcrData?.account_number}
                        verifiedValue={bankDoc.apiData?.normalized?.account_number}
                        verifiedLabel="Account Number is verified"
                        onChange={(v) => setOcrField(setBankDoc, "account_number", v)}
                        mono
                      />
                      <EditableOcrField
                        label="IFSC Code"
                        value={bankDoc.ocrData?.ifsc_code}
                        originalValue={bankDoc.originalOcrData?.ifsc_code}
                        verifiedValue={bankDoc.apiData?.normalized?.ifsc_code}
                        verifiedLabel="IFSC is verified"
                        onChange={(v) => setOcrField(setBankDoc, "ifsc_code", v.toUpperCase())}
                        mono
                      />
                      <EditableOcrField
                        label="Bank Name"
                        value={bankDoc.ocrData?.bank_name}
                        originalValue={bankDoc.originalOcrData?.bank_name}
                        verifiedValue={bankDoc.apiData?.normalized?.bank_name}
                        verifiedLabel="Bank Name is verified"
                        onChange={(v) => setOcrField(setBankDoc, "bank_name", v)}
                      />
                      <div>
                        <EditableOcrField
                          label="Branch"
                          value={bankDoc.ocrData?.branch_name}
                          originalValue={bankDoc.originalOcrData?.branch_name}
                          verifiedValue={bankDoc.apiData?.normalized?.branch_name}
                          verifiedLabel="Branch is verified"
                          onChange={(v) => { setOcrField(setBankDoc, "branch_name", v); setBankBranchAutoFilled(false); }}
                        />
                        {bankBranchAutoFilled && bankDoc.ocrData?.branch_name && (
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Auto-filled from IFSC — please verify
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <EditableOcrField
                          label="Account Holder Name"
                          value={bankDoc.ocrData?.account_holder_name}
                          originalValue={bankDoc.originalOcrData?.account_holder_name}
                          verifiedValue={bankDoc.apiData?.normalized?.account_holder_name}
                          verifiedLabel="Name matches bank record"
                          onChange={(v) => setOcrField(setBankDoc, "account_holder_name", v)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Account Type *</Label>
                        <select
                          value={bankAccountType}
                          onChange={(e) => setBankAccountType(e.target.value)}
                          className="mt-1 w-full h-10 rounded-md border border-border/60 bg-muted/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="current">Current Account</option>
                          <option value="savings">Savings Account</option>
                          <option value="cash_credit">Cash Credit</option>
                          <option value="others">Others</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Bank Address</Label>
                        <Input
                          value={bankBranchAddress}
                          onChange={(e) => { bankAddressTouchedRef.current = true; setBankBranchAddress(e.target.value); }}
                          placeholder="Branch address (optional)"
                          className="mt-1 bg-muted/40 border-border/60"
                        />
                      </div>
                    </div>
                  </div>
                }
              />
              {bankDoc.status === "verified" && (
                <CrossCheckStrip ok={true} text="Account active · Penny-drop successful" className="mt-3" />
              )}
            </StageShell>
          </TabsContent>
        </Tabs>
      </TooltipProvider>

      <AlertDialog
        open={mismatchDialog.open}
        onOpenChange={(o) => setMismatchDialog((d) => ({ ...d, open: o }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mismatchDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{mismatchDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setMismatchDialog((d) => ({ ...d, open: false }))}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

/* =================================================================
   Helper components — kept local for visual consistency across stages
   ================================================================= */

function StatusChip({ status, locked }: { status: StageStatus; locked: boolean }) {
  if (locked) return <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Locked" />;
  if (status === "verified") return <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" aria-label="Verified" />;
  if (status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" aria-label="Failed" />;
  if (status === "in-progress") return <Loader2 className="h-3.5 w-3.5 text-primary shrink-0 animate-spin" aria-label="In progress" />;
  return <Clock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Pending" />;
}

function StatusPill({ status }: { status: StageStatus }) {
  const map: Record<StageStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
    "in-progress": { label: "In progress", cls: "bg-primary/10 text-primary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    verified: { label: "Verified", cls: "bg-success/10 text-success", icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: "Failed", cls: "bg-destructive/10 text-destructive", icon: <AlertCircle className="h-3 w-3" /> },
  };
  const { label, cls, icon } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", cls)}>
      {icon}
      {label}
    </span>
  );
}

interface StageShellProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: StageStatus;
  verifiedAt?: number;
  children: React.ReactNode;
}
function StageShell({ icon, title, subtitle, status, verifiedAt, children }: StageShellProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card shadow-enterprise-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {verifiedAt && status === "verified" && (
            <span className="hidden sm:inline text-xs text-muted-foreground">
              · {timeAgo(verifiedAt)}
            </span>
          )}
          <StatusPill status={status} />
        </div>
      </div>

      {/* Body */}
      <div className="p-5">{children}</div>
    </div>
  );
}

function GateRow({
  label, value, onChange, yesLabel = "Yes", noLabel = "No",
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 rounded-md border border-border/60 bg-muted/20 px-4 py-3">
      <Label className="text-sm font-medium text-foreground sm:flex-1">{label}</Label>
      <RadioGroup
        value={value === null ? "" : value ? "yes" : "no"}
        onValueChange={(v) => onChange(v === "yes")}
        className="flex gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="yes" id={`${label}-yes`} />
          <Label htmlFor={`${label}-yes`} className="cursor-pointer text-sm">{yesLabel}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="no" id={`${label}-no`} />
          <Label htmlFor={`${label}-no`} className="cursor-pointer text-sm">{noLabel}</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

interface DocSplitRowProps {
  uploadLabel: string;
  accept: string;
  doc: DocState;
  onUpload: (f: File) => void;
  onReset: () => void;
  busyLabel: string;
  verifiedFields: React.ReactNode;
}
function DocSplitRow({ uploadLabel, accept, doc, onUpload, onReset, busyLabel, verifiedFields }: DocSplitRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = doc.status === "uploading" || doc.status === "ocr" || doc.status === "verifying";
  const isVerified = doc.status === "verified";
  const isFailed = doc.status === "failed";

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onUpload(f);
  }, [onUpload]);

  return (
    <div className="space-y-4">
      {/* Upload control */}
      {doc.status === "idle" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="w-full border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 rounded-md px-4 py-5 flex items-center justify-center gap-3 transition-colors"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Drop {uploadLabel.toLowerCase()} or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG · up to 5 MB</p>
          </div>
        </button>
      )}

      {(isBusy || isVerified || isFailed) && (
        <FilePill
          fileName={doc.fileName}
          fileSize={doc.fileSize}
          state={isBusy ? "busy" : isVerified ? "verified" : "failed"}
          busyLabel={busyLabel}
          ocrModel={doc.ocrModel}
          onReplace={() => inputRef.current?.click()}
          onReset={onReset}
        />
      )}

      {isFailed && doc.errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{doc.errorMessage}</span>
        </div>
      )}

      {isVerified && verifiedFields}

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

function FilePill({
  fileName, fileSize, state, busyLabel, ocrModel, onReplace, onReset,
}: {
  fileName?: string;
  fileSize?: number;
  state: "busy" | "verified" | "failed";
  busyLabel?: string;
  ocrModel?: string;
  onReplace: () => void;
  onReset: () => void;
}) {
  const accent =
    state === "verified" ? "border-success/40 bg-success/5" :
    state === "failed" ? "border-destructive/40 bg-destructive/5" :
    "border-border bg-muted/30";

  const modelLabel = friendlyModelName(ocrModel);

  return (
    <div className={cn("flex items-center gap-3 rounded-md border px-3 py-2.5", accent)}>
      <div className="h-8 w-8 rounded-md bg-background border border-border/60 flex items-center justify-center shrink-0">
        {state === "busy" ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        ) : state === "verified" ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{fileName || "Document"}</p>
          {modelLabel && state !== "busy" && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0"
              title={`Extracted by ${modelLabel}`}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {modelLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {state === "busy" ? busyLabel : (
            <>
              {fileSize ? formatBytes(fileSize) : ""}
              {state === "verified" && <span className="text-success"> · Verified</span>}
              {state === "failed" && <span className="text-destructive"> · Failed</span>}
            </>
          )}
        </p>
      </div>
      {state !== "busy" && (
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onReplace}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            Replace
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative mt-1">
        <Input
          readOnly
          value={value || ""}
          placeholder="—"
          className={cn(
            "pr-8 bg-muted/40 border-border/60 cursor-default focus-visible:ring-0",
            mono && "font-mono text-sm tracking-wide",
          )}
        />
        <Lock className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function GstStatusPill({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  const cls =
    s === "active"
      ? "bg-success/10 text-success"
      : s === "cancelled" || s === "canceled" || s === "inactive"
        ? "bg-destructive/10 text-destructive"
        : s === "suspended"
          ? "bg-warning/10 text-warning"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      {status}
    </span>
  );
}

function ChipList({ items }: { items?: string[] }) {
  const filtered = (items || []).filter((s) => typeof s === "string" && s.trim().length > 0);
  if (filtered.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {filtered.map((t, i) => (
        <span key={`${t}-${i}`} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
          {t}
        </span>
      ))}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  );
}

function GstVerifiedDetails({
  ocr,
  original,
  verifiedApi,
  onChangeField,
  editablePrincipalPlace,
  onChangePrincipalPlace,
}: {
  ocr?: Record<string, any>;
  original?: Record<string, any>;
  /** Snake-case registry payload from the GST validation API. */
  verifiedApi?: Record<string, any>;
  onChangeField: (key: string, value: any) => void;
  editablePrincipalPlace: string;
  onChangePrincipalPlace: (v: string) => void;
}) {
  if (!ocr) return null;
  const businessNature: string[] = Array.isArray(ocr.business_nature) ? ocr.business_nature : [];
  const additionalPlaces: string[] = Array.isArray(ocr.additional_places) ? ocr.additional_places : [];
  const hasAdditional = additionalPlaces.some((s) => typeof s === "string" && s.trim().length > 0);
  const hasJurisdiction = !!(ocr.jurisdiction_centre || ocr.jurisdiction_state);
  const hasRegistrationSection = !!(ocr.gst_status || ocr.registration_date || ocr.taxpayer_type || businessNature.length);
  const api = verifiedApi || {};
  const apiGstStatus = String(api.gst_status || "").trim();
  const statusVerified =
    !!apiGstStatus && !!ocr.gst_status &&
    apiGstStatus.toUpperCase() === String(ocr.gst_status).toUpperCase();
  return (
    <div className="space-y-5">
      <ReviewBanner />

      {/* Identity */}
      <div className="space-y-2">
        <SectionHeading>Identity</SectionHeading>
        <div className="grid md:grid-cols-2 gap-3">
          <EditableOcrField
            label="Legal Name"
            value={ocr.legal_name}
            originalValue={original?.legal_name}
            verifiedValue={api.legal_name}
            verifiedLabel="Legal Name is verified"
            onChange={(v) => onChangeField("legal_name", v)}
          />
          <EditableOcrField
            label="Trade Name"
            value={ocr.trade_name}
            originalValue={original?.trade_name}
            verifiedValue={api.trade_name}
            verifiedLabel="Trade Name is verified"
            onChange={(v) => onChangeField("trade_name", v)}
          />
          <EditableOcrField
            label="GSTIN"
            value={ocr.gstin}
            originalValue={original?.gstin}
            verifiedValue={api.gstin}
            verifiedLabel="GSTIN is verified"
            onChange={(v) => onChangeField("gstin", v.toUpperCase())}
            mono
          />
          <EditableOcrField
            label="Constitution"
            value={ocr.constitution_of_business}
            originalValue={original?.constitution_of_business}
            verifiedValue={api.constitution_of_business}
            verifiedLabel="Verified from registry"
            onChange={(v) => onChangeField("constitution_of_business", v)}
          />
        </div>
      </div>

      {/* Registration */}
      {hasRegistrationSection && (
        <div className="space-y-2">
          <SectionHeading>Registration</SectionHeading>
          <div className="grid md:grid-cols-2 gap-3">
            {ocr.gst_status && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">GST Status</Label>
                <div className="mt-1 h-10 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3">
                  <GstStatusPill status={ocr.gst_status} />
                  {statusVerified && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      {apiGstStatus} per registry
                    </span>
                  )}
                </div>
              </div>
            )}
            {ocr.registration_date && (
              <EditableOcrField
                label="Registration Date"
                value={ocr.registration_date}
                originalValue={original?.registration_date}
                verifiedValue={api.registration_date}
                verifiedLabel="Verified from registry"
                onChange={(v) => onChangeField("registration_date", v)}
              />
            )}
            {ocr.taxpayer_type && (
              <EditableOcrField
                label="Taxpayer Type"
                value={ocr.taxpayer_type}
                originalValue={original?.taxpayer_type}
                verifiedValue={api.taxpayer_type}
                verifiedLabel="Verified from registry"
                onChange={(v) => onChangeField("taxpayer_type", v)}
              />
            )}
            {businessNature.length > 0 && (
              <div className="md:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">Nature of Business</Label>
                <div className="mt-1.5">
                  <ChipList items={businessNature} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Place of Business */}
      <div className="space-y-2">
        <SectionHeading>Place of Business</SectionHeading>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label htmlFor="principal-place" className="text-xs font-medium text-muted-foreground">
              Principal Place of Business
            </Label>
            <Input
              id="principal-place"
              value={editablePrincipalPlace}
              onChange={(e) => onChangePrincipalPlace(e.target.value)}
              placeholder="As per GST certificate"
              className="mt-1"
            />
            {api.address && editablePrincipalPlace.trim().length > 0 &&
              normalizeForCompare(editablePrincipalPlace) === normalizeForCompare(String(api.address)) && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Matches registry address
                </p>
              )}
          </div>
          {hasAdditional && (
            <div className="md:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Additional Places of Business</Label>
              <div className="mt-1.5">
                <ChipList items={additionalPlaces} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Jurisdiction */}
      {hasJurisdiction && (
        <div className="space-y-2">
          <SectionHeading>Jurisdiction</SectionHeading>
          <div className="grid md:grid-cols-2 gap-3">
            {ocr.jurisdiction_centre && (
              <EditableOcrField
                label="Centre Jurisdiction"
                value={ocr.jurisdiction_centre}
                originalValue={original?.jurisdiction_centre}
                verifiedValue={api.jurisdiction_centre}
                verifiedLabel="Verified from registry"
                onChange={(v) => onChangeField("jurisdiction_centre", v)}
              />
            )}
            {ocr.jurisdiction_state && (
              <EditableOcrField
                label="State Jurisdiction"
                value={ocr.jurisdiction_state}
                originalValue={original?.jurisdiction_state}
                verifiedValue={api.jurisdiction_state}
                verifiedLabel="Verified from registry"
                onChange={(v) => onChangeField("jurisdiction_state", v)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  );
}

function CrossCheckStrip({ ok, text, className }: { ok: boolean; text: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
        ok ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive",
        className,
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      <span>{text}</span>
    </div>
  );
}

function InlineFilePicker({
  file, onPick, accept,
}: { file: File | null; onPick: (f: File | null) => void; accept: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        variant={file ? "outline" : "default"}
        size="sm"
        className="h-8"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5 mr-1" />
        {file ? "Replace" : "Upload signed"}
      </Button>
      {file && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{file.name}</span>}
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
    </>
  );
}

/**
 * EditableOcrField — used inside verified panels so users can correct
 * OCR mis-reads inline. Shows an "Edited" pill when the value differs from
 * the OCR'd original, plus a "Reset to OCR" link to revert.
 */
function normalizeForCompare(v: string) {
  // ISO date → keep as-is; otherwise upper + collapse spaces
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t.toUpperCase().replace(/\s+/g, " ");
}

function EditableOcrField({
  label,
  value,
  originalValue,
  onChange,
  mono,
  placeholder,
  verifiedValue,
  verifiedLabel,
}: {
  label: string;
  value?: string;
  originalValue?: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
  /** Value returned by the validation API for this field (registry/penny-drop). */
  verifiedValue?: string;
  /** Label shown next to the green tick when the value matches the API. */
  verifiedLabel?: string;
}) {
  const current = value ?? "";
  const original = originalValue ?? "";
  const isEdited = current.trim() !== original.trim() && original.length > 0;
  const apiVal = (verifiedValue ?? "").toString();
  const hasApi = apiVal.trim().length > 0 && current.trim().length > 0;
  const matchesApi = hasApi && normalizeForCompare(current) === normalizeForCompare(apiVal);
  const mismatchApi = hasApi && !matchesApi;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-2">
          {isEdited && (
            <span className="inline-flex items-center rounded-full bg-warning/10 text-warning px-1.5 py-0.5 text-[10px] font-medium">
              Edited
            </span>
          )}
          {isEdited && (
            <button
              type="button"
              onClick={() => onChange(original)}
              className="text-[10px] text-primary hover:underline"
            >
              Reset to OCR
            </button>
          )}
        </div>
      </div>
      <Input
        value={current}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        className={cn(
          "mt-1 bg-muted/40 border-border/60",
          mono && "font-mono text-sm tracking-wide",
          isEdited && "border-warning/40 bg-warning/5",
          matchesApi && "border-success/40 bg-success/5",
          mismatchApi && "border-warning/50 bg-warning/5",
        )}
      />
      {matchesApi && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-success">
          <CheckCircle2 className="h-3 w-3" />
          {verifiedLabel || `${label} is verified`}
        </p>
      )}
      {mismatchApi && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">
            Doesn't match registry value:&nbsp;
            <span className="font-medium">{apiVal}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(apiVal)}
            className="ml-1 text-[11px] text-primary hover:underline shrink-0"
          >
            Use registry value
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * One-line helper inside each verified panel telling the user they can
 * correct any field if the OCR mis-read the document.
 */
function ReviewBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
      <span>Review the extracted details. Click any field to correct it if the document was misread.</span>
    </div>
  );
}
