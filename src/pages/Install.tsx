import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Monitor, Tablet, CheckCircle2, ArrowLeft, Share, MoreVertical } from 'lucide-react';
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
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
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
              <img src="/ramky-logo.png" alt="Ramky VMS" className="h-10 w-10 object-contain" />
            </div>
            <CardTitle className="text-2xl">Install Ramky VMS</CardTitle>
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
                <Button onClick={() => navigate('/auth')} className="mt-4">
                  Open App
                </Button>
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
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                    <p className="font-semibold text-center">Install on iPhone/iPad</p>
                    <ol className="text-sm space-y-3">
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                        <div>
                          <p className="font-medium">Tap the Share button</p>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            Look for <Share className="inline h-4 w-4 mx-0.5" /> at the bottom of Safari
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                        <div>
                          <p className="font-medium">Scroll & tap "Add to Home Screen"</p>
                          <p className="text-muted-foreground text-xs mt-0.5">You may need to scroll down to find it</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                        <div>
                          <p className="font-medium">Tap "Add" to confirm</p>
                          <p className="text-muted-foreground text-xs mt-0.5">The app icon will appear on your home screen</p>
                        </div>
                      </li>
                    </ol>
                  </div>
                ) : isAndroid ? (
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                    <p className="font-semibold text-center">Install on Android</p>
                    <ol className="text-sm space-y-3">
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                        <div>
                          <p className="font-medium">Tap the menu button</p>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            Look for <MoreVertical className="inline h-4 w-4 mx-0.5" /> in Chrome's toolbar
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                        <div>
                          <p className="font-medium">Tap "Install app" or "Add to Home screen"</p>
                          <p className="text-muted-foreground text-xs mt-0.5">You'll see an install banner or menu option</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                        <div>
                          <p className="font-medium">Confirm installation</p>
                          <p className="text-muted-foreground text-xs mt-0.5">The app will be added to your home screen</p>
                        </div>
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      Open this page in <strong>Chrome</strong>, <strong>Edge</strong>, or <strong>Safari</strong> on mobile to install the app.
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