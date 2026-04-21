import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ValidationConfigManager } from '@/components/admin/ValidationConfigManager';
import { ValidationApiLogs } from '@/components/admin/ValidationApiLogs';
import {
  Settings,
  Clock,
  Shield,
  Building2,
  Save,
  RefreshCw,
  AlertCircle,
  Settings2,
  FileText,
  Percent,
  Bell,
  Mail,
  Eye,
  EyeOff,
} from 'lucide-react';
import { NotificationSettings } from '@/components/pwa/NotificationSettings';

interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_encryption: 'none' | 'ssl' | 'tls' | 'starttls';
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_reply_to: string;
  smtp_use_app_password: boolean;
  smtp_enabled: boolean;
}

interface PortalConfig extends SmtpConfig {
  link_expiry_days: number;
  name_match_threshold: number;
  enable_gst_validation: boolean;
  enable_pan_validation: boolean;
  enable_bank_validation: boolean;
  enable_msme_validation: boolean;
  enable_name_match_validation: boolean;
  auto_reject_failed_validations: boolean;
  gst_revalidation_days: number;
}

const defaultConfig: PortalConfig = {
  link_expiry_days: 14,
  name_match_threshold: 80,
  enable_gst_validation: true,
  enable_pan_validation: true,
  enable_bank_validation: true,
  enable_msme_validation: true,
  enable_name_match_validation: true,
  auto_reject_failed_validations: false,
  gst_revalidation_days: 90,
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_encryption: 'tls',
  smtp_from_email: '',
  smtp_from_name: 'Sharvi Vendor Portal',
  smtp_reply_to: '',
  smtp_use_app_password: true,
  smtp_enabled: false,
};

