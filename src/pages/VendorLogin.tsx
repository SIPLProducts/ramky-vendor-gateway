import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';

interface InvitationData {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  user_id: string | null;
  access_count: number | null;
}

export default function VendorLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('No invitation token provided. Please use the link from your email.');
        setIsValidating(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('vendor_invitations')
          .select('*')
          .eq('token', token)
          .single();

        if (fetchError || !data) {
          setError('Invalid invitation link. Please contact the administrator.');
          setIsValidating(false);
          return;
        }

        // Check expiry
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
          setError('This invitation link has expired. Please request a new one.');
          setIsValidating(false);
          return;
        }

        // If already used, redirect to registration to show status
        if (data.used_at) {
          navigate(`/vendor/registration?token=${token}`);
          return;
        }

        setInvitation(data as InvitationData);
        setEmail(data.email);
        setIsValidating(false);
      } catch (err) {
        console.error('Token validation error:', err);
        setError('Failed to validate invitation. Please try again.');
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Sign in with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials from the invitation email.');
        } else {
          setError(signInError.message);
        }
        setIsLoading(false);
        return;
      }

      // Verify the logged-in user matches the invitation
      if (invitation && data.user) {
        if (data.user.email !== invitation.email) {
          await supabase.auth.signOut();
          setError('This invitation is for a different email address.');
          setIsLoading(false);
          return;
        }
      }

      // Redirect to registration form (protected route)
      navigate(`/vendor/registration?token=${token}`);
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Please contact the administrator for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="h-14 border-b bg-white/80 backdrop-blur-sm px-6 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <img src={ramkyLogo} alt="Ramky" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-foreground">Vendor Portal</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Vendor Login</CardTitle>
            <CardDescription>
              Sign in to complete your vendor registration
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {invitation && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Invitation for:</strong> {invitation.email}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Use the password from your invitation email to log in.
                </p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={!!invitation}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your temporary password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your temporary password was sent in the invitation email.
                </p>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Continue to Registration
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                Having trouble? Contact{' '}
                <a href="mailto:vendor.support@ramky.com" className="text-primary hover:underline">
                  vendor.support@ramky.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-muted-foreground">
        © 2026 Sharvi Infotech Private Limited. All rights reserved.
      </footer>
    </div>
  );
}
