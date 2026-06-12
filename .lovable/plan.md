# Sharvi Vendor Portal — User Manual (DOCX)

A single comprehensive, editable Word document covering every role in the Sharvi Vendor Management System, with screenshots captured from the live preview.

## Deliverable

- **File:** `/mnt/documents/Sharvi_VMS_User_Manual_v1.docx`
- **Format:** DOCX (editable), US Letter, Sharvi branding (greys + blue accent), Arial/Calibri typography matching the SAP Fiori-inspired UI
- **Length:** ~35–45 pages with cover, TOC, screenshots, callouts, and troubleshooting

## Document structure

1. **Cover page** — Sharvi logo, title, version, date, support email
2. **Table of Contents** (auto-generated, hyperlinked)
3. **About this manual** — audience, conventions, support contact
4. **System overview**
   - What VMS does, architecture at a glance (Frontend → Lovable Cloud → SAP via middleware)
   - Roles & responsibilities matrix (Vendor, Buyer, SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office, Tenant Admin, Sharvi Admin)
   - Login, password reset, MFA notes
5. **Vendor guide**
   - Receiving the invitation email
   - Accepting the invite & creating account
   - 7-step registration flow (Company → Contacts → Banking → Tax/KYC → Documents → Declarations → Review/Submit)
   - Inline verifications (PAN, GST, MSME, Bank/Penny-drop, IFSC) and what blocks progression
   - Document upload requirements & OCR auto-fill
   - Tracking status, responding to "Returned to Vendor"
6. **Approver guide** (one section per stage)
   - Buyer Approval (assign company, return to vendor, re-approve)
   - SCM Manager / SCM Head
   - Finance 1 / Finance 2
   - CEO Office
   - Common actions: view documents, comments, approve/reject, audit trail
7. **Tenant Admin guide**
   - User management (create user, assign role, change role, deactivate)
   - Custom roles & permissions matrix
   - Buyer ↔ SCM mapping
   - Approval Matrix configuration (per tenant / All Tenants, role-filtered dropdowns)
   - Workflow configuration
   - Field configuration / Form builder
   - Validation API settings (KYC providers, penny-drop)
   - SAP API settings (direct vs middleware, test connection, payload templates, master data)
   - Email / SMTP configuration, no-reply sender, Resend tracking
   - Branding (logo, colors, theme)
8. **Sharvi Admin Console**
   - Tenant management, invitations, audit logs
   - Scheduled GST compliance checks
   - SAP sync (single & bulk), retry, error inspection
9. **Notifications & emails** — invitation, submission, status, password reset
10. **Troubleshooting**
    - "Email not sent" (DNS/SMTP egress, e.g. `queryA UNKNOWN smtp.gmail.com`)
    - SAP sync failures (middleware reachability, payload mapping)
    - Verification API failures
    - Permission errors / missing role
11. **Glossary** — VMS, SCM, BP, DMS, KYC, MSME, IFSC, Penny-drop, PostgREST, etc.
12. **Appendix** — keyboard shortcuts, support contact, version history

## How it will be built

```text
1. Capture screenshots from live preview (browser tools)
   - Sign in as test user, navigate each major screen at 1366×768
   - Save JPGs to /tmp/manual-shots/
   - Screens: Login, Vendor Register (each step), Vendor Status, Buyer Approval,
     each approval stage, User Mgmt, Approval Matrix, Workflow, Field Config,
     SAP Settings, Email Config, Branding, Sharvi Admin Console, Audit Logs
2. Generate DOCX with docx-js (per built-in skill)
   - Sharvi palette: bg #F7F9FC, primary blue accent, charcoal text
   - Heading1/2/3 styles, TOC with outlineLevel, page numbers in footer,
     Sharvi name in header, smart quotes, proper bullet numbering
   - Embed each screenshot as ImageRun with caption + alt text
   - Callout boxes (single-cell tables w/ light-blue shading) for Tips / Warnings
3. QA pass: convert to PDF via LibreOffice, render each page to JPG,
   inspect for clipped text, broken images, overlapping elements; fix and re-render
4. Write final file to /mnt/documents/ and surface via <presentation-artifact>
```

## Technical details

- **Tooling:** `docx` npm package (already covered by docx skill), LibreOffice for PDF QA, `pdftoppm` for page images
- **Page setup:** US Letter 12240×15840 DXA, 1" margins, Arial 12pt body, Heading1 32pt bold, Heading2 28pt bold
- **Screenshots:** captured via `browser--view_preview` + `browser--screenshot`, ~1366px wide, embedded at 6.0" wide to fit content area
- **Branding tokens pulled from project memory:** grey background, white rounded cards, blue primary, support@sharviinfotech.com
- **No code/config changes to the app** — manual only

## Out of scope (confirm if you want any added)

- Per-page printed glossy design / marketing brochure styling
- Translation to other languages
- Video walkthroughs
- A second in-app `/user-manual` route (we picked DOCX only)

Confirm and I'll switch to build mode, capture screenshots, generate the DOCX, QA it, and hand you the file.