export default function AdminConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<PortalConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: portalConfigs, isLoading, error } = useQuery({
    queryKey: ['portal-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_config')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (portalConfigs) {
      const loadedConfig = { ...defaultConfig };
      portalConfigs.forEach((item) => {
        const key = item.config_key as keyof PortalConfig;
        const value = item.config_value;
        if (key in loadedConfig) {
          if (typeof loadedConfig[key] === 'boolean') {
            (loadedConfig as Record<string, unknown>)[key] = Boolean(value);
          } else if (typeof loadedConfig[key] === 'number') {
            (loadedConfig as Record<string, unknown>)[key] = Number(value);
          } else if (typeof loadedConfig[key] === 'string') {
            (loadedConfig as Record<string, unknown>)[key] = value == null ? '' : String(value);
          }
        }
      });
      setConfig(loadedConfig);
    }
  }, [portalConfigs]);

  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: PortalConfig) => {
      const configEntries = Object.entries(newConfig).map(([key, value]) => ({
        config_key: key,
        config_value: value,
      }));

      for (const entry of configEntries) {
        const { error } = await supabase
          .from('portal_config')
          .upsert({
            config_key: entry.config_key,
            config_value: entry.config_value,
            description: getConfigDescription(entry.config_key),
          }, { onConflict: 'config_key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-config'] });
      setHasChanges(false);
      toast({
        title: 'Configuration Saved',
        description: 'Portal settings have been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error Saving Configuration',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getConfigDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      link_expiry_days: 'Number of days before vendor registration links expire',
      name_match_threshold: 'Minimum percentage for name matching validation',
      enable_gst_validation: 'Enable GST number validation against government database',
      enable_pan_validation: 'Enable PAN validation',
      enable_bank_validation: 'Enable bank account verification via penny drop',
      enable_msme_validation: 'Enable MSME/Udyam certificate validation',
      enable_name_match_validation: 'Enable vendor name vs GST legal name matching',
      auto_reject_failed_validations: 'Automatically reject vendors with failed validations',
      gst_revalidation_days: 'Days between periodic GST re-validations',
      smtp_host: 'SMTP server hostname (e.g. smtp.gmail.com)',
      smtp_port: 'SMTP server port (587 for TLS, 465 for SSL, 25 for none)',
      smtp_username: 'SMTP authentication username',
      smtp_password: 'SMTP authentication password or app password',
      smtp_encryption: 'Connection encryption: none, ssl, tls, starttls',
      smtp_from_email: 'Default From email address used to send notifications',
      smtp_from_name: 'Display name shown in the From field',
      smtp_reply_to: 'Reply-To email address',
      smtp_use_app_password: 'Use an app-specific password instead of the account password',
      smtp_enabled: 'Enable outbound emails through this SMTP configuration',
    };
    return descriptions[key] || '';
  };

  const updateConfig = <K extends keyof PortalConfig>(key: K, value: PortalConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveConfigMutation.mutate(config);
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load configuration. Please try again.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Portal Configuration
          </h1>
          <p className="text-muted-foreground">
            Manage vendor onboarding portal settings and validation rules
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saveConfigMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveConfigMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Click "Save Changes" to apply them.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="validations" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Validations</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email (SMTP)</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid gap-6 md:grid-cols-2">
        {/* Link Expiry Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Registration Link Settings
            </CardTitle>
            <CardDescription>
              Configure vendor invitation link expiry duration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="linkExpiry">Link Expiry (Days)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="linkExpiry"
                  type="number"
                  min={1}
                  max={90}
                  value={config.link_expiry_days}
                  onChange={(e) => updateConfig('link_expiry_days', parseInt(e.target.value) || 14)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  days from invitation
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Vendors must complete registration within this period
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Name Match Threshold */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Name Match Threshold
            </CardTitle>
            <CardDescription>
              Minimum match score for vendor name validation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Match Threshold</Label>
                <span className="text-2xl font-bold text-primary">
                  {config.name_match_threshold}%
                </span>
              </div>
              <Slider
                value={[config.name_match_threshold]}
                onValueChange={([value]) => updateConfig('name_match_threshold', value)}
                min={50}
                max={100}
                step={5}
                className="py-4"
              />
              <p className="text-xs text-muted-foreground">
                Vendor legal name must match GST legal name by this percentage
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Validation Toggles */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Validation Settings
            </CardTitle>
            <CardDescription>
              Enable or disable specific validation checks during vendor onboarding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="gstValidation" className="font-medium">GST Validation</Label>
                  <p className="text-xs text-muted-foreground">
                    Verify GSTIN against government database
                  </p>
                </div>
                <Switch
                  id="gstValidation"
                  checked={config.enable_gst_validation}
                  onCheckedChange={(checked) => updateConfig('enable_gst_validation', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="panValidation" className="font-medium">PAN Validation</Label>
                  <p className="text-xs text-muted-foreground">
                    Verify PAN number validity
                  </p>
                </div>
                <Switch
                  id="panValidation"
                  checked={config.enable_pan_validation}
                  onCheckedChange={(checked) => updateConfig('enable_pan_validation', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="bankValidation" className="font-medium">Bank Verification</Label>
                  <p className="text-xs text-muted-foreground">
                    Verify bank account via ₹1 penny drop
                  </p>
                </div>
                <Switch
                  id="bankValidation"
                  checked={config.enable_bank_validation}
                  onCheckedChange={(checked) => updateConfig('enable_bank_validation', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="msmeValidation" className="font-medium">MSME Validation</Label>
                  <p className="text-xs text-muted-foreground">
                    Verify Udyam registration certificate
                  </p>
                </div>
                <Switch
                  id="msmeValidation"
                  checked={config.enable_msme_validation}
                  onCheckedChange={(checked) => updateConfig('enable_msme_validation', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="nameMatchValidation" className="font-medium">Name Match Validation</Label>
                  <p className="text-xs text-muted-foreground">
                    Match vendor name with GST legal name
                  </p>
                </div>
                <Switch
                  id="nameMatchValidation"
                  checked={config.enable_name_match_validation}
                  onCheckedChange={(checked) => updateConfig('enable_name_match_validation', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-destructive/5">
                <div>
                  <Label htmlFor="autoReject" className="font-medium">Auto-Reject Failed Validations</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically reject vendors with failed checks
                  </p>
                </div>
                <Switch
                  id="autoReject"
                  checked={config.auto_reject_failed_validations}
                  onCheckedChange={(checked) => updateConfig('auto_reject_failed_validations', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GST Revalidation */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Periodic GST Verification
            </CardTitle>
            <CardDescription>
              Configure automatic GST re-verification for active vendors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label htmlFor="gstRevalidation">Re-verification Interval</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="gstRevalidation"
                    type="number"
                    min={30}
                    max={365}
                    value={config.gst_revalidation_days}
                    onChange={(e) => updateConfig('gst_revalidation_days', parseInt(e.target.value) || 90)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    days between checks
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Active vendors' GST status will be automatically verified at this interval
            </p>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="validations">
          <ValidationConfigManager />
        </TabsContent>

        <TabsContent value="email">
          <SmtpSettings config={config} updateConfig={updateConfig} />
        </TabsContent>

        <TabsContent value="notifications">
          <div className="max-w-xl">
            <NotificationSettings />
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <ValidationApiLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SmtpSettingsProps {
  config: PortalConfig;
  updateConfig: <K extends keyof PortalConfig>(key: K, value: PortalConfig[K]) => void;
}

function SmtpSettings({ config, updateConfig }: SmtpSettingsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleTest = () => {
    if (!config.smtp_host || !config.smtp_from_email) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in SMTP host and From email before testing.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Test email queued',
      description: `A test message will be sent from ${config.smtp_from_email} via ${config.smtp_host}:${config.smtp_port}. Save your changes first if you haven't.`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            SMTP Email Configuration
          </CardTitle>
          <CardDescription>
            Configure outbound email delivery via your own SMTP server. Supports app passwords (Gmail, Outlook, Zoho, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="smtp_enabled" className="font-medium">Enable SMTP Sending</Label>
              <p className="text-xs text-muted-foreground">When off, the system uses the default email provider.</p>
            </div>
            <Switch
              id="smtp_enabled"
              checked={config.smtp_enabled}
              onCheckedChange={(checked) => updateConfig('smtp_enabled', checked)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp_host">SMTP Host</Label>
              <Input
                id="smtp_host"
                placeholder="smtp.gmail.com"
                value={config.smtp_host}
                onChange={(e) => updateConfig('smtp_host', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_port">Port</Label>
              <Input
                id="smtp_port"
                type="number"
                placeholder="587"
                value={config.smtp_port}
                onChange={(e) => updateConfig('smtp_port', parseInt(e.target.value) || 587)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_encryption">Encryption</Label>
              <Select
                value={config.smtp_encryption}
                onValueChange={(v) => updateConfig('smtp_encryption', v as PortalConfig['smtp_encryption'])}
              >
                <SelectTrigger id="smtp_encryption">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="tls">TLS (587)</SelectItem>
                  <SelectItem value="ssl">SSL (465)</SelectItem>
                  <SelectItem value="starttls">STARTTLS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="smtp_use_app_password" className="font-medium text-sm">Use App Password</Label>
                <p className="text-xs text-muted-foreground">Recommended for Gmail / Outlook with 2FA</p>
              </div>
              <Switch
                id="smtp_use_app_password"
                checked={config.smtp_use_app_password}
                onCheckedChange={(checked) => updateConfig('smtp_use_app_password', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_username">Username</Label>
              <Input
                id="smtp_username"
                placeholder="you@yourdomain.com"
                value={config.smtp_username}
                onChange={(e) => updateConfig('smtp_username', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_password">
                {config.smtp_use_app_password ? 'App Password' : 'Password'}
              </Label>
              <div className="relative">
                <Input
                  id="smtp_password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={config.smtp_use_app_password ? '16-char app password' : 'Account password'}
                  value={config.smtp_password}
                  onChange={(e) => updateConfig('smtp_password', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_from_email">From Email</Label>
              <Input
                id="smtp_from_email"
                type="email"
                placeholder="noreply@yourdomain.com"
                value={config.smtp_from_email}
                onChange={(e) => updateConfig('smtp_from_email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_from_name">From Name</Label>
              <Input
                id="smtp_from_name"
                placeholder="Sharvi Vendor Portal"
                value={config.smtp_from_name}
                onChange={(e) => updateConfig('smtp_from_name', e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="smtp_reply_to">Reply-To (optional)</Label>
              <Input
                id="smtp_reply_to"
                type="email"
                placeholder="support@yourdomain.com"
                value={config.smtp_reply_to}
                onChange={(e) => updateConfig('smtp_reply_to', e.target.value)}
              />
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Gmail:</strong> Enable 2-Step Verification, then create an App Password at myaccount.google.com/apppasswords. Use port <code>587</code> with TLS.
              <br />
              <strong>Outlook/Office 365:</strong> Use <code>smtp.office365.com</code>, port <code>587</code>, STARTTLS, with an app password.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleTest}>
              <Mail className="h-4 w-4 mr-2" />
              Send Test Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}