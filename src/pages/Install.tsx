import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Monitor, Tablet, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Download className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Install Ramky Vendor Portal</CardTitle>
            <CardDescription className="text-base">
              Get quick access from your home screen
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {isInstalled ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">App Installed!</h3>
                <p className="text-muted-foreground mt-2">
                  You can now access the app from your home screen.
                </p>
              </div>
            ) : (
              <>
                {/* Features */}
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Works Offline</p>
                      <p className="text-xs text-muted-foreground">Access your data anytime</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Monitor className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Fast & Responsive</p>
                      <p className="text-xs text-muted-foreground">Native app experience</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Tablet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">All Devices</p>
                      <p className="text-xs text-muted-foreground">Mobile, tablet, and desktop</p>
                    </div>
                  </div>
                </div>

                {/* Install Button or Instructions */}
                {deferredPrompt ? (
                  <Button 
                    onClick={handleInstall} 
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Install App
                  </Button>
                ) : isIOS ? (
                  <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
                    <p className="font-medium text-sm text-center">Install on iOS</p>
                    <ol className="text-sm text-muted-foreground space-y-2">
                      <li className="flex gap-2">
                        <span className="font-semibold text-foreground">1.</span>
                        Tap the Share button in Safari
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-foreground">2.</span>
                        Scroll down and tap "Add to Home Screen"
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-foreground">3.</span>
                        Tap "Add" to confirm
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      Open this page in Chrome, Edge, or Safari to install the app.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Ramky Infrastructure Limited © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
