import { useCallback, useState } from 'react';
import { FieldValidationState } from '@/hooks/useFieldValidation';
import { useConfiguredKycApi } from '@/hooks/useConfiguredKycApi';

/**
 * Lightweight verification state hook for the vendor registration KYC tabs.
 * Wraps `useConfiguredKycApi.callProvider` and exposes a state object that is
 * shape-compatible with `FieldValidationState`, so existing UI components
 * (ManualEntryAndVerify, VerifyButton, ValidationMessage) keep working.
 *
 * This intentionally bypasses the legacy `useFieldValidation` hook (which
 * called the hardcoded `validate-*` edge functions) so that every KYC call
 * from the registration form goes through the admin-configured providers in
 * "KYC & Validation API Settings".
 */
export function useProviderVerify() {
  const { callProvider } = useConfiguredKycApi();
  const [state, setState] = useState<FieldValidationState>({ status: 'idle', message: null });

  const reset = useCallback(() => setState({ status: 'idle', message: null }), []);

  const verify = useCallback(
    async (params: {
      providerName: string;
      input?: Record<string, any>;
      file?: File | null;
      /** Optional post-processor; return { ok, message, data } to override the raw API result. */
      validate?: (data: Record<string, any>) => { ok: boolean; message: string; data?: Record<string, any> } | Promise<{ ok: boolean; message: string; data?: Record<string, any> }>;
    }) => {
      setState({ status: 'validating', message: null });
      const r = await callProvider({
        providerName: params.providerName,
        input: params.input,
        file: params.file ?? undefined,
      });

      if (!r.found) {
        const msg = `${params.providerName} provider is not configured. Ask an admin to add it in KYC & Validation API Settings.`;
        setState({ status: 'failed', message: msg });
        return { ok: false, message: msg, data: undefined as Record<string, any> | undefined };
      }
      if (!r.ok || !r.data) {
        const msg = r.message || 'Verification failed';
        setState({ status: 'failed', message: msg, data: r.data });
        return { ok: false, message: msg, data: r.data };
      }

      const post = params.validate ? await params.validate(r.data) : { ok: true, message: r.message || 'Verified', data: r.data };
      if (!post.ok) {
        setState({ status: 'failed', message: post.message, data: post.data || r.data });
        return { ok: false, message: post.message, data: post.data || r.data };
      }
      setState({ status: 'passed', message: post.message, data: post.data || r.data });
      return { ok: true, message: post.message, data: post.data || r.data };
    },
    [callProvider],
  );

  return { state, verify, reset, setState };
}
