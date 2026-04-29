import { useMemo, useState } from "react";
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

const EMPTY: SmtpConfigInput = {
  user_email: "",
  smtp_host: "smtp.gmail.com",
  smtp_port: 587,
  encryption: "tls",
  smtp_username: "",
  app_password: "",
  from_name: "",
  is_active: true,
};

export default function EmailConfiguration() {
  const { list, save, remove, test } = useSmtpConfigs();
  const { data: profiles = [] } = useUserEmails();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmtpConfig | null>(null);
  const [form, setForm] = useState<SmtpConfigInput>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<SmtpConfig | null>(null);

  const emailOptions = useMemo(() => {
    const set = new Map<string, string>();
    profiles.forEach((p) => set.set(p.email.toLowerCase(), p.email));
    (list.data ?? []).forEach((c) =>
      set.set(c.user_email.toLowerCase(), c.user_email),
    );
    return Array.from(set.values()).sort();
  }, [profiles, list.data]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
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
      is_active: cfg.is_active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.user_email || !form.smtp_host || !form.smtp_username) {
      toast({ title: "Missing fields", description: "Email, host and username are required.", variant: "destructive" });
      return;
    }
    if (!editing && !form.app_password) {
      toast({ title: "Password required", description: "App password is required for new configs.", variant: "destructive" });
      return;
    }
    try {
      await save.mutateAsync(form);
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

  async function handleTest(cfg: SmtpConfig) {
    try {
      toast({ title: "Sending test email…", description: cfg.user_email });
      const res = await test.mutateAsync({ id: cfg.id });
      toast({ title: "Test email sent", description: `Delivered to ${res.sentTo ?? cfg.user_email}` });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
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
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Edit Email Configuration" : "New Email Configuration"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="col-span-2 space-y-2">
                  <Label>User Email</Label>
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
                      <SelectValue placeholder="Pick a user email or type below" />
                    </SelectTrigger>
                    <SelectContent>
                      {emailOptions.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="or enter a custom email"
                    value={form.user_email}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        user_email: e.target.value,
                        smtp_username: f.smtp_username || e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    value={form.smtp_host}
                    onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={form.smtp_port}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, smtp_port: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Encryption</Label>
                  <Select
                    value={form.encryption}
                    onValueChange={(v: any) => setForm((f) => ({ ...f, encryption: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS</SelectItem>
                      <SelectItem value="ssl">SSL</SelectItem>
                      <SelectItem value="starttls">STARTTLS</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>SMTP Username</Label>
                  <Input
                    value={form.smtp_username}
                    onChange={(e) => setForm((f) => ({ ...f, smtp_username: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>App Password {editing && <span className="text-xs text-muted-foreground">(leave empty to keep existing)</span>}</Label>
                  <Input
                    type="password"
                    placeholder={editing ? "••••••••" : "App password"}
                    value={form.app_password ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, app_password: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Name (optional)</Label>
                  <Input
                    value={form.from_name ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-3 mt-7">
                  <Switch
                    checked={form.is_active ?? true}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  />
                  <Label>Active</Label>
                </div>
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
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No configurations yet. Click "Add Config" to create one.</TableCell></TableRow>
              ) : (
                data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.user_email}</TableCell>
                    <TableCell>{c.smtp_host}</TableCell>
                    <TableCell>{c.smtp_port}</TableCell>
                    <TableCell>{c.encryption.toUpperCase()}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(c.updated_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => handleTest(c)} disabled={test.isPending}>
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
