## What you're seeing in the screenshot

Two separate problems are stacked in this screen:

### A. Why "0 options loaded" on Vendor Cash Flow / Tier Category

The red banner tells the whole story:

> `Classification F4s: middleware rejected request (HTTP 401) at http://206.1.23.95:9009/sap/proxy. Set MIDDLEWARE_SHARED_SECRET on the middleware to match the Proxy Secret.`

CFSTMT and CP_TIER are only returned by the **Classification F4s** SAP API config (the one that failed with 401). Because that call was rejected by your middleware, the edge function never got a payload to cache — so both the live response (`liveF4?.CFSTMT` / `liveF4?.CP_TIER`) and the fallback cache (`sap_master_data` rows for `vendor_cashflow` / `tier_category`) are empty. MGV / Vendor Category still show 63 / 4 options because they were successfully cached by an earlier run.

This is **not a code bug** — the middleware is returning 401 because the `Proxy Secret` in the "Classification F4s" (and "SAP Fields F4") config in SAP API Settings doesn't match the `MIDDLEWARE_SHARED_SECRET` env var on the middleware service.

Fix path (no code change needed):
1. Go to `SAP API Settings → API Configurations`.
2. Open both **SAP Fields F4** and **Classification F4s**.
3. Copy the exact `Proxy Secret` value.
4. On the middleware host, set `MIDDLEWARE_SHARED_SECRET` to the same value and restart the service.
5. Click **Test SAP connection** in each config — both must return OK.
6. Re-open Prepare & Sync; CFSTMT / CP_TIER options will populate.

I don't have credentials for your middleware, so I can't do this from here. Once the 401 is cleared, the code already stores CFSTMT / CP_TIER into `sap_master_data` and hydrates the dropdowns.

### B. Restructure Classification card into two side-by-side panels

Only `src/components/sap/SapFieldsDialog.tsx` changes. The existing `Section` component uses a single 2-column grid — I'll replace the current Classification `<Section>` with a custom block that renders two labelled sub-cards side by side, stacking to one column on mobile:

```text
┌─ Classification ────────────────────────────────────────────┐
│  ┌─ Vendor Details ──────────┐  ┌─ Vendor_CFSTMT ─────────┐ │
│  │ Material Group for Vendors│  │ Vendor Cash Flow        │ │
│  │ [multi-select]            │  │ [multi-select]          │ │
│  │                           │  │                         │ │
│  │ Vendor Category           │  │ Tier Category           │ │
│  │ [multi-select]            │  │ [multi-select]          │ │
│  └───────────────────────────┘  └─────────────────────────┘ │
│  Select Classification values to send to SAP.               │
└─────────────────────────────────────────────────────────────┘
```

Implementation:

- Keep the outer `Section` header (`Tags` icon + "Classification").
- Replace the current 2-column inner grid with a `md:grid-cols-2 gap-4` wrapper containing two rounded-border sub-cards.
- **Left sub-card** — header "Vendor Details":
  - `Material Group for Vendors` (`SapF4MultiSelectField`, `masterType="material_group_vendor"`).
  - `Vendor Category` (`SapF4MultiSelectField`, `masterType="vendor_category"`).
- **Right sub-card** — header "Vendor_CFSTMT":
  - `Vendor Cash Flow` (`SapF4MultiSelectField`, `masterType="vendor_cashflow"`, `liveItems={liveF4?.CFSTMT}`).
  - `Tier Category` (`SapF4MultiSelectField`, `masterType="tier_category"`, `liveItems={liveF4?.CP_TIER}`).
- Keep the trailing helper text below the two sub-cards.

Sub-card styling matches the existing `Section` visual language: `border border-border rounded-lg p-4 space-y-3`, header uses `text-sm font-medium text-primary` so it reads as a nested title without overpowering the main "Classification" heading.

No changes to the payload builder, migration, edge function, or persistence — the previous change already ships CFSTMT / CP_TIER selections in `CASHFLOW` / `TIER_CATEGORY` blocks.

## Verification

1. Re-open the Prepare & Sync popup: Classification card shows two side-by-side sub-cards with the exact field placement above.
2. After you fix the middleware secret, the two right-side dropdowns show live CFSTMT / CP_TIER values (e.g. `CONSTRUCTION — CONSTRUCTION`, `TIER 1 — TIER 1`).
3. Selecting values still produces `CASHFLOW: [{CASH: …}]` and `TIER_CATEGORY: [{TIER: …}]` in the outgoing SAP payload.
