# Project Architecture Rules

- Keep `vendors.credit_period_expected` as a deprecated legacy column; active application flows must not read or write it, preserving historical data without destructive migrations.
- Enforce Material Group for Vendors in both user interfaces and server-side buyer approval functions; Vendor Category remains optional.
- Use the shared checked function-invocation helper for server-side email calls so nested failures retain their safe response message.
- Treat KYC provider absence separately from backend lookup failures, and verify service-role provider access during self-hosted deployment so configuration errors cannot masquerade as missing providers.
- Hydrate GST filing status from validation history during vendor edits while preserving the newest verification details, because newer validation rows may omit filing data.
- Normalize successful PAN Comprehensive `aadhaar_linked` results so only true stores true and false or null stores false, keeping details and reports consistent.
- Preserve configured PAN request-template options while always overriding `id_number` from validated runtime input, so provider options pass through without permitting hardcoded identity data.
- Keep KYC replacements tab-isolated; a failed attempt shows only a temporary error and never changes saved fields, documents, or status, while only a successful replacement updates that tab and reruns dependent checks.
- Share SAP registered-address resolution between the popup, payload builder, and sync function; prefer the saved Organization State, never GST jurisdiction, and persist allowlisted confirmed address edits only after caller-visible vendor and state validation so SAP and saved registration stay consistent.
- Resolve dashboard approver names in batched authenticated lookups for caller-visible vendors using the actual buyer/company routing and skip flags, never global role membership or arbitrary flow rows.
- Use the saved application reference_number in rejection notifications and check vendor lookup errors; never substitute internal IDs or SAP codes because they identify different records.
- Clear SAP location at client and single/bulk server payload boundaries without changing registered State, region, address lines, or location classification.