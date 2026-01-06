import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Building2, Mail, Lock, User, Loader2, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import authHeroImage from '@/assets/auth-hero.jpg';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

interface Invitation {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used_at: string | null;
}

export default function VendorRegisterWithInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided. Please use the link sent to your email.');
      setIsLoading(false);
      return;
    }

    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_invitations')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) {
        setError('Invalid invitation link. Please contact the administrator.');
        return;
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setError('This invitation link has expired. Please request a new one.');
        return;
      }

      if (data.used_at) {
        setError('This invitation has already been used. Please log in instead.');
        return;
      }

      setInvitation(data);
      setEmail(data.email);
    } catch (err) {
      setError('Failed to validate invitation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate inputs
    try {
      nameSchema.parse(fullName);
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setValidationError(err.errors[0].message);
        return;
      }
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/vendor/register`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;

      // Mark invitation as used
      await supabase
        .from('vendor_invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invitation?.id);

      toast({
        title: 'Account Created',
        description: 'Your account has been created. Redirecting to registration form...',
      });

      // Navigate to the registration form
      setTimeout(() => {
        navigate('/vendor/register?invitation=' + invitation?.id);
      }, 1500);
    } catch (err: any) {
      if (err.message.includes('already registered')) {
        setValidationError('This email is already registered. Please log in instead.');
      } else {
        setValidationError(err.message || 'Failed to create account');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/auth')} className="gap-2">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Hero Image Section */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={authHeroImage}
          alt="Infrastructure construction"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/40" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Ramky Infrastructure</h1>
              <p className="text-white/80 text-sm">Vendor Management Portal</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Welcome to<br />Vendor Onboarding
          </h2>
          <p className="text-lg text-white/90 max-w-md">
            Create your account to begin the vendor registration process. 
            Complete your profile and submit your details for verification.
          </p>

          <div className="mt-8 p-4 bg-white/10 backdrop-blur rounded-lg">
            <div className="flex items-center gap-2 text-white/90 text-sm">
              <Clock className="h-5 w-5" />
              <span>
                Link expires on{' '}
                <strong>
                  {invitation && new Date(invitation.expires_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Form Section */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Ramky Infrastructure</h1>
              <p className="text-muted-foreground text-xs">Vendor Management Portal</p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <CardTitle className="text-2xl">Create Your Account</CardTitle>
              <CardDescription>
                You've been invited to register as a vendor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {validationError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              <Alert className="mb-6 bg-muted">
                <Mail className="h-4 w-4" />
                <AlertTitle>Invited Email</AlertTitle>
                <AlertDescription className="font-medium">{invitation?.email}</AlertDescription>
              </Alert>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      className="pl-10 bg-muted"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email is pre-filled from your invitation
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account & Continue
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-4">
                Already have an account?{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>
                  Sign in
                </Button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
