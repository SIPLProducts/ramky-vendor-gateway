import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  ShieldCheck,
  Workflow,
  FileCheck2,
  RefreshCw,
  ClipboardList,
  Users,
  ArrowRight,
  CheckCircle2,
  Mail,
} from "lucide-react";

const SITE_URL = "https://vms.siplproducts.com";
const TITLE = "Vendor Management System & Onboarding Portal | Sharvi";
const DESCRIPTION =
  "Sharvi Vendor Gateway is an enterprise vendor management system and vendor onboarding portal with GST, PAN, MSME and bank verification, multi-level approvals and SAP S/4HANA sync.";

const features = [
  {
    icon: ClipboardList,
    title: "Guided 7-step vendor onboarding",
    body: "A structured vendor onboarding portal that walks suppliers through organization, contact, address, financial, compliance and document submission — with autosave and progress tracking.",
  },
  {
    icon: ShieldCheck,
    title: "Built-in KYC verifications",
    body: "Inline GST, PAN, MSME (Udyam) and bank account (penny-drop) checks against authoritative APIs before a vendor can advance.",
  },
  {
    icon: Workflow,
    title: "Multi-level approval workflow",
    body: "Configurable SCM CO, SCM Head, Finance and CEO stages with delegation, comments, and a full audit trail for every decision.",
  },
  {
    icon: RefreshCw,
    title: "Native SAP S/4HANA sync",
    body: "Approved vendor masters are pushed straight into SAP through configurable payload templates — no spreadsheets, no rekeying.",
  },
  {
    icon: FileCheck2,
    title: "Document OCR & validation",
    body: "Upload PAN, GST and bank documents; OCR extracts the fields and compares them with what the vendor typed to flag mismatches.",
  },
  {
    icon: Users,
    title: "Role-based access & tenancy",
    body: "Granular screen permissions, custom roles and per-tenant branding let one platform serve multiple buyer companies safely.",
  },
];

const steps = [
  {
    n: "01",
    title: "Buyer sends a secure invitation",
    body: "Procurement creates a vendor invitation in the portal; the supplier receives a tracked email with a one-time registration link.",
  },
  {
    n: "02",
    title: "Vendor self-registers and verifies",
    body: "The supplier completes the 7-step form, uploads documents and clears every inline KYC check before submitting.",
  },
  {
    n: "03",
    title: "Approve and sync to SAP",
    body: "SCM, Finance and leadership approve in sequence; the approved record is pushed into SAP S/4HANA as a ready-to-transact vendor master.",
  },
];

