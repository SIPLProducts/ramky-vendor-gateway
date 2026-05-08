## Goal

Make the **full SAP payload** (the 100+ field array you pasted) visible in the browser Network tab when clicking "Sync", instead of the small `{ vendorId, overrides }` body.

Right now the browser sends a compact request and the edge function expands it server-side via the template — that's why you only see the short body. We'll move the expansion to the client so the dynamic, fully-resolved payload travels over the wire and is inspectable.

## Changes

### 1. New client-side payload builder
Create `src/lib/sapPayloadBuilder.ts`:
- Fetches the vendor row, tenant `sap_default_fields`, active `sap_payload_templates` (tenant-specific → global fallback), and `vendor_documents` (downloads + base64-encodes each, skipping >10MB).
- Reuses the same resolver logic currently in the edge function (`resolveTemplate`, `resolveExpr`, `resolveRegion`, `DOC_NAME_MAP`, MSME inference, classify merging).
- Returns the final `payload` array — identical shape to what the edge function builds today.

### 2. Update `usePurchaseAction` (in `src/hooks/useVendors.tsx`)
- Before invoking `sync-vendor-to-sap`, call `buildSapPayload(vendorId, overrides)`.
- Pass the resolved payload in the request body: `{ vendorId, sapPayload }`.
- This is the request the browser Network tab will show — full dynamic payload, every time.

### 3. Update edge function `sync-vendor-to-sap/index.ts`
- If `sapPayload` is present in the request body, **use it directly** and skip template resolution / document fetching.
- Keep the existing template path as a fallback (so older callers still work).
- Still handle: SAP middleware/direct routing, auth headers, response parsing, vendor status update on success.

### 4. No DB schema changes
Templates, defaults, and documents stay in the database — only the *resolution step* moves to the client.

## Why this fixes "same payload sent repeatedly"

Today the browser body is literally just `{ vendorId, overrides }`, so it looks identical between syncs even when the resolved SAP payload differs. After this change, each click serializes the **current** vendor + template + classify + uploads, so the Network tab reflects exactly what SAP receives — and any vendor edit shows up immediately in the next request body.

## Technical notes

- Document base64 encoding on the client uses `FileReader` / `arrayBuffer()` from the Supabase Storage download — same logic as server, just in the browser.
- Resolver is pure — moving it client-side is a straight port (no Deno-only APIs used).
- Edge function keeps its auth gate (`requireAuthenticatedUser`) and middleware secret handling — those must stay server-side.
- A "Preview SAP Payload" button can be added later in `PurchaseApproval.tsx` using the same builder if you want a dry-run view.

## Out of scope

- Changing the SAP field mapping or template content.
- Adding a UI preview modal (can be a follow-up).
