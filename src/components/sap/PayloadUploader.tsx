import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Wand2, FileJson } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  parsePayload, detectRequestFields, detectResponseFields,
  type DetectedRequestField, type DetectedResponseField,
} from "@/lib/payloadAutoDetect";

type Mode = "request" | "response";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  onApply: (rows: any[], strategy: "replace" | "append") => void;
}

const MAX_BYTES = 2 * 1024 * 1024;

export function PayloadUploader({ open, onOpenChange, mode, onApply }: Props) {
  const [text, setText] = useState("");
  const [detected, setDetected] = useState<Array<DetectedRequestField | DetectedResponseField>>([]);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [strategy, setStrategy] = useState<"replace" | "append">("append");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setText(""); setDetected([]); setPicked([]); setStrategy("append"); };

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Max 2 MB", variant: "destructive" });
      return;
    }
    const t = await file.text();
    setText(t);
    autoDetect(t);
  };

  const autoDetect = (raw?: string) => {
    try {
      const payload = parsePayload(raw ?? text);
      const rows = mode === "request" ? detectRequestFields(payload) : detectResponseFields(payload);
      if (rows.length === 0) {
        toast({ title: "No fields detected", description: "Payload appears empty.", variant: "destructive" });
        return;
      }
      setDetected(rows);
      setPicked(rows.map(() => true));
      toast({ title: `Detected ${rows.length} field(s)` });
    } catch (e: any) {
      toast({ title: "Failed to parse", description: e.message, variant: "destructive" });
    }
  };

  const apply = () => {
    const chosen = detected.filter((_, i) => picked[i]);
    if (chosen.length === 0) {
      toast({ title: "Nothing selected", variant: "destructive" });
      return;
    }
    onApply(chosen, strategy);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Auto-detect {mode === "request" ? "request" : "response"} fields
          </DialogTitle>
          <DialogDescription>
            Upload a sample JSON / CSV payload or paste it below. Fields will be extracted automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste" className="w-full">
          <TabsList>
            <TabsTrigger value="paste">Paste payload</TabsTrigger>
            <TabsTrigger value="upload">Upload file</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-2">
            <Textarea
              rows={8}
              placeholder='{"d":{"results":[{"BPARTNER":"V001","NAME":"Acme"}]}}'
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="font-mono text-xs"
            />
            <Button size="sm" onClick={() => autoDetect()} disabled={!text.trim()}>
              <Wand2 className="h-4 w-4 mr-2" />Auto-detect fields
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/40 cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <FileJson className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm mt-2">Drop a <code>.json</code>, <code>.txt</code> or <code>.csv</code> file here, or click to browse.</p>
              <p className="text-xs text-muted-foreground mt-1">Max 2 MB. Fields auto-detect after upload.</p>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.txt,.csv,application/json,text/csv,text/plain"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          </TabsContent>
        </Tabs>

        {detected.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Detected fields ({detected.length})</h4>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPicked(detected.map(() => true))}>Select all</Button>
                <Button size="sm" variant="ghost" onClick={() => setPicked(detected.map(() => false))}>Clear</Button>
              </div>
            </div>

            <div className="border rounded-md max-h-64 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Field</TableHead>
                    {mode === "request" ? (
                      <>
                        <TableHead>Source path</TableHead>
                        <TableHead>Sample value</TableHead>
                      </>
                    ) : (
                      <TableHead>Target column</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detected.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox
                          checked={picked[i]}
                          onCheckedChange={(v) => setPicked((p) => p.map((x, idx) => (idx === i ? !!v : x)))}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{f.field_name}</TableCell>
                      {mode === "request" ? (
                        <>
                          <TableCell className="font-mono text-xs text-muted-foreground">{(f as DetectedRequestField).source}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                            {(f as DetectedRequestField).default_value || "—"}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="font-mono text-xs text-muted-foreground">{(f as DetectedResponseField).target_column}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <RadioGroup value={strategy} onValueChange={(v: any) => setStrategy(v)} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem id="append" value="append" />
                <Label htmlFor="append" className="text-sm font-normal">Append new only (skip duplicates)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="replace" value="replace" />
                <Label htmlFor="replace" className="text-sm font-normal">Replace all existing</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={detected.length === 0}>
            <Upload className="h-4 w-4 mr-2" />Apply to fields
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