const faqs = [
  {
    q: "What is a vendor management system?",
    a: "A vendor management system (VMS) is enterprise software that centralizes how a buying organization onboards, verifies, approves and maintains its suppliers. Sharvi Vendor Gateway covers the full lifecycle — from the first invitation, through KYC and approvals, to the vendor master record in SAP.",
  },
  {
    q: "How does a vendor onboarding portal work?",
    a: "A vendor onboarding portal lets suppliers register themselves through a secure web form instead of emailing PDFs back and forth. Sharvi's portal collects company, tax, banking and compliance details, runs live GST, PAN, MSME and bank verifications, and routes the submission through configurable approval levels.",
  },
  {
    q: "What's the best vendor management system for enterprise use?",
    a: "The best enterprise vendor management system is the one that fits your existing ERP and approval policy. Sharvi Vendor Gateway is built for organizations running SAP S/4HANA, with multi-tenant support, configurable approval matrices, KYC integrations for Indian compliance, and full audit logging.",
  },
  {
    q: "Does Sharvi Vendor Gateway integrate with SAP?",
    a: "Yes. Approved vendors are written into SAP S/4HANA through configurable payload templates and field mappings, so the master record created during onboarding is the same record procurement transacts on.",
  },
  {
    q: "Which compliance checks are supported?",
    a: "Inline checks for GST, PAN, MSME (Udyam) and bank account (penny-drop) verification are built in, with OCR cross-validation against uploaded documents and scheduled re-checks for GST compliance.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Sharvi Infotech",
  url: SITE_URL,
  email: "vyapaarsupport@ramky.com",
  description: DESCRIPTION,
};

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading, isVendor, userRole } = useAuth();

  useEffect(() => {
    if (loading || !user || !userRole) return;
    if (isVendor) navigate('/vendor/login', { replace: true });
  }, [user, loading, userRole, isVendor, navigate]);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-foreground">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(organizationJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center text-sm">S</span>
            Sharvi Vendor Gateway
          </Link>
          <nav className="flex items-center gap-2">
            <a href="#features" className="hidden sm:inline-block text-sm text-muted-foreground hover:text-foreground px-3 py-2">Features</a>
            <a href="#how" className="hidden sm:inline-block text-sm text-muted-foreground hover:text-foreground px-3 py-2">How it works</a>
            <a href="#faq" className="hidden sm:inline-block text-sm text-muted-foreground hover:text-foreground px-3 py-2">FAQ</a>
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          <CheckCircle2 className="h-3.5 w-3.5" /> Enterprise vendor onboarding for SAP S/4HANA
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
          A vendor management system built for enterprise onboarding
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
          Sharvi Vendor Gateway is a secure vendor onboarding portal with built-in GST, PAN, MSME and bank verification, multi-level approvals, and native SAP S/4HANA sync.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Sign in <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="mailto:vyapaarsupport@ramky.com?subject=Sharvi%20Vendor%20Gateway%20demo">
              <Mail className="h-4 w-4 mr-2" /> Request a demo
            </a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Already invited? Open your invitation email or go to <Link to="/vendor/login" className="underline">vendor login</Link>.
        </p>
      </section>

      {/* Trust strip */}
      <section className="container mx-auto px-6 pb-12">
        <Card className="rounded-[10px] border-border/60 shadow-sm">
          <CardContent className="py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-muted-foreground">
            <span>SAP S/4HANA</span>
            <span>GST verification</span>
            <span>PAN verification</span>
            <span>MSME / Udyam</span>
            <span>Penny-drop bank check</span>
            <span>Audit logging</span>
          </CardContent>
        </Card>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold">Everything supplier management software should do</h2>
          <p className="mt-3 text-muted-foreground">
            One platform for invitations, KYC, approvals and SAP master creation — without the spreadsheets and email chains.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <Card key={f.title} className="rounded-[10px] border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white border-y border-border">
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold">How vendor onboarding works</h2>
            <p className="mt-3 text-muted-foreground">
              From the first invitation to a live SAP vendor master in three tracked stages.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {steps.map((s) => (
              <Card key={s.n} className="rounded-[10px] border-border/60 shadow-sm">
                <CardContent className="p-6">
                  <div className="text-xs font-mono text-primary mb-3">{s.n}</div>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Keyword-rich content */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto prose-sm text-muted-foreground space-y-4">
          <h2 className="text-3xl font-bold text-foreground">Vendor portal designed for procurement teams</h2>
          <p>
            Sharvi Vendor Gateway is a vendor management system that combines a self-service vendor portal with the governance enterprise procurement teams need. Suppliers register through a guided onboarding portal, upload statutory documents, and clear inline KYC checks before any internal approver ever sees the request.
          </p>
          <p>
            Because the platform sits in front of SAP S/4HANA, every approved record becomes a clean vendor master — with the same tax IDs, bank details and company codes your buyers transact against. That's why we describe Sharvi as supplier management software, not just an onboarding form: it owns the data from first contact through ERP creation, with audit logs and scheduled compliance re-checks built in.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white border-t border-border">
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <h2 className="text-3xl font-bold">Frequently asked questions</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((f) => (
              <Card key={f.q} className="rounded-[10px] border-border/60 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">{f.q}</h3>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-16">
        <Card className="rounded-[10px] border-border/60 shadow-sm bg-primary text-primary-foreground">
          <CardContent className="p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold">Ready to modernize vendor onboarding?</h2>
            <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
              Talk to us about replacing your spreadsheets and email approvals with a governed, SAP-ready vendor portal.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <a href="mailto:vyapaarsupport@ramky.com?subject=Sharvi%20Vendor%20Gateway%20demo">
                  <Mail className="h-4 w-4 mr-2" /> Email vyapaarsupport@ramky.com
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-white">
        <div className="container mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Sharvi Infotech. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <a href="mailto:vyapaarsupport@ramky.com" className="hover:text-foreground">vyapaarsupport@ramky.com</a>
            <Link to="/support" className="hover:text-foreground">Support</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
