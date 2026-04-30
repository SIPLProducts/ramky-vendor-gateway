import { toast } from 'sonner';
import type { KycApiResult } from '@/hooks/useConfiguredKycApi';

/**
 * Show a toast that proves which configured provider answered the call,
 * surfacing `message_code`, `status_code` and `success` from the upstream API.
 * Used by every KYC tab in the vendor registration flow so admins/vendors can
 * confirm the call ran through KYC & Validation API Settings (not Gemini OCR).
 */
export function toastKycResult(label: string, r: KycApiResult) {
  const provider = r.provider_name ? `via ${r.provider_name}` : 'via configured provider';
  const code = r.message_code ? `message_code: ${r.message_code}` : null;
  const status = r.status_code != null ? `status ${r.status_code}` : (r.status != null ? `HTTP ${r.status}` : null);

  // Only treat as "provider missing" when the edge function explicitly says so
  // AND there is no upstream message_code (i.e. the request never reached an
  // upstream API). This prevents real upstream errors from being misreported.
  if (!r.found && !r.message_code) {
    toast.error(`${label} provider not configured`, {
      description: 'Add it in KYC & Validation API Settings.',
    });
    return;
  }

  const desc = [provider, code, status].filter(Boolean).join(' · ');

  if (r.ok && (r.success !== false)) {
    toast.success(`${label} ${r.message_code || 'verified'}`, { description: desc });
  } else {
    // Surface the actual upstream message in the title so vendors/admins see
    // the real reason (e.g. "no_gstin_detected", "path.split is not a function")
    // instead of a generic "failed".
    const title = r.message ? `${label} failed — ${r.message}` : `${label} failed`;
    toast.error(title, { description: desc });
  }
}
