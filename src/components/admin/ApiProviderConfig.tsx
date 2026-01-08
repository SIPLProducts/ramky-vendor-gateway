import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings2, Edit, Loader2, TestTube2, Check, X } from 'lucide-react';
import { useApiProviders, useUpsertApiProvider, type ApiProvider } from '@/hooks/useTenant';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface ApiProviderConfigProps {
  tenantId: string;
  tenantName?: string;
}

const defaultProviders = [
  { provider_name: 'GST', display_name: 'GST Verification', description: 'Verify GSTIN and fetch business details' },
  { provider_name: 'PAN', display_name: 'PAN Verification', description: 'Verify PAN card and fetch holder details' },
  { provider_name: 'BANK_PENNY_DROP', display_name: 'Bank Penny Drop', description: 'Verify bank account via micro transaction' },
  { provider_name: 'MSME', display_name: 'MSME Verification', description: 'Verify MSME/Udyam registration' },
  { provider_name: 'NAME_MATCH', display_name: 'Name Matching', description: 'Match business name across documents' },
];

const authTypes = [
  { value: 'API_KEY', label: 'API Key' },
  { value: 'BEARER_TOKEN', label: 'Bearer Token' },
  { value: 'BASIC', label: 'Basic Auth' },
  { value: 'OAUTH', label: 'OAuth 2.0' },
];

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH'];

