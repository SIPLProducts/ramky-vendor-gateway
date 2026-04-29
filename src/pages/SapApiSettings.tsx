import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Activity, Download, Upload, Plus, FileText, Link2, Trash2, Pencil,
} from "lucide-react";
import { SapConnectivityGuide } from "@/components/sap/SapConnectivityGuide";
import { AddSapApiConfigDialog } from "@/components/sap/AddSapApiConfigDialog";
import {
  useSapApiConfigs, useDeleteSapApiConfig, useTestSapConnection, useCreateSapApiConfig,
} from "@/hooks/useSapApiConfigs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

export default function SapApiSettings() {
  const navigate = useNavigate();
  const { data: configs, isLoading } = useSapApiConfigs();
  const del = useDeleteSapApiConfig();
  const test = useTestSapConnection();
  const create = useCreateSapApiConfig();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTest = async (id: string) => {
    try {
      const res = await test.mutateAsync(id);
      toast({
        title: res.ok ? "SAP connection OK" : "SAP connection failed",
        description: `${res.message}${res.latency_ms ? ` • ${res.latency_ms}ms` : ""}`,
        variant: res.ok ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(configs || [], null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sap-api-configs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Invalid file format");
      let imported = 0;
      for (const item of parsed) {
        const { id: _id, created_at: _c, updated_at: _u, ...rest } = item;
        await create.mutateAsync(rest);
        imported++;
      }
      toast({ title: `Imported ${imported} configurations` });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">SAP API Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure SAP API connections with dynamic field mappings
          </p>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          System Admin
        </Badge>
      </div>

      <Tabs defaultValue="configs" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="configs"><FileText className="h-4 w-4 mr-2" />API Configurations</TabsTrigger>
            <TabsTrigger value="guide"><Link2 className="h-4 w-4 mr-2" />SAP Connectivity Guide</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!configs?.length || test.isPending}
              onClick={() => configs?.[0] && handleTest(configs[0].id)}>
              <Activity className="h-4 w-4 mr-2" />Test SAP connection
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />Download PDF
            </Button>
          </div>
        </div>

        <TabsContent value="configs" className="space-y-4">
          <SapConnectivityGuide />

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />Export APIs
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />Import APIs
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => setShowAdd(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-2" />Add API Configuration
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="p-6 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">API Configurations</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your SAP API endpoints and their configurations
                </p>
              </div>
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : !configs?.length ? (
                <div className="p-12 text-center text-muted-foreground">
                  No API configurations yet. Click <strong>Add API Configuration</strong> to create one.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Auth</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/sap/api-settings/${c.id}`)}>
                        <TableCell>
                          <div className="font-semibold">{c.name}</div>
                          {c.connection_mode === "proxy" && (
                            <Badge variant="outline" className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              Proxy
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded block max-w-md truncate">
                            {c.endpoint_path || "—"}
                          </code>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{c.http_method}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.auth_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.last_synced_at ? new Date(c.last_synced_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => handleTest(c.id)} disabled={test.isPending}>
                            <Activity className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/sap/api-settings/${c.id}`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c.id)}>
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
        </TabsContent>

        <TabsContent value="guide">
          <SapConnectivityGuide />
        </TabsContent>
      </Tabs>

      <AddSapApiConfigDialog open={showAdd} onOpenChange={setShowAdd} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the SAP API configuration along with its field mappings and credentials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDelete) await del.mutateAsync(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
