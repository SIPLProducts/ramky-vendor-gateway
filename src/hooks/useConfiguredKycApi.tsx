import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface KycApiResult {
  found: boolean;
  ok: boolean;
  message: string;
  status?: number;
  latency_ms?: number;
  data?: Record<string, any>;
  raw?: any;
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

export function useConfiguredKycApi() {
  /** Call a configured provider with a file (multipart) or input (json). */
  const callProvider = useCallback(
    async (params: {
      providerName: string;
      file?: File | null;
      input?: Record<string, any>;
    }): Promise<KycApiResult> => {
      try {
        let fileBase64: string | undefined;
        let fileMimeType: string | undefined;
        if (params.file) {
          fileBase64 = await fileToBase64(params.file);
          fileMimeType = params.file.type || "application/octet-stream";
        }
        const { data, error } = await supabase.functions.invoke(
          "kyc-api-execute",
          {
            body: {
              providerName: params.providerName,
              input: params.input ?? {},
              fileBase64,
              fileMimeType,
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
    },
    [],
  );

  return { callProvider };
}
