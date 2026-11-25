# Vendor Lookup: GST 19ANZPH7427E1ZG / PAN ANZPH7427E

Local Lovable result: no vendor found (0 rows). No code changes needed.

Run in Quality/Production SQL Editor:

```sql
SELECT id, legal_name, trade_name, gstin, pan, status, reference_number,
       sap_vendor_code, invitation_id, created_at
FROM public.vendors
WHERE upper(trim(gstin)) = '19ANZPH7427E1ZG'
   OR upper(trim(pan))   = 'ANZPH7427E'
   OR upper(gstin) LIKE '%ANZPH7427E%';
```
