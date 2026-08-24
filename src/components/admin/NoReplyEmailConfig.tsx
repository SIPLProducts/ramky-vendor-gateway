import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/hooks/use-toast";
import { Mail, Eye, EyeOff, Info, Send, Loader2, X } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_username",
  "smtp_password",
  "smtp_encryption",
  "smtp_from_email",
  "smtp_from_name",
  "smtp_reply_to",
  "smtp_enabled",
] as const;

type Form = {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_encryption: "none" | "ssl" | "tls" | "starttls";
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_reply_to: string;
  smtp_enabled: boolean;
};

const EMPTY: Form = {
  smtp_host: "smtp.gmail.com",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  smtp_encryption: "tls",
  smtp_from_email: "",
  smtp_from_name: "Sharvi Vyapaar Portal — No Reply",
  smtp_reply_to: "",
  smtp_enabled: true,
};

const ENCRYPTION_OPTIONS = [
  { value: "ssl", label: "SSL (465)", port: 465 },
  { value: "tls", label: "TLS (587)", port: 587 },
  { value: "starttls", label: "STARTTLS (587)", port: 587 },
  { value: "none", label: "None", port: 25 },
] as const;

function unwrap(v: any): any {
  if (v && typeof v === "object" && "value" in v) return (v as any).value;
  return v;
}

