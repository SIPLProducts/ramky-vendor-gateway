# Fix: Lossless extraction is silently failing on your cheque PDF — one-line bug found and verified

## What I found (tested against your actual file)

The lossless extraction we added last time **never triggers** for `Avyakth - Cancelled Cheque.pdf`. I ran the exact extraction logic against your file and it found **0 candidates**, so the app silently falls back to the quality-losing canvas re-render — which is why you still see the wrong IFSC.

**Root cause:** Your scanner (HP Scan) writes the PDF with old-style Mac/classic line endings — a lone carriage return (`\r`) after the `stream` keyword. Our code only handles `\r\n` and `\n` (the two forms the PDF spec describes). Because of that single unhandled byte, the JPEG start-marker check fails and the original scan is never extracted.

I verified the fix directly: after also skipping a lone `\r`, the extraction returns the complete original scan (179,750 bytes, valid JPEG start and end markers) — byte-for-byte identical to the image inside the PDF.

## The fix

**`src/lib/pdfToImage.ts`** — in `extractEmbeddedJpeg`, after the `stream` keyword, also skip a lone `\r`:

```text
before:  handle "\r\n" and "\n"
after:   handle "\r\n", "\n", and "\r"
```

Plus one robustness improvement: if the byte right after `stream` still isn't a JPEG start marker, scan forward up to 4 bytes for `FF D8 FF` — so any other unusual scanner output also gets the lossless path instead of silently degrading.

## How we validate

1. Upload the same cheque PDF in the bank KYC step (in the **preview**, where the latest code runs).
2. Console must log `pdf→embedded-jpeg (lossless)` with size ≈ 180 KB — confirming the fast path fired this time.
3. Surepass should return `ifsc_code: KARB0000916`, same as uploading the JPG directly.

Note: if you are testing on your self-hosted server (vms.siplproducts.com), it runs older code — you'll need to redeploy after this fix to see it there.
