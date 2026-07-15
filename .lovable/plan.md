Update the Statutory Details layout in the View Details dialog so the rows are explicitly structured instead of relying on auto-flow grid placement.

Implementation plan:

1. Keep row 1 exactly as:

```text
GSTIN                  PAN                   PAN Holder Name
```

2. Keep row 2 exactly as:

```text
PAN Status             Is Aadhaar Linked
```

3. Move all MSME fields into row 3 exactly as:

```text
MSME Number            MSME Category         MSME Major Activity
```

4. Ensure `MSME Major Activity` continues to display from `v.msme_major_activity`.

5. Do not change the Address Details section or any other fields in this fix.