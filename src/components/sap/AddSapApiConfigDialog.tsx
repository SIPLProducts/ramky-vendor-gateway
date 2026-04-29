import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSapApiConfig } from "@/hooks/useSapApiConfigs";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AddSapApiConfigDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const create = useCreateSapApiConfig();
  const [form, setForm] = useState({
    name: "",
    description: "",
    base_url: "",
    endpoint_path: "",
    http_method: "POST",
    auth_type: "Basic",
    connection_mode: "proxy",
    api_type: "sync",
    auto_sync_enabled: false,
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async (advanced = false) => {
    if (!form.name.trim() || !form.endpoint_path.trim()) return;
    const res = await create.mutateAsync(form);
    onOpenChange(false);
    if (advanced) navigate(`/sap/api-settings/${res.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add SAP API Configuration</DialogTitle>
          <DialogDescription>
            Quick-add a new SAP API endpoint. You can configure request/response field mappings later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input placeholder="e.g. SAP_345_Transfer" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Brief description of what this API does" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input placeholder="http://10.10.6.115:8000" value={form.base_url} onChange={(e) => set("base_url", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Endpoint Path *</Label>
              <Input placeholder="/mrb/..." value={form.endpoint_path} onChange={(e) => set("endpoint_path", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>HTTP Method</Label>
              <Select value={form.http_method} onValueChange={(v) => set("http_method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auth Type</Label>
              <Select value={form.auth_type} onValueChange={(v) => set("auth_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Basic", "Bearer", "None"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Connection</Label>
              <Select value={form.connection_mode} onValueChange={(v) => set("connection_mode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proxy">Proxy</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>API Type</Label>
              <Select value={form.api_type} onValueChange={(v) => set("api_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sync">Sync — store data locally</SelectItem>
                  <SelectItem value="fetch">Fetch — live read</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Enable Auto-Sync</Label>
              <p className="text-xs text-muted-foreground">Schedule periodic background sync for this API.</p>
            </div>
            <Switch checked={form.auto_sync_enabled} onCheckedChange={(v) => set("auto_sync_enabled", v)} />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => handleSave(true)}
            disabled={create.isPending}
          >
            Save & open advanced editor →
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => handleSave(false)} disabled={create.isPending}>Save API</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
