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
} from 'lucide-react';
import { NotificationSettings } from '@/components/pwa/NotificationSettings';

interface PortalConfig {
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="validations" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Validations</span>
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