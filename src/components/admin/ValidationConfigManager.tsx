import { useState, forwardRef } from 'react';
import { useValidationConfigs, useUpdateValidationConfig, ValidationConfig } from '@/hooks/useValidationOrchestrator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Settings2, 
  Shield, 
  Clock, 
  Zap,
  RefreshCw,
  Edit2,
  Save,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  Timer,
  Repeat,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const validationIcons: Record<string, React.ReactNode> = {
  gst: <Shield className="h-4 w-4" />,
  pan: <Shield className="h-4 w-4" />,
  name_match: <CheckCircle2 className="h-4 w-4" />,
  bank: <Zap className="h-4 w-4" />,
  msme: <Shield className="h-4 w-4" />,
};

const stageColors: Record<string, string> = {
  ON_SUBMIT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  BOTH: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
};

export const ValidationConfigManager = forwardRef<HTMLDivElement, object>(
  function ValidationConfigManager(_, ref) {
  const { data: configs, isLoading, refetch } = useValidationConfigs();
  const updateConfig = useUpdateValidationConfig();
  const [editingConfig, setEditingConfig] = useState<ValidationConfig | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<ValidationConfig>>({});

  const handleEdit = (config: ValidationConfig) => {
    setEditingConfig(config);
    setEditedValues(config);
  };

  const handleSave = () => {
    if (editingConfig && editedValues) {
      updateConfig.mutate({
        id: editingConfig.id,
        ...editedValues,
      }, {
        onSuccess: () => {
          setEditingConfig(null);
          setEditedValues({});
        },
      });
    }
  };

  const handleQuickToggle = (config: ValidationConfig, field: 'is_enabled' | 'is_mandatory') => {
    updateConfig.mutate({
      id: config.id,
      [field]: !config[field],
    });
  };

  if (isLoading) {
    return (
      <div ref={ref} className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Validation Engine Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure validation rules, thresholds, and execution behavior. Changes take effect immediately.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Active Validations</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {configs?.filter(c => c.is_enabled).length || 0}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Mandatory</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {configs?.filter(c => c.is_enabled && c.is_mandatory).length || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">On Submit</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {configs?.filter(c => c.is_enabled && (c.execution_stage === 'ON_SUBMIT' || c.execution_stage === 'BOTH')).length || 0}
                </p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Scheduled</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {configs?.filter(c => c.is_enabled && (c.execution_stage === 'SCHEDULED' || c.execution_stage === 'BOTH')).length || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Config Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Validation Rules</CardTitle>
          <CardDescription>
            Click on any row to edit detailed settings. Toggle switches for quick enable/disable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <ArrowUpDown className="h-4 w-4" />
                </TableHead>
                <TableHead>Validation Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mandatory</TableHead>
                <TableHead>Execution Stage</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Retry / Timeout</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs?.map((config) => (
                <TableRow 
                  key={config.id}
                  className={cn(
                    "transition-colors",
                    !config.is_enabled && "opacity-60"
                  )}
                >
                  <TableCell className="font-medium text-muted-foreground">
                    {config.priority_order}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-primary/10 text-primary">
                        {validationIcons[config.validation_type]}
                      </div>
                      <div>
                        <p className="font-medium">{config.display_name}</p>
                        <p className="text-xs text-muted-foreground">{config.validation_type}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={config.is_enabled}
                      onCheckedChange={() => handleQuickToggle(config, 'is_enabled')}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={config.is_mandatory}
                      onCheckedChange={() => handleQuickToggle(config, 'is_mandatory')}
                      disabled={!config.is_enabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-normal", stageColors[config.execution_stage])}>
                      {config.execution_stage === 'ON_SUBMIT' && <Zap className="h-3 w-3 mr-1" />}
                      {config.execution_stage === 'SCHEDULED' && <Clock className="h-3 w-3 mr-1" />}
                      {config.execution_stage === 'BOTH' && <Repeat className="h-3 w-3 mr-1" />}
                      {config.execution_stage}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {config.matching_threshold ? (
                      <span className="font-mono text-sm">{config.matching_threshold}%</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono">{config.retry_count}×</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="font-mono">{config.timeout_seconds}s</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(config)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingConfig && validationIcons[editingConfig.validation_type]}
              Edit {editingConfig?.display_name}
            </DialogTitle>
            <DialogDescription>
              Configure validation parameters. Changes will take effect immediately.
            </DialogDescription>
          </DialogHeader>

          {editingConfig && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Switch
                      checked={editedValues.is_enabled ?? editingConfig.is_enabled}
                      onCheckedChange={(checked) => setEditedValues(prev => ({ ...prev, is_enabled: checked }))}
                    />
                    <span className="text-sm">
                      {editedValues.is_enabled ?? editingConfig.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mandatory</Label>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Switch
                      checked={editedValues.is_mandatory ?? editingConfig.is_mandatory}
                      onCheckedChange={(checked) => setEditedValues(prev => ({ ...prev, is_mandatory: checked }))}
                    />
                    <span className="text-sm">
                      {editedValues.is_mandatory ?? editingConfig.is_mandatory ? 'Required for approval' : 'Optional'}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Execution Stage</Label>
                <Select
                  value={editedValues.execution_stage ?? editingConfig.execution_stage}
                  onValueChange={(value) => setEditedValues(prev => ({ ...prev, execution_stage: value as 'ON_SUBMIT' | 'SCHEDULED' | 'BOTH' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ON_SUBMIT">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        On Submit - Run when vendor submits
                      </div>
                    </SelectItem>
                    <SelectItem value="SCHEDULED">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Scheduled - Run periodically
                      </div>
                    </SelectItem>
                    <SelectItem value="BOTH">
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4" />
                        Both - Submit + Periodic
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editingConfig.validation_type === 'name_match' || editingConfig.validation_type === 'bank') && (
                <div className="space-y-4">
                  <Label>Matching Threshold</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[editedValues.matching_threshold ?? editingConfig.matching_threshold ?? 80]}
                      onValueChange={([value]) => setEditedValues(prev => ({ ...prev, matching_threshold: value }))}
                      min={50}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-2xl font-bold text-primary w-16 text-right">
                      {editedValues.matching_threshold ?? editingConfig.matching_threshold ?? 80}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum similarity score required for validation to pass
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry Count
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={editedValues.retry_count ?? editingConfig.retry_count}
                    onChange={(e) => setEditedValues(prev => ({ ...prev, retry_count: parseInt(e.target.value) || 3 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of retry attempts on failure
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Timeout (seconds)
                  </Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={editedValues.timeout_seconds ?? editingConfig.timeout_seconds}
                    onChange={(e) => setEditedValues(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 30 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum wait time for API response
                  </p>
                </div>
              </div>

              {((editedValues.execution_stage ?? editingConfig.execution_stage) === 'SCHEDULED' || 
                (editedValues.execution_stage ?? editingConfig.execution_stage) === 'BOTH') && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Schedule Frequency (days)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={editedValues.schedule_frequency_days ?? editingConfig.schedule_frequency_days ?? 30}
                    onChange={(e) => setEditedValues(prev => ({ ...prev, schedule_frequency_days: parseInt(e.target.value) || 30 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Days between periodic re-validations
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Priority Order</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={editedValues.priority_order ?? editingConfig.priority_order}
                  onChange={(e) => setEditedValues(prev => ({ ...prev, priority_order: parseInt(e.target.value) || 1 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers run first. Use to control validation sequence.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfig(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateConfig.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});