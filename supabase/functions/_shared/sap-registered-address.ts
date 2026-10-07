// Organization & Contact is the source of truth. Never read GST jurisdiction.
export function normalizeRegisteredState(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return text.replace(/^state\s*[-:]\s*/i, '').split(/[,;\n]|\s+(?:division|circle|range|zone)\s*[-:]/i)[0].trim();
}

export function getRegisteredState(vendor: Record<string, unknown>, override?: unknown): string {
  if (override !== undefined) return vendor.vendor_type === 'international'
    ? String(override ?? '').trim() : normalizeRegisteredState(override);
  if (vendor.vendor_type === 'international') return String(vendor.registered_state ?? '').trim();
  // The Organization State dropdown saves to `state`; older registered_state
  // values may contain the complete GST jurisdiction description.
  return normalizeRegisteredState(vendor.state) || normalizeRegisteredState(vendor.registered_state);
}

const ADDRESS_FIELDS: Record<string, string> = {
  reg_addr1: 'registered_address', reg_addr2: 'registered_address_line2',
  reg_addr3: 'registered_address_line3', reg_addr4: 'registered_address_line4',
  reg_city: 'registered_city', reg_pincode: 'registered_pincode',
  reg_contact1: 'registered_contact_1', reg_contact2: 'registered_contact_2',
  reg_email1: 'registered_email', reg_email2: 'registered_email_2',
};

export function getRegisteredAddressPatch(vendor: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const [key, column] of Object.entries(ADDRESS_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) continue;
    const value = overrides[key];
    if (value !== null && typeof value !== 'string') throw new Error('Invalid registered address field.');
    patch[column] = String(value ?? '').trim();
  }
  const hasState = Object.prototype.hasOwnProperty.call(overrides, 'reg_state');
  if (hasState && overrides.reg_state !== null && typeof overrides.reg_state !== 'string') {
    throw new Error('Invalid registered State.');
  }
  const state = getRegisteredState(vendor, hasState ? overrides.reg_state ?? '' : undefined);
  if (hasState || state !== vendor.registered_state) patch.registered_state = state;
  if (vendor.vendor_type !== 'international' && hasState) patch.state = state;
  return patch;
}

export function applyRegisteredAddressToSap(row: Record<string, any>, vendor: Record<string, any>, region: string): void {
  const address = {
    street: String(vendor.registered_address ?? '').slice(0, 60),
    str_suppl1: String(vendor.registered_address_line2 ?? '').slice(0, 40),
    str_suppl2: String(vendor.registered_address_line3 ?? '').slice(0, 40),
    str_suppl3: String(vendor.registered_address_line4 ?? '').slice(0, 40),
    city: String(vendor.registered_city ?? '').slice(0, 40),
    postl_cod1: String(vendor.registered_pincode ?? '').slice(0, 10),
    location: '', region,
    mob_number: String(vendor.registered_contact_1 ?? vendor.primary_phone ?? '').slice(0, 30),
    mob_number2: String(vendor.registered_contact_2 ?? vendor.secondary_phone ?? '').slice(0, 30),
    smtp_addr: String(vendor.registered_email ?? vendor.primary_email ?? '').slice(0, 241),
    smtp_addr2: String(vendor.registered_email_2 ?? vendor.secondary_email ?? '').slice(0, 241),
  };
  Object.assign(row, address);
  if (Array.isArray(row.vendors)) {
    for (const item of row.vendors) if (item && typeof item === 'object') Object.assign(item, address);
  }
}