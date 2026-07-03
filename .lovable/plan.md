## Scope

Only the **Classification** card in the "Prepare & Sync" (SAP Field Confirmation) popup and the SAP payload builder are touched. Registration steps, other cards, and DMS flow are unchanged.

## UI changes — `src/components/sap/SapFieldsDialog.tsx`

Inside the `Classification` `<Section>`:

- **Remove** the "Vendor Location" input block and the "Vendor Identification Source" `SapF4MultiSelectField`.
- **Row 1:** keep `Material Group for Vendors` (MGV) alone on its own line — wrap in a `md:col-span-2` container so `Vendor Category` moves to the next row.
- **Row 2:** `Vendor Category` (CATV) alone on its line (same `md:col-span-2`).
- **Row 3:** two new multi-select fields side by side:
  - **Vendor Cash Flow** — `SapF4MultiSelectField`, `masterType: "vendor_cashflow"`, `liveItems: liveF4?.CFSTMT`.
  - **Tier Category** — `SapF4MultiSelectField`, `masterType: "tier_category"`, `liveItems: liveF4?.CP_TIER`.

Add both new master types to `F4_FIELD_MAP` with `{ code: "ATWRT", desc: "ATWTB" }` so options render as `CODE — DESCRIPTION`.

Extend the `SapFieldOverrides.classify` type with `CASH: string[]` and `TIER: string[]`; initialise them to `[]` in `buildDefaults`, hydrating from `vendor.vendor_cashflow` / `vendor.tier_category` when present. Wire two `setClassify('CASH', v)` / `setClassify('TIER', v)` handlers.

Drop the `LOCV` / `IDS` fields from the on-screen form only; the type keys stay (kept as empty arrays) so the payload builder's existing wrap for LOCATION_VENDOR / IDENTIFICATION_SOURCE continues to work and simply emits `[]`.

## Master-data plumbing — `supabase/functions/sap-master-fetch/index.ts`

Extend `MASTER_MAP` so a manual "sync" of the new types is understood:

```
CFSTMT: { type: "vendor_cashflow", code: "ATWRT", desc: "ATWTB" },
CP_TIER: { type: "tier_category",  code: "ATWRT", desc: "ATWTB" },
```

Add `"vendor_cashflow"` and `"tier_category"` to the `CLASSIFICATION_TYPES` / `CLASSIFICATION_SAP_KEYS` sets so they resolve through the same `Classification F4s` API config that already returns the CFSTMT / CP_TIER arrays. No new SAP API config or master-data table row is required — the dropdowns will populate live from the F4 response as soon as the popup opens (the same path used today for MGV/CATV).

## Payload — `src/lib/sapPayloadBuilder.ts`

- Extend `classifyArrays` with `CASH` and `TIER`, using `overrides.classify.CASH` / `.TIER` first, falling back to `vendor.vendor_cashflow` / `vendor.tier_category` arrays.
- In the post-processing block, add two new wrappers alongside `MAT_GRP_VENDOR` etc.:

```
CASHFLOW: wrap(classifyArrays.CASH, "CASH"),
TIER_CATEGORY: wrap(classifyArrays.TIER, "TIER"),
```

Multi-select emits one wrapper object per selected value, matching the sample you shared (`"CASHFLOW": [{ "CASH": "CONSTRUCTION" }, ...]`). Empty selection ⇒ `[]`.

**Open question — tier payload key.** You didn't answer the tier key question, so this plan assumes `"TIER_CATEGORY": [{ "TIER": "TIER 1" }]` to mirror the CASHFLOW/CASH shape. If SAP expects a different wrapper (e.g. `CP_TIER` / `TIER1`), tell me and I'll adjust the two lines above.

## Persistence

`persistClassification` in `src/pages/SAPSync.tsx` already stores the `classify` object on the vendor row. Extend it to also write `vendor_cashflow` and `tier_category` columns so re-opening the dialog restores the selections. If those columns don't exist yet on `vendors`, a small migration adds them as `text[]` with default `'{}'` — no RLS/grant changes needed (existing vendors policies cover them).

## Verification

1. Open Prepare & Sync on a vendor: Classification card shows only MGV, Vendor Category, Vendor Cash Flow, Tier Category — each on the expected row.
2. Cash Flow shows entries like `CONSTRUCTION — CONSTRUCTION` from live `CFSTMT`; Tier Category shows `TIER 1 — TIER 1` from live `CP_TIER`.
3. Select values, click **Sync to SAP**, and inspect the outgoing payload (network tab / edge function logs): `CASHFLOW` and `TIER_CATEGORY` arrays contain the selections; `LOCATION_VENDOR` / `IDENTIFICATION_SOURCE` stay as `[]`.
