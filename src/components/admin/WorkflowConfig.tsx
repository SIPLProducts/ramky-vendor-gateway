import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, GitBranch, Edit, Trash2, Loader2, GripVertical, ArrowRight } from 'lucide-react';
import { useApprovalWorkflows, useUpsertApprovalWorkflow, type AppRole } from '@/hooks/useTenant';

interface WorkflowConfigProps {
  tenantId: string;
  tenantName?: string;
}

const availableRoles: { value: AppRole; label: string }[] = [
  { value: 'finance', label: 'Finance Team' },
  { value: 'purchase', label: 'Purchase Team' },
  { value: 'admin', label: 'Admin' },
  { value: 'customer_admin', label: 'Customer Admin' },
  { value: 'approver', label: 'Approver' },
];

interface WorkflowStep {
  step_order: number;
  step_name: string;
  required_role: AppRole;
  is_mandatory: boolean;
  can_reject: boolean;
  can_request_info: boolean;
  auto_approve_after_days: number | null;
  notify_on_pending: boolean;
  notify_on_complete: boolean;
}

export function WorkflowConfig({ tenantId, tenantName }: WorkflowConfigProps) {
  const { data: workflows, isLoading } = useApprovalWorkflows(tenantId);
  const upsertWorkflow = useUpsertApprovalWorkflow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<{
    id?: string;
    workflow_name: string;
    is_active: boolean;
  } | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  const openNewWorkflow = () => {
    setEditingWorkflow({
      workflow_name: '',
      is_active: true,
    });
    setSteps([
      {
        step_order: 1,
        step_name: 'Finance Review',
        required_role: 'finance',
        is_mandatory: true,
        can_reject: true,
        can_request_info: true,
        auto_approve_after_days: null,
        notify_on_pending: true,
        notify_on_complete: true,
      },
    ]);
    setIsDialogOpen(true);
  };

  const openEditWorkflow = (workflow: typeof workflows extends (infer T)[] | undefined ? T : never) => {
    if (!workflow) return;
    setEditingWorkflow({
      id: workflow.id,
      workflow_name: workflow.workflow_name,
      is_active: workflow.is_active,
    });
    setSteps(
      workflow.approval_workflow_steps.map((s) => ({
        step_order: s.step_order,
        step_name: s.step_name,
        required_role: s.required_role,
        is_mandatory: s.is_mandatory,
        can_reject: s.can_reject,
        can_request_info: s.can_request_info,
        auto_approve_after_days: s.auto_approve_after_days,
        notify_on_pending: s.notify_on_pending,
        notify_on_complete: s.notify_on_complete,
      }))
    );
    setIsDialogOpen(true);
  };

  const addStep = () => {
    setSteps([
      ...steps,
      {
        step_order: steps.length + 1,
        step_name: `Step ${steps.length + 1}`,
        required_role: 'approver',
        is_mandatory: true,
        can_reject: true,
        can_request_info: true,
        auto_approve_after_days: null,
        notify_on_pending: true,
        notify_on_complete: true,
      },
    ]);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({
      ...s,
      step_order: i + 1,
    }));
    setSteps(newSteps);
  };

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  const handleSave = () => {
    if (!editingWorkflow?.workflow_name) return;
    upsertWorkflow.mutate(
      {
        workflow: {
          ...editingWorkflow,
          tenant_id: tenantId,
        },
        steps,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingWorkflow(null);
          setSteps([]);
        },
      }
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Approval Workflows</CardTitle>
          <CardDescription>
            Configure approval steps and routing for {tenantName || 'this tenant'}
          </CardDescription>
        </div>
        <Button onClick={openNewWorkflow} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Workflow
        </Button>
      </CardHeader>
      <CardContent>
        {workflows && workflows.length > 0 ? (
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">{workflow.workflow_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {workflow.approval_workflow_steps.length} steps
                      </p>
                    </div>
                    <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEditWorkflow(workflow)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>

                {/* Visual workflow steps */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {workflow.approval_workflow_steps
                    .sort((a, b) => a.step_order - b.step_order)
                    .map((step, index) => (
                      <div key={step.id} className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg whitespace-nowrap">
                          <span className="text-xs font-medium bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                            {step.step_order}
                          </span>
                          <span className="text-sm font-medium">{step.step_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {availableRoles.find(r => r.value === step.required_role)?.label}
                          </Badge>
                        </div>
                        {index < workflow.approval_workflow_steps.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No workflows configured</h3>
            <p className="text-muted-foreground mb-4">
              Create an approval workflow to define the review process
            </p>
            <Button onClick={openNewWorkflow} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Workflow
            </Button>
          </div>
        )}
      </CardContent>

      {/* Workflow Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow?.id ? 'Edit' : 'Create'} Approval Workflow
            </DialogTitle>
            <DialogDescription>
              Define the steps and roles required for vendor approval
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Workflow Name</Label>
                <Input
                  value={editingWorkflow?.workflow_name || ''}
                  onChange={(e) =>
                    setEditingWorkflow(prev => prev ? { ...prev, workflow_name: e.target.value } : null)
                  }
                  placeholder="e.g., Standard Approval"
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Switch
                  checked={editingWorkflow?.is_active ?? true}
                  onCheckedChange={(checked) =>
                    setEditingWorkflow(prev => prev ? { ...prev, is_active: checked } : null)
                  }
                />
                <Label>Active</Label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Workflow Steps</h4>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </Button>
              </div>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 pt-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center">
                          {step.step_order}
                        </span>
                      </div>

                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Step Name</Label>
                          <Input
                            value={step.step_name}
                            onChange={(e) => updateStep(index, { step_name: e.target.value })}
                            placeholder="e.g., Finance Review"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Required Role</Label>
                          <Select
                            value={step.required_role}
                            onValueChange={(v) => updateStep(index, { required_role: v as AppRole })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableRoles.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2 flex flex-wrap gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={step.is_mandatory}
                              onCheckedChange={(checked) => updateStep(index, { is_mandatory: checked })}
                            />
                            <Label className="text-sm">Mandatory</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={step.can_reject}
                              onCheckedChange={(checked) => updateStep(index, { can_reject: checked })}
                            />
                            <Label className="text-sm">Can Reject</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={step.can_request_info}
                              onCheckedChange={(checked) => updateStep(index, { can_request_info: checked })}
                            />
                            <Label className="text-sm">Can Request Info</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={step.notify_on_pending}
                              onCheckedChange={(checked) => updateStep(index, { notify_on_pending: checked })}
                            />
                            <Label className="text-sm">Notify on Pending</Label>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Auto-approve after (days)</Label>
                          <Input
                            type="number"
                            value={step.auto_approve_after_days || ''}
                            onChange={(e) =>
                              updateStep(index, {
                                auto_approve_after_days: e.target.value ? parseInt(e.target.value) : null,
                              })
                            }
                            placeholder="Leave empty to disable"
                          />
                        </div>
                      </div>

                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsertWorkflow.isPending}>
              {upsertWorkflow.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
