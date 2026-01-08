import { Bell, BellOff, Loader2, Smartphone, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    sendLocalNotification,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleTestNotification = () => {
    sendLocalNotification('Ramky VMS', {
      body: 'This is a test notification. Your vendor status has been updated!',
      tag: 'test-notification',
    });
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported on this device or browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To receive notifications, please use a modern browser like Chrome, Firefox, or Edge on desktop, or install the app on your mobile device.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about vendor status updates, approvals, and important alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications" className="text-sm font-medium">
              Enable Notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              {permission === 'denied'
                ? 'Permission denied. Please enable in browser settings.'
                : isSubscribed
                ? 'You will receive push notifications'
                : 'Turn on to receive updates'}
            </p>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              id="notifications"
              checked={isSubscribed}
              onCheckedChange={handleToggle}
              disabled={permission === 'denied'}
            />
          )}
        </div>

        {/* Status indicator */}
        {isSubscribed && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-primary">Notifications Active</p>
              <p className="text-xs text-muted-foreground">You'll receive alerts for vendor updates</p>
            </div>
          </div>
        )}

        {/* Test notification button */}
        {isSubscribed && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestNotification}
            className="w-full gap-2"
          >
            <Smartphone className="h-4 w-4" />
            Send Test Notification
          </Button>
        )}

        {/* Notification types info */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            You'll be notified about:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Vendor registration status changes
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Approval and rejection updates
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Document verification alerts
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Compliance reminders
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