export function NoReplyEmailConfig() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("portal_config")
        .select("config_key, config_value")
        .in("config_key", [...KEYS]);
      if (error) {
        toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      } else if (data) {
        const map: Record<string, any> = {};
        data.forEach((r: any) => {
          map[r.config_key] = unwrap(r.config_value);
        });
        const pwd = String(map.smtp_password ?? "");
        setHasExistingPassword(pwd.length > 0);
        setForm({
          smtp_host: String(map.smtp_host ?? EMPTY.smtp_host),
          smtp_port: Number(map.smtp_port ?? EMPTY.smtp_port),
          smtp_username: String(map.smtp_username ?? ""),
          smtp_password: "", // never prefill — keep empty unless user types a new one
          smtp_encryption: (map.smtp_encryption as any) ?? "tls",
          smtp_from_email: String(map.smtp_from_email ?? ""),
          smtp_from_name: String(map.smtp_from_name ?? EMPTY.smtp_from_name),
          smtp_reply_to: String(map.smtp_reply_to ?? ""),
          smtp_enabled: map.smtp_enabled === undefined ? true : !!map.smtp_enabled,
        });
        setTestTo(String(map.smtp_from_email ?? ""));
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    if (!form.smtp_host || !form.smtp_username || !form.smtp_from_email) {
      toast({
        title: "Missing fields",
        description: "Host, Username and From Email are required.",
        variant: "destructive",
      });
      return;
    }
    if (!form.smtp_username.includes("@")) {
      toast({
        title: "Username must be an email",
        description:
          "SMTP Username should be the full email address (e.g. you@gmail.com), not a display name. Use the From Name field for the sender name.",
        variant: "destructive",
      });
      return;
    }
    if (!hasExistingPassword && !form.smtp_password) {
      toast({
        title: "Password required",
        description: "App password is required for the no-reply sender.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const rows: { config_key: string; config_value: any; description?: string }[] = [
        { config_key: "smtp_host", config_value: { value: form.smtp_host } },
        { config_key: "smtp_port", config_value: { value: form.smtp_port } },
        { config_key: "smtp_username", config_value: { value: form.smtp_username } },
        { config_key: "smtp_encryption", config_value: { value: form.smtp_encryption } },
        { config_key: "smtp_from_email", config_value: { value: form.smtp_from_email } },
        { config_key: "smtp_from_name", config_value: { value: form.smtp_from_name } },
        { config_key: "smtp_reply_to", config_value: { value: form.smtp_reply_to } },
        { config_key: "smtp_enabled", config_value: { value: form.smtp_enabled } },
      ];
      // Only update password if a new one was typed.
      if (form.smtp_password) {
        rows.push({ config_key: "smtp_password", config_value: { value: form.smtp_password } });
      }
      const { error } = await supabase
        .from("portal_config")
        .upsert(rows, { onConflict: "config_key" });
      if (error) throw error;
      toast({
        title: "Saved",
        description: "No-Reply email configuration saved successfully.",
      });
      if (form.smtp_password) setHasExistingPassword(true);
      setForm((f) => ({ ...f, smtp_password: "" }));
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    const to = (testTo || form.smtp_from_email).trim();
    if (!to) {
      toast({ title: "Recipient required", description: "Enter a test recipient.", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          to,
          subject: "Test email from Sharvi Vyapaar Portal (No Reply)",
          html: `<p>This is a test email sent using the No-Reply SMTP configuration.</p>`,
          suppressReplyTo: true,
        },
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any)?.error ?? "Send failed");
      toast({ title: "Test email sent", description: `Delivered to ${to}` });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading no-reply configuration…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          No Reply Email Configuration
        </CardTitle>
        <CardDescription>
          System sender used for vendor-related notifications (invitations, submission alerts, etc.).
          Vendors do not need their own SMTP credentials — outbound notifications go through this account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
          <div>
            <Label className="text-base font-semibold">Enable No-Reply Sending</Label>
            <p className="text-xs text-muted-foreground mt-1">
              When off, system notifications are not sent.
            </p>
          </div>
          <Switch
            checked={form.smtp_enabled}
            onCheckedChange={(v) => setForm((f) => ({ ...f, smtp_enabled: v }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              onChange={(e) => setForm((f) => ({ ...f, smtp_port: Number(e.target.value) }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Encryption</Label>
            <Select
              value={form.smtp_encryption}
              onValueChange={(v: any) => {
                const opt = ENCRYPTION_OPTIONS.find((o) => o.value === v);
                setForm((f) => ({
                  ...f,
                  smtp_encryption: v,
                  smtp_port: opt ? opt.port : f.smtp_port,
                }));
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
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              placeholder="noreply@example.com"
              value={form.smtp_username}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  smtp_username: e.target.value,
                  smtp_from_email: f.smtp_from_email || e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>
              App Password
              {hasExistingPassword && (
                <span className="text-xs text-muted-foreground ml-2">(leave empty to keep existing)</span>
              )}
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={hasExistingPassword ? "••••••••" : "App password"}
                value={form.smtp_password}
                onChange={(e) => setForm((f) => ({ ...f, smtp_password: e.target.value }))}
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
          <div className="space-y-2">
            <Label>From Email</Label>
            <Input
              placeholder="noreply@example.com"
              value={form.smtp_from_email}
              onChange={(e) => setForm((f) => ({ ...f, smtp_from_email: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>From Name</Label>
            <Input
              placeholder="Sharvi Vyapaar Portal — No Reply"
              value={form.smtp_from_name}
              onChange={(e) => setForm((f) => ({ ...f, smtp_from_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>CC Recipients (optional)</Label>
            <ReplyToChips
              value={form.smtp_reply_to}
              onChange={(v) => setForm((f) => ({ ...f, smtp_reply_to: v }))}
            />
            <p className="text-xs text-muted-foreground">
              Add one or more emails. Press Enter or comma after each. Every valid address here is CC'd on the buyer notification email. Invalid entries are skipped automatically.
            </p>
          </div>
        </div>

        <div className="flex gap-3 border rounded-lg p-4 bg-muted/30 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="space-y-1">
            <p>
              This account is the <span className="font-semibold">From</span> address for buyer notifications
              (e.g. when a vendor submits the registration form). The buyer is on <span className="font-semibold">To</span>;
              the addresses listed above are added as <span className="font-semibold">CC</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t">
          <div className="space-y-2 w-72">
            <Label className="text-xs">Send test to</Label>
            <Input
              placeholder="recipient@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSendTest} disabled={testing}>
              <Send className="h-4 w-4 mr-2" />
              {testing ? "Sending…" : "Send Test Email"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Configuration"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReplyToChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const emails = value
    ? value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parts = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...emails];
    let invalid: string | null = null;
    for (const p of parts) {
      if (!EMAIL_RE.test(p)) { invalid = p; continue; }
      if (next.some((e) => e.toLowerCase() === p.toLowerCase())) continue;
      next.push(p);
    }
    setError(invalid ? `Not a valid email: ${invalid}` : null);
    onChange(next.join(", "));
    setDraft("");
  };

  const remove = (email: string) => {
    onChange(emails.filter((e) => e !== email).join(", "));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 min-h-10 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
        {emails.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1 py-0.5"
          >
            {email}
            <button
              type="button"
              onClick={() => remove(email)}
              className="hover:bg-primary/20 rounded-full p-0.5"
              aria-label={`Remove ${email}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[140px] bg-transparent outline-none text-sm py-0.5"
          placeholder={emails.length === 0 ? "support@example.com" : "Add another…"}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
              if (draft.trim()) {
                e.preventDefault();
                commit(draft);
              }
            } else if (e.key === "Backspace" && !draft && emails.length) {
              remove(emails[emails.length - 1]);
            }
          }}
          onBlur={() => { if (draft.trim()) commit(draft); }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,;\s]/.test(text)) {
              e.preventDefault();
              commit(text);
            }
          }}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
