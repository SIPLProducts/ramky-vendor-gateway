import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, FormInput, Check, X, Eye, EyeOff, Edit } from 'lucide-react';
import { useFormFieldConfigs, useUpdateFormFieldConfig, type FormFieldConfig } from '@/hooks/useTenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface FieldConfigManagerProps {
  tenantId: string;
  tenantName?: string;
}

const steps = [
  { id: 'organization', label: 'Organization' },
  { id: 'contact', label: 'Contact' },
  { id: 'statutory', label: 'Statutory' },
  { id: 'bank', label: 'Bank' },
  { id: 'financial', label: 'Financial' },
];

export function FieldConfigManager({ tenantId, tenantName }: FieldConfigManagerProps) {
  const { data: fields, isLoading } = useFormFieldConfigs(tenantId);
  const updateField = useUpdateFormFieldConfig();
  const [selectedStep, setSelectedStep] = useState('organization');
  const [editingField, setEditingField] = useState<FormFieldConfig | null>(null);

  const filteredFields = fields?.filter(f => f.step_name === selectedStep) || [];

  const handleQuickToggle = (field: FormFieldConfig, key: 'is_visible' | 'is_mandatory' | 'is_editable', value: boolean) => {
    updateField.mutate({ id: field.id, [key]: value });
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
      <CardHeader>
        <CardTitle>Form Field Configuration</CardTitle>
        <CardDescription>
          Configure which fields are visible, mandatory, or optional for {tenantName || 'this tenant'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedStep} onValueChange={setSelectedStep}>
          <TabsList className="mb-4">
            {steps.map((step) => (
              <TabsTrigger key={step.id} value={step.id}>
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {steps.map((step) => (
            <TabsContent key={step.id} value={step.id}>
              {filteredFields.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Visible</TableHead>
                      <TableHead className="text-center">Mandatory</TableHead>
                      <TableHead className="text-center">Editable</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFields.sort((a, b) => a.display_order - b.display_order).map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{field.display_label}</div>
                            <div className="text-xs text-muted-foreground">{field.field_name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{field.field_type}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={field.is_visible}
                            onCheckedChange={(checked) => handleQuickToggle(field, 'is_visible', checked)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={field.is_mandatory}
                            onCheckedChange={(checked) => handleQuickToggle(field, 'is_mandatory', checked)}
                            disabled={!field.is_visible}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={field.is_editable}
                            onCheckedChange={(checked) => handleQuickToggle(field, 'is_editable', checked)}
                            disabled={!field.is_visible}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setEditingField(field)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <FormInput className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No fields configured</h3>
                  <p className="text-muted-foreground">
                    Fields will appear here after you initialize the configuration
                  </p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Edit Field Dialog */}
      <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Field Configuration</DialogTitle>
            <DialogDescription>
              Customize settings for {editingField?.display_label}
            </DialogDescription>
          </DialogHeader>
          {editingField && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Display Label</Label>
                <Input
                  value={editingField.display_label}
                  onChange={(e) => setEditingField({ ...editingField, display_label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={editingField.placeholder || ''}
                  onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Help Text</Label>
                <Textarea
                  value={editingField.help_text || ''}
                  onChange={(e) => setEditingField({ ...editingField, help_text: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Validation Regex</Label>
                  <Input
                    value={editingField.validation_regex || ''}
                    onChange={(e) => setEditingField({ ...editingField, validation_regex: e.target.value })}
                    placeholder="^[A-Z]{5}[0-9]{4}[A-Z]$"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Validation Message</Label>
                  <Input
                    value={editingField.validation_message || ''}
                    onChange={(e) => setEditingField({ ...editingField, validation_message: e.target.value })}
                    placeholder="Invalid format"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={editingField.display_order}
                  onChange={(e) => setEditingField({ ...editingField, display_order: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingField) {
                  updateField.mutate({
                    id: editingField.id,
                    display_label: editingField.display_label,
                    placeholder: editingField.placeholder,
                    help_text: editingField.help_text,
                    validation_regex: editingField.validation_regex,
                    validation_message: editingField.validation_message,
                    display_order: editingField.display_order,
                  });
                  setEditingField(null);
                }
              }}
              disabled={updateField.isPending}
            >
              {updateField.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
