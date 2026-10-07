/** SAP location is deliberately blank; this does not affect region or CLASSIFY. */
export function clearSapLocation(row: Record<string, any>): void {
  row.location = '';
  if (Array.isArray(row.vendors)) {
    for (const vendor of row.vendors) if (vendor && typeof vendor === 'object') vendor.location = '';
  }
}