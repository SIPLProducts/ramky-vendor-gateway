Explanation:
- The vendor company is picked from the vendor registration **Buyer Company** dropdown: `formData.organization.buyerCompanyId`.
- That value is saved into `vendors.tenant_id`.
- Approval routing currently looks at `vendors.tenant_id` to find the approval matrix.
- For this vendor, the selected/saved company became `ADIPL-RAMKY JV`, but the invite was sent under `Ramky Energy and Environm` by buyer `Vidya sagar`.
- `ADIPL-RAMKY JV` has no approval matrix, so no `vendor_approval_progress` rows were created. That is why SCM Head, Finance 1, Finance 2, CEO, and SAP queues cannot see it.
- The mapped SCM Manager is not picked from the vendor company. It is picked from `buyer_scm_mappings`, using the inviter/buyer from `vendor_invitations.created_by`.

Plan:
1. Repair the current stuck vendor
   - For vendor `4931737e-ff8a-45cf-a521-22b64f39fabd`, align routing to the invitation company `Ramky Energy and Environm`.
   - Re-run approval routing so SCM Manager, SCM Head, Finance 1, Finance 2, and CEO approval rows are created.
   - Confirm mapped SCM Manager is `Rajaman` because buyer `Vidya sagar` is mapped to him.

2. Prevent future wrong-company routing
   - When a vendor is registering from an invitation, use the invitation company as the workflow company.
   - Do not let a different selected Buyer Company break approval routing.
   - Keep the existing approval flow order unchanged.

3. Show routing details in approval tables/cards
   - In SCM Manager, SCM Head, Finance 1, Finance 2, and CEO approval screens, show:
     - Vendor name
     - Vendor company / buyer company
     - Buyer / invited by
     - Mapped SCM Manager where relevant
   - If the vendor selected company and invitation company differ, show a clear warning/status so admins can identify the mismatch.

4. Show buyer/company details in View Details popup
   - In `VendorReviewDialog`, add a top “Routing / Invitation Details” section with:
     - Vendor company saved on vendor record
     - Invitation company
     - Buyer / invited by name and email
     - Mapped SCM Manager name and email
     - Current approval stage/status
   - Add the same summary to the read-only submission preview where useful.

5. Show buyer/company details in SAP Team view
   - In SAP Sync cards/table, show buyer company and buyer/invited-by so SAP Team can identify who invited the vendor before sync.

6. Backend/data changes needed
   - Extend `list-pending-approvals-by-stage` response to include buyer company, invitation company, buyer, and mapped SCM Manager metadata.
   - Add safe lookup logic from `vendor_invitations`, `tenants`, `profiles`, and `buyer_scm_mappings`.
   - Add a routing fallback so invitation tenant is used for approval matrix seeding when an invited vendor’s saved company does not match the invitation company.

Verification:
- Naresh Babu appears for Rajaman at SCM Manager stage after repair.
- After SCM Manager approval, the same vendor moves to SCM Head, Finance 1, Finance 2, and CEO as per the existing flow.
- SCM Head, Finance 1, Finance 2, CEO, and SAP Team see all vendor data without tenant restriction.
- Approval table/card and View Details popup clearly show vendor company and buyer/invited-by.