# GST Filing Status – Loading Spinner

## What The User Will See
- While the GST filing check runs, the filing card shows a clear loading panel in place of the empty table:
  - A smooth spinning ring in the portal's blue, with a soft pulse behind it
  - Text: "Fetching GST Filing Status From GSTN…" and a smaller line "This may take up to 20 seconds"
  - Three shimmering placeholder table rows, so the vendor can see data is on its way
- The "Continue to PAN" popup also shows a small spinner next to "Still fetching…" while the request runs. The "No, Wait" button then waits and closes the popup when the result arrives.
- The spinner stops automatically in every case:
  - **Success:** it fades into the filing table, with a green "Filing Status Received" badge
  - **Empty `[]`:** it shows the saved "No Filing Records" message
  - **Failed or timed out (20s):** the exact error returned by the GST filing API is shown prominently, for example "Invalid GSTIN" or "GST_FILING timed out after 20s". Portal guidance appears below it in small, normal text.
  - **No automatic re-call:** when the API has already answered with an error, the portal does not call it again by itself. A manual "Retry" button is available only if the vendor chooses to try again. The vendor can also continue to PAN through the popup.
- The same loader is used in View Details → GST while it fetches live.

## Not Changed
- API calls, saving logic and existing data stay as they are. Only the display changes.

## Technical Details
- New `src/components/vendor/GstFilingLoader.tsx`: a ring spinner built from Tailwind `animate-spin` and `animate-ping` with semantic tokens (`border-primary`), plus skeleton rows from `@/components/ui/skeleton`. Respects `motion-reduce`.
- `DocumentVerificationStep.tsx`, `kyc/GstKycTab.tsx`, `VendorReviewDialog.tsx`: render the loader while `gstFilingChecking`, `filingChecking` or `filingFetching` is true. A `finally` block already clears the flag on both success and failure, so the spinner always stops.
- Capture the provider error (`r.message`, `r.error`, `r.data.message`, or the thrown error) in a new `gstFilingError` state and show it in the card, the popup and the console. Clear it on success or empty.
- In the popup, when `gstFilingError` is set, show the error and offer "Stay On GST" and "Yes, Continue". Staying does not call the API again; only the manual Retry button calls it.
- Add a fade-in on the table when the result arrives (`animate-in fade-in`).
- Self-hosted deployment needs a frontend build only.
