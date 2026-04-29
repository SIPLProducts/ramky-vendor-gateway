import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Wand2 } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { PayloadUploader } from "./PayloadUploader";

export interface ResField {
  field_name: string;
  target_column?: string;
}

interface Props {
  initial: ResField[];
  onChange: (rows: ResField[]) => void;
}

export function ResponseFieldsEditor({ initial, onChange }: Props) {
  const [rows, setRows] = useState<ResField[]>(initial);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => setRows(initial), [initial]);

  const update = (i: number, patch: Partial<ResField>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setRows(next);
    onChange(next);
  };
  const add = () => {
    const next = [...rows, { field_name: "" }];
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
    const merged = [...rows, ...detected.filter((d: ResField) => !existing.has(d.field_name))];
    setRows(merged);
    onChange(merged);
  };

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Response Field</TableHead>
            <TableHead>Target Column</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No response mappings. Click Add or Upload payload to begin.</TableCell></TableRow>
          ) : rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell><Input value={r.field_name} onChange={(e) => update(i, { field_name: e.target.value })} placeholder="BP_LIFNR" /></TableCell>
              <TableCell><Input value={r.target_column || ""} onChange={(e) => update(i, { target_column: e.target.value })} placeholder="sap_vendor_code" /></TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4 mr-2" />Add mapping</Button>
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Wand2 className="h-4 w-4 mr-2" />Upload payload & auto-detect
        </Button>
      </div>

      <PayloadUploader open={uploadOpen} onOpenChange={setUploadOpen} mode="response" onApply={applyDetected} />
    </div>
  );
}
