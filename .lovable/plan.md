## Plan

1. **Make GST address extraction provider-safe**
   - Update `DocumentVerificationStep.tsx` so GST verification reads the principal business address from all known registry response shapes, not only `d.address`.
   - Prefer official registry fields in this order: `principal_place_of_business`, `principalPlaceOfBusiness`, `principal_address`, `address`, then nested raw response paths such as `raw.data.address`.

2. **Stop stale/OCR address from winning**
   - When a new GST certificate is verified, clear any old Principal Place value at upload start.
   - After verification, always set the field from the canonical registry address if present.
   - Use OCR only as a fallback when the registry has no usable address.

3. **Keep saved/review data aligned**
   - Ensure the same canonical address is written into `gst.principalPlaceOfBusiness`, `gst.address`, the statutory field, and the registered address merge.
   - Update the “Matches registry address” indicator to compare against the canonical registry address, not just `api.address`.

4. **Verify the fix**
   - Check the updated code path for GST upload → API normalization → field display → form merge, so the uploaded response address shown in your screenshot is the one displayed in “Principal Place of Business”.