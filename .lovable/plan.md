

## Plan: Tenant-Configurable Hierarchical Approval Matrix

Build a per-tenant, level-based approval chain for vendor submissions. Each tenant defines their own ordered approver levels (Level 1 → 2 → 3 → …), assigns specific users to each level, and a submitted vendor flows up the chain — each level must approve before it routes to the next.

### Example (from your screenshot)

```text
Vendor Submitted
     │
     ▼
 Level 4: XYZ1 (Buyer)              ── approves ──┐
                                                  ▼
 Level 3: ABC1, ABC1, ABC1 (Managers, ANY one)  ── approves ──┐
                                                              ▼
 Level 2: Soumendukumar (Manager)               ── approves ──┐
                                                              ▼
 Level 1: Brijesh Kabra (SCM Head)              ── final approval ──► SAP Sync
```

Configurable per tenant. Each level has: level number, name, designation/role label, and one or more assigned users. Multi-user levels support "ANY one approves" or "ALL must approve".

### Database (new migration)

```sql
-- Approval matrix definition per tenant
CREATE TABLE public.approval_matrix_levels (
  id uuid PK,
  tenant_id uuid NOT NULL REFERENCES tenants,
  level_number int NOT NULL,             -- 1 = first approver (lowest), N = final
  level_name text NOT NULL,              -- e.g. "Buyer", "Manager", "SCM Head"
  designation text,                      -- free text label shown in UI
  approval_mode text DEFAULT 'ANY',      -- 'ANY' or 'ALL'
  is_active boolean DEFAULT true,
  created_at, updated_at,
  UNIQUE(tenant_id, level_number)
);

-- Users assigned to each level
CREATE TABLE public.approval_matrix_approvers (
  id uuid PK,
  level_id uuid NOT NULL REFERENCES approval_matrix_levels ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid, added_at timestamptz DEFAULT now(),
  UNIQUE(level_id, user_id)
);

-- Per-vendor approval progress
CREATE TABLE public.vendor_approval_progress (
  id uuid PK,
  vendor_id uuid NOT NULL REFERENCES vendors ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES approval_matrix_levels,
  level_number int NOT NULL,
  status text DEFAULT 'pending',        -- pending | approved | rejected | skipped
  acted_by uuid,
  acted_at timestamptz,
  comments text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_id, level_id)
);

-- RLS:
--   approval_matrix_levels / approvers: admin + sharvi_admin + customer_admin (own tenant) manage; assigned approvers can read
--   vendor_approval_progress: assigned approvers see their own pending; admins see all
```

### Routing logic (vendor submission flow)

When a vendor is submitted (`status = 'submitted'`):
1. Edge function `route-vendor-approval` reads the tenant's active approval matrix.
2. Inserts `vendor_approval_progress` rows for every level (all `pending`).
3. Sets vendor status to indicate it is at Level N (highest level) — first action expected from the bottom of the chain.
4. When current level approves:
   - If `approval_mode = ANY`, level marked approved on first approval.
   - If `approval_mode = ALL`, wait until all assigned users approve.
5. Vendor moves to next level (level - 1). Notifications sent to that level's approvers.
6. After Level 1 approves → vendor status = `approved` → triggers existing SAP sync flow.
7. Any level can reject → vendor status = `rejected`, comments captured.

### UI

**1. New tab in User Management → "Approval Matrix"** (admin / sharvi_admin / customer_admin)

Tenant selector at top (admins) or auto-bound to current tenant (customer_admin).

Inline table editor:

```text
┌────────┬──────────────────┬─────────────┬────────────────────────────┬──────┬─────┐
│ Level  │ Name (label)     │ Designation │ Approver(s)                │ Mode │  …  │
├────────┼──────────────────┼─────────────┼────────────────────────────┼──────┼─────┤
│   1    │ SCM Head         │ Final       │ [Brijesh Kabra]            │ ANY  │ ⋮   │
│   2    │ Senior Manager   │ Manager     │ [Soumendukumar]            │ ANY  │ ⋮   │
│   3    │ Manager Group    │ Manager     │ [ABC1] [ABC1] [ABC1]   ＋  │ ANY  │ ⋮   │
│   4    │ Buyer            │ Buyer       │ [XYZ1]                  ＋ │ ANY  │ ⋮   │
└────────┴──────────────────┴─────────────┴────────────────────────────┴──────┴─────┘
                                                          [+ Add Level]  [Save]
```

- Add/remove levels, drag to reorder (renumbers automatically).
- Approver chips use a user picker (searches `profiles` of users in the tenant).
- Mode toggle: ANY one approves vs ALL must approve.
- Visual chain preview at top showing: Level 4 → Level 3 → Level 2 → Level 1.

**2. New page `/admin/my-approvals`** (visible to anyone assigned as an approver)

- Lists vendors waiting at the level the current user is assigned to.
- Each row: vendor name, submitted date, current level, lower-level history.
- Actions: **Approve** / **Reject** (with comments dialog).
- After action, item leaves their queue and either advances or closes.
- Sidebar entry "My Approvals" with pending-count badge.

**3. Vendor detail / FinanceReview pages** — show approval timeline:

```text
✅ Level 4 — XYZ1 (Buyer)         Approved · 21 Apr 10:14
✅ Level 3 — ABC1 (Manager)       Approved · 21 Apr 11:02
🟡 Level 2 — Soumendukumar        Pending
⚪ Level 1 — Brijesh Kabra        Waiting
```

### Files

**New**
- `supabase/migrations/...` — 3 tables, RLS, indexes
- `supabase/functions/route-vendor-approval/index.ts` — initialise progress on submit
- `supabase/functions/process-approval-action/index.ts` — handle approve/reject + advance level + notify
- `src/components/admin/ApprovalMatrixConfig.tsx` — inline editor (used inside User Management tab)
- `src/components/admin/ApproverPicker.tsx` — multi-select user chips
- `src/pages/MyApprovals.tsx` — per-user inbox
- `src/components/vendor/ApprovalTimeline.tsx` — used in vendor detail views
- `src/hooks/useApprovalMatrix.tsx`, `src/hooks/useMyApprovals.tsx`

**Modified**
- `src/pages/UserManagement.tsx` — add 4th tab "Approval Matrix"
- `src/components/layout/Sidebar.tsx` — add "My Approvals" link with badge
- `src/App.tsx` — add `/admin/my-approvals` route
- `src/hooks/useVendorRegistration.tsx` (or vendor submit handler) — call `route-vendor-approval` on submit
- `src/pages/FinanceReview.tsx` / vendor detail — embed `ApprovalTimeline`

### Permissions

- **Configure matrix**: admin, sharvi_admin, customer_admin (own tenant only)
- **Approve/reject**: only users assigned to the active level for that vendor
- **View progress**: admins, finance, purchase, the vendor itself
- All actions written to `audit_logs`

### Safeguards
- Cannot save matrix with zero levels or a level with zero approvers.
- Cannot delete a level if vendors are currently pending at that level (must reassign first).
- Approval action validates the user is in the current pending level (server-side in edge function).
- Email notifications to next-level approvers using existing Resend setup.

### Out of scope (this round)
- Conditional routing (e.g. amount-based skipping)
- Delegation / out-of-office substitutes
- Parallel branches (only sequential levels for now)
- SLA / auto-escalation timers

