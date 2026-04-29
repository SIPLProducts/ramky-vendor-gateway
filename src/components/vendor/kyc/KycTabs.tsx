import { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  CheckCircle2, Loader2, AlertCircle, Circle, FileText, CreditCard, Award, Landmark, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type KycStatus = 'idle' | 'validating' | 'passed' | 'failed' | 'na';

interface KycTabsProps {
  active: 'gst' | 'pan' | 'msme' | 'bank';
  onActiveChange: (v: 'gst' | 'pan' | 'msme' | 'bank') => void;
  statuses: Record<'gst' | 'pan' | 'msme' | 'bank', KycStatus>;
  gst: ReactNode;
  pan: ReactNode;
  msme: ReactNode;
  bank: ReactNode;
}

function StatusPill({ status }: { status: KycStatus }) {
  if (status === 'passed') {
    return (
      <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/30 gap-1 px-1.5">
        <CheckCircle2 className="h-3 w-3" />
        <span className="text-[10px]">Verified</span>
      </Badge>
    );
  }
  if (status === 'validating') {
    return (
      <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/30 gap-1 px-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-[10px]">Verifying</span>
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge variant="outline" className="ml-2 bg-destructive/10 text-destructive border-destructive/30 gap-1 px-1.5">
        <AlertCircle className="h-3 w-3" />
        <span className="text-[10px]">Failed</span>
      </Badge>
    );
  }
  if (status === 'na') {
    return (
      <Badge variant="outline" className="ml-2 bg-muted text-muted-foreground border-border gap-1 px-1.5">
        <span className="text-[10px]">N/A</span>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="ml-2 bg-muted/50 text-muted-foreground border-border gap-1 px-1.5">
      <Circle className="h-2.5 w-2.5" />
      <span className="text-[10px]">Pending</span>
    </Badge>
  );
}

export function KycTabs({ active, onActiveChange, statuses, gst, pan, msme, bank }: KycTabsProps) {
  const verifiedCount = (['gst', 'pan', 'msme', 'bank'] as const).filter(
    (k) => statuses[k] === 'passed' || statuses[k] === 'na',
  ).length;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">KYC & Statutory Verification</h3>
        </div>
        <span
          className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full border',
            verifiedCount === 4
              ? 'bg-success/10 text-success border-success/30'
              : 'bg-muted text-muted-foreground border-border',
          )}
        >
          {verifiedCount} of 4 verified
        </span>
      </div>

      <Tabs value={active} onValueChange={(v) => onActiveChange(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="gst" className="flex items-center justify-center py-2.5">
            <FileText className="h-4 w-4 mr-1.5" />
            GST <StatusPill status={statuses.gst} />
          </TabsTrigger>
          <TabsTrigger value="pan" className="flex items-center justify-center py-2.5">
            <CreditCard className="h-4 w-4 mr-1.5" />
            PAN <StatusPill status={statuses.pan} />
          </TabsTrigger>
          <TabsTrigger value="msme" className="flex items-center justify-center py-2.5">
            <Award className="h-4 w-4 mr-1.5" />
            MSME <StatusPill status={statuses.msme} />
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex items-center justify-center py-2.5">
            <Landmark className="h-4 w-4 mr-1.5" />
            Bank <StatusPill status={statuses.bank} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gst" className="mt-4">{gst}</TabsContent>
        <TabsContent value="pan" className="mt-4">{pan}</TabsContent>
        <TabsContent value="msme" className="mt-4">{msme}</TabsContent>
        <TabsContent value="bank" className="mt-4">{bank}</TabsContent>
      </Tabs>
    </Card>
  );
}
