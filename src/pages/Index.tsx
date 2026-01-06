import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, ClipboardCheck, Shield, ArrowRight } from 'lucide-react';

export default function Index() {
  const roles = [
    {
      title: 'Vendor Portal',
      description: 'Complete your vendor registration',
      icon: Building2,
      href: '/vendor/register',
      color: 'bg-primary',
    },
    {
      title: 'Finance Team',
      description: 'Review and validate vendor submissions',
      icon: Shield,
      href: '/finance/dashboard',
      color: 'bg-warning',
    },
    {
      title: 'Purchase Team',
      description: 'Final approval and SAP synchronization',
      icon: ClipboardCheck,
      href: '/purchase/dashboard',
      color: 'bg-accent',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">R</span>
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Ramky Infrastructure Limited</h1>
              <p className="text-xs text-muted-foreground">Vendor Onboarding Portal</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Vendor Onboarding Portal
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Secure, compliant, and audit-ready vendor registration system for 
          Ramky Infrastructure Limited
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/vendor/register">
            <Button size="lg" className="gap-2">
              Start Registration
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Role Selection */}
      <section className="container mx-auto px-6 pb-16">
        <h2 className="text-2xl font-semibold text-center mb-8">Select Your Role</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {roles.map((role) => (
            <Link key={role.title} to={role.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className={`h-12 w-12 rounded-lg ${role.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <role.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>{role.title}</CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="gap-2 p-0">
                    Enter Portal
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-2xl font-semibold text-center mb-8">Key Features</h2>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { title: 'GST Validation', desc: 'Real-time government verification' },
              { title: 'PAN Verification', desc: 'Instant PAN authenticity check' },
              { title: 'Bank Verification', desc: '₹1 penny-drop verification' },
              { title: 'MSME Check', desc: 'Udyam registration validation' },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© 2024 Ramky Infrastructure Limited. All rights reserved.</p>
          <p className="mt-1">Vendor Onboarding Portal v1.0</p>
        </div>
      </footer>
    </div>
  );
}
