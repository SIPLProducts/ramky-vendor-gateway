import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Wand2 } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { PayloadUploader } from "./PayloadUploader";

export interface ReqField {
  field_name: string;
  source?: string;
  default_value?: string;
  required?: boolean;
}

interface Props {
  initial: ReqField[];
  onChange: (rows: ReqField[]) => void;
}

export function RequestFieldsEditor({ initial, onChange }: Props) {
  const [rows, setRows] = useState<ReqField[]>(initial);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => setRows(initial), [initial]);

  const update = (i: number, patch: Partial<ReqField>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setRows(next);
    onChange(next);
  };
  const add = () => {
    const next = [...rows, { field_name: "", required: false }];
    setRows(next);
    onChange(next);
  };
  const remove = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    onChange(next);
  };

  const applyDetected = (detected: any[], strategy: "replace" | "append") => {
    if (strategy === "replace") {
      setRows(detected);
      onChange(detected);
      return;
    }
    const existing = new Set(rows.map((r) => r.field_name));
    const merged = [...rows, ...detected.filter((d: ReqField) => !existing.has(d.field_name))];
    setRows(merged);
    onChange(merged);
  };

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field Name</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Default Value</TableHead>
            <TableHead className="w-24">Required</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No request fields. Click Add or Upload payload to begin.</TableCell></TableRow>
          ) : rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell><Input value={r.field_name} onChange={(e) => update(i, { field_name: e.target.value })} placeholder="BPARTNER" /></TableCell>
              <TableCell><Input value={r.source || ""} onChange={(e) => update(i, { source: e.target.value })} placeholder="vendor.legal_name" /></TableCell>
              <TableCell><Input value={r.default_value || ""} onChange={(e) => update(i, { default_value: e.target.value })} placeholder="(optional)" /></TableCell>
              <TableCell><Switch checked={!!r.required} onCheckedChange={(v) => update(i, { required: v })} /></TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4 mr-2" />Add field</Button>
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Wand2 className="h-4 w-4 mr-2" />Upload payload & auto-detect
        </Button>
      </div>

      <PayloadUploader open={uploadOpen} onOpenChange={setUploadOpen} mode="request" onApply={applyDetected} />
    </div>
  );
}
