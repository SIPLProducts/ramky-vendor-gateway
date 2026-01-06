import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, ClipboardCheck, Shield, ArrowRight, LogIn, Sparkles, CheckCircle2, Zap, Globe } from 'lucide-react';

export default function Index() {
  const roles = [
    {
      title: 'Vendor Portal',
      description: 'Register and manage your vendor profile',
      icon: Building2,
      href: '/vendor/register',
      gradient: 'from-indigo-500 to-purple-600',
    },
    {
      title: 'Finance Team',
      description: 'Review and validate vendor submissions',
      icon: Shield,
      href: '/dashboard',
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Purchase Team',
      description: 'Final approval and SAP synchronization',
      icon: ClipboardCheck,
      href: '/dashboard',
      gradient: 'from-teal-500 to-emerald-600',
    },
  ];

  const features = [
    { icon: CheckCircle2, title: 'GST Validation', desc: 'Real-time government verification' },
    { icon: Shield, title: 'PAN Verification', desc: 'Instant PAN authenticity check' },
    { icon: Zap, title: 'Bank Verification', desc: '₹1 penny-drop verification' },
    { icon: Globe, title: 'MSME Check', desc: 'Udyam registration validation' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <div>
              <h1 className="font-bold text-foreground text-lg">Ramky Infrastructure</h1>
              <p className="text-xs text-muted-foreground">Vendor Onboarding Portal</p>
            </div>
          </div>
          <Link to="/auth">
            <Button variant="outline" className="gap-2 rounded-full px-5">
              <LogIn className="h-4 w-4" />
              Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" />
          Trusted by 500+ vendors across India
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Vendor Onboarding
          <span className="block bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Made Simple
          </span>
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Secure, compliant, and audit-ready vendor registration system with 
          real-time validations and seamless SAP integration.
        </p>
        
        <div className="flex justify-center gap-4 flex-wrap">
          <Link to="/vendor/register">
            <Button size="lg" className="gap-2 rounded-full px-8 h-12 text-base shadow-lg shadow-primary/25">
              Start Registration
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline" className="gap-2 rounded-full px-8 h-12 text-base">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Role Selection */}
      <section className="container mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-3">Choose Your Portal</h2>
        <p className="text-muted-foreground text-center mb-10">Select your role to access the appropriate dashboard</p>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {roles.map((role) => (
            <Link key={role.title} to={role.href}>
              <Card className="h-full card-interactive cursor-pointer group border-0 shadow-md bg-card/80 backdrop-blur">
                <CardHeader className="pb-4">
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                    <role.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">{role.title}</CardTitle>
                  <CardDescription className="text-base">{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="gap-2 p-0 text-primary group-hover:translate-x-1 transition-transform">
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
      <section className="bg-gradient-to-b from-muted/50 to-muted py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-3">Built-in Validations</h2>
          <p className="text-muted-foreground text-center mb-12">Automated compliance checks for seamless onboarding</p>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <Card key={feature.title} className="text-center border-0 shadow-sm bg-card/60 backdrop-blur card-interactive">
                <CardContent className="pt-8 pb-6">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
            <div className="p-6">
              <p className="text-5xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">500+</p>
              <p className="text-muted-foreground mt-2">Active Vendors</p>
            </div>
            <div className="p-6">
              <p className="text-5xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">₹2000Cr+</p>
              <p className="text-muted-foreground mt-2">Annual Procurement</p>
            </div>
            <div className="p-6">
              <p className="text-5xl font-bold bg-gradient-to-r from-teal-500 to-emerald-600 bg-clip-text text-transparent">15+</p>
              <p className="text-muted-foreground mt-2">States Covered</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© 2024 Ramky Infrastructure Limited. All rights reserved.</p>
          <p className="mt-1">Vendor Onboarding Portal v2.0</p>
        </div>
      </footer>
    </div>
  );
}
