## Goal

Add a public, SEO-optimized marketing landing page for Sharvi Vendor Gateway at `/`, targeting the keywords **"vendor management system"** and **"vendor onboarding portal"** (plus secondary: "supplier management software", "vendor portal"). Today `/` renders the `Auth` login screen, which has no SEO value and blocks Google from indexing any marketing copy.

## Scope

### 1. Routing change (`src/App.tsx`)
- `/` → new `Landing` page (public)
- `/auth` → existing `Auth` (unchanged)
- All other routes unchanged
- Existing login links continue to work; landing CTAs point to `/auth` and `/vendor/invite`

### 2. New page `src/pages/Landing.tsx`
Single long-scroll page, SAP Fiori-inspired styling consistent with the app (grey `#F7F9FC` bg, white rounded cards, blue primary). Sections:

1. **Hero** — H1 "Vendor Management System for Enterprise Onboarding", subheading mentioning "vendor onboarding portal", primary CTA "Vendor Login", secondary "Request a Demo" (mailto support@sharviinfotech.com)
2. **Trust strip** — SAP S/4HANA, GST, PAN, MSME, Bank verification badges
3. **Features grid** — 6 cards mapped to real product capabilities (7-step onboarding, multi-level approval workflow, KYC verifications, SAP sync, audit logs, role-based access)
4. **How it works** — 3 steps (Invite → Vendor Self-Registration → Approval & SAP Sync)
5. **Keyword-rich content block** — 2–3 short paragraphs naturally using the target keywords + supplier management software / vendor portal
6. **FAQ** — answers to "What is a vendor management system?", "How does vendor onboarding work?", "What's the best vendor management system for enterprise use?" (mirrors high-volume question keywords from Semrush). Doubles as `FAQPage` JSON-LD source.
7. **Footer** — support email, login link

### 3. SEO head (per-route via `react-helmet-async`)
- Install `react-helmet-async`, wrap app in `<HelmetProvider>` in `src/main.tsx`
- `Landing.tsx` `<Helmet>`:
  - `<title>` (~58 chars): "Vendor Management System & Onboarding Portal | Sharvi"
  - `<meta name="description">` (~155 chars) including both primary keywords
  - `<link rel="canonical" href="https://vms.siplproducts.com/">`
  - `og:title`, `og:description`, `og:url`, `og:type=website`
  - JSON-LD: `Organization` + `FAQPage` (from the FAQ section)
- Update `index.html`:
  - Replace sitewide `<title>` and `<meta description>` with Sharvi-branded, keyword-aware fallbacks (so non-JS crawlers still get good defaults)
  - Remove any conflicting per-page tags (none currently — safe)
  - No `og:image` for now (placeholder would hurt previews; can add later if the user provides/wants one generated)

### 4. Semantic HTML & on-page SEO
- Exactly one `<h1>` containing "Vendor Management System"
- `<h2>` per section, using secondary keywords ("Vendor onboarding portal", "Supplier management", etc.) naturally
- Descriptive `alt` text on any imagery
- Internal link from landing → `/auth`, `/vendor/invite`, `/support`
- Lazy-load below-the-fold images if any

### 5. `public/robots.txt` and sitemap
- Confirm `robots.txt` allows `/`
- Add a minimal `public/sitemap.xml` listing `/` (and `/auth`, `/support`) so Google can discover the landing page

## Out of scope
- No backend changes, no DB migrations, no auth changes
- No changes to the vendor registration flow, approval workflow, or any portal screens
- No new images (text-first landing; can add later)
- Existing portal users land on `/auth` directly via bookmark/email — unaffected

## Technical notes

```
src/
  pages/Landing.tsx          NEW
  App.tsx                    EDIT — / → Landing, keep /auth → Auth
  main.tsx                   EDIT — wrap with <HelmetProvider>
index.html                   EDIT — title, description, brand
public/sitemap.xml           NEW
package.json                 +react-helmet-async
```

Routes table after change:

```text
/            Landing (public, SEO)
/auth        Auth (existing, unchanged)
/vendor/*    unchanged
/dashboard…  unchanged (protected)
```

## Expected SEO impact
Targets ~2,400/mo "vendor management system" (KDI 42, achievable) + the exact-match "vendor onboarding portal" (KDI 0, trivial to rank). Both have high commercial intent ($22–$55 CPC). Rankings typically take 4–8 weeks after Google indexes the page.
