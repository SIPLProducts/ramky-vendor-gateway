## Dashboard Tile Updates (`src/pages/Dashboard.tsx`)

1. **Include drafts in the query**
   - Remove `.neq('status', 'draft')` so draft vendors are fetched.

2. **Add a 5th tile: Draft**
   - Extend `StatusFilter` type to `'all' | 'draft' | 'pending' | 'approved' | 'rejected'`.
   - Add `DRAFT_STATUSES = new Set(['draft'])`; count separately (currently draft falls under Pending — will remove from `PENDING_STATUSES`).
   - Update `counts` and `statusFilteredVendors` to handle Draft.
   - Change grid to `lg:grid-cols-5`.

3. **Colored tile backgrounds + selected highlight**

   Each card gets a light tinted background, colored icon chip, and a stronger ring + border when selected:

   | Tile | Background | Icon color | Selected ring |
   |------|------------|-----------|---------------|
   | Total | `bg-blue-50` | `text-blue-600` on `bg-blue-100` | `ring-2 ring-blue-500` |
   | Pending | `bg-orange-50` | `text-orange-600` on `bg-orange-100` | `ring-2 ring-orange-500` |
   | Approved | `bg-green-50` | `text-green-600` on `bg-green-100` | `ring-2 ring-green-500` |
   | Rejected | `bg-red-50` | `text-red-600` on `bg-red-100` | `ring-2 ring-red-500` |
   | Draft | `bg-slate-50` | `text-slate-600` on `bg-slate-100` | `ring-2 ring-slate-500` (icon: `FileEdit`) |

   Refactor `cards` array to carry `bgClass`, `iconBgClass`, `iconColorClass`, and `ringClass` so per-card styling is data-driven. Update the Card `className` to apply `bgClass` always and `ringClass` when `active`.

## Seed Local Test Data

Insert ~10 sample vendors covering every tile via the insert tool:
- 2 × `draft`
- 3 × pending (mix of `buyer_review`, `finance_1_review`, `pending_sap_sync`)
- 3 × approved (`sap_synced`, `dms_synced`)
- 2 × rejected (`sap_team_rejected`, `sap_team_closed`)

Each row will have: `id = gen_random_uuid()`, realistic `legal_name`/`trade_name`, unique `primary_email`, `vendor_type='domestic'`, `created_at = now() - interval '<n> days'`, `tenant_id = NULL` (visible to admin users). No FK to `auth.users` needed since `user_id` will be NULL.

Note: since `assign_vendor_reference_number` only fires on transition into a review status, seeded review-status rows will get reference numbers via the trigger; drafts will have `NULL` reference (correct behavior).

## Out of scope
- No changes to filtering logic outside Dashboard.
- No changes to VendorList, Reports, or backend policies.
- Existing "All Applications" tile continues to show every status.
