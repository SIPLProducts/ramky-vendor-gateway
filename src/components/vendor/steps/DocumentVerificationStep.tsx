import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Upload, CheckCircle2, Loader2, AlertCircle, AlertTriangle, FileText, RotateCcw, ShieldCheck, Download, Lock, Clock, Landmark, BadgeCheck, Building2, CreditCard, Sparkles, Pencil, PlusCircle, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OcrDocumentType } from "@/hooks/useOcrExtraction";
import { useConfiguredKycApi } from "@/hooks/useConfiguredKycApi";
import { toastKycResult } from "@/lib/kycToast";
import { lookupIfsc, isValidIfsc } from "@/lib/ifscLookup";
import {
  nameMatchPercentage,
  evaluateCrossNameMatch,
  formatCrossMatchSuccess,
  formatCrossMatchFailure,
} from "@/lib/nameMatch";
import { normalizeUploadToImage } from "@/lib/pdfToImage";
import { mergeOcrExtracted } from "@/lib/kycExtract";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { GstFilingStatusTable, normalizeFilingStatus, evaluateGstr1Compliance, type FilingStatusRow } from "@/components/vendor/kyc/GstFilingStatusTable";
import { ManualEntryFallbackDialog } from "@/components/vendor/kyc/ManualEntryFallbackDialog";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/vendor/FileUpload";
import { supabase } from "@/integrations/supabase/client";
import { formatPanStatus, formatAadhaarLinked } from "@/lib/panComprehensive";

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

/**
 * Parse a plain comma-delimited Indian address string (typical KYC provider
 * output for Principal Place of Business / MSME office address) into PIN /
 * State / City / Address-line parts so the Address step can auto-fill them.
 * Returns undefined parts when nothing could be parsed.
 */
const INDIAN_STATE_NAMES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh",
  "Lakshadweep","Puducherry","Orissa","Pondicherry",
];
const STATE_ALIASES: Record<string, string> = {
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
};
function parseAddressString(raw: string): { address?: string; city?: string; state?: string; pincode?: string } {
  if (!raw || typeof raw !== "string") return {};
  let s = raw.replace(/\s+/g, " ").trim();
  // PIN: trailing 6-digit number
  let pincode: string | undefined;
  const pinMatch = s.match(/(\d{6})(?!.*\d{6})/);
  if (pinMatch) {
    pincode = pinMatch[1];
    s = s.replace(pinMatch[0], "").replace(/[,\s-]+$/g, "").trim();
  }
  const segments = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (!segments.length) return { pincode };
  // State: scan from the end for a known Indian state (case-insensitive)
  let stateIdx = -1;
  let state: string | undefined;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const low = seg.toLowerCase();
    const aliased = STATE_ALIASES[low];
    const direct = INDIAN_STATE_NAMES.find((n) => n.toLowerCase() === low);
    if (direct || aliased) {
      state = direct || aliased;
      stateIdx = i;
      break;
    }
  }
  // City: segment immediately before the state (skip if it looks like a number)
  let city: string | undefined;
  if (stateIdx > 0) {
    const candidate = segments[stateIdx - 1];
    if (candidate && !/^\d+$/.test(candidate)) city = candidate;
  } else if (segments.length >= 2) {
    // No state detected — use last segment as city as a weak fallback
    city = segments[segments.length - 1];
  }
  // Address line = everything before the city segment
  let addressEnd = stateIdx >= 0 ? stateIdx : segments.length;
  if (city && stateIdx > 0) addressEnd = stateIdx - 1;
  else if (city && stateIdx < 0) addressEnd = segments.length - 1;
  const address = segments.slice(0, addressEnd).join(", ") || undefined;
  return { address, city, state, pincode };
}

