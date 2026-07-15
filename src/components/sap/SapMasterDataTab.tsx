import { formatDateTime } from '@/lib/dateFormat';
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Database, RefreshCw, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  SAP_MASTER_TYPES, useSapMasterData, useUpsertSapMaster,
  useDeleteSapMaster, useRefreshSapMaster, type SapMasterRow,
} from "@/hooks/useSapMasterData";

export function SapMasterDataTab() {
  const [type, setType] = useState<string>("vendor_account_group");
  const { data: rows, isLoading } = useSapMasterData(type);
  const refresh = useRefreshSapMaster();
  const del = useDeleteSapMaster();
  const upsert = useUpsertSapMaster();

  const [editing, setEditing] = useState<SapMasterRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">SAP Master Data (F4 Value Help)</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            These values populate dropdowns in the SAP sync screen. Refresh from SAP, or add/edit
            entries manually if SAP is not reachable from the cloud.
          </p>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Master Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-[260px] h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAP_MASTER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => refresh.mutate(type)}
              disabled={refresh.isPending}
            >
              {refresh.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Refreshing…</>
                : <><RefreshCw className="h-4 w-4 mr-2" />Refresh from SAP</>}
            </Button>
            <Button onClick={() => setCreating(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-2" />Add value
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : !rows?.length ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No values yet. Click <strong>Refresh from SAP</strong> or <strong>Add value</strong>.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.source === "sap" ? "default" : "secondary"}>
                        {r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(r.last_synced_at, '—')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditDialog
        open={creating || !!editing}
        row={editing}
        masterType={type}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={async (vals) => {
          await upsert.mutateAsync({
            id: editing?.id,
            master_type: type,
            code: vals.code,
            description: vals.description,
          });
          setEditing(null); setCreating(false);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this value?</AlertDialogTitle>
            <AlertDialogDescription>This will remove it from the dropdown.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (confirmDelete) await del.mutateAsync(confirmDelete);
              setConfirmDelete(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({
  open, row, masterType, onClose, onSave,
}: {
  open: boolean;
  row: SapMasterRow | null;
  masterType: string;
  onClose: () => void;
  onSave: (vals: { code: string; description: string }) => Promise<void>;
}) {
  const [code, setCode] = useState(row?.code || "");
  const [description, setDescription] = useState(row?.description || "");
  const [saving, setSaving] = useState(false);

  // reset when opened
  useState(() => {
    setCode(row?.code || "");
    setDescription(row?.description || "");
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{row ? "Edit value" : "Add value"} ({masterType})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 0001" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Vendor" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            disabled={!code.trim() || saving}
            onClick={async () => {
              setSaving(true);
              try { await onSave({ code: code.trim(), description: description.trim() }); }
              finally { setSaving(false); }
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
