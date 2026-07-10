import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Eye } from 'lucide-react';
import {
  DEFAULT_REPORTS_SCREEN_CONFIG,
  ReportsScreenConfig,
  useReportsScreenConfig,
  useSaveReportsScreenConfig,
} from '@/hooks/useScreenConfig';

type Row = { key: keyof ReportsScreenConfig; label: string };

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Report Type',
    rows: [
      { key: 'report_type_vendor', label: 'Vendor Report' },
      { key: 'report_type_approval', label: 'Approval Flow Report' },
      { key: 'report_type_both', label: 'Both' },
    ],
  },
  {
    title: 'Scope',
    rows: [
      { key: 'scope_single', label: 'Single Vendor (Reference Number)' },
      { key: 'scope_all', label: 'All Vendors' },
    ],
  },
  {
    title: 'Filters',
    rows: [
      { key: 'filter_from_date', label: 'From Date' },
      { key: 'filter_to_date', label: 'To Date' },
      { key: 'filter_vendor_status', label: 'Vendor Status' },
    ],
  },
  {
    title: 'Action Buttons',
    rows: [
      { key: 'action_run', label: 'Run Report' },
      { key: 'action_reset', label: 'Reset' },
      { key: 'action_excel', label: 'Export to Excel' },
      { key: 'action_pdf', label: 'Export to PDF' },
    ],
  },
];

export function ReportsScreenConfigCard() {
  const { data, isLoading } = useReportsScreenConfig();
  const save = useSaveReportsScreenConfig();
  const [cfg, setCfg] = useState<ReportsScreenConfig>(DEFAULT_REPORTS_SCREEN_CONFIG);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setCfg(data);
      setDirty(false);
    }
  }, [data]);

  const toggle = (k: keyof ReportsScreenConfig, v: boolean) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setDirty(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Reports Configuration
            </CardTitle>
            <CardDescription>
              Show or hide report tabs, filters, and action buttons on the Reports screen.
            </CardDescription>
          </div>
          <Button
            onClick={() => save.mutate(cfg, { onSuccess: () => setDirty(false) })}
            disabled={!dirty || save.isPending || isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {GROUPS.map((g) => (
          <div key={g.title} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {g.title}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {g.rows.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <Label htmlFor={r.key} className="font-medium cursor-pointer">
                    {r.label}
                  </Label>
                  <Switch
                    id={r.key}
                    checked={cfg[r.key]}
                    onCheckedChange={(v) => toggle(r.key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
