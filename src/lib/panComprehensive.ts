// Shared formatting helpers for PAN Comprehensive Validation API result
// (fields `status` and `aadhaar_linked` from the Surepass PAN Comprehensive endpoint).

export function formatPanStatus(status: string | null | undefined): string {
  const s = String(status ?? '').trim().toLowerCase();
  if (!s) return '-';
  return s === 'valid' ? 'Valid' : 'Invalid';
}

export function formatAadhaarLinked(linked: boolean | null | undefined): string {
  if (linked === true) return 'Aadhaar Linked with PAN';
  return 'Aadhaar Not Linked with PAN';
}

/** Human label used across the app. */
export const PAN_STATUS_LABEL = 'PAN Status';
export const AADHAAR_LINKED_LABEL = 'Is Aadhaar Linked';
