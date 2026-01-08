import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Palette, Save } from 'lucide-react';
import { useTenantBranding, useUpdateTenantBranding } from '@/hooks/useTenant';

interface BrandingConfigProps {
  tenantId: string;
  tenantName?: string;
}

export function BrandingConfig({ tenantId, tenantName }: BrandingConfigProps) {
  const { data: branding, isLoading } = useTenantBranding(tenantId);
  const updateBranding = useUpdateTenantBranding();

  const [formData, setFormData] = useState({
    logo_url: '',
    primary_color: '#0066cc',
    secondary_color: '#f5f5f5',
    accent_color: '#ff6600',
    company_name: '',
    tagline: '',
    footer_text: '',
    help_email: '',
    help_phone: '',
    terms_url: '',
    privacy_url: '',
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (branding) {
      setFormData({
        logo_url: branding.logo_url || '',
        primary_color: branding.primary_color || '#0066cc',
        secondary_color: branding.secondary_color || '#f5f5f5',
        accent_color: branding.accent_color || '#ff6600',
        company_name: branding.company_name || '',
        tagline: branding.tagline || '',
        footer_text: branding.footer_text || '',
        help_email: branding.help_email || '',
        help_phone: branding.help_phone || '',
        terms_url: branding.terms_url || '',
        privacy_url: branding.privacy_url || '',
      });
    }
  }, [branding]);

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    updateBranding.mutate(
      { tenantId, branding: formData },
      { onSuccess: () => setHasChanges(false) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Branding Configuration</CardTitle>
            <CardDescription>
              Customize the look and feel for {tenantName || 'this tenant'}
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || updateBranding.isPending}>
            {updateBranding.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Identity */}
          <div>
            <h3 className="text-lg font-medium mb-4">Company Identity</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  placeholder="e.g., Ramky Industries"
                />
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input
                  value={formData.tagline}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder="e.g., Vendor Onboarding Portal"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Logo URL</Label>
                <Input
                  value={formData.logo_url}
                  onChange={(e) => handleChange('logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>
          </div>

          {/* Colors */}
          <div>
            <h3 className="text-lg font-medium mb-4">Brand Colors</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    placeholder="#0066cc"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    placeholder="#f5f5f5"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.accent_color}
                    onChange={(e) => handleChange('accent_color', e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.accent_color}
                    onChange={(e) => handleChange('accent_color', e.target.value)}
                    placeholder="#ff6600"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4 p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-3">Preview</p>
              <div 
                className="p-4 rounded-lg text-white"
                style={{ backgroundColor: formData.primary_color }}
              >
                <h4 className="font-bold">{formData.company_name || 'Company Name'}</h4>
                <p className="text-sm opacity-80">{formData.tagline || 'Tagline'}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <Button 
                  size="sm" 
                  style={{ 
                    backgroundColor: formData.primary_color,
                    color: 'white'
                  }}
                >
                  Primary Button
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  style={{ 
                    borderColor: formData.accent_color,
                    color: formData.accent_color
                  }}
                >
                  Accent Button
                </Button>
              </div>
            </div>
          </div>

          {/* Footer & Help */}
          <div>
            <h3 className="text-lg font-medium mb-4">Footer & Support</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Footer Text</Label>
                <Textarea
                  value={formData.footer_text}
                  onChange={(e) => handleChange('footer_text', e.target.value)}
                  placeholder="© 2024 Company Name. All rights reserved."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Help Email</Label>
                <Input
                  type="email"
                  value={formData.help_email}
                  onChange={(e) => handleChange('help_email', e.target.value)}
                  placeholder="support@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Help Phone</Label>
                <Input
                  value={formData.help_phone}
                  onChange={(e) => handleChange('help_phone', e.target.value)}
                  placeholder="+91 1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label>Terms & Conditions URL</Label>
                <Input
                  value={formData.terms_url}
                  onChange={(e) => handleChange('terms_url', e.target.value)}
                  placeholder="https://company.com/terms"
                />
              </div>
              <div className="space-y-2">
                <Label>Privacy Policy URL</Label>
                <Input
                  value={formData.privacy_url}
                  onChange={(e) => handleChange('privacy_url', e.target.value)}
                  placeholder="https://company.com/privacy"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