export function ApiProviderConfig({ tenantId, tenantName }: ApiProviderConfigProps) {
  const { data: providers, isLoading } = useApiProviders(tenantId);
  const upsertProvider = useUpsertApiProvider();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<ApiProvider> | null>(null);

  const [formData, setFormData] = useState({
    provider_name: '',
    display_name: '',
    is_enabled: true,
    is_mandatory: false,
    execution_order: 1,
    base_url: '',
    endpoint_path: '',
    http_method: 'POST',
    auth_type: 'API_KEY',
    auth_header_name: 'Authorization',
    auth_header_prefix: 'Bearer',
    request_headers: '{}',
    request_body_template: '{}',
    response_success_path: '',
    response_success_value: 'true',
    response_message_path: '',
    response_data_mapping: '{}',
    timeout_seconds: 30,
    retry_count: 3,
    schedule_enabled: false,
    schedule_frequency_days: 30,
  });

  const openEditDialog = (provider?: ApiProvider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        provider_name: provider.provider_name,
        display_name: provider.display_name,
        is_enabled: provider.is_enabled,
        is_mandatory: provider.is_mandatory,
        execution_order: provider.execution_order,
        base_url: provider.base_url,
        endpoint_path: provider.endpoint_path,
        http_method: provider.http_method,
        auth_type: provider.auth_type,
        auth_header_name: provider.auth_header_name,
        auth_header_prefix: provider.auth_header_prefix,
        request_headers: JSON.stringify(provider.request_headers, null, 2),
        request_body_template: JSON.stringify(provider.request_body_template, null, 2),
        response_success_path: provider.response_success_path || '',
        response_success_value: provider.response_success_value,
        response_message_path: provider.response_message_path || '',
        response_data_mapping: JSON.stringify(provider.response_data_mapping, null, 2),
        timeout_seconds: provider.timeout_seconds,
        retry_count: provider.retry_count,
        schedule_enabled: provider.schedule_enabled,
        schedule_frequency_days: provider.schedule_frequency_days || 30,
      });
    } else {
      setEditingProvider(null);
      setFormData({
        provider_name: '',
        display_name: '',
        is_enabled: true,
        is_mandatory: false,
        execution_order: (providers?.length || 0) + 1,
        base_url: '',
        endpoint_path: '',
        http_method: 'POST',
        auth_type: 'API_KEY',
        auth_header_name: 'Authorization',
        auth_header_prefix: 'Bearer',
        request_headers: '{}',
        request_body_template: '{}',
        response_success_path: '',
        response_success_value: 'true',
        response_message_path: '',
        response_data_mapping: '{}',
        timeout_seconds: 30,
        retry_count: 3,
        schedule_enabled: false,
        schedule_frequency_days: 30,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    try {
      const payload = {
        ...(editingProvider?.id ? { id: editingProvider.id } : {}),
        tenant_id: tenantId,
        provider_name: formData.provider_name,
        display_name: formData.display_name,
        is_enabled: formData.is_enabled,
        is_mandatory: formData.is_mandatory,
        execution_order: formData.execution_order,
        base_url: formData.base_url,
        endpoint_path: formData.endpoint_path,
        http_method: formData.http_method,
        auth_type: formData.auth_type,
        auth_header_name: formData.auth_header_name,
        auth_header_prefix: formData.auth_header_prefix,
        request_headers: JSON.parse(formData.request_headers),
        request_body_template: JSON.parse(formData.request_body_template),
        response_success_path: formData.response_success_path || null,
        response_success_value: formData.response_success_value,
        response_message_path: formData.response_message_path || null,
        response_data_mapping: JSON.parse(formData.response_data_mapping),
        timeout_seconds: formData.timeout_seconds,
        retry_count: formData.retry_count,
        schedule_enabled: formData.schedule_enabled,
        schedule_frequency_days: formData.schedule_enabled ? formData.schedule_frequency_days : null,
      };

      upsertProvider.mutate(payload, {
        onSuccess: () => setIsDialogOpen(false),
      });
    } catch (e) {
      console.error('Invalid JSON in configuration');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>API Provider Configuration</CardTitle>
          <CardDescription>
            Configure compliance APIs for {tenantName || 'this tenant'}
          </CardDescription>
        </div>
        <Button onClick={() => openEditDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Provider
        </Button>
      </CardHeader>
      <CardContent>
        {/* Quick setup templates */}
        {(!providers || providers.length === 0) && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Quick Setup Templates</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Click to add pre-configured API templates
            </p>
            <div className="flex flex-wrap gap-2">
              {defaultProviders.map((dp) => (
                <Button
                  key={dp.provider_name}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      provider_name: dp.provider_name,
                      display_name: dp.display_name,
                    });
                    setIsDialogOpen(true);
                  }}
                >
                  {dp.display_name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {providers && providers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mandatory</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{provider.display_name}</div>
                        <div className="text-xs text-muted-foreground">{provider.provider_name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {provider.http_method} {provider.endpoint_path}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{provider.auth_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={provider.is_enabled ? 'default' : 'secondary'}>
                      {provider.is_enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {provider.is_mandatory ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(provider)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <TestTube2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Settings2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No API providers configured</h3>
            <p className="text-muted-foreground">
              Add API providers to enable compliance validations
            </p>
          </div>
        )}
      </CardContent>

      {/* Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Edit' : 'Add'} API Provider
            </DialogTitle>
            <DialogDescription>
              Configure the API endpoint, authentication, and response mapping
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="auth">Authentication</TabsTrigger>
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="response">Response</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider Name</Label>
                  <Select
                    value={formData.provider_name}
                    onValueChange={(v) => {
                      const dp = defaultProviders.find(p => p.provider_name === v);
                      setFormData({
                        ...formData,
                        provider_name: v,
                        display_name: dp?.display_name || formData.display_name,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider type" />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultProviders.map((p) => (
                        <SelectItem key={p.provider_name} value={p.provider_name}>
                          {p.display_name}
                        </SelectItem>
                      ))}
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="e.g., GST Verification"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input
                    value={formData.base_url}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                    placeholder="https://api.provider.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Endpoint Path</Label>
                  <Input
                    value={formData.endpoint_path}
                    onChange={(e) => setFormData({ ...formData, endpoint_path: e.target.value })}
                    placeholder="/v1/verify/gst"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>HTTP Method</Label>
                  <Select
                    value={formData.http_method}
                    onValueChange={(v) => setFormData({ ...formData, http_method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {httpMethods.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timeout (seconds)</Label>
                  <Input
                    type="number"
                    value={formData.timeout_seconds}
                    onChange={(e) => setFormData({ ...formData, timeout_seconds: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retry Count</Label>
                  <Input
                    type="number"
                    value={formData.retry_count}
                    onChange={(e) => setFormData({ ...formData, retry_count: parseInt(e.target.value) || 3 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
                    />
                    <Label>Enabled</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_mandatory}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
                    />
                    <Label>Mandatory</Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.schedule_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, schedule_enabled: checked })}
                  />
                  <Label>Schedule periodic checks</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="auth" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Authentication Type</Label>
                  <Select
                    value={formData.auth_type}
                    onValueChange={(v) => setFormData({ ...formData, auth_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {authTypes.map((at) => (
                        <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Header Name</Label>
                  <Input
                    value={formData.auth_header_name}
                    onChange={(e) => setFormData({ ...formData, auth_header_name: e.target.value })}
                    placeholder="Authorization"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Header Prefix</Label>
                <Input
                  value={formData.auth_header_prefix}
                  onChange={(e) => setFormData({ ...formData, auth_header_prefix: e.target.value })}
                  placeholder="Bearer"
                />
                <p className="text-xs text-muted-foreground">
                  The prefix added before the API key (e.g., "Bearer" or "ApiKey")
                </p>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  API Credentials
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  API keys and secrets are stored securely and separately. Configure credentials after saving this provider.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="request" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Request Headers (JSON)</Label>
                <Textarea
                  value={formData.request_headers}
                  onChange={(e) => setFormData({ ...formData, request_headers: e.target.value })}
                  placeholder='{"Content-Type": "application/json"}'
                  className="font-mono text-sm"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Request Body Template (JSON)</Label>
                <Textarea
                  value={formData.request_body_template}
                  onChange={(e) => setFormData({ ...formData, request_body_template: e.target.value })}
                  placeholder='{"gstin": "{{gstin}}", "consent": "Y"}'
                  className="font-mono text-sm"
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Use placeholders like {"{{gstin}}"}, {"{{pan}}"}, {"{{account_number}}"} which will be replaced with vendor data
                </p>
              </div>
            </TabsContent>

            <TabsContent value="response" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Success Path</Label>
                  <Input
                    value={formData.response_success_path}
                    onChange={(e) => setFormData({ ...formData, response_success_path: e.target.value })}
                    placeholder="data.valid"
                  />
                  <p className="text-xs text-muted-foreground">
                    JSON path to check for success (e.g., "data.valid", "status")
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Success Value</Label>
                  <Input
                    value={formData.response_success_value}
                    onChange={(e) => setFormData({ ...formData, response_success_value: e.target.value })}
                    placeholder="true"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Message Path</Label>
                <Input
                  value={formData.response_message_path}
                  onChange={(e) => setFormData({ ...formData, response_message_path: e.target.value })}
                  placeholder="data.message"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Mapping (JSON)</Label>
                <Textarea
                  value={formData.response_data_mapping}
                  onChange={(e) => setFormData({ ...formData, response_data_mapping: e.target.value })}
                  placeholder='{"legal_name": "data.legalName", "status": "data.gstStatus"}'
                  className="font-mono text-sm"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Map response fields to internal vendor fields
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsertProvider.isPending}>
              {upsertProvider.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
