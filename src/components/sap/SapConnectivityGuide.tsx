import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Monitor, Server } from "lucide-react";

export function SapConnectivityGuide() {
  return (
    <Card className="border-dashed border-2 bg-muted/30">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">How SAP Connection Works</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          All requests go through your <strong>Node.js middleware</strong> via its{" "}
          <code className="px-1 py-0.5 bg-muted rounded text-xs">POST /proxy</code> endpoint. The middleware URL is the{" "}
          <strong>base URL only</strong> (do not append <code className="px-1 py-0.5 bg-muted rounded text-xs">/proxy</code>).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border bg-background">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Lovable Cloud Preview</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                App → Backend Function → ngrok → local proxy → SAP
              </p>
              <p className="text-xs text-muted-foreground">
                → Set <strong>"Node.js Middleware URL"</strong> to your <strong>public ngrok URL</strong>
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">e.g. https://abc123.ngrok-free.app</p>
            </CardContent>
          </Card>

          <Card className="border bg-background">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Self-Hosted / Client Server</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Browser → internal middleware → SAP
              </p>
              <p className="text-xs text-muted-foreground">
                → Set <strong>"Node.js Middleware URL"</strong> to{" "}
                <code className="px-1 bg-muted rounded text-[11px]">http://host.docker.internal:3002</code>
              </p>
              <p className="text-[11px] text-muted-foreground">
                or <code className="px-1 bg-muted rounded">http://10.10.4.178:3002</code> (default port: 3002)
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">
          💡 Credentials are read from this page. The system tries multiple auth strategies automatically if SAP rejects the first attempt.
        </p>
        <p className="text-xs text-muted-foreground">
          🛠️ A ready-to-deploy proxy lives in the repo at{" "}
          <code className="px-1 py-0.5 bg-muted rounded text-[11px]">middleware/</code> — see{" "}
          <code className="px-1 py-0.5 bg-muted rounded text-[11px]">middleware/README.md</code> for setup, Docker, and ngrok instructions.
        </p>
      </CardContent>
    </Card>
  );
}
