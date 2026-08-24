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
import authHeroImage from '@/assets/auth-hero.jpg';
import ramkyLogo from '@/assets/ramky-logo.png';
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
    <div className="login-theme min-h-screen flex">
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
            <img 
              src={ramkyLogo} 
              alt="Sharvi Infotech Private Limited" 
              className="h-16 w-auto bg-white/90 rounded-lg p-2"
            />
          </div>
          
          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Building Tomorrow's<br />Infrastructure Today
          </h2>
          <p className="text-lg text-white/90 max-w-md">
            Join our network of trusted vendors and partners. Streamline your onboarding 
            process with our secure, efficient portal.
          </p>
        </div>
      </div>

      {/* Auth Form Section */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img 
              src={ramkyLogo} 
              alt="Sharvi Infotech Private Limited" 
              className="h-14 w-auto"
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
