import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Send,
  FileSpreadsheet,
  FileText,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import {
  useSmtpConfigs,
  useUserEmails,
  type SmtpConfig,
  type SmtpConfigInput,
} from "@/hooks/useSmtpConfigs";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface FormState extends SmtpConfigInput {
  use_app_password: boolean;
  reply_to: string | null;
}

const EMPTY: FormState = {
  user_email: "",
  smtp_host: "smtp.gmail.com",
  smtp_port: 587,
  encryption: "tls",
  smtp_username: "",
  app_password: "",
  from_name: "Sharvi Vendor Portal",
  reply_to: "",
  is_active: true,
  use_app_password: true,
};

const ENCRYPTION_OPTIONS = [
  { value: "ssl", label: "SSL (465)", port: 465 },
  { value: "tls", label: "TLS (587)", port: 587 },
  { value: "starttls", label: "STARTTLS (587)", port: 587 },
  { value: "none", label: "None", port: 25 },
] as const;

export default function EmailConfiguration() {
  const { list, save, remove, test } = useSmtpConfigs();
  const { data: profiles = [] } = useUserEmails();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmtpConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<SmtpConfig | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [portTouched, setPortTouched] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const emailOptions = useMemo(() => {
    const set = new Map<string, string>();
    profiles.forEach((p) => set.set(p.email.toLowerCase(), p.email));
    (list.data ?? []).forEach((c) =>
      set.set(c.user_email.toLowerCase(), c.user_email),
    );
    return Array.from(set.values()).sort();
  }, [profiles, list.data]);

  // Auto-suggest port when encryption changes (unless user typed a port)
  useEffect(() => {
    if (portTouched) return;
    const opt = ENCRYPTION_OPTIONS.find((o) => o.value === form.encryption);
    if (opt && form.smtp_port !== opt.port) {
      setForm((f) => ({ ...f, smtp_port: opt.port }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.encryption]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setShowPassword(false);
    setPortTouched(false);
    setTestTo("");
    setOpen(true);
  }

  function openEdit(cfg: SmtpConfig) {
    setEditing(cfg);
    setForm({
      id: cfg.id,
      user_email: cfg.user_email,
      smtp_host: cfg.smtp_host,
      smtp_port: cfg.smtp_port,
      encryption: cfg.encryption,
      smtp_username: cfg.smtp_username,
      app_password: "",
      from_name: cfg.from_name ?? "",
      reply_to: cfg.reply_to ?? "",
      is_active: cfg.is_active,
      use_app_password: true,
    });
    setShowPassword(false);
    setPortTouched(true);
    setTestTo(cfg.reply_to ?? cfg.user_email);
    setOpen(true);
  }

  async function handleSave() {
    if (!form.user_email || !form.smtp_host || !form.smtp_username) {
      toast({ title: "Missing fields", description: "From Email, Host and Username are required.", variant: "destructive" });
      return;
    }
    if (!editing && !form.app_password) {
      toast({ title: "Password required", description: "App password is required for new configs.", variant: "destructive" });
      return;
    }
    try {
      const { use_app_password: _u, ...payload } = form;
      await save.mutateAsync(payload as SmtpConfigInput);
      toast({ title: editing ? "Updated" : "Saved", description: "Email configuration saved." });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(cfg: SmtpConfig) {
    try {
      await remove.mutateAsync(cfg.id);
      toast({ title: "Deleted", description: `Removed config for ${cfg.user_email}` });
      setConfirmDelete(null);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  async function handleRowTest(cfg: SmtpConfig) {
    try {
      toast({ title: "Sending test email…", description: cfg.user_email });
      const res = await test.mutateAsync({ id: cfg.id });
      toast({ title: "Test email sent", description: `Delivered to ${res.sentTo ?? cfg.user_email}` });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    }
  }

  async function handleInlineTest() {
    if (!form.smtp_host || !form.smtp_username || !form.app_password || !form.user_email) {
      toast({
        title: "Fill the form first",
        description: "Host, Username, App Password and From Email are required to test.",
        variant: "destructive",
      });
      return;
    }
    const recipient = (testTo || form.user_email).trim();
    setTesting(true);
    try {
      toast({ title: "Sending test email…", description: recipient });
      const res = await test.mutateAsync({
        inline: {
          to: recipient,
          smtp_host: form.smtp_host,
          smtp_port: form.smtp_port,
          encryption: form.encryption,
          smtp_username: form.smtp_username,
          app_password: form.app_password!,
          from_email: form.user_email,
          from_name: form.from_name ?? null,
          reply_to: form.reply_to ?? null,
        },
      });
      toast({ title: "Test email sent", description: `Delivered to ${res.sentTo ?? recipient}` });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  function rowsForExport() {
    return (list.data ?? []).map((c) => ({
      Email: c.user_email,
      Host: c.smtp_host,
      Port: c.smtp_port,
      Encryption: c.encryption.toUpperCase(),
      Username: c.smtp_username,
      "From Name": c.from_name ?? "",
      "Reply-To": c.reply_to ?? "",
      Active: c.is_active ? "Yes" : "No",
      "Last Updated": new Date(c.updated_at).toLocaleString(),
    }));
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(rowsForExport());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Email Configurations");
    XLSX.writeFile(wb, `email-configurations-${Date.now()}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Sharvi Vendor Portal — Email Configuration", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    const rows = rowsForExport();
    autoTable(doc, {
      startY: 28,
      head: [Object.keys(rows[0] ?? { Email: "" })],
      body: rows.map((r) => Object.values(r) as (string | number)[]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [25, 91, 155] },
    });
    doc.save(`email-configurations-${Date.now()}.pdf`);
  }

  const data = list.data ?? [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-7 w-7 text-primary" /> Email Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage SMTP credentials for outbound emails (host, port, sender, app password).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={data.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={exportPdf} disabled={data.length === 0}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" /> Add Config
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  SMTP Email Configuration
                </DialogTitle>
                <CardDescription>
                  Configure outbound email delivery via your own SMTP server. Supports app passwords (Gmail, Outlook, Zoho, etc.).
                </CardDescription>
              </DialogHeader>

              {/* Enable SMTP Sending banner */}
              <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
                <div>
                  <Label className="text-base font-semibold">Enable SMTP Sending</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    When off, the system uses the default email provider.
                  </p>
                </div>
                <Switch
                  checked={form.is_active ?? true}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                {/* Row 1: Host | Port */}
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    placeholder="smtp.gmail.com"
                    value={form.smtp_host}
                    onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={form.smtp_port}
                    onChange={(e) => {
                      setPortTouched(true);
                      setForm((f) => ({ ...f, smtp_port: Number(e.target.value) }));
                    }}
                  />
                </div>

                {/* Row 2: Encryption | Use App Password toggle */}
                <div className="space-y-2">
                  <Label>Encryption</Label>
                  <Select
                    value={form.encryption}
                    onValueChange={(v: any) => {
                      setPortTouched(false);
                      setForm((f) => ({ ...f, encryption: v }));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENCRYPTION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                  <div>
                    <Label className="font-semibold">Use App Password</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended for Gmail / Outlook with 2FA
                    </p>
                  </div>
                  <Switch
                    checked={form.use_app_password}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, use_app_password: v }))}
                  />
                </div>

                {/* Row 3: Username | App Password */}
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    placeholder="user@example.com"
                    value={form.smtp_username}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        smtp_username: e.target.value,
                        user_email: f.user_email || e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {form.use_app_password ? "App Password" : "Password"}
                    {editing && <span className="text-xs text-muted-foreground ml-2">(leave empty to keep existing)</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={editing ? "••••••••" : "App password"}
                      value={form.app_password ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, app_password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Row 4: From Email | From Name */}
                <div className="space-y-2">
                  <Label>From Email</Label>
                  {emailOptions.length > 0 ? (
                    <Select
                      value={form.user_email}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          user_email: v,
                          smtp_username: f.smtp_username || v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick an email or type below" />
                      </SelectTrigger>
                      <SelectContent>
                        {emailOptions.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Input
                    placeholder="from@example.com"
                    value={form.user_email}
                    onChange={(e) => setForm((f) => ({ ...f, user_email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    placeholder="Sharvi Vendor Portal"
                    value={form.from_name ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                  />
                </div>

                {/* Row 5: Reply-To full width */}
                <div className="col-span-2 space-y-2">
                  <Label>Reply-To (optional)</Label>
                  <Input
                    placeholder="replies@example.com"
                    value={form.reply_to ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))}
                  />
                </div>
              </div>

              {/* Provider hints */}
              <div className="flex gap-3 border rounded-lg p-4 bg-muted/30 text-sm">
                <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold">Gmail:</span> Enable 2-Step Verification, then create an App Password at{" "}
                    <span className="font-mono text-xs">myaccount.google.com/apppasswords</span>. Use port 587 with TLS.
                  </p>
                  <p>
                    <span className="font-semibold">Outlook/Office 365:</span> Use{" "}
                    <span className="font-mono text-xs">smtp.office365.com</span>, port 587, STARTTLS, with an app password.
                  </p>
                </div>
              </div>

              {/* Inline test sender */}
              <div className="flex items-end justify-end gap-3 pt-2 border-t">
                <div className="space-y-2 w-72">
                  <Label className="text-xs">Send test to</Label>
                  <Input
                    placeholder="recipient@example.com"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleInlineTest}
                  disabled={testing}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {testing ? "Sending…" : "Send Test Email"}
                </Button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={save.isPending}>
                  {save.isPending ? "Saving…" : editing ? "Update" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Configurations</CardTitle>
          <CardDescription>
            {data.length} configuration{data.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Encryption</TableHead>
                <TableHead>Reply-To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No configurations yet. Click "Add Config" to create one.</TableCell></TableRow>
              ) : (
                data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.user_email}</TableCell>
                    <TableCell>{c.smtp_host}</TableCell>
                    <TableCell>{c.smtp_port}</TableCell>
                    <TableCell>{c.encryption.toUpperCase()}</TableCell>
                    <TableCell className="text-muted-foreground">{c.reply_to ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(c.updated_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => handleRowTest(c)} disabled={test.isPending}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the SMTP configuration for {confirmDelete?.user_email}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
