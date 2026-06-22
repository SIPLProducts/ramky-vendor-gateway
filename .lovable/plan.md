## Changes

### 1. GST Compliance Report tab — remove sections
**File:** `src/components/vendor/VendorReviewDialog.tsx`

In the `gst_compliance` TabsContent (lines ~690–815), remove:
- The 3-card grid containing **Compliance Score**, **GST Status**, **Risk Level** (lines ~694–727).
- The entire **Compliance Document** block including its heading and the docs list/buttons (lines ~777–811, including the preceding `<Separator />`).

What remains in the tab: GSTIN / Registration Date / Filing Status / Last Filed Return grid + the GST Filing Status (Last 3 Months) table.

### 2. Fix View / Download in Documents tab everywhere
The buttons silently no-op when the signed URL call fails (file missing in storage, expired path, etc.). Make them resilient and user-visible.

**File:** `src/components/vendor/VendorDocuments.tsx` (used by VendorReviewDialog and any approver who opens a vendor)
- In `handlePreview` and `handleDownload`, when `createSignedUrl` errors:
  - Fall back to `supabase.storage.from('vendor-documents').download(file_path)` and open the blob URL (download) or set it as preview source (preview).
  - If that also fails, show a toast: "Document not available — file missing in storage."
- For `handleDownload`, instead of just `window.open`, trigger a real download via an `<a download={doc.file_name}>` click so the browser saves the file rather than navigating away.
- Allow preview for all mime types via the existing dialog (PDF/image inline, others → "Open in new tab"), so the eye button is no longer hidden for non-PDF/image files.

**File:** `src/components/vendor/VendorReviewDialog.tsx`
- The Compliance Document section is being removed (item 1), so its broken `openDocument` calls go away with it.

No changes to `DocumentVerification.tsx` (already has fallback + toast).

### 3. SAP Sync label
**File:** `src/pages/SAPSync.tsx` (line 278)
- Change card label `"Ready for SAP Sync"` → `"Pending for SAP Sync"`.

## Out of scope
- Storage bucket / RLS changes. If files are genuinely missing in storage the toast will now explain it; underlying upload pipeline is unchanged.
