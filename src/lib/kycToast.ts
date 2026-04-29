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

  if (!r.found) {
    toast.error(`${label} provider not configured`, {
      description: 'Add it in KYC & Validation API Settings.',
    });
    return;
  }

  const desc = [provider, code, status].filter(Boolean).join(' · ');

  if (r.ok && (r.success !== false)) {
    toast.success(`${label} ${r.message_code || 'verified'}`, { description: desc });
  } else {
    toast.error(`${label} failed`, {
      description: [r.message, desc].filter(Boolean).join(' — '),
    });
  }
}
