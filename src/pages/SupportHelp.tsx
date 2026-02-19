import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  HelpCircle, 
  Mail, 
  Phone, 
  Clock, 
  MessageSquare,
  FileQuestion,
  Building2,
  CreditCard,
  Shield,
  Send,
  Download,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const faqs = [
  {
    category: 'Registration',
    icon: <Building2 className="h-5 w-5" />,
    questions: [
      {
        q: 'How do I register as a vendor?',
        a: 'You can register by visiting the Vendor Registration page and filling out the multi-step form with your organization, contact, statutory, bank, and financial details. Once submitted, your application will go through verification.',
      },
      {
        q: 'What documents do I need for registration?',
        a: 'You will need: GST Certificate, PAN Card, MSME Certificate (if applicable), Cancelled Cheque, and Financial Statements for the last 3 years.',
      },
      {
        q: 'How long does the registration process take?',
        a: 'The registration process typically takes 5-7 business days, depending on document verification and approval workflows.',
      },
      {
        q: 'Can I save my registration and continue later?',
        a: 'Yes! You can click "Save as Draft" at any time during registration. Your progress will be saved and you can continue from where you left off.',
      },
    ],
  },
  {
    category: 'Validation & Verification',
    icon: <Shield className="h-5 w-5" />,
    questions: [
      {
        q: 'What happens after I submit my registration?',
        a: 'After submission, your documents undergo automatic validation (GST, PAN, Bank verification). If all validations pass, your application moves to finance review.',
      },
      {
        q: 'What if my validation fails?',
        a: 'If any validation fails, you will see the specific errors on your status page. You can click "Edit & Resubmit" to correct the information and resubmit.',
      },
      {
        q: 'How can I check my registration status?',
        a: 'Once logged in, visit the Vendor Registration page to see your current status in the progress tracker. You will also receive email notifications for status changes.',
      },
    ],
  },
  {
    category: 'Payment & Banking',
    icon: <CreditCard className="h-5 w-5" />,
    questions: [
      {
        q: 'Why is bank account verification required?',
        a: 'Bank verification ensures that payments are made to the correct account. We verify your account number and IFSC code against official records.',
      },
      {
        q: 'What credit periods are available?',
        a: 'Credit periods are negotiated during registration. Common options include 30, 45, 60, or 90 days, subject to approval.',
      },
    ],
  },
  {
    category: 'Technical Issues',
    icon: <FileQuestion className="h-5 w-5" />,
    questions: [
      {
        q: 'I cannot upload my documents. What should I do?',
        a: 'Ensure your documents are in PDF, JPG, or PNG format and under 5MB. If the issue persists, try using a different browser or clearing your cache.',
      },
      {
        q: 'My session expired during registration. Is my data saved?',
        a: 'If you clicked "Save as Draft" before your session expired, your data is safe. Otherwise, you may need to re-enter some information.',
      },
    ],
  },
];

function FeatureSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
        <ArrowRight className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <ul className="space-y-2 ml-6">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SupportHelp() {
  const { toast } = useToast();
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDownloadFeatures = () => {
    const content = `
RAMKY VENDOR ONBOARDING PORTAL
Product Features & Functionalities
===================================

1. VENDOR SELF-REGISTRATION PORTAL
- Multi-step registration form (Organization, Contact, Statutory, Bank, Financial details)
- Save as Draft & resume later functionality
- Invitation-based registration via secure email links
- Multi-tenant support for multiple buyer companies (RIL, REE, REF, RPC, REEL)

2. AUTOMATED DOCUMENT VERIFICATION
- GST Number Verification – Validates GSTIN against government database
- PAN Verification – Cross-checks PAN details with NSDL/UTIITSL
- MSME Certificate Verification – Validates Udyam registration number
- Bank Account Verification – Validates account number & IFSC code
- Penny Drop Verification – Real-time bank account ownership validation via ₹1 test transaction
- Name Match Verification – Cross-validates entity name across GST, PAN & Bank records

3. GST COMPLIANCE CHECK
- Periodic GST return filing status check
- Scheduled compliance monitoring (configurable frequency)
- Automated alerts for non-compliant vendors
- Compliance history tracking and audit trail

4. MULTI-LEVEL APPROVAL WORKFLOW
- Finance Review & Approval – Finance team reviews vendor financials, bank details, and compliance
- Purchase Review & Approval – Purchase team reviews vendor capabilities and commercial terms
- Configurable approval steps with role-based access
- Approval comments, rejection reasons, and request-for-info flows
- Email notifications at each approval stage

5. SAP INTEGRATION (BUSINESS PARTNER CREATION)
- Automatic sync of approved vendor data to SAP S/4HANA
- Business Partner (BP) creation via SAP API
- Vendor code generation and mapping
- Company code extension (e.g., 1710)
- Real-time sync status tracking with SAP response logging

6. ADMINISTRATION & CONFIGURATION
- Tenant/Buyer Company Management
- Form Field Configuration – Show/hide/reorder fields per tenant
- Validation API Provider Management – Configure external API endpoints
- Workflow Configuration – Define approval steps and roles
- Branding Configuration – Custom logo, colors, and company details per tenant
- API Logs & Monitoring – Track all validation API calls and responses

7. AUDIT TRAIL & SECURITY
- Complete audit logging of all user actions
- Role-based access control (Vendor, Finance, Purchase, Admin, Sharvi Admin)
- Row-level security on all database tables
- Encrypted credential storage for API keys
- Session management and secure authentication

8. NOTIFICATIONS & COMMUNICATION
- Email notifications for registration status changes
- Invitation emails with secure registration links
- Finance & Purchase approval notifications
- Email delivery tracking (sent, opened, clicked)

===================================
© Ramky Group – Vendor Onboarding Portal
Powered by Sharvi Technologies
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Ramky_Vendor_Portal_Features.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download Started',
      description: 'Product Features document is being downloaded.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast({
      title: 'Message Sent',
      description: 'Our support team will get back to you within 24 hours.',
    });

    setContactForm({ name: '', email: '', subject: '', message: '' });
    setIsSubmitting(false);
  };

  return (
    <div className="w-full">
      <main className="w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Help & Support</h1>
          <p className="text-muted-foreground">
            Find answers to common questions or reach out to our support team for assistance
          </p>
        </div>

        {/* Quick Contact Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Email Support</p>
                  <a href="mailto:vendor-support@ramky.com" className="text-sm text-primary hover:underline">
                    vendor-support@ramky.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Phone Support</p>
                  <a href="tel:+914023456789" className="text-sm text-primary hover:underline">
                    +91 40 2345 6789
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Working Hours</p>
                  <p className="text-sm text-muted-foreground">
                    Mon - Fri: 9:00 AM - 6:00 PM IST
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* FAQs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Frequently Asked Questions
              </CardTitle>
              <CardDescription>
                Browse common questions by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-4">
                {faqs.map((category, idx) => (
                  <div key={category.category}>
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                      {category.icon}
                      {category.category}
                    </div>
                    {category.questions.map((faq, qIdx) => (
                      <AccordionItem key={qIdx} value={`${idx}-${qIdx}`}>
                        <AccordionTrigger className="text-left text-sm">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </div>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Contact Support
              </CardTitle>
              <CardDescription>
                Can't find what you're looking for? Send us a message
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={contactForm.name}
                      onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, subject: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Please describe your issue in detail..."
                    rows={5}
                    value={contactForm.message}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Product Features & Functionalities */}
        <Card className="mt-8" id="product-features">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Product Features & Functionalities
              </CardTitle>
              <CardDescription>
                Complete vendor onboarding platform capabilities
              </CardDescription>
            </div>
            <Button onClick={handleDownloadFeatures} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6" id="features-content">
              {/* Vendor Registration */}
              <FeatureSection
                title="1. Vendor Self-Registration Portal"
                items={[
                  'Multi-step registration form (Organization, Contact, Statutory, Bank, Financial details)',
                  'Save as Draft & resume later functionality',
                  'Invitation-based registration via secure email links',
                  'Multi-tenant support for multiple buyer companies (RIL, REE, REF, RPC, REEL)',
                ]}
              />

              {/* Document Verification */}
              <FeatureSection
                title="2. Automated Document Verification"
                items={[
                  'GST Number Verification – Validates GSTIN against government database',
                  'PAN Verification – Cross-checks PAN details with NSDL/UTIITSL',
                  'MSME Certificate Verification – Validates Udyam registration number',
                  'Bank Account Verification – Validates account number & IFSC code',
                  'Penny Drop Verification – Real-time bank account ownership validation via ₹1 test transaction',
                  'Name Match Verification – Cross-validates entity name across GST, PAN & Bank records',
                ]}
              />

              {/* GST Compliance */}
              <FeatureSection
                title="3. GST Compliance Check"
                items={[
                  'Periodic GST return filing status check',
                  'Scheduled compliance monitoring (configurable frequency)',
                  'Automated alerts for non-compliant vendors',
                  'Compliance history tracking and audit trail',
                ]}
              />

              {/* Approval Workflow */}
              <FeatureSection
                title="4. Multi-Level Approval Workflow"
                items={[
                  'Finance Review & Approval – Finance team reviews vendor financials, bank details, and compliance',
                  'Purchase Review & Approval – Purchase team reviews vendor capabilities and commercial terms',
                  'Configurable approval steps with role-based access',
                  'Approval comments, rejection reasons, and request-for-info flows',
                  'Email notifications at each approval stage',
                ]}
              />

              {/* SAP Integration */}
              <FeatureSection
                title="5. SAP Integration (Business Partner Creation)"
                items={[
                  'Automatic sync of approved vendor data to SAP S/4HANA',
                  'Business Partner (BP) creation via SAP API',
                  'Vendor code generation and mapping',
                  'Company code extension (e.g., 1710)',
                  'Real-time sync status tracking with SAP response logging',
                ]}
              />

              {/* Admin & Configuration */}
              <FeatureSection
                title="6. Administration & Configuration"
                items={[
                  'Tenant/Buyer Company Management',
                  'Form Field Configuration – Show/hide/reorder fields per tenant',
                  'Validation API Provider Management – Configure external API endpoints',
                  'Workflow Configuration – Define approval steps and roles',
                  'Branding Configuration – Custom logo, colors, and company details per tenant',
                  'API Logs & Monitoring – Track all validation API calls and responses',
                ]}
              />

              {/* Audit & Security */}
              <FeatureSection
                title="7. Audit Trail & Security"
                items={[
                  'Complete audit logging of all user actions',
                  'Role-based access control (Vendor, Finance, Purchase, Admin, Sharvi Admin)',
                  'Row-level security on all database tables',
                  'Encrypted credential storage for API keys',
                  'Session management and secure authentication',
                ]}
              />

              {/* Notifications */}
              <FeatureSection
                title="8. Notifications & Communication"
                items={[
                  'Email notifications for registration status changes',
                  'Invitation emails with secure registration links',
                  'Finance & Purchase approval notifications',
                  'Email delivery tracking (sent, opened, clicked)',
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Additional Resources */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Additional Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => document.getElementById('product-features')?.scrollIntoView({ behavior: 'smooth' })}>
                <FileQuestion className="h-6 w-6" />
                <span>Product Features</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <Shield className="h-6 w-6" />
                <span>Security Policy</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <Building2 className="h-6 w-6" />
                <span>About Ramky</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <MessageSquare className="h-6 w-6" />
                <span>Feedback</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
