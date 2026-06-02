import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface KycApiResult {
  found: boolean;
  ok: boolean;
  message: string;
  status?: number;
  /** Upstream provider's `status_code` field (falls back to HTTP status). */
  status_code?: number;
  /** Upstream provider's `success` boolean (falls back to ok). */
  success?: boolean;
  /** Upstream provider's `message_code` (e.g. "success"). */
  message_code?: string | null;
  latency_ms?: number;
  data?: Record<string, any>;
  raw?: any;
  provider_id?: string;
  provider_name?: string;
  endpoint_url?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Module-level in-flight map: dedupes concurrent identical provider calls
// (same provider + same account/ifsc/id_number/file size). This prevents
// accidental double invocations from React re-renders, double-clicks, or
// effects firing twice — which was contributing to upstream "Transaction
// rate limit exceeded" errors against Surepass for the BANK provider.
const inflight = new Map<string, Promise<KycApiResult>>();

function makeInflightKey(providerName: string, input: Record<string, any> | undefined, file?: File | null): string {
  const inp = input ? JSON.stringify(Object.keys(input).sort().reduce((a, k) => { (a as any)[k] = input[k]; return a; }, {} as Record<string, any>)) : "";
  const f = file ? `${file.name}|${file.size}|${file.lastModified}` : "";
  return `${providerName}::${inp}::${f}`;
}

export function useConfiguredKycApi() {
  /** Call a configured provider with a file (multipart) or input (json). */
  const callProvider = useCallback(
    async (params: {
      providerName: string;
      file?: File | null;
      input?: Record<string, any>;
    }): Promise<KycApiResult> => {
      const key = makeInflightKey(params.providerName, params.input, params.file);
      const existing = inflight.get(key);
      if (existing) {
        console.log(`[useConfiguredKycApi] Reusing in-flight ${params.providerName} request`);
        return existing;
      }
      const p = (async (): Promise<KycApiResult> => {
        try {
          let fileBase64: string | undefined;
          let fileMimeType: string | undefined;
          let fileName: string | undefined;
          if (params.file) {
            // Backstop: OCR providers (e.g. GST_OCR / PAN_OCR / Surepass)
            // do not accept PDFs on these endpoints — they return
            // `no_gstin_detected`. If a raw PDF reaches this hook it means
            // the client-side PDF→JPEG conversion failed (commonly the
            // pdf.js worker `.mjs` not loading on the self-hosted server).
            // Refuse to send it and surface a clear error.
            const isOcrProvider = /(_OCR|^OCR_)/i.test(params.providerName);
            const isPdf =
              params.file.type === "application/pdf" ||
              params.file.name.toLowerCase().endsWith(".pdf");
            if (isOcrProvider && isPdf) {
              return {
                found: true,
                ok: false,
                message:
                  "PDF could not be converted to an image in this browser. " +
                  "Please upload a JPG or PNG of the document, or contact your administrator " +
                  "to fix the PDF worker on this server.",
                provider_name: params.providerName,
              };
            }
            fileBase64 = await fileToBase64(params.file);
            fileMimeType = params.file.type || "application/octet-stream";
            fileName = params.file.name || undefined;
          }
          const { data, error } = await supabase.functions.invoke(
            "kyc-api-execute",
            {
              body: {
                providerName: params.providerName,
                input: params.input ?? {},
                fileBase64,
                fileMimeType,
                fileName,
              },
            },
          );
          if (error) {
            return {
              found: false,
              ok: false,
              message: error.message || "API call failed",
            };
          }
          return data as KycApiResult;
        } catch (e: any) {
          return {
            found: false,
            ok: false,
            message: e?.message || "Unexpected error",
          };
        }
      })();
      inflight.set(key, p);
      try {
        return await p;
      } finally {
        inflight.delete(key);
      }
    },
    [],
  );

  return { callProvider };
}
