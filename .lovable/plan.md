# Go-Live Cutover: KYC-Only Onboarding for Existing SAP Vendors

Vendors that already have a SAP vendor code (KYC done manually before go-live) will complete their KYC through the portal, go through the normal approval chain, and finish in a terminal "KYC Completed" state — with no SAP sync and no DMS push. New vendors continue on the existing flow unchanged.

## How it works for users

**Buyer sends the invite**
- The invitation form gets an "Existing SAP Vendor" toggle.
- When switched on, a mandatory "SAP Vendor Code" field appears (plus the usual vendor name / email / contact number).
- The flag and code carry over to the vendor record when the vendor claims the invite.

**Vendor fills the form**
- Identical experience: same steps, same GST / PAN / MSME / Bank verifications, same document uploads.
- A small badge on the header shows "Existing SAP Vendor — KYC Update" so it's clear this is a re-KYC.

**Approvals**
- Exactly the same chain as today (Buyer, SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office — as configured in the approval matrix).
- Comments, rejections, return-to-vendor and history all behave the same.

**After the final approval**
- New vendor: goes to Pending SAP Sync, as today.
- Existing SAP vendor: goes straight to **KYC Completed** (terminal). It never appears in the SAP Sync queue or the DMS sync queue, and no sync can be triggered for it.

**Finding these records**
- Vendor List, Dashboard and Reports get a "Vendor Origin" filter: All / New Vendors / Existing SAP Vendors.
- Vendor List gains a SAP Vendor Code column and shows "KYC Completed" as a distinct status chip.
- Reports export includes the flag and the existing SAP code so cutover progress can be tracked in Excel.

## Cutover sequence (operational)

1. Buyers invite the legacy vendor list with the toggle on and the correct SAP code.
2. Vendors complete KYC; approvers process them alongside new vendors.
3. Track progress with the "Existing SAP Vendors" filter until the legacy list is fully KYC Completed.
4. New vendors registered during this window flow to SAP normally — no interference.

## Technical details

**Database (one migration)**
- `vendor_invitations`: add `is_existing_sap_vendor boolean not null default false`, `existing_sap_vendor_code text`.
- `vendors`: add `is_existing_sap_vendor boolean not null default false`, `existing_sap_vendor_code text`.
- `vendor_status` enum: add value `kyc_completed`.
- Existing rows default to `false`, so current behaviour is untouched.

**Invite path**
- `src/pages/AdminInvitations.tsx`: toggle + SAP code input, validation, pass through to the insert and to the invite edge function payload.
- `get_invitation_by_token` / `record_invitation_access` / `claim_invitation` return the two new fields so the registration page can pick them up.
- `src/hooks/useVendorRegistration.tsx`: copy the flag and code onto the vendor row on first draft save.

**Approval terminal state**
- `supabase/functions/process-approval-action/index.ts`: at the point where it currently sets `pending_sap_sync`, set `kyc_completed` instead when `is_existing_sap_vendor` is true.
- `supabase/functions/buyer-reapprove-rejected/index.ts`: same branch on its final status.

**Sync guards**
- `src/pages/SAPSync.tsx`: filter out `is_existing_sap_vendor` rows from both the SAP and DMS queues.
- `sync-vendor-to-sap` and `sync-vendor-to-dms` edge functions: reject with a clear message if the vendor is flagged, so no manual/API path can push a legacy vendor.

**Status labels and UI**
- Add `kyc_completed` ("KYC Completed") to the status maps in `VendorList.tsx`, `Dashboard.tsx`, `VendorStatus.tsx`, `VendorStageCell.tsx`, `RegistrationStatusTracker.tsx`, `src/lib/reports/loadVendorReport.ts`.
- `RegistrationStatusTracker` ends the timeline at KYC Completed for flagged vendors (no SAP/DMS steps shown).
- Vendor Origin filter added to `VendorList.tsx`, `Dashboard.tsx` and `Reports.tsx`; column + export field for the SAP code.
