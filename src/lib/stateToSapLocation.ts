import type { SapMasterRow } from '@/hooks/useSapMasterData';

/**
 * Mapping from friendly Indian state names (INDIAN_STATES) to the SAP
 * vendor_location master codes. SAP uses uppercase and SAP-specific spellings,
 * so we override the cases where a simple uppercase doesn't match.
 */
export const STATE_TO_SAP_LOCATION_OVERRIDES: Record<string, string> = {
  'Odisha': 'ORISSA',
  'Uttarakhand': 'UTTARAKAND',
  'Chhattisgarh': 'CHHAATTISGARH',
  'Puducherry': 'PONDICHERRY',
  'Meghalaya': 'MEGALAYA',
  'Jammu and Kashmir': 'JAMMU UND KASHMIR',
  'Dadra and Nagar Haveli and Daman and Diu': 'DADRA UND NAGAR HAV.',
  'Andaman and Nicobar Islands': 'ANDAMAN UND NICO.IN.',
};

const norm = (s: string) => (s || '').trim().toUpperCase();

/**
 * Map a state name to a SAP vendor_location code. Resolution order:
 *  1. Explicit override
 *  2. Case-insensitive match against sapRows[].code
 *  3. Uppercase fallback
 */
export function mapStateToSapLocationCode(
  state: string | null | undefined,
  sapRows?: SapMasterRow[] | null,
): string {
  if (!state) return '';
  const override = STATE_TO_SAP_LOCATION_OVERRIDES[state];
  if (override) return override;
  const target = norm(state);
  if (sapRows && sapRows.length) {
    const hit = sapRows.find((r) => norm(r.code) === target);
    if (hit) return hit.code;
  }
  return target;
}

/** Return "CODE — Description" if description exists, else just the code. */
export function getLocationLabel(
  code: string | undefined,
  sapRows?: SapMasterRow[] | null,
): string {
  if (!code) return '';
  const row = (sapRows || []).find((r) => r.code === code);
  if (row?.description && row.description !== row.code) return `${row.code} — ${row.description}`;
  return code;
}
