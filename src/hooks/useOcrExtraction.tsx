import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OcrDocumentType = "pan" | "gst" | "msme" | "cheque";

export interface OcrResult {
  success: boolean;
  extracted?: Record<string, any>;
  confidence?: number;
  error?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:<mime>;base64," prefix
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useOcrExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);

  const extractFromFile = useCallback(
    async (
      file: File,
      documentType: OcrDocumentType,
      vendorId?: string,
    ): Promise<OcrResult> => {
      setIsExtracting(true);
      try {
        const fileBase64 = await fileToBase64(file);

        const { data, error } = await supabase.functions.invoke("ocr-extract", {
          body: {
            fileBase64,
            mimeType: file.type || "application/octet-stream",
            documentType,
            vendorId,
          },
        });

        if (error) {
          return { success: false, error: error.message ?? "OCR call failed" };
        }
        return data as OcrResult;
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Unexpected error",
        };
      } finally {
        setIsExtracting(false);
      }
    },
    [],
  );

  return { extractFromFile, isExtracting };
}
