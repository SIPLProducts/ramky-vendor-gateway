import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Trash2, Settings as SettingsIcon, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useSapApiConfig, useUpdateSapApiConfig, useDeleteSapApiConfig,
  useSapRequestFields, useSapResponseFields, useReplaceSapRequestFields,
  useReplaceSapResponseFields, useSapCredentials, useSaveSapCredentials,
} from "@/hooks/useSapApiConfigs";
import { RequestFieldsEditor, ReqField } from "@/components/sap/RequestFieldsEditor";
import { ResponseFieldsEditor, ResField } from "@/components/sap/ResponseFieldsEditor";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SapApiConfigEdit() {
  const { configId } = useParams<{ configId: string }>();
  const navigate = useNavigate();
  const { data: config, isLoading } = useSapApiConfig(configId);
  const update = useUpdateSapApiConfig();
  const del = useDeleteSapApiConfig();
  const { data: reqFields } = useSapRequestFields(configId);
  const { data: resFields } = useSapResponseFields(configId);
  const { data: creds } = useSapCredentials(configId);
  const saveReq = useReplaceSapRequestFields();
  const saveRes = useReplaceSapResponseFields();
  const saveCreds = useSaveSapCredentials();

  const [form, setForm] = useState<any>({});
  const [reqRows, setReqRows] = useState<ReqField[]>([]);
  const [resRows, setResRows] = useState<ResField[]>([]);
  const [credForm, setCredForm] = useState({ username: "", password_encrypted: "", extra_headers: "{}" });

  useEffect(() => { if (config) setForm(config); }, [config]);
  useEffect(() => {
    if (reqFields) setReqRows(reqFields.map((r: any) => ({
      field_name: r.field_name, source: r.source, default_value: r.default_value, required: r.required,
    })));
  }, [reqFields]);
  useEffect(() => {
    if (resFields) setResRows(resFields.map((r: any) => ({
      field_name: r.field_name, target_column: r.target_column,
    })));
  }, [resFields]);
  useEffect(() => {
    if (creds) setCredForm({
      username: creds.username || "",
      password_encrypted: creds.password_encrypted || "",
      extra_headers: JSON.stringify(creds.extra_headers || {}, null, 2),
    });
  }, [creds]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  if (isLoading || !config) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-96 w-full" /></div>;
  }

  const saveDetails = () => {
    if ((form.connection_mode || "proxy") === "proxy") {
      if (!form.middleware_url || !String(form.middleware_url).trim()) {
        toast({
          title: "Middleware URL is required",
          description: "In Proxy mode, set 'Node.js Middleware URL' to your public middleware URL (e.g. https://abc123.ngrok-free.app).",
          variant: "destructive",
        });
        return;
      }
      if (!form.proxy_secret || !String(form.proxy_secret).trim()) {
        toast({
          title: "Proxy Secret / Password is required",
          description: "Paste the same value as MIDDLEWARE_SHARED_SECRET from middleware/.env into 'Proxy Secret / Password', then save.",
          variant: "destructive",
        });
        return;
      }
    }
    update.mutate({ id: config.id, ...form });
  };
  const saveRequest = () => saveReq.mutate({ configId: config.id, rows: reqRows });
  const saveResponse = () => saveRes.mutate({ configId: config.id, rows: resRows });
  const saveCredentials = () => {
    let extra = {};
    try { extra = JSON.parse(credForm.extra_headers || "{}"); } catch {}
    saveCreds.mutate({
      config_id: config.id,
      username: credForm.username,
      password_encrypted: credForm.password_encrypted,
      extra_headers: extra,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sap/api-settings")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <h1 className="text-2xl font-bold">Edit API Configuration</h1>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">API Details</TabsTrigger>
          <TabsTrigger value="request">Request Fields</TabsTrigger>
          <TabsTrigger value="response">Response Fields</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* API Details */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">API Configuration</h3>
              </div>
              <p className="text-sm text-muted-foreground">Edit the API endpoint details, HTTP method, and authentication type.</p>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Name *"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} /></Field>
                <Field label="Description"><Input value={form.description || ""} onChange={(e) => set("description", e.target.value)} /></Field>
                <Field label="Base URL *"><Input value={form.base_url || ""} onChange={(e) => set("base_url", e.target.value)} /></Field>
                <Field label="Endpoint Path"><Input value={form.endpoint_path || ""} onChange={(e) => set("endpoint_path", e.target.value)} /></Field>
                <Field label="List Endpoint (proxy path)"><Input value={form.list_endpoint || ""} onChange={(e) => set("list_endpoint", e.target.value)} /></Field>
                <Field label="Create Endpoint (proxy path)"><Input value={form.create_endpoint || ""} onChange={(e) => set("create_endpoint", e.target.value)} /></Field>
                <Field label="Update Endpoint (proxy path)"><Input value={form.update_endpoint || ""} onChange={(e) => set("update_endpoint", e.target.value)} /></Field>
                <Field label="Update Method">
                  <Select value={form.update_method || "PATCH"} onValueChange={(v) => set("update_method", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["PATCH", "PUT", "POST"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Key Field"><Input value={form.key_field || ""} onChange={(e) => set("key_field", e.target.value)} placeholder="gate_id" /></Field>
                <Field label="HTTP Method">
                  <Select value={form.http_method || "POST"} onValueChange={(v) => set("http_method", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Auth Type">
                  <Select value={form.auth_type || "Basic"} onValueChange={(v) => set("auth_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Basic", "Bearer", "None"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="SAP Client"><Input value={form.sap_client || ""} onChange={(e) => set("sap_client", e.target.value)} /></Field>
                <Field label="Timeout (ms)"><Input type="number" value={form.timeout_ms || 30000} onChange={(e) => set("timeout_ms", parseInt(e.target.value) || 30000)} /></Field>
                <Field label="Connection Mode">
                  <Select value={form.connection_mode || "proxy"} onValueChange={(v) => set("connection_mode", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proxy">Via Proxy Server</SelectItem>
                      <SelectItem value="direct">Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Deployment Mode">
                  <Select value={form.deployment_mode || "cloud"} onValueChange={(v) => set("deployment_mode", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cloud">Lovable Cloud</SelectItem>
                      <SelectItem value="self_hosted">Self-Hosted (Client Server)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Middleware Port"><Input type="number" value={form.middleware_port || ""} onChange={(e) => set("middleware_port", parseInt(e.target.value) || null)} placeholder="3002" /></Field>
                <Field label="Node.js Middleware URL"><Input value={form.middleware_url || ""} onChange={(e) => set("middleware_url", e.target.value)} placeholder="https://...ngrok-free.app" /></Field>
                <Field label="Proxy Secret / Password"><Input type="password" value={form.proxy_secret || ""} onChange={(e) => set("proxy_secret", e.target.value)} placeholder="Optional" /></Field>
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-0 bg-background border-t flex justify-end gap-2 py-3 px-2">
            <Button variant="outline" onClick={() => navigate("/sap/api-settings")}>Cancel</Button>
            <Button onClick={saveDetails} disabled={update.isPending}>
              <Save className="h-4 w-4 mr-2" />Save API Details
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="request" className="space-y-3">
          <Card><CardContent className="p-6"><RequestFieldsEditor initial={reqRows} onChange={setReqRows} /></CardContent></Card>
          <div className="flex justify-end"><Button onClick={saveRequest} disabled={saveReq.isPending}><Save className="h-4 w-4 mr-2" />Save Request Fields</Button></div>
        </TabsContent>

        <TabsContent value="response" className="space-y-3">
          <Card><CardContent className="p-6"><ResponseFieldsEditor initial={resRows} onChange={setResRows} /></CardContent></Card>
          <div className="flex justify-end"><Button onClick={saveResponse} disabled={saveRes.isPending}><Save className="h-4 w-4 mr-2" />Save Response Fields</Button></div>
        </TabsContent>

        <TabsContent value="scheduler">
          <Card><CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Enable Auto-Sync</Label>
                <p className="text-xs text-muted-foreground">Schedule periodic background sync.</p>
              </div>
              <Switch checked={!!form.auto_sync_enabled} onCheckedChange={(v) => set("auto_sync_enabled", v)} />
            </div>
            <Field label="Schedule (cron expression)">
              <Input value={form.schedule_cron || ""} onChange={(e) => set("schedule_cron", e.target.value)} placeholder="*/5 * * * *" />
            </Field>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => set("schedule_cron", "*/5 * * * *")}>Every 5 min</Button>
              <Button size="sm" variant="outline" onClick={() => set("schedule_cron", "0 * * * *")}>Hourly</Button>
              <Button size="sm" variant="outline" onClick={() => set("schedule_cron", "0 0 * * *")}>Daily</Button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Last sync: </span>{form.last_synced_at ? new Date(form.last_synced_at).toLocaleString() : "—"}</div>
              <div><span className="text-muted-foreground">Next sync: </span>{form.next_sync_at ? new Date(form.next_sync_at).toLocaleString() : "—"}</div>
            </div>
            <div className="flex justify-end"><Button onClick={saveDetails} disabled={update.isPending}><Save className="h-4 w-4 mr-2" />Save Scheduler</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="credentials">
          <Card><CardContent className="p-6 space-y-4">
            <Field label="Username"><Input value={credForm.username} onChange={(e) => setCredForm((p) => ({ ...p, username: e.target.value }))} /></Field>
            <Field label="Password / Token"><Input type="password" value={credForm.password_encrypted} onChange={(e) => setCredForm((p) => ({ ...p, password_encrypted: e.target.value }))} /></Field>
            <Field label="Extra Headers (JSON)">
              <Textarea rows={6} value={credForm.extra_headers} onChange={(e) => setCredForm((p) => ({ ...p, extra_headers: e.target.value }))} className="font-mono text-xs" />
            </Field>
            <div>
              <input
                id="cred-upload"
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) { toast({ title: "File too large (max 2 MB)", variant: "destructive" }); return; }
                  try {
                    const obj = JSON.parse(await f.text());
                    const next = { ...credForm };
                    if (obj.username) next.username = String(obj.username);
                    if (obj.password) next.password_encrypted = String(obj.password);
                    if (obj.token) next.password_encrypted = String(obj.token);
                    const headers = obj.headers ?? obj.extra_headers ?? (typeof obj === "object" && !obj.username && !obj.password && !obj.token ? obj : {});
                    next.extra_headers = JSON.stringify(headers, null, 2);
                    setCredForm(next);
                    toast({ title: "Credentials file parsed" });
                  } catch (err: any) {
                    toast({ title: "Invalid JSON", description: err.message, variant: "destructive" });
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={() => document.getElementById("cred-upload")?.click()}>
                <Upload className="h-4 w-4 mr-2" />Upload credentials JSON
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Supports keys: <code>username</code>, <code>password</code>, <code>token</code>, <code>headers</code>.
              </p>
            </div>
            <div className="flex justify-end"><Button onClick={saveCredentials} disabled={saveCreds.isPending}><Save className="h-4 w-4 mr-2" />Save Credentials</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card><CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive configs are skipped during sync.</p>
              </div>
              <Switch checked={form.is_active !== false} onCheckedChange={(v) => set("is_active", v)} />
            </div>
            <div className="flex justify-end"><Button onClick={saveDetails} disabled={update.isPending}><Save className="h-4 w-4 mr-2" />Save Settings</Button></div>

            <div className="border border-destructive/40 rounded-lg p-4 mt-6">
              <h4 className="font-semibold text-destructive mb-1">Danger Zone</h4>
              <p className="text-sm text-muted-foreground mb-3">Delete this configuration permanently.</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete Configuration</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this configuration?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => { await del.mutateAsync(config.id); navigate("/sap/api-settings"); }}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
