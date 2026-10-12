# Restore dashboard approver names on the self-hosted portal

## Confirmed finding
- The screenshot shows **Names unavailable** for SCM CO, Finance 2, SAP Team, and Returned to Buyer.
- The dashboard sets this label when the `dashboard-approvers` request fails or returns an error. It does not mean those people are unassigned.
- The exact self-hosted failure is not yet confirmed. A missing deployment, authentication failure, or server lookup error must be distinguished before changing anything.

## Plan
1. Check the failed request's status and safe response, plus the matching self-hosted function log. Do not collect keys or Authorization headers.
2. Apply only the correction supported by that evidence:
   - **Missing function:** prepare targeted deployment instructions for `dashboard-approvers/index.ts`, `routing.ts`, and its shared authentication dependencies; reload the function service using the existing self-hosted procedure.
   - **Authentication failure:** check the current signed-in request and existing self-hosted configuration without replacing production keys or weakening authentication.
   - **Server error:** identify the failing lookup or missing schema dependency, then prepare the smallest targeted repair for approval.
3. Verify the signed-in self-hosted dashboard displays **Role (Person Name)** for affected applications and all eligible SAP Team names. Preserve **Not assigned** and **Stage skipped** only where the actual assignments justify them.

## Technical scope and safeguards
- Frontend `dist` deployment alone does not deploy `dashboard-approvers`.
- Retain caller-visible vendor checks, existing company scoping, skip flags, and active-user filtering.
- Do not change registration saving, approval assignments, document access, or unrelated functions.
- No production configuration, migrations, or deployment changes without explicit approval. If self-hosted access is unavailable, provide targeted instructions and leave production verification outstanding.