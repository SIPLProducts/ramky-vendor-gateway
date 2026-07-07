import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, RotateCcw, FileCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function SapPayloadTemplateEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [originalText, setOriginalText] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sap_payload_templates" as any)
      .select("id, template")
      .eq("is_active", true)
      .is("tenant_id", null)
      .maybeSingle();
    if (error) {
      toast({ title: "Failed to load template", description: error.message, variant: "destructive" });
    }
    if (data) {
      setRowId((data as any).id);
      const pretty = JSON.stringify((data as any).template, null, 2);
      setText(pretty);
      setOriginalText(pretty);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch (e: any) {
      toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
      return;
    }
    if (!rowId) return;
    setSaving(true);
    const { error } = await supabase
      .from("sap_payload_templates" as any)
      .update({ template: parsed })
      .eq("id", rowId);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setOriginalText(text);
    toast({ title: "Template saved", description: "New SAP payload mapping is now active." });
  };

  const reset = () => setText(originalText);

  if (loading) {
    return (
      <Card><CardContent className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading template…
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">SAP Payload Template</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Edit the full SAP Business Partner Create payload shape. Every key here is sent to SAP.
              Use <code className="text-xs bg-muted px-1 rounded">{"{{vendor.field}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{override.key|default:X}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{classify.MGV|upper}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{region(vendor.registered_state)}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{uploads}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{wt.witht}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{wt.wt_withcd}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{wt.wt_subjct_flag}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{wt.qsrec}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{wt.qland}}"}</code> (WHOLDTAX per-row mapping).
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={reset} disabled={text === originalText}>
              <RotateCcw className="h-4 w-4 mr-2" /> Revert
            </Button>
            <Button size="sm" onClick={save} disabled={saving || text === originalText}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="font-mono text-xs min-h-[600px]"
        />
      </CardContent>
    </Card>
  );
}