/** Build the bank holder-name success message from the active reference labels. */
function buildHolderNameSuccessMessage(labels: string[]): string {
  if (!labels.length) return "Account Holder Name verified successfully.";
  let joined: string;
  if (labels.length === 1) joined = labels[0];
  else if (labels.length === 2) joined = `${labels[0]} and ${labels[1]}`;
  else joined = `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `Account Holder Name verified with ${joined}.`;
}

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
    filing_status?: any;
    filingCompliant?: boolean;
    /** Parsed parts of the principal place of business — used to auto-populate the Address step. */
    addressParts?: { address?: string; city?: string; state?: string; pincode?: string };
  };
  manualLegalName?: string;
  manualAddress?: { address: string; city: string; state: string; pincode: string };
  gstSelfDeclarationFile?: File | null;
  pan?: { number: string; holderName: string; apiName?: string; nameMatchScore?: number };
  isMsmeRegistered?: boolean;
  msmeDeclarationReason?: string;
  msmeSelfDeclarationFile?: File | null;
  msme?: {
    udyamNumber: string;
    enterpriseName: string;
    enterpriseType?: string;
    majorActivity?: string;
    apiName?: string;
    nameMatchScore?: number;
    /** Address fields returned by the Udyam registry — used as a fallback for the Address step. */
    addressParts?: { address?: string; city?: string; state?: string; pincode?: string };
  };
  bank?: { accountNumber: string; ifsc: string; bankName: string; branchName?: string; accountHolderName?: string; apiName?: string; accountType?: string; bankAddress?: string };
  bank2?: { accountNumber: string; ifsc: string; bankName: string; branchName?: string; accountHolderName?: string; apiName?: string; accountType?: string; bankAddress?: string };
  panStatus?: string | null;
  panAadhaarLinked?: boolean | null;
  panComprehensiveVerifiedAt?: string | null;
  panHolderName?: string | null;
  // Step-1 uploaded files — lifted so parent draft saves include them
  gstCertificateFile?: File | null;
  panCardFile?: File | null;
  msmeCertificateFile?: File | null;
  cancelledChequeFile?: File | null;
  cancelledChequeFile2?: File | null;
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
  initialTab?: "gst" | "pan" | "msme" | "bank";
}

type DocStatus = "idle" | "uploading" | "preparing" | "ocr" | "verifying" | "verified" | "failed";
type StageStatus = "pending" | "in-progress" | "verified" | "failed";

interface DocState {
  status: DocStatus;
  fileName?: string;
  fileSize?: number;
  /** The actual uploaded File — lifted to parent so draft save includes it */
  file?: File;
  /** Storage path when the file was hydrated from a previously saved vendor row */
  filePath?: string;
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
  // Hide raw KYC provider codes (e.g. PAN_OCR / GST_OCR / MSME_OCR / BANK_OCR)
  // — those are internal identifiers and add noise to the file pill.
  if (/^(PAN|GST|MSME|BANK|CHEQUE)_OCR$/i.test(model)) return undefined;
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

function normalizeBooleanLike(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (value === 1) return true;
  if (value === 0) return false;
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (
    ["false", "no", "n", "not_linked", "notlinked", "not linked", "aadhaar not linked", "aadhaar not linked with pan", "not_seeded", "notseeded", "not seeded", "unlinked", "inactive", "invalid", "0"].includes(s) ||
    /\bnot\b/.test(s)
  ) return false;
  if (["true", "yes", "y", "linked", "aadhaar linked", "aadhaar linked with pan", "seeded", "active", "valid", "verified", "1"].includes(s)) return true;
  return null;
}

function pickPrimitiveString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return pickPrimitiveString((value as Record<string, unknown>).value);
  }
  return "";
}

function collectPanResponseObjects(source: any): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  const seen = new Set<any>();
  const push = (v: any) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    out.push(v);
    push(v.data);
    push(v.result);
    push(v.response);
    push(v.response_data);
    push(v.raw);
  };
  // IMPORTANT: do NOT push `source` itself — when `source` is a KycApiResult
  // envelope it carries a top-level `status` field (HTTP 200) that would
  // shadow the inner `data.status` ("valid") and make the PAN check fail
  // with the upstream message_code "success". Start from the payload keys.
  push(source?.data);
  push(source?.raw);
  push(source?.result);
  push(source?.response);
  push(source?.response_data);
  return out;
}

function extractPanComprehensiveFields(result: any): { status: string | null; aadhaarLinked: boolean | null } {
  let statusRaw: unknown = null;
  let aadhaarLinked: boolean | null = null;
  for (const data of collectPanResponseObjects(result)) {
    if (statusRaw == null) {
      const candidate = data.status ?? data.pan_status ?? data.panStatus ?? data.pan_status_desc ?? null;
      const asStr = pickPrimitiveString(candidate).trim();
      // Ignore numeric-looking values (e.g. HTTP 200) — real PAN status is textual.
      if (asStr && !/^\d+$/.test(asStr)) statusRaw = candidate;
    }
    const candidates = [
      data.aadhaar_linked,
      data.aadhaarLinked,
      data.aadhaar_linked_with_pan,
      data.is_aadhaar_linked,
      data.aadhaar_link_status,
      data.aadhaar_seeding,
      data.aadhaar_seeding_status,
      data.aadhaar_seeding_status_desc,
      data.pan_aadhaar_linked,
      data.panAadhaarLinked,
      data.pan_aadhaar_link_status,
    ];
    for (const raw of candidates) {
      const parsed = normalizeBooleanLike(raw);
      if (parsed !== null) {
        aadhaarLinked = parsed;
        break;
      }
    }
    if (statusRaw != null && aadhaarLinked !== null) break;
  }
  const statusText = pickPrimitiveString(statusRaw).trim();
  return {
    status: statusText || null,
    aadhaarLinked,
  };
}

/** Extract the persisted-file bits (name/size/path) from a File-like coming from a previously saved vendor row. */
function persistedFileMeta(f?: File | null): { fileName?: string; fileSize?: number; filePath?: string; file?: File } {
  if (!f) return {};
  const persisted = (f as any).__persistedDocument === true;
  return {
    file: f,
    fileName: f.name,
    fileSize: (f as any).size,
    filePath: persisted ? (f as any).filePath : undefined,
  };
}

export function DocumentVerificationStep({
  vendorId,
  initialData,
  onComplete,
  onStageChange,
  initialTab,
}: DocumentVerificationStepProps) {
  // OCR is now exclusively driven by the admin-configured providers in
  // "KYC & Validation API Settings" (see kyc-api-execute edge function).
  // The Gemini-based useOcrExtraction hook has been removed from this flow.
  const { callProvider } = useConfiguredKycApi();

  const extractFromFile = useCallback(
    async (file: File, documentType: OcrDocumentType, _vendorId?: string) => {
      const cfg = OCR_PROVIDER_BY_KIND[documentType];
      // Always normalize uploads to a single JPEG before sending to the
      // OCR provider. Surepass and most providers only reliably read
      // images. If conversion fails we surface an error rather than
      // silently sending a raw PDF.
      let fileForOcr: File = file;
      try {
        fileForOcr = await normalizeUploadToImage(file);
      } catch (err) {
        console.warn("[KYC] file→image conversion failed, sending original to provider", err);
        fileForOcr = file;
      }

      const r = await callProvider({ providerName: cfg.provider, file: fileForOcr });
      // Surface upstream provider identity + message_code/status_code so it's
      // obvious the call hit the configured provider (not Gemini).
      toastKycResult(cfg.label, r);
      if (!r.found && !r.message_code) {
        return {
          success: false as const,
          error: `${cfg.label} provider not configured. Add it in KYC & Validation API Settings.`,
        };
      }
      // Merge mapped `data` with `raw.data` so a misconfigured
      // `response_data_mapping` (e.g. admin pasted the sample response instead
      // of dotted JSON paths) doesn't blank out the extracted fields. Also
      // unwraps Surepass `{ value, confidence }` objects to plain strings.
      const merged = mergeOcrExtracted(r.data, r.raw);
      const hasAnyValue = Object.values(merged).some(
        (v) => v != null && v !== "" && typeof v !== "boolean",
      );
      if (!r.ok || !hasAnyValue) {
        return {
          success: false as const,
          error: r.message || `${cfg.label} failed`,
          extracted: merged,
        };
      }
      // Normalize PAN OCR shape: Surepass returns full_name, the rest of this
      // component expects holder_name. Alias without losing the original key.
      const extracted: Record<string, any> = { ...merged };
      if (documentType === "pan") {
        if (extracted.full_name && !extracted.holder_name) extracted.holder_name = extracted.full_name;
      }
      if (
        documentType === "cheque" &&
        (!("account_number" in (r.data || {})) || !("ifsc_code" in (r.data || {})))
      ) {
        console.warn(
          "[BANK_OCR] response_data_mapping missing fields — recovered from raw.data",
          { mappedKeys: Object.keys(r.data || {}), recoveredKeys: Object.keys(extracted) },
        );
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
      // Seed apiData with the same registry-canonical values so EditableOcrField
      // renders green borders + "…is verified" text on the Edit screen exactly
      // as after a fresh verification.
      apiData: {
        legalName: initialData.gst.apiName,
        legal_name: initialData.gst.apiName || initialData.gst.legalName,
        trade_name: initialData.gst.tradeName,
        gstin: initialData.gst.gstin,
        constitution_of_business: initialData.gst.constitutionOfBusiness,
        principal_place_of_business: initialData.gst.principalPlaceOfBusiness,
        gst_status: initialData.gst.status,
        registration_date: initialData.gst.registrationDate,
        taxpayer_type: initialData.gst.taxpayerType,
        jurisdiction_centre: initialData.gst.jurisdictionCentre,
        jurisdiction_state: initialData.gst.jurisdictionState,
      },
      nameMatchScore: initialData.gst.nameMatchScore,
      verifiedAt: Date.now(),
      ...persistedFileMeta(initialData.gstCertificateFile),
    };
  });
  const [editablePrincipalPlace, setEditablePrincipalPlace] = useState<string>(
    initialData?.gst?.principalPlaceOfBusiness || initialData?.gst?.address || "",
  );

  const [gstDeclarationFile, setGstDeclarationFile] = useState<File | null>(initialData?.gstSelfDeclarationFile ?? null);
  const [gstDeclarationReason, setGstDeclarationReason] = useState<string>(initialData?.gstDeclarationReason ?? "");

  // GST Filing Status (post-validation) — last 3 months from GST_FILING
  const [gstFilingRows, setGstFilingRows] = useState<FilingStatusRow[]>(
    () => normalizeFilingStatus((initialData?.gst as any)?.filing_status),
  );
  const [gstFilingChecked, setGstFilingChecked] = useState<boolean>(
    () => normalizeFilingStatus((initialData?.gst as any)?.filing_status).length > 0,
  );
  const [gstFilingChecking, setGstFilingChecking] = useState(false);
  const [gstCompliance, setGstCompliance] = useState<{ previousMonthFiled: boolean; declarationRequired: boolean; checkedPeriod: string } | null>(
    () => {
      const rows = normalizeFilingStatus((initialData?.gst as any)?.filing_status);
      return rows.length ? evaluateGstr1Compliance(rows) : null;
    },
  );

  const [msmeDeclarationFile, setMsmeDeclarationFile] = useState<File | null>(initialData?.msmeSelfDeclarationFile ?? null);
  const [msmeDeclarationReason, setMsmeDeclarationReason] = useState<string>(initialData?.msmeDeclarationReason ?? "");
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
    const data = {
      pan_number: initialData.pan.number,
      holder_name: initialData.pan.holderName,
      status: initialData.panStatus ?? undefined,
      aadhaar_linked: initialData.panAadhaarLinked ?? undefined,
    };
    return {
      status: "verified",
      ocrData: data,
      originalOcrData: data,
      apiData: {
        name: initialData.pan.apiName,
        panStatus: initialData.panStatus ?? null,
        aadhaarLinked: initialData.panAadhaarLinked ?? null,
        panComprehensiveVerifiedAt: initialData.panComprehensiveVerifiedAt ?? null,
        normalized: {
          pan_number: initialData.pan.number,
          holder_name: initialData.pan.holderName,
          status: initialData.panStatus ?? null,
          aadhaar_linked: initialData.panAadhaarLinked ?? null,
        },
      },
      nameMatchScore: initialData.pan.nameMatchScore,
      verifiedAt: Date.now(),
      ...persistedFileMeta(initialData.panCardFile),
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
      apiData: {
        name: initialData.msme.apiName,
        normalized: {
          udyam_number: initialData.msme.udyamNumber,
          enterprise_name: initialData.msme.apiName || initialData.msme.enterpriseName,
          enterprise_type: initialData.msme.enterpriseType,
          major_activity: initialData.msme.majorActivity,
        },
      },
      nameMatchScore: initialData.msme.nameMatchScore,
      verifiedAt: Date.now(),
      ...persistedFileMeta(initialData.msmeCertificateFile),
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
      apiData: {
        name: initialData.bank.apiName,
        normalized: {
          account_number: initialData.bank.accountNumber,
          ifsc_code: initialData.bank.ifsc,
          bank_name: initialData.bank.bankName,
          branch_name: initialData.bank.branchName,
          account_holder_name: initialData.bank.apiName || initialData.bank.accountHolderName,
        },
      },
      verifiedAt: Date.now(),
      ...persistedFileMeta(initialData.cancelledChequeFile),
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

  // Stage 4b: Optional Secondary Bank
  const [bank2Enabled, setBank2Enabled] = useState<boolean>(!!initialData?.bank2);
  const [bankDoc2, setBankDoc2] = useState<DocState>(() => {
    if (!initialData?.bank2) return idleDoc;
    const data = {
      account_number: initialData.bank2.accountNumber,
      ifsc_code: initialData.bank2.ifsc,
      bank_name: initialData.bank2.bankName,
      branch_name: initialData.bank2.branchName,
      account_holder_name: initialData.bank2.accountHolderName,
    };
    return {
      status: "verified",
      ocrData: data,
      originalOcrData: data,
      apiData: {
        name: initialData.bank2.apiName,
        normalized: {
          account_number: initialData.bank2.accountNumber,
          ifsc_code: initialData.bank2.ifsc,
          bank_name: initialData.bank2.bankName,
          branch_name: initialData.bank2.branchName,
          account_holder_name: initialData.bank2.apiName || initialData.bank2.accountHolderName,
        },
      },
      verifiedAt: Date.now(),
      ...persistedFileMeta(initialData.cancelledChequeFile2),
    };
  });
  const [bankAccountType2, setBankAccountType2] = useState<string>(
    initialData?.bank2?.accountType || "current",
  );
  const [bankBranchAddress2, setBankBranchAddress2] = useState<string>(
    initialData?.bank2?.bankAddress || "",
  );
  const [bankBranchAutoFilled2, setBankBranchAutoFilled2] = useState(false);
  const bankAddressTouchedRef2 = useRef(!!initialData?.bank2?.bankAddress);

  // Cross-tab name-mismatch popup. Used for MSME (Enterprise Name vs
  // GST/PAN) and Bank (Account Holder Name vs GST/PAN). The dialog also
  // forces the user back onto the offending tab so they cannot proceed.
  const [mismatchDialog, setMismatchDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  });

  // Manual bank-entry popup — opened when cheque OCR / penny-drop fails.
  // Vendor types Account Number + IFSC, we re-call the configured BANK
  // provider, and on success populate the bank doc as if cheque OCR had worked.
  const chequeTargetRef = useRef<"primary" | "secondary">("primary");
  // Track the most-recently uploaded cheque File per slot so the manual-entry
  // popup can attach it to the verified state (otherwise re-uploads get lost
  // and DMS keeps showing the first uploaded cheque).
  const lastBankFileRef = useRef<File | null>(null);
  const lastBankFile2Ref = useRef<File | null>(null);
  const [bankPopup, setBankPopup] = useState<{
    open: boolean;
    target: "primary" | "secondary";
    reason: string;
    account: string;
    ifsc: string;
    submitting: boolean;
    error: string;
  }>({ open: false, target: "primary", reason: "", account: "", ifsc: "", submitting: false, error: "" });

  const openBankManualPopup = (
    target: "primary" | "secondary",
    reason: string,
    prefillAccount = "",
    prefillIfsc = "",
  ) => {
    setBankPopup({
      open: true,
      target,
      reason,
      account: prefillAccount,
      ifsc: prefillIfsc,
      submitting: false,
      error: "",
    });
  };

  // Manual entry fallback popups for GST / PAN — opened when OCR is unreadable
  // or the validation API rejects the extracted value. Vendor types the ID and
  // we re-run the existing GST / PAN Comprehensive provider.
  const [gstManualPopup, setGstManualPopup] = useState<{ open: boolean; reason: string; prefill: string }>({
    open: false, reason: "", prefill: "",
  });
  const [panManualPopup, setPanManualPopup] = useState<{ open: boolean; reason: string; prefill: string }>({
    open: false, reason: "", prefill: "",
  });
  const openGstManualPopup = (reason: string, prefill = "") =>
    setGstManualPopup({ open: true, reason, prefill });
  const openPanManualPopup = (reason: string, prefill = "") =>
    setPanManualPopup({ open: true, reason, prefill });


  // ---------- Verification ----------
  // For GST, hit the configured `GST` provider (Surepass GSTIN validation).
  // Other kinds still use a lightweight simulation pending real provider wiring.
  const verifyApi = async (kind: OcrDocumentType, ocr: Record<string, any>) => {
    if (kind === "gst") {
      let ocrGstin = String(ocr.gstin || "").toUpperCase().trim();
      if (!ocrGstin || ocrGstin.length !== 15) {
        // Fallback: if OCR didn't read a 15-char GSTIN (PDF rasterisation can
        // fail on self-hosted servers), use any GSTIN already known on this
        // vendor record so verification still chains automatically.
        const known = String(
          initialData?.gst?.gstin || gstDoc.ocrData?.gstin || "",
        ).toUpperCase().trim();
        if (known.length === 15) {
          ocrGstin = known;
          ocr.gstin = known;
        } else {
          return {
            ok: false as const,
            message: "Could not read GSTIN from the certificate. Please re-upload a clearer scan or enter the 15-character GSTIN.",
          };
        }
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
      // The admin-configured response mapping may omit the address field.
      // Fall back to the raw upstream response so we always have the
      // registry's canonical Principal Place of Business.
      const rawData: Record<string, any> =
        (r.raw && typeof r.raw === "object" && (r.raw as any).data && typeof (r.raw as any).data === "object")
          ? (r.raw as any).data
          : {};
      const pickAddress = (src: Record<string, any>): string | undefined => {
        const candidates = [
          src.principal_place_of_business,
          src.principalPlaceOfBusiness,
          src.principal_address,
          src.address,
          src.pradr,
          src.pradr_addr,
        ];
        for (const c of candidates) {
          if (typeof c === "string" && c.trim().length > 0) return c.trim();
          if (c && typeof c === "object") {
            // Surepass nested shapes: { addr: "...", building_name, ... }
            const nested = (c as any).addr || (c as any).address || (c as any).full_address;
            if (typeof nested === "string" && nested.trim().length > 0) return nested.trim();
          }
        }
        return undefined;
      };
      const registryAddress = pickAddress(d) || pickAddress(rawData);
      // Parse the structured Principal Address (Surepass returns `pradr.addr`
      // with `city/dst/stcd/pncd`) so we can populate the Address step's
      // City / State / PIN Code fields without the vendor re-typing them.
      const pickAddressParts = (src: Record<string, any>): { city?: string; state?: string; pincode?: string; address?: string } => {
        const candidates = [src.pradr, src.principal_address, src.principal_place_address, src.pradr_addr, src.address];
        for (const c of candidates) {
          if (c && typeof c === "object") {
            const inner = (c as any).addr && typeof (c as any).addr === "object" ? (c as any).addr : c;
            const city = String(inner.city || inner.loc || inner.locality || "").trim();
            const state = String(inner.stcd || inner.state || "").trim();
            const pincode = String(inner.pncd || inner.pincode || inner.pin || "").trim();
            const addr = String(inner.bnm || inner.building_name || inner.st || inner.street || "").trim();
            if (city || state || pincode) {
              return { city: city || undefined, state: state || undefined, pincode: pincode || undefined, address: addr || undefined };
            }
          }
        }
        return {};
      };
      let addressParts = pickAddressParts(d).city || pickAddressParts(d).state || pickAddressParts(d).pincode
        ? pickAddressParts(d)
        : pickAddressParts(rawData);
      // String-address fallback: when the registry returns Principal Place of
      // Business as a plain comma-delimited string, parse PIN / State / City
      // from the tail so the Address step can auto-fill those fields.
      if (!addressParts.city && !addressParts.state && !addressParts.pincode && registryAddress) {
        addressParts = parseAddressString(registryAddress);
      }
      // Normalize API field names to the keys the UI reads from `ocrData`.
      const normalized: Record<string, any> = {
        gstin: apiGstin || ocrGstin,
        legal_name: d.legal_name || rawData.legal_name,
        trade_name: d.trade_name || d.business_name || rawData.trade_name || rawData.business_name,
        constitution_of_business: d.constitution_of_business || rawData.constitution_of_business,
        principal_place_of_business: registryAddress,
        address: registryAddress,
        gst_status: d.gstin_status || d.gst_status || rawData.gstin_status || rawData.gst_status,
        registration_date: d.date_of_registration || d.registration_date || rawData.date_of_registration || rawData.registration_date,
        taxpayer_type: d.taxpayer_type || rawData.taxpayer_type,
        business_nature: Array.isArray(d.nature_bus_activities)
          ? d.nature_bus_activities
          : (d.nature_of_core_business_activity_description
              ? [d.nature_of_core_business_activity_description]
              : (Array.isArray(rawData.nature_bus_activities)
                  ? rawData.nature_bus_activities
                  : (rawData.nature_of_core_business_activity_description
                      ? [rawData.nature_of_core_business_activity_description]
                      : undefined))),
        jurisdiction_centre: d.center_jurisdiction || d.jurisdiction_centre || rawData.center_jurisdiction || rawData.jurisdiction_centre,
        jurisdiction_state: d.state_jurisdiction || d.jurisdiction_state || rawData.state_jurisdiction || rawData.jurisdiction_state,
        pan_number: d.pan_number || rawData.pan_number,
        address_city: addressParts.city,
        address_state: addressParts.state || (d.state_jurisdiction || rawData.state_jurisdiction || "").toString().replace(/^State\s*-\s*/i, "").trim() || undefined,
        address_pincode: addressParts.pincode,
        address_line: addressParts.address,
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
      // PAN flow: OCR has already run. Always call PAN Comprehensive Validation
      // after a valid PAN is read, then keep the existing GST cross-check gate.
      const ocrPan = String(ocr.pan_number || "").toUpperCase().trim();
      const ocrName = String(ocr.full_name || ocr.holder_name || ocr.name || "").trim();
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(ocrPan)) {
        return { ok: false as const, message: "Could not read a valid 10-character PAN. Please upload a clearer scan." };
      }

      const r = await callProvider({
        providerName: "PAN",
        input: { id_number: ocrPan, pan: ocrPan, pan_number: ocrPan },
      });
      toastKycResult("PAN", r);
      if (!r.found) {
        return {
          ok: false as const,
          message: "PAN Comprehensive Validation provider is not configured. Add it in KYC & Validation API Settings.",
        };
      }
      const comprehensive = extractPanComprehensiveFields(r);
      const rawData: Record<string, any> =
        (r.raw && typeof r.raw === "object" && (r.raw as any).data && typeof (r.raw as any).data === "object")
          ? (r.raw as any).data
          : {};
      const apiStatus = String(comprehensive.status ?? "").toLowerCase().trim();
      if (!r.ok || apiStatus !== "valid") {
        return {
          ok: false as const,
          message: r.message || "PAN validation failed. Please upload a clearer PAN card and try again.",
        };
      }
      const apiName = String(
        (r.data as any)?.full_name ||
        (r.data as any)?.name ||
        (r.data as any)?.holder_name ||
        rawData.full_name ||
        rawData.name ||
        ""
      ).trim();

      if (isGstRegistered === true) {
        const gstin = String(gstDoc.ocrData?.gstin || "").toUpperCase().trim();
        const panFromGst = gstin.slice(2, 12);
        const gstLegal = String(gstDoc.ocrData?.legal_name || "").trim();
        if (panFromGst.length === 10 && panFromGst !== ocrPan) {
          return {
            ok: false as const,
            message: `PAN on card (${ocrPan}) does not match PAN derived from GSTIN (${panFromGst}).`,
          };
        }
        // Prefer the PAN Verification API name over the OCR-extracted name for
        // cross-checking against GST Legal Name, so OCR reading errors don't
        // create false mismatches.
        const panNameForMatch = apiName || ocrName;
        if (panNameForMatch && gstLegal && nameMatchPercentage(panNameForMatch, gstLegal) < 40) {
          return {
            ok: false as const,
            message: "PAN Holder Name does not match GST Legal Name.",
          };
        }
        const holderName = panNameForMatch || gstLegal;
        const normalized: Record<string, any> = {
          pan_number: ocrPan,
          holder_name: holderName,
          full_name: holderName,
          status: comprehensive.status,
          aadhaar_linked: comprehensive.aadhaarLinked,
        };
        if (vendorId) {
          try {
            const panPatch: Record<string, unknown> = {
              pan_holder_name: holderName || null,
            };
            if (comprehensive.status != null) panPatch.pan_status = comprehensive.status;
            if (comprehensive.aadhaarLinked != null) panPatch.pan_aadhaar_linked = comprehensive.aadhaarLinked;
            await supabase.from('vendors').update(panPatch).eq('id', vendorId);
          } catch (e) {
            console.warn('[PAN Comprehensive] persist failed', e);
          }
        }
        return {
          ok: true as const,
          apiData: {
            name: holderName,
            pan: ocrPan,
            source: "GST cross-check",
            status: "valid",
            panStatus: comprehensive.status,
            aadhaarLinked: comprehensive.aadhaarLinked,
            panComprehensiveVerifiedAt: new Date().toISOString(),
            panMatchMessage: "PAN verified against GST registry.",
          },
          normalized,
          registeredName: holderName,
        };
      }

      const holderName = ocrName || apiName;
      // Persist PAN Comprehensive result on the vendor row so approvers can see it.
      if (vendorId) {
        try {
          const panPatch: Record<string, unknown> = {
            pan_holder_name: holderName || null,
          };
          if (comprehensive.status != null) panPatch.pan_status = comprehensive.status;
          if (comprehensive.aadhaarLinked != null) panPatch.pan_aadhaar_linked = comprehensive.aadhaarLinked;
          await supabase.from('vendors').update(panPatch).eq('id', vendorId);
        } catch (e) {
          console.warn('[PAN Comprehensive] persist failed', e);
        }
      }

      const normalized: Record<string, any> = {
        pan_number: ocrPan,
        holder_name: holderName,
        full_name: holderName,
        status: comprehensive.status,
        aadhaar_linked: comprehensive.aadhaarLinked,
      };
      return {
        ok: true as const,
        apiData: {
          name: holderName,
          pan: ocrPan,
          source: "PAN verification",
          status: "valid",
          panStatus: comprehensive.status,
          aadhaarLinked: comprehensive.aadhaarLinked,
          panComprehensiveVerifiedAt: new Date().toISOString(),
          panMatchMessage: "PAN details validated successfully from PAN verification.",
        },
        normalized,
        registeredName: holderName,
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
        classification_year: pickStr(registry.classification_year) || ocr.classification_year,
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
      // Cross-check: Enterprise Name vs ANY of GST Legal / PAN Holder / Bank
      // Account Holder names (>=20% to pass against any one).
      const msmeName = String(normalized.enterprise_name || "").trim();
      const evalRes = evaluateCrossNameMatch(msmeName, [
        { field: "GST Legal Name", value: gstDoc.ocrData?.legal_name },
        { field: "GST Trade Name", value: gstDoc.ocrData?.trade_name || gstDoc.ocrData?.business_name },
        { field: "PAN Holder Name", value: panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name },
        { field: "Bank Account Holder Name", value: bankDoc.ocrData?.account_holder_name },
      ]);
      if (!evalRes.skipped && !evalRes.passed) {
        return {
          ok: false as const,
          message: formatCrossMatchFailure("Enterprise Name", evalRes.best),
          isNameMismatch: true,
        } as any;
      }
      const enterpriseNameMessage = !evalRes.skipped && evalRes.passed
        ? formatCrossMatchSuccess("Enterprise Name", evalRes.matches)
        : undefined;
      return {
        ok: true as const,
        apiData: { name: normalized.enterprise_name, enterpriseName: normalized.enterprise_name, udyamNumber: normalized.udyam_number, enterpriseNameMessage },
        normalized,
        registeredName: normalized.enterprise_name,
      };
    }
    // Bank (cheque) → call configured BANK provider (Surepass penny-drop)
    // Defensive unwrap in case OCR mapping ever returns {value,confidence}.
    const pickStr = (v: any): string => {
      if (v == null) return "";
      if (typeof v === "string" || typeof v === "number") return String(v);
      if (typeof v === "object" && "value" in v) return String((v as any).value ?? "");
      return "";
    };
    const ocrAccountRaw = pickStr(ocr.account_number).replace(/\s+/g, "");
    const ocrIfscRaw = pickStr(ocr.ifsc_code).toUpperCase().trim();
    if (!/^\d{8,18}$/.test(ocrAccountRaw)) {
      return { ok: false as const, message: "Could not read a valid account number from the cheque. Please upload a clearer scan." };
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ocrIfscRaw)) {
      return { ok: false as const, message: "Could not read a valid 11-character IFSC from the cheque. Please upload a clearer scan." };
    }
    // Surepass throttles the penny-drop endpoint aggressively. We do NOT
    // auto-retry here — repeated automatic calls were the root cause of the
    // "Transaction rate limit exceeded" loop seen from the integrated app.
    // A single user action triggers exactly one BANK provider call; if the
    // upstream is throttled, surface the real provider message and let the
    // vendor retry manually.
    const isRateLimited = (res: any) =>
      res && (res.found || res.message_code) &&
      typeof res.message === "string" &&
      /rate limit|too many requests|throttl/i.test(res.message);

    const r = await callProvider({
      providerName: "BANK",
      input: { account: ocrAccountRaw, ifsc: ocrIfscRaw, id_number: ocrAccountRaw },
    });
    toastKycResult("Bank", r);

    // Always prefer the upstream message verbatim — never hardcode UI copy
    // for provider-side failures. Surepass returns a meaningful `message`
    // for both success and error cases; surface it as-is.
    const upstreamMsg =
      (typeof (r as any)?.message === "string" && (r as any).message) ||
      ((r as any)?.raw && typeof (r as any).raw.message === "string" && (r as any).raw.message) ||
      "";
    const upstreamCode =
      (r as any)?.message_code ||
      ((r as any)?.raw && (r as any).raw.message_code) ||
      undefined;

    // Hard-fail on persistent rate limit. Vendor must re-upload and try again
    // — they should NOT be allowed to continue without a real penny-drop.
    if (isRateLimited(r)) {
      return {
        ok: false as const,
        message: upstreamMsg || "Bank verification rate limited by provider. Please try again shortly.",
        messageCode: upstreamCode,
        reason: "rate_limited" as const,
      };
    }

    if (!r.found) {
      return { ok: false as const, message: upstreamMsg || "Bank validation provider is not configured. Add it in KYC & Validation API Settings." };
    }
    if (!r.ok || !r.data) {
      return { ok: false as const, message: upstreamMsg || "Bank verification failed. Please check the details or try again.", messageCode: upstreamCode };
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
    // depending on the upstream provider. Also fall back to raw.data.full_name
    // for nested provider shapes (e.g. Surepass).
    const rawData = (r.raw && typeof r.raw === "object" && (r.raw as any).data) || {};
    const nameAtBank = String(
      d.full_name || d.name_at_bank || rawData.full_name || "",
    ).trim();

    // Cross-field match: Account Holder Name vs ANY of GST Legal / PAN Holder
    // / MSME Enterprise names (>=20% against any one).
    const gstLegalName = String(gstDoc.ocrData?.legal_name || "").trim();
    const gstTradeName = String(gstDoc.ocrData?.trade_name || gstDoc.ocrData?.business_name || "").trim();
    const panHolderName = String(
      panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name || "",
    ).trim();
    const msmeEnterpriseName = String(msmeDoc.ocrData?.enterprise_name || "").trim();

    let holderNameStatus: "passed" | "none" = "none";
    let holderNameMessage = "";
    if (nameAtBank) {
      const evalRes = evaluateCrossNameMatch(nameAtBank, [
        { field: "GST Legal Name", value: gstLegalName },
        { field: "GST Trade Name", value: gstTradeName },
        { field: "PAN Holder Name", value: panHolderName },
        { field: "MSME Enterprise Name", value: msmeEnterpriseName },
      ], { minPass: 20, requireWordOverlap: true });
      if (!evalRes.skipped) {
        if (!evalRes.passed) {
          return {
            ok: false as const,
            message: formatCrossMatchFailure("Account Holder Name", evalRes.best),
            isNameMismatch: true as const,
          };
        }
        holderNameStatus = "passed";
        holderNameMessage = formatCrossMatchSuccess("Account Holder Name", evalRes.matches);
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

  /**
   * Provider/transport-level failures (bad request shape, unsupported input,
   * provider not configured) — these are NOT "the document couldn't be read",
   * so we must not prompt the vendor for manual entry.
   */
  const isProviderConfigError = (msg?: string) => {
    const m = (msg || "").toLowerCase();
    if (!m) return false;
    return (
      m.includes("use_pdf") ||
      m.includes("pdf input") ||
      m.includes("multipart") ||
      m.includes("file required") ||
      m.includes("provider is not configured") ||
      m.includes("not configured") ||
      m.includes("invalid request") ||
      m.includes("unsupported file")
    );
  };

  const runDocFlow = async (
    kind: OcrDocumentType,
    file: File,
    setDoc: (d: DocState) => void,
    afterVerifiedOcrName: () => string | undefined,
    extraValidation?: (ocr: Record<string, any>, apiData: any) => string | null,
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, file, errorMessage: "File must be under 5 MB" });
      return;
    }
    setDoc({ status: "uploading", fileName: file.name, fileSize: file.size, file });
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      setDoc({ status: "preparing", fileName: file.name, fileSize: file.size, file });
    }
    setDoc({ status: "ocr", fileName: file.name, fileSize: file.size, file });
    const ocrRes = await extractFromFile(file, kind, vendorId);
    if (!ocrRes.success || !ocrRes.extracted) {
      const errMsg = ocrRes.error || "Could not read document";
      const providerIssue = isProviderConfigError(ocrRes.error);
      setDoc({
        status: "failed",
        fileName: file.name,
        fileSize: file.size,
        file,
        errorMessage: providerIssue
          ? `${errMsg} — the document couldn't be sent to the verification service. Please re-upload the document (or try a clear image) and retry.`
          : errMsg,
      });
      if (providerIssue) {
        // Not an OCR read failure — do not offer manual entry.
        return;
      }
      if (kind === "cheque") {
        openBankManualPopup(
          chequeTargetRef.current,
          ocrRes.error || "We couldn't read your cheque. Please enter your bank details manually.",
        );
      } else if (kind === "gst") {
        openGstManualPopup(
          "We couldn't read your GST certificate. Please enter your 15-character GSTIN and we'll verify it.",
        );
      } else if (kind === "pan") {
        openPanManualPopup(
          "We couldn't read your PAN card. Please enter your 10-character PAN and we'll verify it.",
        );
      }
      return;
    }

    const conf = ocrRes.confidence ?? 0;
    if (conf < 0.5) {
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, file, ocrData: ocrRes.extracted, errorMessage: "Couldn't read clearly — please upload a sharper scan." });
      if (kind === "cheque") {
        const acc = String((ocrRes.extracted as any).account_number ?? "").replace(/\s+/g, "");
        const ifsc = String((ocrRes.extracted as any).ifsc_code ?? "").toUpperCase().trim();
        openBankManualPopup(
          chequeTargetRef.current,
          "We couldn't read your cheque clearly. Please enter your bank details manually.",
          acc,
          ifsc,
        );
      } else if (kind === "gst") {
        const gstin = String((ocrRes.extracted as any).gstin ?? "").toUpperCase().trim();
        openGstManualPopup(
          "We couldn't read your GST certificate clearly. Please enter your 15-character GSTIN.",
          gstin,
        );
      } else if (kind === "pan") {
        const pan = String((ocrRes.extracted as any).pan_number ?? "").toUpperCase().trim();
        openPanManualPopup(
          "We couldn't read your PAN card clearly. Please enter your 10-character PAN.",
          pan,
        );
      }
      return;
    }
    setDoc({ status: "verifying", fileName: file.name, fileSize: file.size, file, ocrData: ocrRes.extracted, ocrModel: ocrRes.model });
    const v = await verifyApi(kind, ocrRes.extracted);
    if (!v.ok) {
      const msg = (v as any).message || "Verification failed";
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, file, ocrData: ocrRes.extracted, ocrModel: ocrRes.model, errorMessage: msg });
      // Surface a hard popup for cross-tab name mismatches and force the
      // user back onto the offending tab so they cannot navigate forward.
      if (kind === "msme" && (v as any).isNameMismatch) {
        setMismatchDialog({ open: true, title: "Enterprise Name mismatch", message: msg });
        setActiveTab("msme");
      } else if (kind === "cheque" && !(v as any).isNameMismatch && !isProviderConfigError(msg)) {
        // For cheque/penny-drop failures that indicate the cheque couldn't
        // be read or verified (rate-limit, OCR mismatch, upstream 500,
        // account not found, etc.) — let the vendor enter bank details
        // manually and re-verify via the configured BANK API.
        // Skip the manual popup for pure cross-field Account Holder Name
        // mismatches and for provider/transport errors (use_pdf, multipart).
        const acc = String((ocrRes.extracted as any).account_number ?? "").replace(/\s+/g, "");
        const ifsc = String((ocrRes.extracted as any).ifsc_code ?? "").toUpperCase().trim();
        setActiveTab("bank");
        openBankManualPopup(chequeTargetRef.current, msg, acc, ifsc);

      } else if (kind === "gst") {
        const gstin = String((ocrRes.extracted as any).gstin ?? "").toUpperCase().trim();
        openGstManualPopup(msg, gstin);
      } else if (kind === "pan") {
        // Skip manual entry when the failure is a PAN-vs-GSTIN mismatch —
        // allowing manual entry would let the vendor bypass the check by
        // typing the GST-derived PAN even though the uploaded PAN card
        // belongs to a different entity. Vendor must upload the correct
        // PAN document instead.
        const isPanGstMismatch = /does not match PAN derived from GSTIN/i.test(msg);
        if (!isPanGstMismatch) {
          const pan = String((ocrRes.extracted as any).pan_number ?? "").toUpperCase().trim();
          openPanManualPopup(msg, pan);
        }
      }
      return;
    }
    const extraErr = extraValidation?.(ocrRes.extracted, v.apiData) ?? null;
    if (extraErr) {
      setDoc({ status: "failed", fileName: file.name, fileSize: file.size, file, ocrData: ocrRes.extracted, apiData: v.apiData, ocrModel: ocrRes.model, errorMessage: extraErr });
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

  // ---------- Toggle handlers: clear stale data when Yes/No flips ----------
  const handleGstRegisteredChange = useCallback((next: boolean | null) => {
    setIsGstRegistered((prev) => {
      if (prev === next) return prev;
      // Reset GST verification state regardless of direction so previously
      // fetched fields/files cannot leak into the new selection's payload.
      setGstDoc(idleDoc);
      setEditablePrincipalPlace("");
      // Clear self-declaration / manual fields when leaving the No path.
      if (next !== false) {
        setGstDeclarationFile(null);
        setGstDeclarationReason("");
        setManualLegalName("");
        setManualAddress({ address: "", city: "", state: "", pincode: "" });
      }
      // GST is the top of the chain — cascade-clear PAN, MSME, and Bank.
      setPanDoc(idleDoc);
      setPanCrossCheckError(null);
      setMsmeDoc(idleDoc);
      setMsmeManualNumber("");
      setMsmeManualError(null);
      setMsmeDeclarationFile(null);
      setMsmeDeclarationReason("");
      setIsMsmeRegistered(null);
      setBankDoc(idleDoc);
      setBankDoc2(idleDoc);
      lastBankFileRef.current = null;
      lastBankFile2Ref.current = null;
      setBankPopup((p) => ({ ...p, open: false }));
      return next;
    });
  }, []);

  const handleMsmeRegisteredChange = useCallback((next: boolean | null) => {
    setIsMsmeRegistered((prev) => {
      if (prev === next) return prev;
      setMsmeDoc(idleDoc);
      if (next !== false) {
        setMsmeDeclarationFile(null);
        setMsmeDeclarationReason("");
      }
      // Bank depends on MSME — clear dependent bank state too.
      resetBankCascade();
      return next;
    });
  }, []);

  // ---------- Cascading reset helpers ----------
  // When a parent document (GST → PAN → MSME → Bank) is uploaded, replaced, or
  // reset, every dependent document and its captured data must be cleared so
  // stale verification results never leak into the new submission payload.
  const resetBankCascade = useCallback(() => {
    setBankDoc(idleDoc);
    setBankDoc2(idleDoc);
    lastBankFileRef.current = null;
    lastBankFile2Ref.current = null;
    setBankPopup((p) => ({ ...p, open: false }));
  }, []);

  const resetMsmeCascade = useCallback(() => {
    setMsmeDoc(idleDoc);
    setMsmeManualNumber("");
    setMsmeManualError(null);
    setMsmeDeclarationFile(null);
    setMsmeDeclarationReason("");
    setIsMsmeRegistered(null);
    resetBankCascade();
  }, [resetBankCascade]);

  const resetPanCascade = useCallback(() => {
    setPanDoc(idleDoc);
    setPanCrossCheckError(null);
    resetMsmeCascade();
  }, [resetMsmeCascade]);

  const resetGstAux = useCallback(() => {
    setGstDeclarationFile(null);
    setGstDeclarationReason("");
    setEditablePrincipalPlace("");
    setGstFilingRows([]);
    setGstFilingChecked(false);
    setGstCompliance(null);
  }, []);

  const effectiveLegalName = useMemo(() => {
    if (isGstRegistered === true) return gstDoc.ocrData?.legal_name || gstDoc.apiData?.legalName;
    if (isGstRegistered === false) return manualLegalName;
    return undefined;
  }, [isGstRegistered, gstDoc, manualLegalName]);

  // Calls the GST_FILING provider to fetch last-3-months filing status,
  // saves it onto the vendor_validations row, and updates local state.
  const runGstFilingStatusCheck = async (baseGstData: Record<string, any>) => {
    const gstin = String(baseGstData?.gstin || "").toUpperCase().trim();
    if (!gstin) return;
    setGstFilingChecking(true);
    try {
      const r = await callProvider({
        providerName: "GST_FILING",
        input: { id_number: gstin, gstin },
      });
      // Prefer the dedicated GST_FILING response, fall back to the
      // filing_status returned by the main GST validation call.
      const filingSrc =
        r.found && r.ok && r.data
          ? (r.data.filing_status ?? baseGstData.filing_status)
          : baseGstData.filing_status;
      const rows = normalizeFilingStatus(filingSrc);
      setGstFilingRows(rows);
      setGstFilingChecked(true);
      const evalRes = rows.length
        ? evaluateGstr1Compliance(rows)
        : { previousMonthFiled: false, declarationRequired: false, checkedPeriod: "" };
      setGstCompliance(evalRes);
      // Persist the filing status onto the vendor_validations GST row so the
      // View Details "GST Compliance Report" popup can render the real table.
      if (vendorId) {
        try {
          await supabase
            .from("vendor_validations")
            .delete()
            .eq("vendor_id", vendorId)
            .eq("validation_type", "gst");
          const msg = evalRes.previousMonthFiled
            ? `GST verified — GSTR1 filed for ${evalRes.checkedPeriod}`
            : evalRes.declarationRequired
              ? `GST verified — GSTR1 for ${evalRes.checkedPeriod} not filed (declaration required)`
              : `GST verified — GSTR1 for ${evalRes.checkedPeriod} not yet filed (within grace period, due 11th)`;
          await supabase.from("vendor_validations").insert({
            vendor_id: vendorId,
            validation_type: "gst",
            status: "passed",
            message: msg,
            details: { ...baseGstData, filing_status: filingSrc },
          });
        } catch (err) {
          console.warn("[GST_FILING] Failed to persist filing status", err);
        }
      }
    } finally {
      setGstFilingChecking(false);
    }
  };

  const handleGstUpload = (file: File) => {
    // Parent of PAN/MSME/Bank — cascade-clear dependents before re-verifying.
    resetPanCascade();
    // Reset filing-status state for the new upload
    setGstFilingRows([]);
    setGstFilingChecked(false);
    setGstCompliance(null);
    // Clear stale address up front so a previous upload's value can never
    // bleed through if the new registry response is missing the field.
    setEditablePrincipalPlace("");
    return runDocFlow("gst", file, setGstDoc, () => gstDoc.ocrData?.legal_name).then(() => {
      setGstDoc((prev) => {
        // Registry response is the source of truth — always overwrite the
        // editable Principal Place of Business with the API-returned address
        // when verification succeeded. Fall back to OCR only if the API has
        // no address.
        const apiAddress =
          prev.apiData?.normalized?.principal_place_of_business ||
          prev.apiData?.normalized?.address;
        if (apiAddress) {
          setEditablePrincipalPlace(apiAddress);
        } else {
          const ocrAddress = prev.ocrData?.principal_place_of_business || prev.ocrData?.address;
          if (ocrAddress) setEditablePrincipalPlace(ocrAddress);
        }
        // Chain GST_FILING right after GSTIN validation succeeds.
        if (prev.status === "verified" && prev.ocrData?.gstin) {
          void runGstFilingStatusCheck(prev.ocrData);
        }
        return prev;
      });
    });
  };

  const handlePanUpload = (file: File) => {
    // PAN replace/upload — cascade-clear MSME and Bank.
    resetMsmeCascade();
    return runDocFlow("pan", file, setPanDoc, () => effectiveLegalName, (ocr) => {
      if (isGstRegistered === true && gstDoc.ocrData?.gstin) {
        // Prefer the canonical PAN returned by the GST validation API; fall
        // back to slicing the GSTIN (chars 3-12) only if the API didn't
        // return one (legacy / unmapped responses).
        const apiPan = String(gstDoc.ocrData.pan_number || "").toUpperCase().trim();
        const slicedPan = String(gstDoc.ocrData.gstin).slice(2, 12).toUpperCase();
        const panFromGst = apiPan || slicedPan;
        const panOcr = String(ocr.pan_number || "").toUpperCase();
        if (panFromGst.length === 10 && panOcr && panFromGst !== panOcr) {
          const src = apiPan ? "GST registry" : "GSTIN";
          setPanCrossCheckError(`PAN on card (${panOcr}) does not match PAN from ${src} (${panFromGst}).`);
          return `PAN on card (${panOcr}) does not match PAN from ${src} (${panFromGst}).`;
        }
      }
      setPanCrossCheckError(null);
      return null;
    });
  };

  const handleMsmeUpload = (file: File) => {
    // MSME upload/replace — cascade-clear Bank.
    resetBankCascade();
    return runDocFlow("msme", file, setMsmeDoc, () => effectiveLegalName);
  };

  // ----- MSME Manual Entry (Udyam Number → MSME validation API) -----
  
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
    // MSME re-validation — cascade-clear Bank so stale penny-drop data clears.
    resetBankCascade();
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
        classification_year: pickValue(d.classification_year),
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
      // Cross-tab gate: enterprise name vs ANY of GST Legal / PAN Holder /
      // Bank Account Holder names (>=20% to pass against any one).
      const evalRes = evaluateCrossNameMatch(apiName, [
        { field: "GST Legal Name", value: gstDoc.ocrData?.legal_name },
        { field: "GST Trade Name", value: gstDoc.ocrData?.trade_name || gstDoc.ocrData?.business_name },
        { field: "PAN Holder Name", value: panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name },
        { field: "Bank Account Holder Name", value: bankDoc.ocrData?.account_holder_name },
      ]);
      if (apiName && !evalRes.skipped && !evalRes.passed) {
        const msg = formatCrossMatchFailure("Enterprise Name", evalRes.best);
        setMsmeManualError(msg);
        setMsmeDoc({ status: "failed", errorMessage: msg, ocrData: ocrShape });
        setMismatchDialog({ open: true, title: "Enterprise Name mismatch", message: msg });
        setActiveTab("msme");
        return;
      }
      const score = nameMatchScore(effectiveLegalName, apiName);
      const enterpriseNameMessage = !evalRes.skipped && evalRes.passed
        ? formatCrossMatchSuccess("Enterprise Name", evalRes.matches)
        : undefined;
      setMsmeDoc({
        status: "verified",
        fileName: `Udyam ${ocrShape.udyam_number}`,
        ocrData: ocrShape,
        originalOcrData: ocrShape,
        apiData: { name: apiName, enterpriseName: apiName, udyamNumber: ocrShape.udyam_number, normalized: { ...ocrShape }, enterpriseNameMessage },
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

  const handleBankUpload = (file: File) => {
    chequeTargetRef.current = "primary";
    lastBankFileRef.current = file;
    // Clear any previously fetched/auto-filled bank data so a fresh upload
    // never inherits stale branch / address values from the prior cheque.
    setBankDoc(idleDoc);
    setBankBranchAutoFilled(false);
    if (!bankAddressTouchedRef.current) setBankBranchAddress("");
    return runDocFlow("cheque", file, setBankDoc, () => effectiveLegalName).then(async () => {
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
  };

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

  // ----- Secondary bank: same upload flow + IFSC enrichment -----
  const handleBankUpload2 = (file: File) => {
    chequeTargetRef.current = "secondary";
    lastBankFile2Ref.current = file;
    setBankDoc2(idleDoc);
    setBankBranchAutoFilled2(false);
    return runDocFlow("cheque", file, setBankDoc2, () => effectiveLegalName).then(async () => {
      setBankDoc2((prev) => {
        const ifsc = prev.ocrData?.ifsc_code;
        const hasBranch = !!(prev.ocrData?.branch_name && String(prev.ocrData.branch_name).trim());
        if (!isValidIfsc(ifsc) || hasBranch) return prev;
        lookupIfsc(ifsc).then((info) => {
          if (!info) return;
          setBankDoc2((curr) => {
            const next = { ...(curr.ocrData || {}) };
            let touched = false;
            if (info.branch && !next.branch_name) { next.branch_name = info.branch; touched = true; }
            if (info.bank && !next.bank_name) { next.bank_name = info.bank; }
            if (touched) setBankBranchAutoFilled2(true);
            return { ...curr, ocrData: next };
          });
          if (info.address && !bankAddressTouchedRef2.current) {
            setBankBranchAddress2(info.address);
          }
        });
        return prev;
      });
    });
  };

  // Submit manually-entered GSTIN → re-run GST validation and populate gstDoc
  // as if OCR had succeeded, keeping the rest of the pipeline intact.
  const handleGstManualSubmit = async (gstin: string): Promise<{ ok: boolean; message?: string }> => {
    const clean = String(gstin || "").toUpperCase().trim();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(clean)) {
      return { ok: false, message: "Please enter a valid 15-character GSTIN." };
    }
    const ocr: Record<string, any> = { gstin: clean };
    const v = await verifyApi("gst", ocr);
    if (!v.ok) return { ok: false, message: (v as any).message || "GSTIN verification failed." };
    const merged = (v as any).normalized ? { ...ocr, ...(v as any).normalized } : ocr;
    setGstDoc((prev) => ({
      status: "verified",
      fileName: prev.fileName,
      fileSize: prev.fileSize,
      file: prev.file,
      ocrData: merged,
      originalOcrData: ocr,
      apiData: { ...(v.apiData || {}), normalized: (v as any).normalized },
      verifiedAt: Date.now(),
      ocrModel: prev.ocrModel,
    }));
    const apiAddress =
      (v as any).normalized?.principal_place_of_business || (v as any).normalized?.address;
    if (apiAddress) setEditablePrincipalPlace(apiAddress);
    if (merged.gstin) void runGstFilingStatusCheck(merged);
    return { ok: true };
  };

  // Submit manually-entered PAN → re-run PAN Comprehensive Validation and
  // populate panDoc as if OCR had succeeded.
  const handlePanManualSubmit = async (pan: string): Promise<{ ok: boolean; message?: string }> => {
    const clean = String(pan || "").toUpperCase().trim();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) {
      return { ok: false, message: "Please enter a valid 10-character PAN." };
    }
    const ocr: Record<string, any> = { pan_number: clean };
    const v = await verifyApi("pan", ocr);
    if (!v.ok) return { ok: false, message: (v as any).message || "PAN verification failed." };
    const merged = (v as any).normalized ? { ...ocr, ...(v as any).normalized } : ocr;
    setPanDoc((prev) => ({
      status: "verified",
      fileName: prev.fileName,
      fileSize: prev.fileSize,
      file: prev.file,
      ocrData: merged,
      originalOcrData: ocr,
      apiData: { ...(v.apiData || {}), normalized: (v as any).normalized },
      verifiedAt: Date.now(),
      ocrModel: prev.ocrModel,
    }));
    setPanCrossCheckError(null);
    return { ok: true };
  };


  const handleBankPopupSubmit = async () => {
    const account = bankPopup.account.replace(/\s+/g, "");
    const ifsc = bankPopup.ifsc.toUpperCase().trim();
    if (account.length < 8 || !/^\d+$/.test(account)) {
      setBankPopup((p) => ({ ...p, error: "Enter a valid account number (8+ digits)." }));
      return;
    }
    if (!isValidIfsc(ifsc)) {
      setBankPopup((p) => ({ ...p, error: "Enter a valid 11-character IFSC code." }));
      return;
    }
    setBankPopup((p) => ({ ...p, submitting: true, error: "" }));
    const target = bankPopup.target;
    const setDoc = target === "secondary" ? setBankDoc2 : setBankDoc;
    setDoc((prev) => ({
      ...prev,
      status: "verifying",
      ocrData: { ...(prev.ocrData || {}), account_number: account, ifsc_code: ifsc },
    }));
    try {
      const r = await callProvider({
        providerName: "BANK",
        input: { account, ifsc, id_number: account },
      });
      toastKycResult("Bank", r);
      if (!r.found || !r.ok || !r.data) {
        setBankPopup((p) => ({
          ...p,
          submitting: false,
          error: r.message || "Bank verification failed. Please re-check the details and try again.",
        }));
        setDoc((prev) => ({ ...prev, status: "failed", errorMessage: r.message || "Bank verification failed" }));
        return;
      }
      const d = r.data as Record<string, any>;
      const apiAccount = String(d.account_number || account).replace(/\s+/g, "");
      const apiIfsc = String(d.ifsc || ifsc).toUpperCase().trim();
      const rawData = (r.raw && typeof r.raw === "object" && (r.raw as any).data) || {};
      const nameAtBank = String(d.full_name || d.name_at_bank || rawData.full_name || "").trim();

      // IFSC enrichment for bank/branch/address
      const ifscInfo = await lookupIfsc(apiIfsc);
      const bankName = String(d.bank_name || ifscInfo?.bank || "").trim();
      const branchName = String(d.branch_name || ifscInfo?.branch || "").trim();
      const branchAddress = String(d.branch_address || ifscInfo?.address || "").trim();

      // Cross-field match: Account Holder Name vs ANY of GST Legal / PAN
      // Holder / MSME Enterprise names (>=20% against any one).
      const gstLegalName = String(gstDoc.ocrData?.legal_name || "").trim();
      const gstTradeName = String(gstDoc.ocrData?.trade_name || gstDoc.ocrData?.business_name || "").trim();
      const panHolderName = String(panDoc.ocrData?.holder_name || panDoc.ocrData?.full_name || "").trim();
      const msmeEnterpriseName = String(msmeDoc.ocrData?.enterprise_name || "").trim();
      let holderNameStatus: "passed" | "none" = "none";
      let holderNameMessage = "";
      if (nameAtBank) {
        const evalRes = evaluateCrossNameMatch(nameAtBank, [
          { field: "GST Legal Name", value: gstLegalName },
          { field: "GST Trade Name", value: gstTradeName },
          { field: "PAN Holder Name", value: panHolderName },
          { field: "MSME Enterprise Name", value: msmeEnterpriseName },
        ], { minPass: 20, requireWordOverlap: true });
        if (!evalRes.skipped) {
          if (!evalRes.passed) {
            const msg = formatCrossMatchFailure("Account Holder Name", evalRes.best);
            setBankPopup((p) => ({ ...p, submitting: false, error: msg }));
            setDoc((prev) => ({ ...prev, status: "failed", errorMessage: msg }));
            return;
          }
          holderNameStatus = "passed";
          holderNameMessage = formatCrossMatchSuccess("Account Holder Name", evalRes.matches);
        }
      }

      const normalized: Record<string, any> = {
        account_number: apiAccount,
        ifsc_code: apiIfsc,
        bank_name: bankName,
        branch_name: branchName,
        account_holder_name: nameAtBank,
        branch_address: branchAddress,
      };
      // Preserve the most recently uploaded cheque File so the post-manual
      // verified state still carries it. Without this, the parent receives
      // `cancelledChequeFile = null` and the older file remains in DMS.
      const lastFile = (target === "secondary" ? lastBankFile2Ref : lastBankFileRef).current;
      const manualFileName = `Manual ${apiAccount.slice(-4).padStart(apiAccount.length, "•")}`;
      setDoc({
        status: "verified",
        file: lastFile ?? undefined,
        fileName: lastFile?.name || manualFileName,
        fileSize: lastFile?.size,
        ocrData: normalized,
        originalOcrData: normalized,
        apiData: {
          accountHolderName: nameAtBank,
          bankName,
          branchName,
          ifsc: apiIfsc,
          accountNumber: apiAccount,
          bankAddress: branchAddress,
          accountExists: d.account_exists,
          impsRefNo: d.imps_ref_no,
          holderNameStatus,
          holderNameMessage,
          normalized,
        },
        nameMatchScore: nameMatchScore(effectiveLegalName, nameAtBank),
        verifiedAt: Date.now(),
      });
      // Push branch address into the editable Bank Address field if untouched.
      if (target === "secondary") {
        if (!bankAddressTouchedRef2.current && branchAddress) setBankBranchAddress2(branchAddress);
      } else {
        if (!bankAddressTouchedRef.current && branchAddress) setBankBranchAddress(branchAddress);
      }
      setBankPopup((p) => ({ ...p, open: false, submitting: false, error: "" }));
    } catch (e: any) {
      const msg = e?.message || "Bank verification failed unexpectedly.";
      setBankPopup((p) => ({ ...p, submitting: false, error: msg }));
      setDoc((prev) => ({ ...prev, status: "failed", errorMessage: msg }));
    }
  };


  useEffect(() => {
    if (!bank2Enabled) return;
    const ifsc = bankDoc2.ocrData?.ifsc_code;
    const hasBranch = !!(bankDoc2.ocrData?.branch_name && String(bankDoc2.ocrData.branch_name).trim());
    if (!isValidIfsc(ifsc) || hasBranch) return;
    const t = setTimeout(async () => {
      const info = await lookupIfsc(ifsc!);
      if (!info) return;
      setBankDoc2((curr) => {
        const next = { ...(curr.ocrData || {}) };
        let touched = false;
        if (info.branch && !next.branch_name) { next.branch_name = info.branch; touched = true; }
        if (info.bank && !next.bank_name) { next.bank_name = info.bank; }
        if (touched) setBankBranchAutoFilled2(true);
        return { ...curr, ocrData: next };
      });
      if (info.address && !bankAddressTouchedRef2.current) {
        setBankBranchAddress2(info.address);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [bank2Enabled, bankDoc2.ocrData?.ifsc_code, bankDoc2.ocrData?.branch_name]);

  // Validate Primary vs Secondary Account Holder Name. When the secondary
  // cheque is verified, compare its holder name against the primary holder
  // name. On mismatch, surface a SweetAlert and reset all secondary fields.
  const secondaryMismatchHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bank2Enabled) return;
    if (bankDoc2.status !== "verified") return;
    if (bankDoc.status !== "verified") return;
    const primaryName = String(
      bankDoc.ocrData?.account_holder_name ||
        (bankDoc.apiData as any)?.accountHolderName ||
        "",
    ).trim();
    const secondaryName = String(
      bankDoc2.ocrData?.account_holder_name ||
        (bankDoc2.apiData as any)?.accountHolderName ||
        "",
    ).trim();
    if (!primaryName || !secondaryName) return;

    // De-dupe so we don't loop on the same verified pair.
    const key = `${primaryName}::${secondaryName}`;
    if (secondaryMismatchHandledRef.current === key) return;

    const score = nameMatchPercentage(primaryName, secondaryName);
    if (score >= 90) {
      secondaryMismatchHandledRef.current = key;
      return;
    }

    secondaryMismatchHandledRef.current = key;
    // Reset everything secondary so the vendor must re-upload.
    setBankDoc2(idleDoc);
    lastBankFile2Ref.current = null;
    setBankBranchAutoFilled2(false);
    setBankBranchAddress2("");
    setBankAccountType2("current");
    bankAddressTouchedRef2.current = false;

    Swal.fire({
      icon: "error",
      title: "Account holder mismatch",
      text: "Primary and Secondary Account Holder Names do not match.",
      confirmButtonColor: "#2563eb",
    });
  }, [
    bank2Enabled,
    bankDoc.status,
    bankDoc2.status,
    bankDoc.ocrData?.account_holder_name,
    bankDoc2.ocrData?.account_holder_name,
  ]);



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
  // GST stage requires: validation verified AND filing check completed AND
  // (latest month filed OR a self-declaration was uploaded).
  const gstFilingOk =
    gstFilingChecked && (!gstCompliance?.declarationRequired || !!gstDeclarationFile);
  const stage1Done =
    isGstRegistered === true
      ? gstDoc.status === "verified" && gstFilingOk
      : isGstRegistered === false
        ? !!gstDeclarationFile
        : false;
  const stage2Done = panDoc.status === "verified" && !panCrossCheckError;
  const stage3Done =
    (isMsmeRegistered === false && !!msmeDeclarationFile) ||
    (isMsmeRegistered === true && msmeDoc.status === "verified" && !!msmeDoc.file);
  const stage4Done =
    bankDoc.status === "verified" &&
    (!bank2Enabled || bankDoc2.status === "verified");
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
        filing_status: gstFilingRows.length ? gstFilingRows : undefined,
        filingCompliant: gstCompliance?.previousMonthFiled ?? undefined,
        addressParts: (gstDoc.ocrData.address_city || gstDoc.ocrData.address_state || gstDoc.ocrData.address_pincode || gstDoc.ocrData.address_line)
          ? {
              address: gstDoc.ocrData.address_line || undefined,
              city: gstDoc.ocrData.address_city || undefined,
              state: gstDoc.ocrData.address_state || undefined,
              pincode: gstDoc.ocrData.address_pincode || undefined,
            }
          : undefined,
      };
      // If GST filing was not compliant and a self-declaration was uploaded,
      // carry the file through so the parent saves it under gst_self_declaration.
      if (gstCompliance?.declarationRequired && gstDeclarationFile) {
        out.gstSelfDeclarationFile = gstDeclarationFile;
      }
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
      out.panStatus = panDoc.apiData?.panStatus ?? panDoc.ocrData.status ?? null;
      out.panAadhaarLinked = panDoc.apiData?.aadhaarLinked ?? normalizeBooleanLike(panDoc.ocrData.aadhaar_linked);
      out.panComprehensiveVerifiedAt = panDoc.apiData?.panComprehensiveVerifiedAt ?? null;
      out.panHolderName = panDoc.apiData?.name ?? panDoc.ocrData.holder_name ?? null;
    }
    out.isMsmeRegistered = isMsmeRegistered ?? false;
    if (isMsmeRegistered && msmeDoc.status === "verified" && msmeDoc.ocrData) {
      const msmeAddrLine = [msmeDoc.ocrData.flat, msmeDoc.ocrData.name_of_building, msmeDoc.ocrData.road, msmeDoc.ocrData.village, msmeDoc.ocrData.block]
        .map((v: any) => (v == null ? "" : String(v).trim()))
        .filter((v: string) => v && v !== "-")
        .join(", ");
      out.msme = {
        udyamNumber: msmeDoc.ocrData.udyam_number,
        enterpriseName: msmeDoc.ocrData.enterprise_name,
        enterpriseType: msmeDoc.ocrData.enterprise_type,
        majorActivity: msmeDoc.ocrData.major_activity,
        apiName: msmeDoc.apiData?.name || msmeDoc.apiData?.enterpriseName,
        nameMatchScore: msmeDoc.nameMatchScore,
        addressParts: (() => {
          const direct = {
            address: msmeAddrLine || msmeDoc.ocrData.office_address || undefined,
            city: msmeDoc.ocrData.city || msmeDoc.ocrData.district || undefined,
            state: msmeDoc.ocrData.state || undefined,
            pincode: msmeDoc.ocrData.pin_code || undefined,
          };
          if (direct.city || direct.state || direct.pincode) return direct;
          // String fallback: parse office_address / composed line.
          const raw = String(msmeDoc.ocrData.office_address || msmeAddrLine || "").trim();
          if (!raw) return undefined;
          const parsed = parseAddressString(raw);
          if (!parsed.city && !parsed.state && !parsed.pincode && !parsed.address) return undefined;
          return { address: parsed.address || raw, city: parsed.city, state: parsed.state, pincode: parsed.pincode };
        })(),
      };
    } else if (isMsmeRegistered === false) {
      out.msmeDeclarationReason = msmeDeclarationReason;
      out.msmeSelfDeclarationFile = msmeDeclarationFile;
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
    if (bank2Enabled && bankDoc2.status === "verified" && bankDoc2.ocrData) {
      out.bank2 = {
        accountNumber: bankDoc2.ocrData.account_number,
        ifsc: bankDoc2.ocrData.ifsc_code,
        bankName: bankDoc2.ocrData.bank_name,
        branchName: bankDoc2.ocrData.branch_name,
        accountHolderName: bankDoc2.ocrData.account_holder_name,
        apiName: bankDoc2.apiData?.accountHolderName || bankDoc2.apiData?.name,
        accountType: bankAccountType2,
        bankAddress: bankBranchAddress2,
      };
    }
    // Lift uploaded files so the parent can persist them in the draft.
    // Persist as soon as a file is picked for the active section — do NOT
    // gate on verification, otherwise unverified uploads silently vanish
    // from Review / Approval and never reach vendor_documents storage.
    out.gstCertificateFile =
      isGstRegistered === true ? (gstDoc.file ?? null) : null;
    out.panCardFile = panDoc.file ?? null;
    out.msmeCertificateFile =
      isMsmeRegistered === true ? (msmeDoc.file ?? null) : null;
    out.cancelledChequeFile = bankDoc.file ?? null;
    out.cancelledChequeFile2 = bank2Enabled ? (bankDoc2.file ?? null) : null;
    // Authoritative completion status (mirrors what the UI shows green)
    out.step1Status = { stage1Done, stage2Done, stage3Done, stage4Done, allDone };
    return out;
  }, [isGstRegistered, gstDoc, editablePrincipalPlace, gstDeclarationReason, gstDeclarationFile, manualLegalName, manualAddress, panDoc, isMsmeRegistered, msmeDoc, msmeDeclarationReason, msmeDeclarationFile, bankDoc, bankAccountType, bankBranchAddress, bank2Enabled, bankDoc2, bankAccountType2, bankBranchAddress2, stage1Done, stage2Done, stage3Done, stage4Done, allDone, gstFilingRows, gstCompliance]);

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
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "gst");

  // Re-sync when parent changes initialTab (e.g. user clicks Edit on Review).
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Auto-advance between tabs after a successful verification has been
  // intentionally removed — the user must click the next tab (or Continue)
  // themselves once a stage turns green.

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
      id="step-form-1"
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
          <TabsList className="grid grid-cols-4 w-full h-auto p-1 gap-1 bg-muted border border-border rounded-lg">
            {([
              { key: "gst", label: "GST", num: 1 },
              { key: "pan", label: "PAN", num: 2 },
              { key: "msme", label: "MSME", num: 3 },
              { key: "bank", label: "Bank", num: 4 },
            ] as { key: TabKey; label: string; num: number }[]).map((t) => {
              const unlocked = tabUnlock[t.key];
              const status = tabStatus[t.key];
              const isActive = activeTab === t.key;
              const trigger = (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  disabled={!unlocked}
                  className={cn(
                    "group relative flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2.5 min-w-0 rounded-md transition-all",
                    "text-muted-foreground hover:text-foreground hover:bg-background/60",
                    "data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:font-semibold",
                    "data-[state=active]:shadow-enterprise-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-5 w-5 shrink-0 rounded-full text-[10px] font-semibold border transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border group-hover:border-foreground/30",
                    )}
                  >
                    {t.num}
                  </span>
                  <span className="text-xs sm:text-sm font-medium truncate">
                    {t.label}
                  </span>
                  <StatusChip status={status} locked={!unlocked} />
                  {isActive && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                    />
                  )}
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
              title=""
              subtitle=""
              status={tabStatus.gst}
              verifiedAt={gstDoc.verifiedAt}
            >
              <div className="space-y-5">
                {/* Gate row */}
                <GateRow
                  label="Are you GST registered?"
                  value={isGstRegistered}
                  onChange={handleGstRegisteredChange}
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
                      onReset={() => { setGstDoc(idleDoc); resetGstAux(); resetPanCascade(); }}
                      busyLabel={
                        gstDoc.status === "uploading" ? "Uploading…" :
                        gstDoc.status === "preparing" ? "Preparing document for OCR…" :
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
                          legalNameInfo={
                            gstDoc.status === "verified" && typeof gstDoc.nameMatchScore === "number"
                              ? {
                                  message: `Name match score: ${gstDoc.nameMatchScore}%`,
                                  ok: gstDoc.nameMatchScore >= 80,
                                }
                              : null
                          }
                        />

                      }
                    />



                    {/* GST Filing Status — runs after GSTIN Validation */}
                    {gstDoc.status === "verified" && (
                      <div className="rounded-lg border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold text-sm">GST Filing Status (Last 3 Months)</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            {gstFilingChecked && gstCompliance && !gstCompliance.previousMonthFiled && !gstCompliance.declarationRequired && (
                              <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground bg-muted/40">
                                GSTR1 for {gstCompliance.checkedPeriod} not yet filed — within grace period (due 11th)
                              </Badge>
                            )}
                            {gstFilingChecked && gstCompliance?.declarationRequired && (
                              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                GSTR1 for {gstCompliance.checkedPeriod} not filed — declaration required
                              </Badge>
                            )}
                          </div>
                        </div>

                        {gstFilingRows.length > 0 ? (
                          <GstFilingStatusTable rows={gstFilingRows} limit={3} />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {gstFilingChecking
                              ? "Fetching latest filing status from GSTN…"
                              : "Click \"Check Filing Status\" to fetch the last 3 months of returns."}
                          </p>
                        )}

                        {/* Non-compliant -> require self-declaration upload */}
                        {gstFilingChecked && gstCompliance?.declarationRequired && (
                          <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50/60 p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                              <div className="text-sm text-amber-900">
                                GSTR1 for {gstCompliance.checkedPeriod} has not been filed and the due date (11th) has passed. Please download the
                                GST Returns Declaration, sign it, and upload the signed copy to continue.
                              </div>
                            </div>
                            <Button asChild type="button" variant="outline" size="sm">
                              <a
                                href="/templates/gst-self-declaration.docx"
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download GST Returns Declaration
                              </a>
                            </Button>
                            <FileUpload
                              label="Signed GST Returns Declaration *"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              documentType="gst_self_declaration"
                              onFileSelect={setGstDeclarationFile}
                              currentFile={gstDeclarationFile}
                              vendorId={vendorId}
                            />
                          </div>
                        )}
                      </div>
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
                        href="/templates/gst-self-declaration.docx"
                        download
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Template download
                      </a>
                      <InlineFilePicker
                        file={gstDeclarationFile}
                        onPick={async (f) => {
                          if (!f) { setGstDeclarationFile(null); return; }
                          try {
                            const img = await normalizeUploadToImage(f);
                            setGstDeclarationFile(img);
                            if (img !== f) toast.success(`Converted to image: ${img.name}`);
                          } catch (err: any) {
                            toast.error(err?.message ?? "Please upload a PDF or image (PNG/JPG/JPEG).");
                          }
                        }}
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.gif,.docx,.txt,.csv"
                      />
                    </div>

                  </div>
                )}
              </div>
            </StageShell>

            <div className="mt-4 flex justify-end">
              <Button type="button" disabled={!stage1Done} onClick={() => setActiveTab("pan")}>
                Continue to PAN
              </Button>
            </div>
          </TabsContent>

          {/* ============================== PAN ============================== */}
          <TabsContent value="pan" className="mt-4">
            <StageShell
              icon={<BadgeCheck className="h-4 w-4" />}
              title=""
              subtitle=""
              status={tabStatus.pan}
              verifiedAt={panDoc.verifiedAt}
            >
              <DocSplitRow
                uploadLabel="PAN Card"
                accept=".pdf,.jpg,.jpeg,.png"
                doc={panDoc}
                onUpload={handlePanUpload}
                onReset={() => { setPanDoc(idleDoc); setPanCrossCheckError(null); resetMsmeCascade(); }}
                busyLabel={
                  panDoc.status === "uploading" ? "Uploading…" :
                  panDoc.status === "preparing" ? "Preparing document for OCR…" :
                  panDoc.status === "ocr" ? "Reading PAN…" :
                  panDoc.status === "verifying" ? "Verifying…" : ""
                }
                verifiedFields={
                  (() => {
                    const panApi = panDoc.apiData?.normalized || {};
                    return (
                      <div className="space-y-3">
                        <ReviewBanner />
                        <div className="grid md:grid-cols-3 gap-3">
                          <EditableOcrField
                            label="PAN Number"
                            value={panDoc.ocrData?.pan_number}
                            originalValue={panDoc.originalOcrData?.pan_number}
                            onChange={(v) => setOcrField(setPanDoc, "pan_number", v.toUpperCase())}
                            mono
                            verifiedValue={panApi.pan_number}
                            verifiedLabel="PAN is verified"
                          />
                          {(() => {
                            const msgs: string[] = [];
                            if (panCrossCheckError) msgs.push(panCrossCheckError);
                            if (panDoc.status === "verified" && !panCrossCheckError) {
                              if (panDoc.apiData?.panMatchMessage) msgs.push(panDoc.apiData.panMatchMessage);
                              if (panDoc.apiData?.nameMatchMessage) msgs.push(panDoc.apiData.nameMatchMessage);
                              if (!panDoc.apiData?.panMatchMessage && isGstRegistered === true) {
                                msgs.push("PAN Number verified with GST PAN Number.");
                              }
                              if (typeof panDoc.nameMatchScore === "number") {
                                msgs.push(`Name match vs Legal Name: ${panDoc.nameMatchScore}%`);
                              }
                            }
                            const trailingInfo = msgs.length
                              ? { message: msgs.join("\n"), ok: !panCrossCheckError }
                              : null;
                            return (
                              <EditableOcrField
                                label="Holder Name"
                                value={panDoc.ocrData?.holder_name}
                                originalValue={panDoc.originalOcrData?.holder_name}
                                onChange={(v) => setOcrField(setPanDoc, "holder_name", v)}
                                verifiedValue={panApi.holder_name || panApi.full_name}
                                verifiedLabel="Name matches PAN registry"
                                trailingInfo={trailingInfo}
                              />
                            );
                          })()}

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
                          {(() => {
                            const comprehensive = extractPanComprehensiveFields({ data: panDoc.ocrData, raw: { data: panApi } });
                            const panStatusLabel = formatPanStatus(comprehensive.status);
                            return (
                              <EditableOcrField
                                label="PAN Status"
                                value={panStatusLabel}
                                verifiedValue={panStatusLabel}
                                verifiedLabel={panStatusLabel === "Valid" ? "Active per registry" : "Marked invalid by registry"}
                                onChange={() => {}}
                                readOnly
                              />
                            );
                          })()}
                          {(() => {
                            const comprehensive = extractPanComprehensiveFields({ data: panDoc.ocrData, raw: { data: panApi } });
                            const linkedLabel = formatAadhaarLinked(comprehensive.aadhaarLinked);
                            return (
                              <EditableOcrField
                                label="Is Aadhaar Linked"
                                value={linkedLabel}
                                verifiedValue={linkedLabel}
                                verifiedLabel="Verified from registry"
                                onChange={() => {}}
                                readOnly
                              />
                            );
                          })()}

                        </div>
                      </div>
                    );
                  })()
                }
              />


            </StageShell>

            <div className="mt-4 flex justify-end">
              <Button type="button" disabled={!stage2Done} onClick={() => setActiveTab("msme")}>
                Continue to MSME
              </Button>
            </div>
          </TabsContent>

          {/* ============================== MSME ============================== */}
          <TabsContent value="msme" className="mt-4">
            <StageShell
              icon={<ShieldCheck className="h-4 w-4" />}
              title=""
              subtitle=""
              status={tabStatus.msme}
              verifiedAt={msmeDoc.verifiedAt}
            >
              <div className="space-y-5">
                <GateRow
                  label="Are you MSME registered?"
                  value={isMsmeRegistered}
                  onChange={handleMsmeRegisteredChange}
                  yesLabel="Yes"
                  noLabel="No"
                />

                {isMsmeRegistered === false && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">MSME Self-Declaration</p>
                        <p className="text-xs text-muted-foreground">Download, sign, then upload</p>
                      </div>
                      <a
                        href="/templates/msme-self-declaration.docx"
                        download
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Template download
                      </a>
                      <InlineFilePicker
                        file={msmeDeclarationFile}
                        onPick={async (f) => {
                          if (!f) { setMsmeDeclarationFile(null); return; }
                          try {
                            const img = await normalizeUploadToImage(f);
                            setMsmeDeclarationFile(img);
                            if (img !== f) toast.success(`Converted to image: ${img.name}`);
                          } catch (err: any) {
                            toast.error(err?.message ?? "Please upload a PDF or image (PNG/JPG/JPEG).");
                          }
                        }}
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.gif,.docx,.txt,.csv"
                      />
                    </div>
                  </div>
                )}


                {isMsmeRegistered === true && (
                  <div className="space-y-4">
                    
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
                            <div className="grid md:grid-cols-3 gap-3">
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
                              <div className="md:col-span-2">
                                <EditableOcrField
                                  label="Enterprise Name"
                                  value={msmeDoc.ocrData?.enterprise_name}
                                  originalValue={msmeDoc.originalOcrData?.enterprise_name}
                                  onChange={(v) => setOcrField(setMsmeDoc, "enterprise_name", v)}
                                  verifiedValue={m.enterprise_name}
                                  verifiedLabel="Enterprise Name matches registry"
                                  trailingInfo={
                                    msmeDoc.apiData?.enterpriseNameMessage
                                      ? { message: msmeDoc.apiData.enterpriseNameMessage, ok: true }
                                      : null
                                  }
                                />
                              </div>
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
                                label="Current Year"
                                value={msmeDoc.ocrData?.classification_year}
                                originalValue={msmeDoc.originalOcrData?.classification_year}
                                onChange={(v) => setOcrField(setMsmeDoc, "classification_year", v)}
                                placeholder="e.g. 2026-27"
                                verifiedValue={m.classification_year}
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
                              onClick={() => { setMsmeDoc(idleDoc); setMsmeManualNumber(""); setMsmeManualError(null); resetBankCascade(); }}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Re-validate
                            </Button>
                            <div className="pt-2">
                              <FileUpload
                                label="Upload Udyam Certificate *"
                                documentType="msme_certificate"
                                vendorId={vendorId}
                                currentFile={msmeDoc.file ?? null}
                                onFileSelect={(file) =>
                                  setMsmeDoc((prev) => ({ ...prev, file: file ?? undefined }))
                                }
                              />
                              {!msmeDoc.file && (
                                <p className="mt-1 text-xs text-destructive">
                                  Udyam certificate upload is required to proceed.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                  </div>
                )}


              </div>
            </StageShell>

            <div className="mt-4 flex justify-end">
              <Button type="button" disabled={!stage3Done} onClick={() => setActiveTab("bank")}>
                Continue to Bank
              </Button>
            </div>
          </TabsContent>

          {/* ============================== BANK ============================== */}
          <TabsContent value="bank" className="mt-4">
            <StageShell
              icon={<Landmark className="h-4 w-4" />}
              title=""
              subtitle=""
              status={tabStatus.bank}
              verifiedAt={bankDoc.verifiedAt}
            >
              <DocSplitRow
                uploadLabel="Cancelled Cheque"
                accept=".pdf,.jpg,.jpeg,.png"
                doc={bankDoc}
                onUpload={handleBankUpload}
                onReset={() => { setBankDoc(idleDoc); lastBankFileRef.current = null; }}
                busyLabel={
                  bankDoc.status === "uploading" ? "Uploading…" :
                  bankDoc.status === "preparing" ? "Preparing document for OCR…" :
                  bankDoc.status === "ocr" ? "Reading cheque…" :
                  bankDoc.status === "verifying" ? "Penny-drop verification…" : ""
                }
                verifiedFields={
                  <div className="space-y-3">
                    <ReviewBanner />
                    <div className="grid md:grid-cols-3 gap-3">
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
                      </div>
                      <div className="md:col-span-2">
                        <EditableOcrField
                          label="Account Holder Name"
                          value={bankDoc.ocrData?.account_holder_name}
                          originalValue={bankDoc.originalOcrData?.account_holder_name}
                          verifiedValue={bankDoc.apiData?.normalized?.account_holder_name}
                          verifiedLabel="Name matches bank record"
                          onChange={(v) => setOcrField(setBankDoc, "account_holder_name", v)}
                          trailingInfo={
                            bankDoc.apiData?.holderNameMessage
                              ? { message: bankDoc.apiData.holderNameMessage, ok: true }
                              : null
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Account Type *</Label>
                        <select
                          value={bankAccountType}
                          disabled
                          className="mt-1 w-full h-10 rounded-md border border-border/60 bg-muted/40 px-3 text-sm text-muted-foreground cursor-not-allowed focus:outline-none"
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
                          readOnly
                          placeholder="Branch address"
                          className="mt-1 bg-muted/40 border-border/60 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                }
              />

              {/* ---------- Optional Secondary Bank Account ---------- */}
              <div className="mt-6 pt-5 border-t border-border/60">
                {!bank2Enabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBank2Enabled(true)}
                    className="gap-1.5"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add another bank account (optional)
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-primary" />
                        Secondary Bank Account
                        <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBank2Enabled(false);
                          setBankDoc2(idleDoc);
                          setBankBranchAddress2("");
                          setBankAccountType2("current");
                          bankAddressTouchedRef2.current = false;
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                    <DocSplitRow
                      uploadLabel="Cancelled Cheque (Secondary)"
                      accept=".pdf,.jpg,.jpeg,.png"
                      doc={bankDoc2}
                      onUpload={handleBankUpload2}
                      onReset={() => { setBankDoc2(idleDoc); lastBankFile2Ref.current = null; }}
                      busyLabel={
                        bankDoc2.status === "uploading" ? "Uploading…" :
                        bankDoc2.status === "preparing" ? "Preparing document for OCR…" :
                        bankDoc2.status === "ocr" ? "Reading cheque…" :
                        bankDoc2.status === "verifying" ? "Penny-drop verification…" : ""
                      }
                      verifiedFields={
                        <div className="space-y-3">
                          <div className="grid md:grid-cols-3 gap-3">
                            <EditableOcrField
                              label="Account Number"
                              value={bankDoc2.ocrData?.account_number}
                              originalValue={bankDoc2.originalOcrData?.account_number}
                              verifiedValue={bankDoc2.apiData?.normalized?.account_number}
                              verifiedLabel="Account Number is verified"
                              onChange={(v) => setOcrField(setBankDoc2, "account_number", v)}
                              mono
                            />
                            <EditableOcrField
                              label="IFSC Code"
                              value={bankDoc2.ocrData?.ifsc_code}
                              originalValue={bankDoc2.originalOcrData?.ifsc_code}
                              verifiedValue={bankDoc2.apiData?.normalized?.ifsc_code}
                              verifiedLabel="IFSC is verified"
                              onChange={(v) => setOcrField(setBankDoc2, "ifsc_code", v.toUpperCase())}
                              mono
                            />
                            <EditableOcrField
                              label="Bank Name"
                              value={bankDoc2.ocrData?.bank_name}
                              originalValue={bankDoc2.originalOcrData?.bank_name}
                              verifiedValue={bankDoc2.apiData?.normalized?.bank_name}
                              verifiedLabel="Bank Name is verified"
                              onChange={(v) => setOcrField(setBankDoc2, "bank_name", v)}
                            />
                            <div>
                              <EditableOcrField
                                label="Branch"
                                value={bankDoc2.ocrData?.branch_name}
                                originalValue={bankDoc2.originalOcrData?.branch_name}
                                verifiedValue={bankDoc2.apiData?.normalized?.branch_name}
                                verifiedLabel="Branch is verified"
                                onChange={(v) => { setOcrField(setBankDoc2, "branch_name", v); setBankBranchAutoFilled2(false); }}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <EditableOcrField
                                label="Account Holder Name"
                                value={bankDoc2.ocrData?.account_holder_name}
                                originalValue={bankDoc2.originalOcrData?.account_holder_name}
                                verifiedValue={bankDoc2.apiData?.normalized?.account_holder_name}
                                verifiedLabel="Name matches bank record"
                                onChange={(v) => setOcrField(setBankDoc2, "account_holder_name", v)}
                                trailingInfo={
                                  bankDoc2.apiData?.holderNameMessage
                                    ? { message: bankDoc2.apiData.holderNameMessage, ok: true }
                                    : null
                                }
                              />
                            </div>

                            <div>
                              <Label className="text-xs font-medium text-muted-foreground">Account Type *</Label>
                              <select
                                value={bankAccountType2}
                                disabled
                                className="mt-1 w-full h-10 rounded-md border border-border/60 bg-muted/40 px-3 text-sm text-muted-foreground cursor-not-allowed focus:outline-none"
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
                                value={bankBranchAddress2}
                                readOnly
                                placeholder="Branch address"
                                className="mt-1 bg-muted/40 border-border/60 cursor-not-allowed"
                              />
                            </div>
                          </div>
                        </div>
                      }
                    />
                  </div>
                )}
              </div>
            </StageShell>

            <div className="mt-4 flex justify-end">
              <Button type="button" disabled={!stage4Done} onClick={() => handleContinue()}>
                Continue
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </TooltipProvider>

      <AlertDialog
        open={mismatchDialog.open}
        onOpenChange={(o) => setMismatchDialog((d) => ({ ...d, open: o }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">{mismatchDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">{mismatchDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            {/Account Holder Name|Bank verification/i.test(mismatchDialog.title) ? (
              <AlertDialogAction
                onClick={() => {
                  setBankDoc(idleDoc);
                  setMismatchDialog((d) => ({ ...d, open: false }));
                }}
              >
                Re-upload cheque
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={() => setMismatchDialog((d) => ({ ...d, open: false }))}
              >
                OK
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={bankPopup.open}
        onOpenChange={(o) => !bankPopup.submitting && setBankPopup((p) => ({ ...p, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank verification — enter details manually</DialogTitle>
            <DialogDescription>
              {bankPopup.reason || "Please enter your bank account details to verify via Penny-Drop."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bankPopupAccount">Account Number *</Label>
              <Input
                id="bankPopupAccount"
                value={bankPopup.account}
                onChange={(e) =>
                  setBankPopup((p) => ({ ...p, account: e.target.value.replace(/\s+/g, "") }))
                }
                placeholder="e.g. 50100123456789"
                className="font-mono"
                autoFocus
                disabled={bankPopup.submitting}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bankPopupIfsc">IFSC Code *</Label>
              <Input
                id="bankPopupIfsc"
                value={bankPopup.ifsc}
                onChange={(e) =>
                  setBankPopup((p) => ({ ...p, ifsc: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. HDFC0001234"
                maxLength={11}
                className="font-mono uppercase"
                disabled={bankPopup.submitting}
              />
            </div>
            {bankPopup.error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="break-words">{bankPopup.error}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBankPopup((p) => ({ ...p, open: false }))}
              disabled={bankPopup.submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBankPopupSubmit}
              disabled={
                bankPopup.submitting ||
                bankPopup.account.replace(/\s+/g, "").length < 8 ||
                !isValidIfsc(bankPopup.ifsc)
              }
            >
              {bankPopup.submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualEntryFallbackDialog
        open={gstManualPopup.open}
        onOpenChange={(o) => setGstManualPopup((p) => ({ ...p, open: o }))}
        title="Enter GSTIN manually"
        description={gstManualPopup.reason}
        label="GSTIN *"
        placeholder="e.g. 20AAPCS1562H1ZG"
        maxLength={15}
        pattern={/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/}
        initialValue={gstManualPopup.prefill}
        onVerify={handleGstManualSubmit}
      />

      <ManualEntryFallbackDialog
        open={panManualPopup.open}
        onOpenChange={(o) => setPanManualPopup((p) => ({ ...p, open: o }))}
        title="Enter PAN manually"
        description={panManualPopup.reason}
        label="PAN *"
        placeholder="AAAAA9999A"
        maxLength={10}
        pattern={/^[A-Z]{5}[0-9]{4}[A-Z]$/}
        initialValue={panManualPopup.prefill}
        onVerify={handlePanManualSubmit}
      />
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
  const showHeader = Boolean(title || subtitle);
  return (
    <div className="rounded-lg border border-border/60 bg-card shadow-enterprise-sm overflow-hidden">
      {showHeader && (
        <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-muted-foreground leading-tight mt-0.5">{subtitle}</p>}
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
      )}
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
  const isBusy = doc.status === "uploading" || doc.status === "preparing" || doc.status === "ocr" || doc.status === "verifying";
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
    <h4 className="text-[11px] font-semibold text-muted-foreground">
      <span className="inline-block border-b border-warning/70 pb-1 w-fit">
        {children}
      </span>
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
  legalNameInfo,
}: {
  ocr?: Record<string, any>;
  original?: Record<string, any>;
  /** Snake-case registry payload from the GST validation API. */
  verifiedApi?: Record<string, any>;
  onChangeField: (key: string, value: any) => void;
  editablePrincipalPlace: string;
  onChangePrincipalPlace: (v: string) => void;
  legalNameInfo?: { message: string; ok: boolean } | null;
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
        <div className="grid md:grid-cols-3 gap-3">
          <EditableOcrField
            label="Legal Name"
            value={ocr.legal_name}
            originalValue={original?.legal_name}
            verifiedValue={api.legal_name}
            verifiedLabel="Legal Name is verified"
            onChange={(v) => onChangeField("legal_name", v)}
            trailingInfo={legalNameInfo ?? null}
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
          <EditableOcrField
            label="PAN Number (from GST)"
            value={ocr.pan_number}
            originalValue={original?.pan_number}
            verifiedValue={api.pan_number}
            verifiedLabel="PAN derived from GSTIN — verified"
            onChange={(v) => onChangeField("pan_number", v.toUpperCase())}
            mono
          />
        </div>
      </div>

      {/* Registration */}
      {hasRegistrationSection && (
        <div className="space-y-2">
          <SectionHeading>Registration</SectionHeading>
          <div className="grid md:grid-cols-3 gap-3">
            {ocr.gst_status && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">GST Status</Label>
                <div className="mt-1 h-10 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3">
                  <GstStatusPill status={ocr.gst_status} />
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
        <div className="grid md:grid-cols-3 gap-3">
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

function NameMatchInfo({ message, ok = true }: { message: string; ok?: boolean }) {
  if (!message) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Match details"
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors hover:opacity-90",
            ok
              ? "border-success/40 bg-success/10 text-success"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-w-sm text-xs leading-relaxed">
        <div className="flex items-start gap-2">
          {ok
            ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
          <span className="whitespace-pre-wrap break-words">{message}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CrossCheckStrip({ ok, text, className }: { ok: boolean; text: string; className?: string }) {
  return (
    <div className={cn("flex justify-end", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Match details"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-90",
              ok
                ? "border-success/30 bg-success/5 text-success"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            <Info className="h-3 w-3" />
            Match details
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-w-sm text-xs leading-relaxed">
          <div className="flex items-start gap-2">
            {ok
              ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              : <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
            <span className="whitespace-pre-wrap break-words">{text}</span>
          </div>
        </PopoverContent>
      </Popover>
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
  readOnly = true,
  trailingInfo,
}: {
  label: string;
  value?: string;
  originalValue?: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
  /** Value returned by the validation API for this field (registry/penny-drop). */
  verifiedValue?: string;
  /** Tooltip label shown on the trailing green tick when the value matches the API. */
  verifiedLabel?: string;
  /** When true, disables editing and hides Edited/Reset/Use registry affordances. */
  readOnly?: boolean;
  /** Optional cross-check message rendered as an (i) popover inside the input. */
  trailingInfo?: { message: string; ok: boolean } | null;
}) {
  const current = value ?? "";
  const original = originalValue ?? "";
  const isEdited = !readOnly && current.trim() !== original.trim() && original.length > 0;
  const apiVal = (verifiedValue ?? "").toString();
  const hasApi = apiVal.trim().length > 0 && current.trim().length > 0;
  const matchesApi = hasApi && normalizeForCompare(current) === normalizeForCompare(apiVal);
  const mismatchApi = !readOnly && hasApi && !matchesApi;
  const hasTrailingInfo = !!(trailingInfo && trailingInfo.message);
  const hasBadge = matchesApi || isEdited || mismatchApi;
  const adornmentCount = (hasBadge ? 1 : 0) + (hasTrailingInfo ? 1 : 0);
  const padRight = adornmentCount === 2 ? "pr-16" : adornmentCount === 1 ? "pr-9" : "";
  return (
    <div>
      <div className="flex items-center justify-between gap-2 min-h-[18px]">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
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
      <div className="relative">
        <Input
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          aria-readonly={readOnly || undefined}
          className={cn(
            "mt-1 border-0 border-b rounded-none bg-transparent border-border/60 px-0 focus-visible:ring-0 focus-visible:ring-offset-0",
            mono && "font-mono text-sm tracking-wide",
            current.trim().length > 0 && "bg-muted/40 px-2",
            isEdited && "border-b-2 border-b-warning",
            matchesApi && "border-b-2 border-b-success",
            mismatchApi && "border-b-2 border-b-warning",
            readOnly && "cursor-default",
            padRight,
          )}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1">
          {hasBadge && (
            <span
              className="pointer-events-auto"
              title={
                matchesApi
                  ? verifiedLabel || `${label} is verified`
                  : mismatchApi
                    ? `Doesn't match registry value: ${apiVal}`
                    : "Edited"
              }
            >
              {matchesApi ? (
                <BadgeCheck className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
            </span>
          )}
          {hasTrailingInfo && (
            <span className="pointer-events-auto">
              <NameMatchInfo message={trailingInfo!.message} ok={trailingInfo!.ok} />
            </span>
          )}
        </div>
      </div>



      {mismatchApi && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-warning">
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
  return null;
}
