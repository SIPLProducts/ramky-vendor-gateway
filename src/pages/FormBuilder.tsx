import { useEffect, useMemo, useState } from 'react';
import { useTenants, useFormFieldConfigs } from '@/hooks/useTenant';
import { useTenantContext } from '@/hooks/useTenantContext';
import {
  useFormStepConfigs,
  useUpsertFormStep,
  useDeleteFormStep,
  useDeleteFormField,
  useReorderFormSteps,
  useReorderFormFields,
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, GripVertical, Lock, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { InlineFieldEditor } from '@/components/admin/InlineFieldEditor';
import { FieldTemplateActions } from '@/components/admin/FieldTemplateActions';
import type { FormFieldConfig } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { BUILT_IN_FIELDS_CATALOG, BUILT_IN_FIELD_MARKER, isBuiltInField } from '@/lib/builtInFields';
import { cn } from '@/lib/utils';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ---------- Sortable Tab Row ----------
function SortableTab({
  step, idx, isSelected, onSelect,
}: { step: FormStepConfig; idx: number; isSelected: boolean; onSelect: () => void }) {
  const disabled = step.is_built_in;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id, disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'w-full px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors',
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={onSelect}>
        <span
          {...attributes}
          {...listeners}
          className={cn('shrink-0', disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing')}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className={cn('h-3.5 w-3.5', disabled ? 'text-muted-foreground/30' : 'text-muted-foreground/70')} />
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <span className="truncate font-medium text-left">{step.step_label}</span>
      </div>
      {step.is_built_in ? (
        <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
      ) : (
        !step.is_visible && <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
    </div>
  );
}

// ---------- Sortable Field Row ----------
function SortableField({
  field, isEditing, isBuiltIn, onEdit, onDelete,
}: {
  field: FormFieldConfig; isEditing: boolean; isBuiltIn: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2.5 bg-background',
        isEditing && 'bg-primary/5',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/70" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{field.display_label}</span>
            <Badge variant="outline" className="text-[10px]">{field.field_type}</Badge>
            {isBuiltIn && <Badge variant="secondary" className="text-[10px]">Built-in</Badge>}
            {field.is_mandatory && <Badge className="text-[10px]">Required</Badge>}
            {!field.is_visible && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <EyeOff className="h-2.5 w-2.5" />Hidden
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{field.field_name}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

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
  const reorderSteps = useReorderFormSteps();
  const reorderFields = useReorderFormFields();

  // Combine built-in (display only) with custom steps
  const allSteps = useMemo(() => {
    const customSorted = [...customSteps].sort((a, b) => a.step_order - b.step_order);
    const synthetic: FormStepConfig[] = BUILT_IN_STEPS.map((s) => ({
      id: `builtin-${s.step_key}`,
      tenant_id: effectiveTenantId,
      created_at: '',
      updated_at: '',
      ...s,
    }));
    const review = synthetic.find((s) => s.step_key === 'review')!;
    const headBuiltins = synthetic.filter((s) => s.step_key !== 'review');
    return [...headBuiltins, ...customSorted, review];
  }, [customSteps, effectiveTenantId]);

  const [selectedStepKey, setSelectedStepKey] = useState<string>('document_verification');
  // Default to first available tab if current selection vanishes
  useEffect(() => {
    if (!allSteps.find((s) => s.step_key === selectedStepKey) && allSteps.length) {
      setSelectedStepKey(allSteps[0].step_key);
    }
  }, [allSteps, selectedStepKey]);

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

  // Inline field editor state: 'new' | field id | null
  const [editingFieldId, setEditingFieldId] = useState<string | 'new' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ---- Tab DnD ----
  const handleTabDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const customIds = customSteps
      .slice()
      .sort((a, b) => a.step_order - b.step_order)
      .map((s) => s.id);
    const oldIdx = customIds.indexOf(active.id as string);
    const newIdx = customIds.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return; // Non-custom (built-in) — ignore
    const reordered = arrayMove(customIds, oldIdx, newIdx);
    const updates = reordered.map((id, i) => ({ id, step_order: 6 + i }));
    await reorderSteps.mutateAsync(updates);
  };

  // ---- Field DnD ----
  const handleFieldDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = fieldsForStep.map((f) => f.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(ids, oldIdx, newIdx);
    const updates = reordered.map((id, i) => ({ id, display_order: i + 1 }));
    await reorderFields.mutateAsync(updates);
  };

  const openNewTab = () => {
    setTabDraft({ step_label: '', step_description: '', step_order: (customSteps.length || 0) + 6, is_visible: true });
    setTabDialogOpen(true);
  };

  const openEditTab = (s: FormStepConfig) => {
    if (s.is_built_in) return;
    setTabDraft({
      id: s.id, step_label: s.step_label, step_description: s.step_description || '',
      step_order: s.step_order, is_visible: s.is_visible,
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

  const customStepIds = customSteps
    .slice()
    .sort((a, b) => a.step_order - b.step_order)
    .map((s) => s.id);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Form Builder</h1>
          <p className="text-muted-foreground mt-1">
            Add tabs and fields to the vendor registration form for{' '}
            <span className="font-medium text-foreground">{tenantName}</span>.
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
          Built-in steps (locked 🔒) drive verification and gating and can't be reordered or removed.
          Drag custom tabs to reorder. Drag fields inside any tab to reorder them.
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
              <SortableContext items={customStepIds} strategy={verticalListSortingStrategy}>
                {allSteps.map((s, idx) => (
                  <SortableTab
                    key={s.id}
                    step={s}
                    idx={idx}
                    isSelected={s.step_key === selectedStepKey}
                    onSelect={() => setSelectedStepKey(s.step_key)}
                  />
                ))}
              </SortableContext>
            </DndContext>
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
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">
                Fields <span className="text-muted-foreground font-normal">({fieldsForStep.length})</span>
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <FieldTemplateActions
                  tenantId={effectiveTenantId}
                  stepKey={selectedStepKey}
                  stepLabel={selectedStep?.step_label || selectedStepKey}
                  fields={fieldsForStep}
                />
                <Button size="sm" onClick={() => setEditingFieldId('new')} disabled={editingFieldId === 'new'}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
                </Button>
              </div>
            </div>

            {/* Inline new-field editor */}
            {editingFieldId === 'new' && (
              <div className="mb-3">
                <InlineFieldEditor
                  tenantId={effectiveTenantId}
                  stepKey={selectedStepKey}
                  defaultOrder={fieldsForStep.length + 1}
                  onClose={() => setEditingFieldId(null)}
                />
              </div>
            )}

            {fieldsForStep.length === 0 && editingFieldId !== 'new' ? (
              <div className="border border-dashed rounded-lg p-10 text-center">
                <p className="text-sm text-muted-foreground">No custom fields configured for this tab yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedStep?.is_built_in
                    ? 'Built-in fields are managed in code; add tenant overrides here.'
                    : 'Click "Add Field" above to start collecting data.'}
                </p>
              </div>
            ) : fieldsForStep.length > 0 ? (
              <div className="border rounded-lg divide-y overflow-hidden">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
                  <SortableContext items={fieldsForStep.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    {fieldsForStep.map((f) => (
                      <div key={f.id}>
                        <SortableField
                          field={f}
                          isEditing={editingFieldId === f.id}
                          onEdit={() => setEditingFieldId(editingFieldId === f.id ? null : f.id)}
                          onDelete={async () => {
                            if (confirm(`Delete field "${f.display_label}"?`)) await deleteField.mutateAsync(f.id);
                          }}
                        />
                        {editingFieldId === f.id && (
                          <div className="p-3 bg-muted/20 border-t">
                            <InlineFieldEditor
                              tenantId={effectiveTenantId}
                              stepKey={selectedStepKey}
                              field={f}
                              onClose={() => setEditingFieldId(null)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            ) : null}
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
    </div>
  );
}
