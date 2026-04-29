import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Activity, Plus, FileText, Trash2, Pencil, ScanLine, ShieldCheck, FlaskConical,
} from "lucide-react";
import { KycLiveTestPanel } from "@/components/admin/KycLiveTestPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useKycApiProviders, useDeleteKycApiProvider, useTestKycApi, useCreateKycApiProvider,
} from "@/hooks/useKycApiConfigs";

const TEMPLATES: Array<{
  provider_name: string; display_name: string; category: "OCR" | "VALIDATION";
  base_url: string; endpoint_path: string; request_mode: string; file_field_name?: string;
  request_body_template: any;
}> = [
  { provider_name: "GST_OCR", display_name: "GST OCR", category: "OCR",
    base_url: "https://kyc-api.surepass.app", endpoint_path: "/api/v1/ocr/gst",
    request_mode: "multipart", file_field_name: "file", request_body_template: {} },
  { provider_name: "PAN_OCR", display_name: "PAN OCR", category: "OCR",
    base_url: "https://kyc-api.surepass.app", endpoint_path: "/api/v1/ocr/pan",
    request_mode: "multipart", file_field_name: "file", request_body_template: {} },
  { provider_name: "MSME", display_name: "MSME / Udyog Aadhaar", category: "VALIDATION",
    base_url: "https://kyc-api.surepass.app", endpoint_path: "/api/v1/corporate/udyog-aadhaar",
    request_mode: "json", request_body_template: { id_number: "{{msme}}" } },
  { provider_name: "BANK", display_name: "Bank Verification", category: "VALIDATION",
    base_url: "https://kyc-api.surepass.app", endpoint_path: "/api/v1/bank-verification/",
    request_mode: "json", request_body_template: { id_number: "{{account}}", ifsc: "{{ifsc}}", ifsc_details: true } },
];

export default function KycApiSettings() {
  const navigate = useNavigate();
  const { data: providers, isLoading } = useKycApiProviders();
  const del = useDeleteKycApiProvider();
  const test = useTestKycApi();
  const create = useCreateKycApiProvider();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [tab, setTab] = useState<"OCR" | "VALIDATION" | "TEST">("OCR");

  const filtered = (providers || []).filter((p) => p.category === tab);

  const handleTest = async (id: string) => {
    try {
      const r = await test.mutateAsync({ providerId: id });
      toast({
        title: r.ok ? "API call OK" : "API call failed",
        description: `${r.message || `HTTP ${r.status ?? "?"}`}${r.latency_ms ? ` • ${r.latency_ms}ms` : ""}`,
        variant: r.ok ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    }
  };

  const addFromTemplate = async (t: typeof TEMPLATES[number]) => {
    const created = await create.mutateAsync({
      provider_name: t.provider_name,
      display_name: t.display_name,
      category: t.category,
      base_url: t.base_url,
      endpoint_path: t.endpoint_path,
      request_mode: t.request_mode,
      file_field_name: t.file_field_name ?? null,
      request_body_template: t.request_body_template,
      execution_order: (providers?.length || 0) + 1,
    });
    if (created?.id) navigate(`/admin/kyc-api-settings/${created.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">KYC & Validation API Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure OCR and validation endpoints (GST, PAN, MSME, Bank) — URL, headers, payload and response mapping.
          </p>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          System Admin
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="OCR"><ScanLine className="h-4 w-4 mr-2" />OCR APIs</TabsTrigger>
            <TabsTrigger value="VALIDATION"><ShieldCheck className="h-4 w-4 mr-2" />Validation APIs</TabsTrigger>
            <TabsTrigger value="TEST"><FlaskConical className="h-4 w-4 mr-2" />Live Test</TabsTrigger>
          </TabsList>
          {tab !== "TEST" && (
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.filter((t) => t.category === tab).map((t) => (
                <Button key={t.provider_name} variant="outline" size="sm" onClick={() => addFromTemplate(t)}>
                  <Plus className="h-4 w-4 mr-1" />{t.display_name}
                </Button>
              ))}
            </div>
          )}
        </div>

        <TabsContent value="TEST" className="space-y-4">
          <KycLiveTestPanel />
        </TabsContent>

        {(tab === "OCR" || tab === "VALIDATION") && (
          <TabsContent value={tab} className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="p-6 border-b">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">
                      {tab === "OCR" ? "OCR API Configurations" : "Validation API Configurations"}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tab === "OCR"
                      ? "Document OCR endpoints used to extract data from uploaded files."
                      : "Identifier-based validation endpoints (GSTIN, PAN, MSME number, bank account)."}
                  </p>
                </div>
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : !filtered.length ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No {tab === "OCR" ? "OCR" : "validation"} APIs yet. Use a template above to add one.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Auth</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => (
                        <TableRow key={c.id} className="cursor-pointer"
                          onClick={() => navigate(`/admin/kyc-api-settings/${c.id}`)}>
                          <TableCell>
                            <div className="font-semibold">{c.display_name}</div>
                            <div className="text-xs text-muted-foreground">{c.provider_name}</div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded block max-w-md truncate">
                              {c.base_url}{c.endpoint_path}
                            </code>
                          </TableCell>
                          <TableCell><Badge variant="secondary">{c.http_method}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.request_mode}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.auth_type}</TableCell>
                          <TableCell>
                            <Badge variant={c.is_enabled ? "default" : "secondary"}>
                              {c.is_enabled ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" onClick={() => handleTest(c.id)} disabled={test.isPending}>
                              <Activity className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/kyc-api-settings/${c.id}`)}>
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
        )}
      </Tabs>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the API configuration along with its credentials.
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
