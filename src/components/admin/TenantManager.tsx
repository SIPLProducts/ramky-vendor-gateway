import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, Edit, Loader2 } from 'lucide-react';
import { useTenants, useCreateTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';

export function TenantManager() {
  const { data: tenants, isLoading } = useTenants();
  const createTenant = useCreateTenant();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', code: '', is_active: true });

  const handleCreateTenant = () => {
    if (!newTenant.name || !newTenant.code) return;
    createTenant.mutate(newTenant, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setNewTenant({ name: '', code: '', is_active: true });
      },
    });
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
          <CardTitle>Customer Tenants</CardTitle>
          <CardDescription>
            Manage customer deployments and configurations
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Add a new customer tenant to the platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Ramky Industries"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Tenant Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., ramky (lowercase, no spaces)"
                  value={newTenant.code}
                  onChange={(e) => setNewTenant({ ...newTenant, code: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier used in URLs and configurations
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Active</Label>
                <Switch
                  id="active"
                  checked={newTenant.is_active}
                  onCheckedChange={(checked) => setNewTenant({ ...newTenant, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTenant} disabled={createTenant.isPending}>
                {createTenant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Tenant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {tenants && tenants.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {tenant.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{tenant.code}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                      {tenant.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No tenants yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first customer tenant to get started
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Tenant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
