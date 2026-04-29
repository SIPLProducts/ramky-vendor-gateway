import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Eye, EyeOff, Play, Loader2, Plus, Trash2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import {
  useKycApiProvider, useUpdateKycApiProvider, useKycApiCredential,
  useSaveKycApiCredential, useTestKycApi,
} from "@/hooks/useKycApiConfigs";

const AUTH_TYPES = ["BEARER_TOKEN", "API_KEY", "BASIC", "NONE"];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH"];
const REQUEST_MODES = ["json", "multipart", "form"];

function jsonStr(v: any) {
  try { return JSON.stringify(v ?? {}, null, 2); } catch { return "{}"; }
}

type HeaderRow = { key: string; value: string };

function objToRows(obj: Record<string, any> | null | undefined): HeaderRow[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value: String(value ?? "") }));
}

function rowsToObj(rows: HeaderRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    if (k.toLowerCase() === "authorization") continue; // auto-added from credential
    out[k] = r.value;
  }
  return out;
}

/** Accepts strict JSON or pasted "Key: Value" header lines. */
function lenientHeaderParse(text: string): { ok: true; obj: Record<string, string> } | { ok: false; error: string } {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: true, obj: {} };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) out[k] = String(v ?? "");
      return { ok: true, obj: out };
    }
  } catch { /* fall through to lenient */ }
  // Strip wrapping braces and try line-by-line "Key: Value"
  const body = trimmed.replace(/^\{/, "").replace(/\}$/, "");
  const out: Record<string, string> = {};
  const lines = body.split(/\r?\n/);
  for (let raw of lines) {
    let line = raw.trim().replace(/,$/, "");
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) return { ok: false, error: `Cannot parse line: "${line}"` };
    const k = line.slice(0, colon).trim().replace(/^["']|["']$/g, "");
    const v = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "").replace(/,$/, "");
    if (!k) continue;
    out[k] = v;
  }
  return { ok: true, obj: out };
}

