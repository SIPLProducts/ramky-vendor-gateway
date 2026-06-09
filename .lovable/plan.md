## Delete all vendor data

### Lovable Cloud (this project's DB) — I will do

1. **Wipe vendor-related tables** (in FK-safe order):
   - `vendor_documents`
   - `vendor_validations`
   - `vendor_approval_progress`
   - `vendor_feedback`
   - `ocr_extractions`
   - `validation_api_logs` (vendor-scoped rows)
   - `audit_logs` (vendor-scoped rows)
   - `vendor_invitations`
   - `vendors`
   - `vendor_reference_counters` (so daily sequence restarts at 001)

2. **Empty the `vendor-documents` storage bucket** — delete every object in the bucket (bucket itself kept).

3. **Keep**:
   - All auth users and `profiles` (including vendor accounts)
   - Admin/config tables (tenants, roles, SAP/KYC configs, form configs, branding, SMTP, etc.)

### Self-hosted `vms.siplproducts.com` — you run

I can't reach your self-hosted instance. After the cloud wipe runs, I'll give you:
- A single SQL script to run on the self-hosted Postgres (same statements as above).
- A short `supabase storage` CLI / `psql` snippet (or a small Node script) to empty the `vendor-documents` bucket on that instance.

You execute it on the server; data is then in sync with the cloud copy.

### Notes

- This is destructive and irreversible — once approved I run it immediately.
- Reference numbers will restart at `YYYYMMDD001` for the next vendor created.
