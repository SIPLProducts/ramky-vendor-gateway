## Problem

The MSME self-declaration flow was added earlier to `MsmeKycTab.tsx`, but the screen the user is actually on (Document Verification step) uses **`DocumentVerificationStep.tsx`** instead. That file currently just renders a "Skipped — not MSME registered" line when "No, skip" is chosen — no download/upload/reason fields appear.

## Fix

Mirror the existing GST self-declaration block (already present at lines 1357–1378 of `DocumentVerificationStep.tsx`) inside the MSME tab's `isMsmeRegistered === false` branch.

### Changes (single file: `src/components/vendor/steps/DocumentVerificationStep.tsx`)

1. **State** (next to existing `gstDeclarationFile` / `gstDeclarationReason` around line 275):
   ```ts
   const [msmeDeclarationFile, setMsmeDeclarationFile] = useState<File | null>(initialData?.msmeSelfDeclarationFile ?? null);
   const [msmeDeclarationReason, setMsmeDeclarationReason] = useState<string>(initialData?.msmeDeclarationReason ?? "");
   ```

2. **Props type** (around line 56–63): add optional `msmeSelfDeclarationFile?: File | null` and `msmeDeclarationReason?: string` to `initialData`.

3. **Replace the "Skipped" block** (lines 1552–1557) with a download-template + InlineFilePicker + reason field, styled exactly like the GST block:
   - Card row: `FileText` icon, "MSME Self-Declaration", "Download, sign, then upload"
   - `<a href="/templates/msme-self-declaration.html" download>` Template link
   - `InlineFilePicker` bound to `msmeDeclarationFile` / `setMsmeDeclarationFile`
   - `FormField` for `msmeDeclarationReason` (placeholder: "e.g. Turnover below MSME threshold limit")

4. **Gate** (`stage3Done`, line 1092): require declaration file when not registered.
   ```ts
   const stage3Done =
     (isMsmeRegistered === false && !!msmeDeclarationFile) ||
     (isMsmeRegistered === true && msmeDoc.status === "verified");
   ```

5. **Persist in `out` payload** (around line 1133): when `isMsmeRegistered === false`, also write `msmeDeclarationReason` and `msmeSelfDeclarationFile` so the parent saves them (the existing upload pipeline already handles `msme_self_declaration` document type from the previous change).

6. **Effect deps**: add `msmeDeclarationFile`, `msmeDeclarationReason` to the dep array on line 1177.

No other files change. The `public/templates/msme-self-declaration.html` template and the `msme_self_declaration` upload type added previously are reused.

## Out of scope

- No changes to the parent `VendorRegistration.tsx` wiring beyond what already exists (already supports `msmeSelfDeclarationFile` / `msmeDeclarationReason` from the prior loop).
- No DB schema changes.