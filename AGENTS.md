# Project Architecture Rules

- Keep `vendors.credit_period_expected` as a deprecated legacy column; active application flows must not read or write it, preserving historical data without destructive migrations.
- Enforce Material Group for Vendors in both user interfaces and server-side buyer approval functions; Vendor Category remains optional.
- Use the shared checked function-invocation helper for server-side email calls so nested failures retain their safe response message.
- Treat KYC provider absence separately from backend lookup failures, and verify service-role provider access during self-hosted deployment so configuration errors cannot masquerade as missing providers.
- Hydrate GST filing status from validation history during vendor edits while preserving the newest verification details, because newer validation rows may omit filing data.
- Normalize successful PAN Comprehensive `aadhaar_linked` results so only true stores true and false or null stores false, keeping details and reports consistent.
- Keep KYC document replacements tab-isolated; re-run dependent cross-checks as failed/review statuses without deleting other tabs' data or files.