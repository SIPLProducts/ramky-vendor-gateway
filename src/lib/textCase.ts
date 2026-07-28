// Preserve these tokens as-is (uppercase) after title-casing.
const KEEP_UPPER = new Set([
  'LTD', 'LTD.', 'PVT', 'PVT.', 'LLP', 'PLC', 'LLC', 'INC', 'INC.',
  'CO', 'CO.', 'JV', 'SMC', 'M/S', '&', 'HUF', 'OPC', 'SA', 'AG', 'GMBH',
  'BV', 'NV', 'SPA', 'SRL', 'AB', 'AS', 'OY',
]);

const titleWord = (w: string): string => {
  if (!w) return w;
  const upper = w.toUpperCase();
  if (KEEP_UPPER.has(upper)) return upper;
  // Preserve non-letter chars, title-case letter runs.
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
