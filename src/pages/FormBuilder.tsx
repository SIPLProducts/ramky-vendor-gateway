import { useMemo, useState } from 'react';
import { useTenants, useFormFieldConfigs } from '@/hooks/useTenant';
import { useTenantContext } from '@/hooks/useTenantContext';
import {
  useFormStepConfigs,
  useUpsertFormStep,
  useDeleteFormStep,
  useDeleteFormField,
  BUILT_IN_STEPS,
  type FormStepConfig,
} from '@/hooks/useFormBuilder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, GripVertical, Lock, Eye, EyeOff } from 'lucide-react';
import { FieldEditorDrawer } from '@/components/admin/FieldEditorDrawer';
import type { FormFieldConfig } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function FormBuilder() {
  const { data: tenants } = useTenants();
  const { activeTenantId, setActiveTenantId, isSuperAdmin } = useTenantContext();
  const [tenantId, setTenantId] = useState<string | null>(activeTenantId);

  const effectiveTenantId = tenantId || activeTenantId;
  const tenantName = tenants?.find((t) => t.id === effectiveTenantId)?.name;

  const { data: customSteps = [] } = useFormStepConfigs(effectiveTenantId);
  const { data: allFields = [] } = useFormFieldConfigs(effectiveTenantId);

  const upsertStep = useUpsertFormStep();
  const deleteStep = useDeleteFormStep();
  const deleteField = useDeleteFormField();

  // Combine built-in (display only) with custom steps
  const allSteps = useMemo(() => {
    const customSorted = [...customSteps].sort((a, b) => a.step_order - b.step_order);
    const synthetic: FormStepConfig[] = BUILT_IN_STEPS.map((s, i) => ({
      id: `builtin-${s.step_key}`,
      tenant_id: effectiveTenantId,
      created_at: '',
      updated_at: '',
      ...s,
    }));
    // Place built-in 1-5, then custom, then built-in review
    const review = synthetic.find((s) => s.step_key === 'review')!;
    const headBuiltins = synthetic.filter((s) => s.step_key !== 'review');
    return [...headBuiltins, ...customSorted, review];
  }, [customSteps, effectiveTenantId]);

  const [selectedStepKey, setSelectedStepKey] = useState<string>('document_verification');
  const selectedStep = allSteps.find((s) => s.step_key === selectedStepKey);
  const fieldsForStep = useMemo(
    () => allFields.filter((f) => f.step_name === selectedStepKey).sort((a, b) => a.display_order - b.display_order),
    [allFields, selectedStepKey],
  );

  // Tab dialog state
  const [tabDialogOpen, setTabDialogOpen] = useState(false);
  const [tabDraft, setTabDraft] = useState<{ id?: string; step_label: string; step_description: string; step_order: number; is_visible: boolean }>({
    step_label: '', step_description: '', step_order: (customSteps.length || 0) + 6, is_visible: true,
  });

  // Field drawer state
  const [fieldDrawerOpen, setFieldDrawerOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormFieldConfig | null>(null);

  const openNewTab = () => {
    setTabDraft({ step_label: '', step_description: '', step_order: (customSteps.length || 0) + 6, is_visible: true });
    setTabDialogOpen(true);
  };

  const openEditTab = (s: FormStepConfig) => {
    if (s.is_built_in) return;
    setTabDraft({
      id: s.id,
      step_label: s.step_label,
      step_description: s.step_description || '',
      step_order: s.step_order,
      is_visible: s.is_visible,
    });
    setTabDialogOpen(true);
  };

  const saveTab = async () => {
    if (!effectiveTenantId || !tabDraft.step_label.trim()) return;
    await upsertStep.mutateAsync({
      id: tabDraft.id,
      tenant_id: effectiveTenantId,
      step_key: tabDraft.id ? selectedStep!.step_key : slugify(tabDraft.step_label),
      step_label: tabDraft.step_label,
      step_description: tabDraft.step_description,
      step_order: tabDraft.step_order,
      is_visible: tabDraft.is_visible,
    });
    setTabDialogOpen(false);
  };

  const handleAddField = () => {
    setEditingField(null);
    setFieldDrawerOpen(true);
  };

  const handleEditField = (f: FormFieldConfig) => {
    setEditingField(f);
    setFieldDrawerOpen(true);
  };

  if (!effectiveTenantId) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Form Builder</h1>
          <p className="text-muted-foreground mt-1">Configure vendor registration tabs and fields per tenant.</p>
        </div>
        {isSuperAdmin ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Tenant</Label>
                <Select value={tenantId || ''} onValueChange={(v) => { setTenantId(v); setActiveTenantId(v); }}>
                  <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select tenant..." /></SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert><AlertDescription>You don't have a tenant assigned.</AlertDescription></Alert>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Form Builder</h1>
          <p className="text-muted-foreground mt-1">
            Add tabs and fields to the vendor registration form for <span className="font-medium text-foreground">{tenantName}</span>.
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Tenant:</Label>
            <Select value={effectiveTenantId} onValueChange={(v) => { setTenantId(v); setActiveTenantId(v); }}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tenants?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Alert>
        <AlertDescription>
          Built-in steps (locked) drive verification and gating and can't be removed. Add custom tabs to collect any extra information your vendors need to submit.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left rail: tabs */}
        <Card className="h-fit">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm">Tabs</CardTitle>
            <Button size="sm" variant="outline" onClick={openNewTab}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 pb-4">
            {allSteps.map((s, idx) => {
              const isSelected = s.step_key === selectedStepKey;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStepKey(s.step_key)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors',
                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
                    <span className="truncate font-medium">{s.step_label}</span>
                  </div>
                  {s.is_built_in ? (
                    <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  ) : (
                    !s.is_visible && <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Right pane: tab + fields */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedStep?.step_label}
                  {selectedStep?.is_built_in && <Badge variant="secondary" className="text-[10px]">Built-in</Badge>}
                </CardTitle>
                <CardDescription>{selectedStep?.step_description || 'No description'}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {!selectedStep?.is_built_in && selectedStep && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openEditTab(selectedStep as FormStepConfig)}>
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit Tab
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (confirm(`Delete tab "${selectedStep.step_label}"? Its fields will also be removed.`)) {
                          await deleteStep.mutateAsync(selectedStep.id);
                          setSelectedStepKey('document_verification');
                        }
                      }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Fields</h3>
              <Button size="sm" onClick={handleAddField}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
              </Button>
            </div>

            {fieldsForStep.length === 0 ? (
              <div className="border border-dashed rounded-lg p-10 text-center">
                <p className="text-sm text-muted-foreground">No custom fields configured for this tab yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedStep?.is_built_in
                    ? 'Built-in fields are managed in code; add tenant overrides here.'
                    : 'Add fields to start collecting data.'}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {fieldsForStep.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{f.display_label}</span>
                          <Badge variant="outline" className="text-[10px]">{f.field_type}</Badge>
                          {f.is_mandatory && <Badge className="text-[10px]">Required</Badge>}
                          {!f.is_visible && <Badge variant="secondary" className="text-[10px] gap-1"><EyeOff className="h-2.5 w-2.5" />Hidden</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{f.field_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEditField(f)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        onClick={async () => {
                          if (confirm(`Delete field "${f.display_label}"?`)) await deleteField.mutateAsync(f.id);
                        }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tab dialog */}
      <Dialog open={tabDialogOpen} onOpenChange={setTabDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tabDraft.id ? 'Edit Tab' : 'Add Tab'}</DialogTitle>
            <DialogDescription>Add a new step to the vendor registration form.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tab Label *</Label>
              <Input value={tabDraft.step_label}
                onChange={(e) => setTabDraft({ ...tabDraft, step_label: e.target.value })}
                placeholder="e.g. QHSE Compliance" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={tabDraft.step_description}
                onChange={(e) => setTabDraft({ ...tabDraft, step_description: e.target.value })}
                placeholder="Short subtitle shown under the tab title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Display Order</Label>
                <Input type="number" value={tabDraft.step_order}
                  onChange={(e) => setTabDraft({ ...tabDraft, step_order: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2 self-end">
                <div className="flex items-center gap-2">
                  {tabDraft.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <Label className="text-sm">Visible to vendors</Label>
                </div>
                <Switch checked={tabDraft.is_visible}
                  onCheckedChange={(v) => setTabDraft({ ...tabDraft, is_visible: v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTabDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveTab} disabled={upsertStep.isPending || !tabDraft.step_label.trim()}>
              {tabDraft.id ? 'Save Changes' : 'Create Tab'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field drawer */}
      <FieldEditorDrawer
        open={fieldDrawerOpen}
        onOpenChange={setFieldDrawerOpen}
        tenantId={effectiveTenantId}
        stepKey={selectedStepKey}
        field={editingField}
        defaultOrder={fieldsForStep.length + 1}
      />
    </div>
  );
}
