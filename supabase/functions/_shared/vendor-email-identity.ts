export function vendorEmailIdentity(vendor: Record<string, unknown>): { name: string; reference: string } {
  const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const reference = clean(vendor.reference_number);
  if (!reference) console.warn('Vendor notification: application reference is not assigned.');
  return {
    name: clean(vendor.trade_name) || clean(vendor.legal_name) || clean(vendor.pan_holder_name) || clean(vendor.account_holder_name) || 'Vendor',
    reference: reference || 'Not Assigned',
  };
}