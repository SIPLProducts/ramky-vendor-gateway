import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Palette, Settings2, GitBranch, Shield, Users } from 'lucide-react';
import { TenantManager } from '@/components/admin/TenantManager';
import { ApiProviderConfig } from '@/components/admin/ApiProviderConfig';
import { BrandingConfig } from '@/components/admin/BrandingConfig';
import { WorkflowConfig } from '@/components/admin/WorkflowConfig';
import { FieldConfigManager } from '@/components/admin/FieldConfigManager';
import { useTenants } from '@/hooks/useTenant';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SharviAdminConsole() {
  const { data: tenants, isLoading } = useTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const selectedTenant = tenants?.find(t => t.id === selectedTenantId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sharvi Admin Console</h1>
          <p className="text-muted-foreground mt-1">
            Configure tenants, APIs, branding, and workflows
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active Tenant:</span>
            <Select 
              value={selectedTenantId || ''} 
              onValueChange={(v) => setSelectedTenantId(v || null)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select tenant..." />
              </SelectTrigger>
              <SelectContent>
                {tenants?.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active customer deployments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Integrations</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">GST, PAN, Bank, MSME, etc.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Approval workflows configured</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Role Types</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7</div>
            <p className="text-xs text-muted-foreground">Sharvi, Customer, Approver...</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="tenants" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Tenants</span>
          </TabsTrigger>
          <TabsTrigger value="apis" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">API Config</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="fields" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Form Fields</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <TenantManager />
        </TabsContent>

        <TabsContent value="apis">
          {!selectedTenantId ? (
            <Alert>
              <AlertDescription>
                Please select a tenant from the dropdown above to configure API providers.
              </AlertDescription>
            </Alert>
          ) : (
            <ApiProviderConfig tenantId={selectedTenantId} tenantName={selectedTenant?.name} />
          )}
        </TabsContent>

        <TabsContent value="branding">
          {!selectedTenantId ? (
            <Alert>
              <AlertDescription>
                Please select a tenant to configure branding.
              </AlertDescription>
            </Alert>
          ) : (
            <BrandingConfig tenantId={selectedTenantId} tenantName={selectedTenant?.name} />
          )}
        </TabsContent>

        <TabsContent value="fields">
          {!selectedTenantId ? (
            <Alert>
              <AlertDescription>
                Please select a tenant to configure form fields.
              </AlertDescription>
            </Alert>
          ) : (
            <FieldConfigManager tenantId={selectedTenantId} tenantName={selectedTenant?.name} />
          )}
        </TabsContent>

        <TabsContent value="workflows">
          {!selectedTenantId ? (
            <Alert>
              <AlertDescription>
                Please select a tenant to configure approval workflows.
              </AlertDescription>
            </Alert>
          ) : (
            <WorkflowConfig tenantId={selectedTenantId} tenantName={selectedTenant?.name} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