export default function KycApiConfigEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: provider, isLoading } = useKycApiProvider(id);
  const update = useUpdateKycApiProvider();
  const { data: cred } = useKycApiCredential(id);
  const saveCred = useSaveKycApiCredential();
  const test = useTestKycApi();

  const [form, setForm] = useState<any>(null);
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [headersAdvanced, setHeadersAdvanced] = useState(false);
  const [headersText, setHeadersText] = useState("{}");
  const [headersError, setHeadersError] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState("{}");
  const [mappingText, setMappingText] = useState("{}");
  const [credValue, setCredValue] = useState("");
  const [showCred, setShowCred] = useState(false);
  const [sampleText, setSampleText] = useState('{"gstin":"22AAAAA0000A1Z5"}');
  const [testFile, setTestFile] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (provider) {
      setForm({ ...provider });
      const hdrs = (provider.request_headers || {}) as Record<string, any>;
      // Strip any Authorization header from extras (it's auto-added from credential)
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(hdrs)) {
        if (k.toLowerCase() === "authorization") continue;
        cleaned[k] = String(v ?? "");
      }
      setHeaderRows(objToRows(cleaned));
      setHeadersText(jsonStr(cleaned));
      setHeadersError(null);
      setBodyText(jsonStr(provider.request_body_template));
      setMappingText(jsonStr(provider.response_data_mapping));
    }
  }, [provider]);

  useEffect(() => {
    if (cred?.credential_value) setCredValue(cred.credential_value);
  }, [cred]);

  if (isLoading || !form) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  const addHeaderRow = () => setHeaderRows((r) => [...r, { key: "", value: "" }]);
  const updateHeaderRow = (i: number, patch: Partial<HeaderRow>) =>
    setHeaderRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeHeaderRow = (i: number) =>
    setHeaderRows((rows) => rows.filter((_, idx) => idx !== i));

  const onSave = async () => {
    // Resolve headers from whichever editor is active
    let request_headers: Record<string, string> = {};
    if (headersAdvanced) {
      const parsed = lenientHeaderParse(headersText);
      if (!parsed.ok) {
        setHeadersError(parsed.error);
        toast({ title: "Headers — couldn't parse", description: parsed.error, variant: "destructive" });
        return;
      }
      // Strip Authorization (auto-added)
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.obj)) {
        if (k.toLowerCase() === "authorization") continue;
        out[k] = v;
      }
      request_headers = out;
      setHeadersError(null);
    } else {
      request_headers = rowsToObj(headerRows);
    }

    let request_body_template, response_data_mapping;
    try {
      request_body_template = JSON.parse(bodyText || "{}");
      response_data_mapping = JSON.parse(mappingText || "{}");
    } catch (e: any) {
      toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
      return;
    }
    await update.mutateAsync({
      id: form.id,
      provider_name: form.provider_name,
      display_name: form.display_name,
      category: form.category,
      base_url: form.base_url,
      endpoint_path: form.endpoint_path,
      http_method: form.http_method,
      request_mode: form.request_mode,
      file_field_name: form.file_field_name || null,
      auth_type: form.auth_type,
      auth_header_name: form.auth_header_name,
      auth_header_prefix: form.auth_header_prefix,
      timeout_seconds: form.timeout_seconds,
      retry_count: form.retry_count,
      is_enabled: form.is_enabled,
      is_mandatory: form.is_mandatory,
      request_headers,
      request_body_template,
      response_data_mapping,
      response_success_path: form.response_success_path,
      response_success_value: form.response_success_value,
      response_message_path: form.response_message_path,
    });
    if (credValue && credValue !== cred?.credential_value) {
      await saveCred.mutateAsync({ providerId: form.id, value: credValue });
    }
  };

  const onTest = async () => {
    setTestResult(null);
    let sampleInput: any = {};
    try { sampleInput = JSON.parse(sampleText || "{}"); } catch { /* ignore */ }
    let fileBase64: string | undefined;
    let fileMimeType: string | undefined;
    if (testFile) {
      fileBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const s = r.result as string;
          resolve(s.includes(",") ? s.split(",")[1] : s);
        };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(testFile);
      });
      fileMimeType = testFile.type;
    }
    try {
      const res = await test.mutateAsync({ providerId: form.id, sampleInput, fileBase64, fileMimeType });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/kyc-api-settings")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{form.display_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{form.category}</Badge>
              <span className="text-xs text-muted-foreground">{form.provider_name}</span>
            </div>
          </div>
        </div>
        <Button onClick={onSave} disabled={update.isPending || saveCred.isPending}>
          <Save className="h-4 w-4 mr-2" />Save
        </Button>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="payload">Request Payload</TabsTrigger>
          <TabsTrigger value="response">Response Mapping</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card><CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Provider Key</Label>
                <Input value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OCR">OCR</SelectItem>
                    <SelectItem value="VALIDATION">Validation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>HTTP Method</Label>
                <Select value={form.http_method} onValueChange={(v) => setForm({ ...form, http_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://kyc-api.surepass.app" />
              </div>
              <div className="space-y-2">
                <Label>Endpoint Path</Label>
                <Input value={form.endpoint_path} onChange={(e) => setForm({ ...form, endpoint_path: e.target.value })} placeholder="/api/v1/ocr/gst" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Request Mode</Label>
                <Select value={form.request_mode} onValueChange={(v) => setForm({ ...form, request_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUEST_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>File Field Name (multipart)</Label>
                <Input value={form.file_field_name || ""} onChange={(e) => setForm({ ...form, file_field_name: e.target.value })} placeholder="file" disabled={form.request_mode !== "multipart"} />
              </div>
              <div className="space-y-2">
                <Label>Timeout (s)</Label>
                <Input type="number" value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: parseInt(e.target.value) || 30 })} />
              </div>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm({ ...form, is_enabled: v })} />
                <Label>Enabled</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_mandatory} onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })} />
                <Label>Mandatory</Label>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="auth">
          <Card><CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Auth Type</Label>
                <Select value={form.auth_type} onValueChange={(v) => setForm({ ...form, auth_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUTH_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Header Name</Label>
                <Input value={form.auth_header_name} onChange={(e) => setForm({ ...form, auth_header_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Header Prefix</Label>
                <Input value={form.auth_header_prefix} onChange={(e) => setForm({ ...form, auth_header_prefix: e.target.value })} placeholder="Bearer" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>API Token / Credential</Label>
              <div className="flex gap-2">
                <Input
                  type={showCred ? "text" : "password"}
                  value={credValue}
                  onChange={(e) => setCredValue(e.target.value)}
                  placeholder="Paste your bearer token / API key"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowCred((s) => !s)}>
                  {showCred ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored encrypted. Sent as <code>{form.auth_header_name}: {form.auth_header_prefix} &lt;token&gt;</code> on every call.
              </p>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="headers">
          <Card><CardContent className="p-6 space-y-2">
            <Label>Extra Request Headers (JSON)</Label>
            <Textarea rows={10} className="font-mono text-xs" value={headersText} onChange={(e) => setHeadersText(e.target.value)} />
            <p className="text-xs text-muted-foreground">Authorization header is added automatically from the credential — only put extras here.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payload">
          <Card><CardContent className="p-6 space-y-2">
            <Label>Request Body Template (JSON)</Label>
            <Textarea rows={10} className="font-mono text-xs" value={bodyText} onChange={(e) => setBodyText(e.target.value)}
              disabled={form.request_mode === "multipart"} />
            <p className="text-xs text-muted-foreground">
              Use <code>{"{{placeholder}}"}</code> tokens — e.g. <code>{`{ "id_number": "{{gstin}}" }`}</code>.
              For multipart OCR, the file is sent under field <code>{form.file_field_name || "file"}</code> instead of a body.
            </p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="response">
          <Card><CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Success Path</Label>
                <Input value={form.response_success_path || ""} onChange={(e) => setForm({ ...form, response_success_path: e.target.value })} placeholder="success" />
              </div>
              <div className="space-y-2">
                <Label>Success Value</Label>
                <Input value={form.response_success_value || ""} onChange={(e) => setForm({ ...form, response_success_value: e.target.value })} placeholder="true" />
              </div>
              <div className="space-y-2">
                <Label>Message Path</Label>
                <Input value={form.response_message_path || ""} onChange={(e) => setForm({ ...form, response_message_path: e.target.value })} placeholder="message" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Field Mapping (JSON)</Label>
              <Textarea rows={10} className="font-mono text-xs" value={mappingText} onChange={(e) => setMappingText(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Map output field → JSON path in the API response (dot notation), e.g. <code>{`{ "legalName": "data.legal_name" }`}</code>.
              </p>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader><CardTitle className="text-base">Run a test call</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sample input (JSON, used to fill {"{{placeholders}}"})</Label>
                <Textarea rows={5} className="font-mono text-xs" value={sampleText} onChange={(e) => setSampleText(e.target.value)} />
              </div>
              {form.request_mode === "multipart" && (
                <div className="space-y-2">
                  <Label>Upload sample file</Label>
                  <Input type="file" onChange={(e) => setTestFile(e.target.files?.[0] || null)} />
                </div>
              )}
              <Button onClick={onTest} disabled={test.isPending}>
                {test.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Send test request
              </Button>
              {testResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={testResult.ok ? "default" : "destructive"}>
                      {testResult.ok ? "Success" : "Failed"}
                    </Badge>
                    {testResult.status != null && <span className="text-xs text-muted-foreground">HTTP {testResult.status}</span>}
                    {testResult.latency_ms != null && <span className="text-xs text-muted-foreground">{testResult.latency_ms}ms</span>}
                  </div>
                  {testResult.message && <p className="text-sm">{testResult.message}</p>}
                  <Label className="text-xs">Mapped result</Label>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">{JSON.stringify(testResult.mappedResult ?? {}, null, 2)}</pre>
                  <Label className="text-xs">Raw response</Label>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">{JSON.stringify(testResult.response ?? {}, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
