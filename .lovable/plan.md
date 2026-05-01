# Add PAN Number to GST tab + reuse for PAN cross-check + explain Bank error

## What's happening today

1. **GST tab** — when GST is verified, the response includes `pan_number` (e.g. `ABDCS6352G`). The validation code already captures it into `gstDoc.ocrData.pan_number` (DocumentVerificationStep.tsx line 359), but the **GST verified panel UI never renders it** (lines 2060-2098 only show Legal Name, Trade Name, GSTIN, Constitution).
2. **PAN tab** — PAN Number cross-verification against GST already runs (line 374-412 + line 667-679 derives PAN from GSTIN[2:12]). The screenshot confirms: "PAN matches PAN derived from GSTIN" + "PAN is verified" both show. So the logic is wired — it just isn't visually anchored to a PAN field on the GST tab.
3. **Bank cheque error** — "Transaction rate limit exceeded. Please try again later." is **the upstream Surepass BANK_OCR provider's response** (screenshot shows the BANK_OCR badge with Failed status). It's not an app bug; Surepass is throttling the API key. Our code passes the message through unchanged.

## Changes

### 1. GST tab — add PAN Number field to the verified panel
**File:** `src/components/vendor/steps/DocumentVerificationStep.tsx`

In the `GstVerifiedPanel` Identity grid (lines 2063-2097), add a new `EditableOcrField` for PAN Number, populated from `ocr.pan_number` (which the GST API already fills via the `normalized` mapping at line 359). Read-only / `mono`, with `verifiedValue={api.pan_number}` and label "PAN Number derived from GSTIN".

Also add `pan_number: d.pan_number` to the `verifiedApi` shape passed in (the GST verify result already carries it as `panNumber` at line 368 — add the snake_case alias so the panel can show "verified" green check).

### 2. PAN tab — make the cross-check message explicit
**File:** `src/components/vendor/steps/DocumentVerificationStep.tsx`

Currently when PAN matches, the success uses generic copy. Update the verified-state subtitle on the PAN card to render the two messages already produced in `apiData`:
- `panMatchMessage`: "PAN Number verified with GST PAN Number."
- `nameMatchMessage`: "PAN Holder Name verified with GST Legal Name."

(The data is already on `panDoc.apiData` — just surface it in the rendered panel near lines 1220-1230.)

Also tighten line 669-679 so the cross-check uses **`gstDoc.ocrData.pan_number` directly** (from the API response) instead of re-deriving from `gstin.slice(2,12)`. Slicing GSTIN works but the API gives us the canonical value — prefer it, fall back to slice only if missing.

### 3. Bank tab — clarify the upstream rate-limit message
**File:** `src/components/vendor/steps/DocumentVerificationStep.tsx`

When the cheque OCR fails with a message containing "rate limit", show a friendlier inline note under the failed cheque tile:
> "The bank document service is temporarily throttled by the upstream provider (Surepass). Please wait ~30 seconds and click Replace to retry. No re-upload of GST/PAN/MSME is needed."

This is purely a UI hint — no retry/queue logic, since the throttle is on the provider side.

### 4. (Already done — confirm) Bank holder-name validation against GST + PAN
The logic at lines 510-542 already implements the three messages exactly as requested:
- both match → "Account Holder Name verified with GST Legal Name and PAN Holder Name."
- gst only → "Account Holder Name matched with GST Legal Name."
- neither → "Account Holder Name does not match with GST Legal Name and PAN Holder Name." (blocks navigation via mismatch dialog)

No change needed here — but the user can't currently test it because Surepass BANK_OCR is rate-limited. Once the OCR succeeds the existing flow will trigger.

## Files touched
- `src/components/vendor/steps/DocumentVerificationStep.tsx` (GST panel field, PAN message rendering, PAN cross-check source, bank rate-limit hint)

## Out of scope
- Changing the Surepass throttle behaviour (provider-side limit).
- Editing `KycTabs`/`PanKycTab`/`BankKycTab` standalone components — the screen in the screenshots is `DocumentVerificationStep`, not `KycTabs`.
