import { useState, useEffect } from 'react';
import { X, Download, Smartphone, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if user previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 3 days on mobile, 7 days on desktop
      const dismissDuration = isMobile ? 3 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < dismissDuration) {
        setIsDismissed(true);
        return;
      }
    }

    // For iOS, show the manual install instructions immediately
    if (isIOSDevice) {
      // Delay showing on iOS to not be intrusive
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }

    // For Android/Chrome, listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show prompt after delay if on mobile and no beforeinstallprompt fired
    // This handles cases where the browser doesn't support the event
    const fallbackTimer = setTimeout(() => {
      if (!isIOSDevice && isMobile) {
        setIsVisible(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(fallbackTimer);
    };
  }, [isMobile]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // If no deferred prompt, redirect to install page for instructions
      window.location.href = '/install';
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isInstalled || isDismissed || !isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm",
        "bg-card border border-border rounded-xl shadow-lg",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
        "z-50"
      )}
    >
      <div className="p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">
              Install Ramky VMS
            </h3>
            {isIOS ? (
              <p className="text-sm text-muted-foreground mt-1">
                Tap <Share className="inline h-4 w-4 mx-0.5" /> then <strong>"Add to Home Screen"</strong>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Quick access & offline support
              </p>
            )}
          </div>
        </div>

        {!isIOS && (
          <Button
            onClick={handleInstall}
            size="sm"
            className="w-full mt-4 gap-2"
          >
            <Download className="h-4 w-4" />
            Install App
          </Button>
        )}

        {isIOS && (
          <Button
            onClick={() => window.location.href = '/install'}
            variant="outline"
            size="sm"
            className="w-full mt-4"
          >
            View Instructions
          </Button>
        )}
      </div>
    </div>
  );
}
