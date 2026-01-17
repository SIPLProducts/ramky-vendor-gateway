# SAP Vendor Sync - Field Mapping Documentation

This document describes how vendor registration fields are mapped to SAP API fields.

## Field Mapping Table

| SAP Field | Vendor Table Field | Description | Max Length | Notes |
|-----------|-------------------|-------------|------------|-------|
| BPARTNER | - | Business Partner ID | - | Empty - SAP generates this |
| PARTN_CAT | - | Partner Category | - | Fixed: "1" (Vendor) |
| PARTN_GRP | - | Partner Group | - | Fixed: "S001" (Standard vendor group) |
| TITLE | - | Title | - | Fixed: "0002" (Standard title) |
| NAME1 | legal_name | Legal Name | 40 | Primary vendor name |
| NAME2 | trade_name | Trade Name | 40 | Secondary name |
| STERM1 | legal_name (first word) | Search Term 1 | 20 | First word of legal name |
| STERM2 | legal_name (second word) | Search Term 2 | 20 | Second word of legal name |
| STREET | registered_address | Street Address | 60 | Main address line |
| HOUSE_NO | registered_address_line2 | House Number | 10 | Address line 2 |
| STR_SUPPL1 | registered_address_line3 or registered_city | Street Supplement | 40 | Additional address info |
| LOCATION | registered_city | Location | 40 | City name |
| DISTRICT | registered_city | District | 40 | District (using city) |
| POSTL_COD1 | registered_pincode | Postal Code | 10 | PIN code |
| CITY | registered_city | City | 40 | City name |
| COUNTRY | - | Country Code | 2 | Fixed: "IN" (India) |
| REGION | registered_state | Region/State Code | 2 | State code (AP, MH, etc.) |
| LANGU | - | Language | 1 | Fixed: "E" (English) |
| TEL_NUMBER | registered_phone | Telephone | 16 | Registered office phone |
| MOB_NUMBER | primary_phone | Mobile Number | 16 | Primary contact mobile |
| SMTP_ADDR | primary_email | Email Address | 241 | Primary contact email |
| TAXNUMXL | gstin | GST Number | 20 | GSTIN |
| BUKRS | - | Company Code | 4 | Fixed: "1710" |
| WITHT | - | Withholding Tax Type | 4 | Fixed: "1710" |
| TAXKD07 | - | Tax Indicator | 1 | Fixed: "X" |

## State to Region Code Mapping

Indian states are mapped to 2-letter SAP region codes:

| State | Code | State | Code |
|-------|------|-------|------|
| Andhra Pradesh | AP | Maharashtra | MH |
| Arunachal Pradesh | AR | Manipur | MN |
| Assam | AS | Meghalaya | ML |
| Bihar | BR | Mizoram | MZ |
| Chhattisgarh | CG | Nagaland | NL |
| Goa | GA | Odisha | OR |
| Gujarat | GJ | Punjab | PB |
| Haryana | HR | Rajasthan | RJ |
| Himachal Pradesh | HP | Sikkim | SK |
| Jharkhand | JH | Tamil Nadu | TN |
| Karnataka | KA | Telangana | TG |
| Kerala | KL | Tripura | TR |
| Madhya Pradesh | MP | Uttar Pradesh | UP |
| | | Uttarakhand | UK |
| | | West Bengal | WB |
| | | Delhi | DL |

## Additional Vendor Fields Available (Not Currently Mapped)

The following fields are available in the vendors table but not currently mapped to SAP. These can be added if SAP API supports them:

### Banking Details
- bank_name
- account_number
- ifsc_code
- bank_branch_name
- micr_code
- bank_address
- account_type

### Statutory Details
- pan
- msme_number
- msme_category
- firm_registration_no
- pf_number
- esi_number
- labour_permit_no
- iec_no
- entity_type

### Contact Details
- secondary_contact_name
- secondary_designation
- secondary_email
- secondary_phone
- production_contact_name
- production_designation
- production_phone
- production_email
- customer_service_name
- customer_service_designation
- customer_service_phone
- customer_service_email

### Manufacturing/Branch Details
- manufacturing_address
- manufacturing_city
- manufacturing_state
- manufacturing_pincode
- manufacturing_phone
- branch_address
- branch_city
- branch_state
- branch_pincode
- branch_contact_name
- branch_contact_email
- branch_contact_phone

### Business Details
- industry_type
- organization_type
- ownership_type
- product_categories
- turnover_year1, turnover_year2, turnover_year3
- credit_period_expected
- major_customer1, major_customer2, major_customer3

## SAP Response Format

When a vendor is successfully synced, SAP returns:

```json
[
  {
    "BP_LIFNR": "0000052056",
    "MSGTYP": "S",
    "MSGNR": "2",
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

### Response Fields
- **BP_LIFNR**: SAP Vendor Code (stored in `sap_vendor_code`)
- **MSGTYP**: Message Type ("S" = Success, "E" = Error)
- **MSG**: Human-readable message
- **ERDAT**: Creation date
- **UZEIT**: Creation time
- **UNAME**: SAP username who created it
- **BPNAME**: Business Partner name

## Environment Variables Required

The edge function requires these environment variables:

```bash
# SAP API Configuration
SAP_API_URL=https://49.207.9.62:44325/vendor/bp/create?sap-client=100
SAP_USERNAME=s23hana2
SAP_PASSWORD=Sh@rv!3220

# Supabase (automatically available in edge functions)
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## Workflow

1. User clicks "Approve & Sync" in Purchase Approval page
2. Frontend calls `usePurchaseAction` hook
3. Hook updates vendor status to `purchase_approved`
4. Hook invokes `sync-vendor-to-sap` edge function
5. Edge function:
   - Fetches vendor data from database
   - Maps fields to SAP format
   - Calls SAP API with Basic Auth
   - Parses response
   - Updates vendor with SAP code if successful
6. Frontend displays SAP sync result dialog
7. User sees SAP Vendor Code and success message

## Error Handling

- If vendor not found: Returns 500 error
- If SAP API fails: Returns 400 with SAP error details
- If mapping fails: Returns 500 with error message
- All errors are logged to console and shown to user
