import { useState, useRef, useCallback } from "react";
import { Upload, CheckCircle2, Loader2, AlertCircle, FileText, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOcrExtraction, OcrDocumentType } from "@/hooks/useOcrExtraction";
import { OcrComparisonCard } from "@/components/vendor/OcrComparisonCard";

export interface VerifiedDocumentData {
  pan?: { number: string; holderName: string; apiName?: string; nameMatchScore?: number };
  gst?: { gstin: string; legalName: string; tradeName?: string; address?: string; apiName?: string; nameMatchScore?: number };
  msme?: { udyamNumber: string; enterpriseName: string; enterpriseType?: string; apiName?: string; nameMatchScore?: number };
  bank?: { accountNumber: string; ifsc: string; bankName: string; branchName?: string; accountHolderName?: string; apiName?: string };
}

interface DocumentVerificationStepProps {
  vendorId?: string;
  initialData?: VerifiedDocumentData;
  onComplete: (data: VerifiedDocumentData) => void;
}

type TileStatus = "idle" | "uploading" | "ocr" | "ocr_done" | "verifying" | "verified" | "failed";

interface TileState {
  status: TileStatus;
  fileName?: string;
  ocrData?: Record<string, any>;
  apiData?: Record<string, any>;
  nameMatchScore?: number;
  errorMessage?: string;
}

const DOC_META: Record<OcrDocumentType, { title: string; subtitle: string; required: boolean }> = {
  pan: { title: "PAN Card", subtitle: "Permanent Account Number", required: true },
  gst: { title: "GST Certificate", subtitle: "GST Registration", required: true },
  msme: { title: "MSME / Udyam", subtitle: "Optional — skip if not applicable", required: false },
  cheque: { title: "Cancelled Cheque", subtitle: "Bank account proof", required: true },
};

const ORDER: OcrDocumentType[] = ["pan", "gst", "msme", "cheque"];

