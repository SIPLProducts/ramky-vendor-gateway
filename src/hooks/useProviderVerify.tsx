import { useCallback, useState } from 'react';
import { FieldValidationState } from '@/hooks/useFieldValidation';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';
import { toastKycResult } from '@/lib/kycToast';

/**
 * Lightweight verification state hook for the vendor registration KYC tabs.
 * Wraps `useConfiguredKycApi.callProvider` and exposes a state object that is
 * shape-compatible with `FieldValidationState`. Also fires a sonner toast
 * showing the upstream `message_code` / `status_code` so it's obvious the
 * call ran through the admin-configured provider (not Gemini OCR).
 */
export function useProviderVerify() {
  const { callProvider } = useConfiguredKycApi();
  const [state, setState] = useState<FieldValidationState>({ status: 'idle', message: null });

  const reset = useCallback(() => setState({ status: 'idle', message: null }), []);

  const verify = useCallback(
    async (params: {
      providerName: string;
      /** Friendly label shown in the toast, e.g. "GST". Defaults to providerName. */
      label?: string;
      input?: Record<string, any>;
      file?: File | null;
      validate?: (data: Record<string, any>) => { ok: boolean; message: string; data?: Record<string, any> } | Promise<{ ok: boolean; message: string; data?: Record<string, any> }>;
    }) => {
      setState({ status: 'validating', message: null });
      const r = await callProvider({
        providerName: params.providerName,
        input: params.input,
        file: params.file ?? undefined,
      });

      const label = params.label || params.providerName;
      toastKycResult(label, r);

      if (!r.found) {
        const msg = `${params.providerName} provider is not configured. Ask an admin to add it in KYC & Validation API Settings.`;
        setState({ status: 'failed', message: msg });
        return { ok: false, message: msg, data: undefined as Record<string, any> | undefined, apiResult: r };
      }
      if (!r.ok || !r.data) {
        const msg = r.message || 'Verification failed';
        setState({ status: 'failed', message: msg, data: r.data });
        return { ok: false, message: msg, data: r.data, apiResult: r };
      }

      const post = params.validate ? await params.validate(r.data) : { ok: true, message: r.message || 'Verified', data: r.data };
      if (!post.ok) {
        setState({ status: 'failed', message: post.message, data: post.data || r.data });
        return { ok: false, message: post.message, data: post.data || r.data, apiResult: r };
      }
      setState({ status: 'passed', message: post.message, data: post.data || r.data });
      return { ok: true, message: post.message, data: post.data || r.data, apiResult: r };
    },
    [callProvider],
  );

  return { state, verify, reset, setState };
}
