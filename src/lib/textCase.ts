// Preserve these tokens as-is (uppercase) after title-casing.
const KEEP_UPPER = new Set([
  'LTD', 'LTD.', 'PVT', 'PVT.', 'LLP', 'PLC', 'LLC', 'INC', 'INC.',
  'CO', 'CO.', 'JV', 'SMC', 'M/S', '&', 'HUF', 'OPC', 'SA', 'AG', 'GMBH',
  'BV', 'NV', 'SPA', 'SRL', 'AB', 'AS', 'OY',
]);

const titleWord = (w: string): string => {
  if (!w) return w;
  const letterOnly = w.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (letterOnly && KEEP_UPPER.has(letterOnly)) return w.toUpperCase();
  if (KEEP_UPPER.has(w.toUpperCase())) return w.toUpperCase();
  return w.toLowerCase().replace(/([a-z])([a-z']*)/gi, (_m, a, rest) => a.toUpperCase() + rest);
};

/**
 * If the input is entirely uppercase (letters), return Title Case with a
 * short allowlist of tokens kept uppercase. Mixed-case input is returned
 * unchanged so intentional casing is preserved.
 */
export function toProperCase(value: string | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (!s.trim()) return s;
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters) return s;
  // If any lowercase letter exists, respect the original casing.
  if (letters !== letters.toUpperCase()) return s;
  // Split on whitespace, title-case each token, then title-case sub-tokens
  // separated by - / . so words like "M/S" and "RAMKY-SMC" render correctly.
  return s.split(/(\s+)/).map((chunk) => {
    if (/^\s+$/.test(chunk)) return chunk;
    return chunk.split(/([-/.])/).map(titleWord).join('');
  }).join('');
}

import { pickVendorDisplayName } from '@/lib/sapPayloadBuilder';

/** UI helper: display vendor name in Proper Case (raw value stays in DB). */
export function formatVendorName(vendorOrName: any): string {
  if (vendorOrName == null) return '';
  if (typeof vendorOrName === 'string') return toProperCase(vendorOrName);
  return toProperCase(pickVendorDisplayName(vendorOrName));
}
