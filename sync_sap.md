
---

## **API Specification: BP Creation (Vendor Portal)**

### **Endpoint Information**

* 
**URL:** `https://49.207.9.62:44325/vendor/bp/create?sap-client=100` 


* **Method:** POST (Implicit via payload structure)
* 
**Authentication:** Basic Auth 


* 
**Username:** `s23hana2` 


* 
**Password:** `Sh@rv!3220` 





### **Request Payload (JSON)**

The request requires an array of objects. Below is the structure with the mandatory and example values extracted from the document:

```json
[
  {
    "BPARTNER": "",
    "PARTN_CAT": "1",
    "PARTN_GRP": "S001",
    "TITLE": "0002",
    "NAME1": "Sharvi",
    "NAME2": "SIPL",
    "STERM1": "KJNKJLN",
    "STERM2": "NKLMLL",
    "STREET": "NLKMLKM",
    "HOUSE_NO": "HSN123",
    "STR_SUPPL1": "Atmakur",
    "LOCATION": "Atmakur",
    "DISTRICT": "Nellore",
    "POSTL_COD1": "524322",
    "CITY": "Nellore",
    "COUNTRY": "IN",
    "REGION": "AP",
    "LANGU": "E",
    "TEL_NUMBER": "223349",
    "MOB_NUMBER": "7887238330",
    "SMTP_ADDR": "sipl@gmail.com",
    "TAXNUMXL": "90878567768767",
    "BUKRS": "1710",
    "WITHT": "1710",
    "TAXKD07": "X"
    // Note: Numerous other fields are present but empty in the provided sample.
  }
]

```

(Note: Fields like `BPARTNER`, `NAME3`, `BANK_KEY`, and `ZTERM` were provided as empty strings in the source.)

### **Response Payload (JSON)**

The API returns an array confirming the creation and the extension of the vendor to specific company codes:

```json
[
  {
    "BP_LIFNR": "0000052056",
    "MSGTYP": "S",
    "MSGNR": " 2",
    "ERDAT": "2025-11-29",
    "UZEIT": "03:23:01",
    "UNAME": "S23HANA2",
    "MSG": "Business Partner Created",
    "BP_LIFNRX": "B",
    "BPNAME": "Sharvi",
    "PERNR": 0,
    "EXCEL_ROW": 0
  },
  {
    "BP_LIFNR": "0000052056",
    "MSGTYP": "S",
    "MSGNR": "001",
    "ERDAT": "2025-11-29",
    "UZEIT": "03:23:06",
    "UNAME": "S23HANA2",
    "MSG": "Vendor Extended for 1710 Company Code",
    "BP_LIFNRX": "V",
    "BPNAME": "Sharvi",
    "PERNR": 0,
    "EXCEL_ROW": 0
  }
]

```

---

## **Key Integration Data Points**

* 
**Business Partner ID:** Returned in the `BP_LIFNR` field (e.g., `0000052056`).


* 
**Success Indicator:** Look for `"MSGTYP": "S"` (Success) and `"MSG": "Business Partner Created"`.


* 
**Company Code:** The vendor is specifically extended to company code `1710`.

