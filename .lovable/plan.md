## 1) Fix Vendor Email showing blank in Approval tables

**Root cause:** In `supabase/functions/list-pending-approvals-by-stage/index.ts`, the vendor email is computed as `v?.primary_email ?? v?.registered_email`. The `??` operator only falls back on `null`/`undefined`. In the database, most vendor rows have `primary_email = ""` (empty string) with a valid `registered_email`, so the empty string wins and the UI shows blank.

**Fix (backend, one function, both stage branches):**
- Replace `v?.primary_email ?? v?.registered_email ?? null` with a truthy fallback so empty strings are skipped, e.g. `(v?.primary_email?.trim() || v?.registered_email?.trim() || null)`.
- Apply this in all three places inside `list-pending-approvals-by-stage/index.ts`:
  - BUYER pending items (line 147)
  - BUYER rejected items (line 174)
  - Downstream stages items (line 293)

**Fix (frontend, defensive):**
- In `src/components/approvals/StageApprovalView.tsx`, change the Vendor Email cell from `{it.vendorEmail ?? '—'}` to `{it.vendorEmail || '—'}` so any lingering empty strings still render an em‑dash.

No schema changes. No other tables or screens touched.

## 2) Answer: Screen name size vs Card header size in UI Design

These are two distinct design tokens exposed in the Design Settings panel (`src/components/admin/DesignSettingsPanel.tsx`) and defined in `src/lib/designTokens.ts` → `DEFAULT_DESIGN_SETTINGS`:

| Token | Where it applies | Default | CSS variable |
|---|---|---|---|
| `typography.screenNameFontSize` | The page/screen title shown at the top of each screen (e.g. "Buyer Approval", "Dashboard"). Rendered by `PageHeader` / screen `<h1>`. | `18px` (weight `600`) | `--screen-name-size`, `--screen-name-weight` |
| `typography.headingFontSize` | Generic large headings inside content (h1/h2 style). | `24px` | `--heading-size` |
| `cards.headerFontSize` | The title text inside a Card header (`<CardTitle>` inside `<CardHeader>`), e.g. section titles like "Pending Approvals", "SAP Sync". | `16px` (weight `600`) | `--card-header-size`, `--card-header-weight` |
| `cards.bodyFontSize` | Text inside `<CardContent>`. | `14px` (weight `400`) | `--card-body-size`, `--card-body-weight` |

So:
- **Screen name size** = the top-of-page screen title (default 18px / 600).
- **Card header size** = the title bar inside each white card (default 16px / 600).

Both are editable at runtime from **Admin → UI Design Settings** (Typography section for screen/heading, Cards section for card header) and persist in `portal_config.ui_design_settings`.

## Scope

- Edit `supabase/functions/list-pending-approvals-by-stage/index.ts` (3 lines).
- Edit `src/components/approvals/StageApprovalView.tsx` (1 line).
- No design-token changes for question 2 — informational only.