export function DocumentVerificationStep({
  vendorId,
  initialData,
  onComplete,
}: DocumentVerificationStepProps) {
  const { extractFromFile } = useOcrExtraction();

  const seedFromInitial = (k: OcrDocumentType): TileState => {
    if (k === "pan" && initialData?.pan?.number) {
      return {
        status: "verified",
        ocrData: { pan_number: initialData.pan.number, holder_name: initialData.pan.holderName },
        apiData: { name: initialData.pan.apiName },
        nameMatchScore: initialData.pan.nameMatchScore,
      };
    }
    if (k === "gst" && initialData?.gst?.gstin) {
      return {
        status: "verified",
        ocrData: { gstin: initialData.gst.gstin, legal_name: initialData.gst.legalName, trade_name: initialData.gst.tradeName, address: initialData.gst.address },
        apiData: { legalName: initialData.gst.apiName },
        nameMatchScore: initialData.gst.nameMatchScore,
      };
    }
    if (k === "msme" && initialData?.msme?.udyamNumber) {
      return {
        status: "verified",
        ocrData: { udyam_number: initialData.msme.udyamNumber, enterprise_name: initialData.msme.enterpriseName, enterprise_type: initialData.msme.enterpriseType },
        apiData: { name: initialData.msme.apiName },
        nameMatchScore: initialData.msme.nameMatchScore,
      };
    }
    if (k === "cheque" && initialData?.bank?.accountNumber) {
      return {
        status: "verified",
        ocrData: { account_number: initialData.bank.accountNumber, ifsc_code: initialData.bank.ifsc, bank_name: initialData.bank.bankName, branch_name: initialData.bank.branchName, account_holder_name: initialData.bank.accountHolderName },
        apiData: { name: initialData.bank.apiName },
      };
    }
    return { status: "idle" };
  };

  const [tiles, setTiles] = useState<Record<OcrDocumentType, TileState>>({
    pan: seedFromInitial("pan"),
    gst: seedFromInitial("gst"),
    msme: seedFromInitial("msme"),
    cheque: seedFromInitial("cheque"),
  });

  const setTile = (k: OcrDocumentType, patch: Partial<TileState>) =>
    setTiles((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));

  const verifyApi = async (k: OcrDocumentType, ocr: Record<string, any>) => {
    try {
      if (k === "pan") {
        const { data, error } = await supabase.functions.invoke("validate-pan", {
          body: { pan: ocr.pan_number, name: ocr.holder_name, simulationMode: true },
        });
        if (error || !data?.valid) throw new Error(data?.message || error?.message || "PAN verification failed");
        return { ok: true, apiData: data.data, registeredName: data.data?.name };
      }
      if (k === "gst") {
        const { data, error } = await supabase.functions.invoke("validate-gst", {
          body: { gstin: ocr.gstin, name: ocr.legal_name, simulationMode: true },
        });
        if (error || !data?.valid) throw new Error(data?.message || error?.message || "GST verification failed");
        return { ok: true, apiData: data.data, registeredName: data.data?.legalName || data.data?.name };
      }
      if (k === "msme") {
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

  const computeNameMatch = (a?: string, b?: string): number | undefined => {
    if (!a || !b) return undefined;
    const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
    const A = new Set(norm(a));
    const B = new Set(norm(b));
    if (A.size === 0 || B.size === 0) return 0;
    let common = 0;
    A.forEach((t) => { if (B.has(t)) common += 1; });
    const denom = Math.max(A.size, B.size);
    return Math.round((common / denom) * 100);
  };

  const handleFile = async (k: OcrDocumentType, file: File) => {
    setTile(k, { status: "uploading", fileName: file.name, errorMessage: undefined });

    // Validate
    if (file.size > 5 * 1024 * 1024) {
      setTile(k, { status: "failed", errorMessage: "File must be under 5 MB" });
      return;
    }

    setTile(k, { status: "ocr" });
    const ocrRes = await extractFromFile(file, k, vendorId);
    if (!ocrRes.success || !ocrRes.extracted) {
      setTile(k, { status: "failed", errorMessage: ocrRes.error || "Could not read document" });
      return;
    }
    const conf = ocrRes.confidence ?? 0;
    if (conf < 0.5) {
      setTile(k, {
        status: "failed",
        ocrData: ocrRes.extracted,
        errorMessage: "Couldn't read clearly — please upload a sharper scan.",
      });
      return;
    }

    setTile(k, { status: "verifying", ocrData: ocrRes.extracted });

    const v = await verifyApi(k, ocrRes.extracted);
    if (!v.ok) {
      setTile(k, { status: "failed", ocrData: ocrRes.extracted, errorMessage: v.error });
      return;
    }

    // Cross-name-match
    const ocrName =
      k === "pan" ? ocrRes.extracted.holder_name :
      k === "gst" ? ocrRes.extracted.legal_name :
      k === "msme" ? ocrRes.extracted.enterprise_name :
      ocrRes.extracted.account_holder_name;
    const nameMatchScore = computeNameMatch(ocrName, v.registeredName);

    setTile(k, {
      status: "verified",
      ocrData: ocrRes.extracted,
      apiData: v.apiData,
      nameMatchScore,
      errorMessage: undefined,
    });
  };

  const reset = (k: OcrDocumentType) => setTile(k, { status: "idle", fileName: undefined, ocrData: undefined, apiData: undefined, nameMatchScore: undefined, errorMessage: undefined });

  const requiredKeys: OcrDocumentType[] = ["pan", "gst", "cheque"];
  const verifiedCount = requiredKeys.filter((k) => tiles[k].status === "verified").length;
  const allVerified = verifiedCount === requiredKeys.length;

  const handleContinue = () => {
    const out: VerifiedDocumentData = {};
    if (tiles.pan.status === "verified" && tiles.pan.ocrData) {
      out.pan = {
        number: tiles.pan.ocrData.pan_number,
        holderName: tiles.pan.ocrData.holder_name,
        apiName: tiles.pan.apiData?.name,
        nameMatchScore: tiles.pan.nameMatchScore,
      };
    }
    if (tiles.gst.status === "verified" && tiles.gst.ocrData) {
      out.gst = {
        gstin: tiles.gst.ocrData.gstin,
        legalName: tiles.gst.ocrData.legal_name,
        tradeName: tiles.gst.ocrData.trade_name,
        address: tiles.gst.ocrData.address,
        apiName: tiles.gst.apiData?.legalName || tiles.gst.apiData?.name,
        nameMatchScore: tiles.gst.nameMatchScore,
      };
    }
    if (tiles.msme.status === "verified" && tiles.msme.ocrData) {
      out.msme = {
        udyamNumber: tiles.msme.ocrData.udyam_number,
        enterpriseName: tiles.msme.ocrData.enterprise_name,
        enterpriseType: tiles.msme.ocrData.enterprise_type,
        apiName: tiles.msme.apiData?.name || tiles.msme.apiData?.enterpriseName,
        nameMatchScore: tiles.msme.nameMatchScore,
      };
    }
    if (tiles.cheque.status === "verified" && tiles.cheque.ocrData) {
      out.bank = {
        accountNumber: tiles.cheque.ocrData.account_number,
        ifsc: tiles.cheque.ocrData.ifsc_code,
        bankName: tiles.cheque.ocrData.bank_name,
        branchName: tiles.cheque.ocrData.branch_name,
        accountHolderName: tiles.cheque.ocrData.account_holder_name,
        apiName: tiles.cheque.apiData?.accountHolderName || tiles.cheque.apiData?.name,
      };
    }
    onComplete(out);
  };

  return (
    <form
      id="step-form"
      onSubmit={(e) => { e.preventDefault(); if (allVerified) handleContinue(); }}
      className="space-y-6"
    >
      {/* Sticky banner */}
      <Alert className={cn("border", allVerified ? "border-success bg-success/10" : "border-warning bg-warning/10")}>
        <ShieldCheck className={cn("h-4 w-4", allVerified ? "text-success" : "text-warning")} />
        <AlertDescription className="font-medium">
          {allVerified
            ? "All required documents verified. You can continue to the next step."
            : `${verifiedCount} of ${requiredKeys.length} required documents verified. Upload PAN, GST, and Cancelled Cheque to continue. MSME is optional.`}
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-4">
        {ORDER.map((k) => (
          <DocumentTile
            key={k}
            kind={k}
            state={tiles[k]}
            onUpload={(f) => handleFile(k, f)}
            onReset={() => reset(k)}
          />
        ))}
      </div>
    </form>
  );
}

interface DocumentTileProps {
  kind: OcrDocumentType;
  state: TileState;
  onUpload: (f: File) => void;
  onReset: () => void;
}

function DocumentTile({ kind, state, onUpload, onReset }: DocumentTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = DOC_META[kind];
  const isBusy = state.status === "uploading" || state.status === "ocr" || state.status === "verifying";
  const isVerified = state.status === "verified";
  const isFailed = state.status === "failed";

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onUpload(f);
  }, [onUpload]);

  const rows = (() => {
    if (kind === "pan") {
      return [
        { label: "PAN Number", ocrValue: state.ocrData?.pan_number, apiValue: state.apiData?.pan ?? state.ocrData?.pan_number },
        { label: "Holder Name", ocrValue: state.ocrData?.holder_name, apiValue: state.apiData?.name },
      ];
    }
    if (kind === "gst") {
      return [
        { label: "GSTIN", ocrValue: state.ocrData?.gstin, apiValue: state.apiData?.gstin ?? state.ocrData?.gstin },
        { label: "Legal Name", ocrValue: state.ocrData?.legal_name, apiValue: state.apiData?.legalName ?? state.apiData?.name },
        { label: "Trade Name", ocrValue: state.ocrData?.trade_name, apiValue: state.apiData?.tradeName },
      ];
    }
    if (kind === "msme") {
      return [
        { label: "Udyam No.", ocrValue: state.ocrData?.udyam_number, apiValue: state.apiData?.udyamNumber ?? state.ocrData?.udyam_number },
        { label: "Enterprise", ocrValue: state.ocrData?.enterprise_name, apiValue: state.apiData?.enterpriseName ?? state.apiData?.name },
      ];
    }
    return [
      { label: "Account No.", ocrValue: state.ocrData?.account_number, apiValue: state.apiData?.accountNumber ?? state.ocrData?.account_number },
      { label: "IFSC", ocrValue: state.ocrData?.ifsc_code, apiValue: state.apiData?.ifsc ?? state.apiData?.ifscCode ?? state.ocrData?.ifsc_code },
      { label: "Bank", ocrValue: state.ocrData?.bank_name, apiValue: state.apiData?.bankName ?? state.ocrData?.bank_name },
      { label: "Holder", ocrValue: state.ocrData?.account_holder_name, apiValue: state.apiData?.accountHolderName ?? state.apiData?.name },
    ];
  })();

  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-colors",
        isVerified && "border-success",
        isFailed && "border-destructive",
      )}
    >
      <div className="px-4 py-3 border-b flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-sm flex items-center gap-2">
            {meta.title}
            {meta.required && <span className="text-destructive">*</span>}
            {isVerified && <CheckCircle2 className="h-4 w-4 text-success" />}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.subtitle}</p>
        </div>
        {(isVerified || isFailed) && (
          <Button type="button" size="sm" variant="ghost" onClick={onReset} className="h-7 px-2 text-xs">
            <RotateCcw className="h-3 w-3 mr-1" />
            Re-upload
          </Button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {state.status === "idle" && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="w-full border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30 rounded-md p-6 flex flex-col items-center justify-center gap-2 transition-colors"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">Drop {meta.title.toLowerCase()} or click to browse</span>
            <span className="text-xs text-muted-foreground">PDF, JPG, PNG up to 5 MB</span>
          </button>
        )}

        {isBusy && (
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-md">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {state.status === "uploading" && "Uploading…"}
                {state.status === "ocr" && "Reading document with AI…"}
                {state.status === "verifying" && "Verifying with government API…"}
              </p>
              {state.fileName && <p className="text-xs text-muted-foreground truncate">{state.fileName}</p>}
            </div>
          </div>
        )}

        {isFailed && (
          <div className="space-y-3">
            {state.ocrData && <OcrComparisonCard rows={rows} />}
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{state.errorMessage}</span>
            </div>
          </div>
        )}

        {isVerified && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 bg-success/10 border border-success/30 rounded-md text-success text-sm">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Verified</span>
            </div>
            <OcrComparisonCard rows={rows} nameMatchScore={state.nameMatchScore} />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>
    </div>
  );
}
