import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Alert, AlertDescription } from '@/components/ui/alert';

import { Mail, Lock, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import ramkyLogo from '@/assets/ramky-logo-transparent.png';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';


const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');


export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading, rolesLoading, signIn, signOut, isVendor, userRole } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  

  useEffect(() => {
    if (!user || authLoading || rolesLoading || !userRole) return;
    if (isVendor) {
      // Vendors are not allowed to sign in via the generic /auth screen.
      void signOut();
      setError('Vendor accounts must use the invitation link sent by email, or the Vendor Login page.');
      return;
    }
    navigate('/dashboard');
  }, [user, authLoading, rolesLoading, userRole, isVendor, navigate, signOut]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Please verify your email before logging in.');
      } else {
        setError(error.message);
      }
    }
  };


  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col md:flex-row overflow-hidden bg-gradient-to-br from-[hsl(210_60%_98%)] via-[hsl(205_55%_96%)] to-[hsl(210_40%_99%)]">
      {/* Faint brand watermark, lower-left */}
      <img
        src={ramkyLogo}
        alt=""
        aria-hidden
        className="pointer-events-none select-none absolute left-6 bottom-8 w-[34rem] max-w-[45vw] opacity-[0.07]"
      />

      {/* Top-right logo */}
      <div className="absolute top-5 right-8 z-10 hidden md:block">
        <img src={ramkyLogo} alt="Ramky Group" className="h-14 w-auto object-contain" />
      </div>

      {/* Left Panel — Branding */}
      <div className="relative hidden md:flex md:w-1/2 lg:w-[55%] flex-col justify-center px-10 lg:px-20">
        <div className="max-w-md">
          <h2 className="text-3xl lg:text-[2.6rem] leading-tight font-bold text-foreground mb-5">
            Building Tomorrow's<br />Infrastructure Today
          </h2>
          <p className="text-base text-muted-foreground max-w-sm">
            Join our network of trusted vendors and partners. Streamline your onboarding process with our secure, efficient portal.
          </p>
        </div>
      </div>


      {/* Right Panel — Auth Form */}
      <div className="relative w-full md:w-1/2 lg:w-[45%] flex flex-col justify-center p-6 md:p-12">
        <div className="w-full max-w-md mx-auto">

          {/* Mobile-only logo */}
          <div className="md:hidden flex justify-center mb-8">
            <img
              src={ramkyLogo}
              alt="Ramky Group"
              className="h-16 w-auto object-contain"
            />
          </div>


          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">Welcome</CardTitle>
              <CardDescription>
                Sign in to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                    {error.toLowerCase().includes('vendor') && (
                      <span className="block mt-2">
                        Go to{' '}
                        <button
                          type="button"
                          onClick={() => navigate('/vendor/login')}
                          className="underline font-medium"
                        >
                          Vendor Login
                        </button>
                        .
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="mb-4 bg-success/10 text-success border-success">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="w-full">
                <div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@company.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setForgotOpen(true)}
                        className="text-sm text-primary hover:underline focus:outline-none"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            © 2026 Sharvi Infotech Private Limited. All rights reserved.
          </p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            For any queries or support, please contact:{" "}
            <a href="mailto:vypaarsupport@ramky.com" className="text-primary hover:underline">
              vypaarsupport@ramky.com
            </a>
          </p>
        </div>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
}
